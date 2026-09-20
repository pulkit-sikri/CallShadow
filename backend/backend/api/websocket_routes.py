import asyncio
import json
import logging
import numpy as np
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from config.settings import settings
from backend.audio.preprocess import preprocess_audio
from backend.ml.factory import get_voice_detector
from backend.ml.aggregator import aggregate_chunk_predictions
from backend.models.schemas import ContextDataSchema
from backend.models.database import SessionLocal, User
from backend.services.auth_service import auth_service
from backend.services.real_speaker_verifier import real_speaker_verifier
from backend.services.context_engine import ContextEngineInterface
from backend.services.trust_score_engine import compute_trust_score

logger = logging.getLogger("VoiceDetector.WebSocketRoutes")
router = APIRouter(prefix="/api")

@router.websocket("/audio/live")
async def websocket_live_mic(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    Live streaming WebSocket endpoint for real-time microphone classification.
    Handshake: reads actual browser/mobile audioContext.sampleRate payload, token, speaker_id, and context_data.
    Streams raw PCM16 binary audio chunks, resamples to 16kHz backend-side via preprocess_audio,
    and returns chunk predictions and final fused session summary in real time.
    """
    await websocket.accept()
    logger.info("WebSocket client connected to /api/audio/live")

    detector = get_voice_detector()

    # Authenticate user if token provided in query or handshake
    authenticated_user_id = None
    authenticated_user_email = None

    if token:
        db = SessionLocal()
        try:
            user = auth_service.get_user_from_token(db, token)
            if user:
                authenticated_user_id = user.id
                authenticated_user_email = user.email
                logger.info(f"WebSocket session authenticated via query token for {user.email} (ID: {user.id})")
        finally:
            db.close()

    # Handshake defaults
    client_sample_rate = 44100
    chunk_samples_threshold = int(client_sample_rate * settings.CHUNK_DURATION)
    speaker_id = None
    context_data = ContextDataSchema()
    handshake_processed = False

    accumulated_pcm_bytes = bytearray()
    full_session_pcm_bytes = bytearray()
    session_chunk_predictions = []
    chunk_counter = 0

    try:
        # Stream processing loop: handles both handshake (text), stop signals, and PCM16 audio (bytes)
        while True:
            message = await websocket.receive()

            if "text" in message:
                try:
                    payload = json.loads(message["text"])
                    msg_type = payload.get("type", "")

                    if msg_type == "stop":
                        logger.info("Received stop signal from WebSocket client")
                        break

                    # Process handshake text frame
                    if msg_type == "handshake" or "sample_rate" in payload:
                        if "sample_rate" in payload and payload["sample_rate"] > 0:
                            client_sample_rate = int(payload["sample_rate"])
                            chunk_samples_threshold = int(client_sample_rate * settings.CHUNK_DURATION)
                            logger.info(f"Handshake processed: client sampleRate = {client_sample_rate} Hz (threshold = {chunk_samples_threshold} samples / 3.0s)")

                        if "token" in payload and payload["token"] and not authenticated_user_id:
                            db = SessionLocal()
                            try:
                                user = auth_service.get_user_from_token(db, payload["token"])
                                if user:
                                    authenticated_user_id = user.id
                                    authenticated_user_email = user.email
                                    logger.info(f"WebSocket session authenticated via handshake token for {user.email}")
                            finally:
                                db.close()

                        if "speaker_id" in payload and payload["speaker_id"]:
                            speaker_id = str(payload["speaker_id"])

                        if "context_data" in payload and isinstance(payload["context_data"], dict):
                            context_data = ContextDataSchema(**payload["context_data"])

                        handshake_processed = True
                        await websocket.send_json({
                            "type": "handshake_ack",
                            "status": "connected",
                            "authenticated": bool(authenticated_user_id),
                            "user_email": authenticated_user_email,
                            "target_sample_rate": settings.TARGET_SAMPLE_RATE,
                            "is_demo_mode": detector.is_demo_mode
                        })
                except Exception as txt_err:
                    logger.warning(f"Error handling WebSocket text frame: {txt_err}")

            elif "bytes" in message:
                chunk_bytes = message["bytes"]
                if not chunk_bytes:
                    continue

                accumulated_pcm_bytes.extend(chunk_bytes)
                full_session_pcm_bytes.extend(chunk_bytes)

                # Check if we have accumulated 3 seconds of PCM16 (2 bytes per sample)
                bytes_per_chunk = chunk_samples_threshold * 2
                if len(accumulated_pcm_bytes) >= bytes_per_chunk:
                    # Extract 3-second PCM16 chunk
                    chunk_buffer = bytes(accumulated_pcm_bytes[:bytes_per_chunk])

                    # Slide buffer with overlap (keep last 1 second = client_sample_rate * 2 bytes)
                    overlap_bytes = int(client_sample_rate * settings.CHUNK_OVERLAP) * 2
                    accumulated_pcm_bytes = accumulated_pcm_bytes[bytes_per_chunk - overlap_bytes:]

                    # Convert raw PCM16 bytes to float32 numpy array [-1.0, 1.0]
                    pcm16_arr = np.frombuffer(chunk_buffer, dtype=np.int16)
                    float32_arr = pcm16_arr.astype(np.float32) / 32768.0

                    # Standardized backend preprocessing (resample to 16kHz & peak normalize)
                    waveform_16k, duration = preprocess_audio(
                        float32_arr,
                        orig_sr=client_sample_rate,
                        target_sr=settings.TARGET_SAMPLE_RATE
                    )

                    start_time = float(chunk_counter) * (settings.CHUNK_DURATION - settings.CHUNK_OVERLAP)

                    # Non-blocking async prediction on worker thread
                    pred = await asyncio.to_thread(
                        detector.predict_chunk,
                        waveform_16k,
                        sample_rate=settings.TARGET_SAMPLE_RATE,
                        chunk_index=chunk_counter,
                        start_time=start_time
                    )

                    session_chunk_predictions.append(pred)
                    chunk_counter += 1

                    # Send chunk event to client immediately
                    await websocket.send_json({
                        "type": "chunk_result",
                        "chunk_index": pred.chunk_index,
                        "start_time": pred.start_time,
                        "end_time": pred.end_time,
                        "ai_probability": pred.ai_probability,
                        "human_probability": pred.human_probability,
                        "classification": pred.classification,
                        "confidence": pred.confidence,
                        "is_demo_mode": pred.is_demo_mode
                    })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}", exc_info=True)

    # Step 3: Process remaining tail buffer and send final Session Summary
    if len(accumulated_pcm_bytes) >= 1600:  # at least ~0.05s remaining
        try:
            pcm16_arr = np.frombuffer(bytes(accumulated_pcm_bytes), dtype=np.int16)
            float32_arr = pcm16_arr.astype(np.float32) / 32768.0
            waveform_16k, _ = preprocess_audio(
                float32_arr,
                orig_sr=client_sample_rate,
                target_sr=settings.TARGET_SAMPLE_RATE
            )
            start_time = float(chunk_counter) * (settings.CHUNK_DURATION - settings.CHUNK_OVERLAP)
            pred = await asyncio.to_thread(
                detector.predict_chunk,
                waveform_16k,
                sample_rate=settings.TARGET_SAMPLE_RATE,
                chunk_index=chunk_counter,
                start_time=start_time
            )
            session_chunk_predictions.append(pred)
        except Exception:
            pass

    # Send aggregate session summary
    summary = aggregate_chunk_predictions(session_chunk_predictions, is_demo_mode=detector.is_demo_mode)
    total_dur = len(session_chunk_predictions) * (settings.CHUNK_DURATION - settings.CHUNK_OVERLAP) + settings.CHUNK_OVERLAP

    # Layer 2 Speaker Verification & Layer 3 Context Risk Fusion
    speaker_result = None
    if speaker_id and len(full_session_pcm_bytes) > 0:
        try:
            pcm16_full = np.frombuffer(bytes(full_session_pcm_bytes), dtype=np.int16)
            float32_full = pcm16_full.astype(np.float32) / 32768.0
            waveform_16k_full, _ = preprocess_audio(
                float32_full,
                orig_sr=client_sample_rate,
                target_sr=settings.TARGET_SAMPLE_RATE
            )
            logger.info(f"Running session-end Layer 2 speaker verification for '{speaker_id}' across {len(waveform_16k_full)/16000:.2f}s accumulated audio...")
            speaker_result = real_speaker_verifier.verify_speaker(speaker_id, waveform_16k_full)
            logger.info(f"Live mic speaker verification result: verified={speaker_result.verified}, score={speaker_result.similarity_score}, msg='{speaker_result.message}'")
        except Exception as sv_err:
            logger.warning(f"Live mic speaker verification failed: {sv_err}")

    has_speaker_input = bool(speaker_id and str(speaker_id).strip())
    has_context_input = bool(
        context_data and (
            context_data.transaction_value is not None or
            bool(context_data.claimed_identity and str(context_data.claimed_identity).strip()) or
            bool(context_data.caller_metadata) or
            bool(context_data.time_location_context and str(context_data.time_location_context).strip())
        )
    )

    context_result = ContextEngineInterface.evaluate_context(context_data)
    trust_score_result = compute_trust_score(
        ai_probability=summary["mean_ai_probability"],
        speaker_result=speaker_result,
        context_result=context_result,
        ai_threshold=settings.AI_THRESHOLD,
        has_speaker_input=has_speaker_input,
        has_context_input=has_context_input,
    )

    try:
        await websocket.send_json({
            "type": "session_summary",
            "total_chunks": len(session_chunk_predictions),
            "total_duration_seconds": round(total_dur, 2),
            "overall_classification": summary["overall_classification"],
            "ai_probability": summary["ai_probability"],
            "human_probability": summary["human_probability"],
            "mean_ai_probability": summary["mean_ai_probability"],
            "median_ai_probability": summary["median_ai_probability"],
            "max_ai_probability": summary["max_ai_probability"],
            "overall_confidence": summary["overall_confidence"],
            "explainability": summary["explainability"],
            "is_demo_mode": summary["is_demo_mode"],
            "trust_score": trust_score_result.model_dump()
        })
        await websocket.close()
    except Exception:
        pass
