import asyncio
import json
import logging
from collections import defaultdict
from typing import Optional, Dict, Set
import numpy as np
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

# Connection rate & concurrency tracking per IP
_active_ws_connections: Dict[str, int] = defaultdict(int)
_ws_connection_lock = asyncio.Lock()
MAX_WS_CONNECTIONS_PER_IP = 5
WS_IDLE_TIMEOUT_SECONDS = 30.0

def get_ws_client_ip(websocket: WebSocket) -> str:
    """
    Returns client IP address for WebSockets. If TRUST_PROXY_HEADERS is enabled,
    inspects the first IP in X-Forwarded-For; otherwise uses direct socket address.
    """
    if getattr(settings, "TRUST_PROXY_HEADERS", False):
        forwarded = websocket.headers.get("x-forwarded-for") or websocket.headers.get("X-Forwarded-For")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip
    return websocket.client.host if websocket.client else "unknown"

@router.websocket("/audio/live")
async def websocket_live_mic(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    Live streaming WebSocket endpoint for real-time microphone classification.
    Validates Origin header against settings.get_allowed_origins_set() before accept() (closing with 1008 on mismatch).
    Missing Origin is allowed if DEBUG=True, or if authenticated (for native mobile apps).
    Enforces proxy-aware per-IP connection limits and idle timeouts.
    Handshake: reads actual browser/mobile audioContext.sampleRate payload, token, speaker_id, and context_data.
    Streams raw PCM16 binary audio chunks, resamples to 16kHz backend-side via preprocess_audio,
    and returns chunk predictions and final fused session summary in real time.
    """
    # 1. Validate Origin header before accepting connection
    origin = websocket.headers.get("origin")
    allowed = settings.get_allowed_origins_set()

    if origin:
        if origin.strip().lower() not in allowed:
            logger.warning(f"WebSocket rejected: Origin '{origin}' not in configured ALLOWED_ORIGINS ({allowed})")
            await websocket.close(code=1008, reason="Policy Violation: Origin not allowed")
            return
    else:
        # Native mobile clients (React Native) send no Origin header.
        # Allow missing Origin in DEBUG mode, or in production if client provides a session token.
        has_auth = bool(token or websocket.cookies.get("session_token"))
        if not settings.DEBUG and not has_auth:
            logger.warning("WebSocket rejected: Missing Origin header for unauthenticated connection in production mode")
            await websocket.close(code=1008, reason="Policy Violation: Missing Origin header")
            return

    # 2. Enforce connection concurrency cap per client IP (proxy-aware)
    client_ip = get_ws_client_ip(websocket)
    async with _ws_connection_lock:
        if _active_ws_connections[client_ip] >= MAX_WS_CONNECTIONS_PER_IP:
            logger.warning(f"WebSocket rejected: IP {client_ip} exceeded connection limit ({MAX_WS_CONNECTIONS_PER_IP})")
            await websocket.close(code=1008, reason="Policy Violation: Connection limit exceeded")
            return
        _active_ws_connections[client_ip] += 1

    try:
        await websocket.accept()
        logger.info(f"WebSocket client connected to /api/audio/live from IP {client_ip}")

        detector = get_voice_detector()

        # Authenticate user if token provided in query, cookie, or handshake
        authenticated_user_id = None
        authenticated_user_email = None

        active_token = token or websocket.cookies.get("session_token")
        if active_token:
            db = SessionLocal()
            try:
                user = auth_service.get_user_from_token(db, active_token)
                if user:
                    authenticated_user_id = user.id
                    authenticated_user_email = user.email
                    logger.info(f"WebSocket session authenticated for {user.email} (ID: {user.id})")
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

        MAX_WS_MESSAGE_BYTES = 512 * 1024  # 512 KB max per frame
        MAX_WS_SESSION_BYTES = 50 * 1024 * 1024  # 50 MB cumulative session cap

        try:
            # Stream processing loop: handles both handshake (text), stop signals, and PCM16 audio (bytes)
            while True:
                try:
                    message = await asyncio.wait_for(websocket.receive(), timeout=WS_IDLE_TIMEOUT_SECONDS)
                except asyncio.TimeoutError:
                    logger.info(f"WebSocket idle timeout ({WS_IDLE_TIMEOUT_SECONDS}s) reached for client {client_ip}. Closing connection.")
                    await websocket.close(code=1000, reason="Session idle timeout")
                    return

                if "text" in message:
                    text_content = message["text"]
                    if len(text_content.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
                        logger.warning("WebSocket text frame exceeded size limit. Terminating session.")
                        await websocket.close(code=1009)
                        return

                    try:
                        payload = json.loads(text_content)
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

                    if len(chunk_bytes) > MAX_WS_MESSAGE_BYTES:
                        logger.warning("WebSocket binary audio frame exceeded maximum size limit. Terminating session.")
                        await websocket.close(code=1009)
                        return

                    accumulated_pcm_bytes.extend(chunk_bytes)
                    full_session_pcm_bytes.extend(chunk_bytes)

                    if len(full_session_pcm_bytes) > MAX_WS_SESSION_BYTES:
                        logger.warning("WebSocket session exceeded cumulative audio buffer limit (50MB). Terminating stream.")
                        break

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
                # If authenticated, use user's bound voiceprint profile
                lookup_key = str(authenticated_user_id) if authenticated_user_id and str(authenticated_user_id) in real_speaker_verifier.registered_speakers else speaker_id
                speaker_result = real_speaker_verifier.verify_speaker(lookup_key, waveform_16k_full)
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
    finally:
        async with _ws_connection_lock:
            if client_ip in _active_ws_connections:
                _active_ws_connections[client_ip] -= 1
                if _active_ws_connections[client_ip] <= 0:
                    del _active_ws_connections[client_ip]
