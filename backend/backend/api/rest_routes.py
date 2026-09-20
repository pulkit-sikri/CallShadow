import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.settings import settings
from backend.audio.ingest import load_audio_from_bytes
from backend.audio.preprocess import preprocess_audio
from backend.ml.factory import get_voice_detector
from backend.models.schemas import HealthResponse, UploadResponse, SpeakerVerificationResult, ContextDataSchema
from backend.models.database import get_db, AnalysisLog, User
from backend.services.auth_service import get_optional_current_user
from backend.services.analysis_service import analysis_service
from backend.services.real_speaker_verifier import real_speaker_verifier

logger = logging.getLogger("VoiceDetector.RESTRoutes")
router = APIRouter(prefix="/api")

@router.get("/health", response_model=HealthResponse)
def health_check():
    """
    Returns server health, active model details, and prominent is_demo_mode flag.
    """
    detector = get_voice_detector()

    msg = None
    if detector.is_demo_mode:
        msg = "🚨 WARNING: Running in Demo Heuristic Fallback Mode! Real fine-tuned checkpoint not loaded."

    return HealthResponse(
        status="ok",
        model_name=detector.model_name,
        model_version=settings.APP_VERSION,
        is_demo_mode=detector.is_demo_mode,
        sample_rate=settings.TARGET_SAMPLE_RATE,
        threshold=settings.CLASSIFICATION_THRESHOLD,
        message=msg
    )

@router.post("/audio/upload", response_model=UploadResponse)
async def upload_audio_file(
    file: UploadFile = File(...),
    speaker_id: Optional[str] = Form(None),
    claimed_identity: Optional[str] = Form(None),
    transaction_value: Optional[float] = Form(None),
    caller_metadata: Optional[str] = Form(None),
    time_location_context: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts multi-format audio files and performs 3-layer deepfake and risk analysis.
    Optionally accepts speaker_id for speaker verification and context data parameters.
    Associates analysis record with authenticated user if logged in.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename missing from uploaded file payload."
        )

    logger.info(f"[ANALYSIS] Request received: filename={file.filename}, content_type={file.content_type}")
    logger.info(f"[ANALYSIS] User ID: {current_user.id if current_user else 'anonymous'}")

    try:
        content = await file.read()
        content_len = len(content) if content else 0
        logger.info(f"[ANALYSIS] Bytes received: {content_len}")

        if not content:
            logger.warning(f"[ANALYSIS][ERROR] Empty file uploaded: {file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty."
            )

        parsed_metadata = None
        if caller_metadata:
            try:
                parsed_metadata = json.loads(caller_metadata)
            except Exception:
                logger.warning(f"Failed to parse caller_metadata JSON: {caller_metadata}")

        context_data = ContextDataSchema(
            claimed_identity=claimed_identity,
            caller_metadata=parsed_metadata,
            transaction_value=transaction_value,
            time_location_context=time_location_context
        )

        user_id = current_user.id if current_user else None
        logger.info(f"[ANALYSIS] Invoking analysis pipeline for '{file.filename}'...")
        analysis_result = analysis_service.analyze_audio_file(
            file_bytes=content,
            filename=file.filename,
            speaker_id=speaker_id,
            context_data=context_data,
            user_id=user_id,
            db=db
        )
        logger.info(
            f"[ANALYSIS] Pipeline complete: classification={analysis_result.get('overall_classification')}, "
            f"ai_probability={analysis_result.get('ai_probability'):.4f}, "
            f"duration={analysis_result.get('duration_seconds')}s, "
            f"chunks={analysis_result.get('chunk_count')}"
        )
        return analysis_result

    except HTTPException:
        # Re-raise HTTP errors (400/422) without wrapping them in a 500
        raise
    except ValueError as val_err:
        logger.warning(f"[ANALYSIS][ERROR] ValueError for '{file.filename}': {val_err}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as exc:
        logger.error(f"[ANALYSIS][ERROR] Unexpected error for '{file.filename}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed for '{file.filename}': {str(exc)}"
        )

@router.post("/speaker/enroll")
async def enroll_speaker(
    file: UploadFile = File(...),
    speaker_id: str = Form(...)
):
    """
    Accepts audio file upload and speaker_id, pre-processes waveform to 16kHz,
    and registers the speaker's vocal embedding.
    """
    if not speaker_id or not speaker_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="speaker_id must be provided for enrollment."
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty."
            )

        raw_waveform, orig_sr = load_audio_from_bytes(content, file.filename or "enrollment.wav")
        waveform_16k, _ = preprocess_audio(
            raw_waveform,
            orig_sr=orig_sr,
            target_sr=settings.TARGET_SAMPLE_RATE
        )

        success = real_speaker_verifier.register_speaker(speaker_id.strip(), waveform_16k)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Speaker enrollment failed (verifier not ready or embedding failed)."
            )

        return {
            "success": True,
            "speaker_id": speaker_id.strip(),
            "message": f"Successfully enrolled voiceprint for speaker '{speaker_id.strip()}'."
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error during speaker enrollment: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enroll speaker: {str(exc)}"
        )

@router.post("/speaker/verify", response_model=SpeakerVerificationResult)
async def verify_speaker_endpoint(
    file: UploadFile = File(...),
    speaker_id: str = Form(...)
):
    """
    Accepts audio file upload and speaker_id, pre-processes waveform to 16kHz,
    and verifies whether the voice matches the registered speaker embedding.
    """
    if not speaker_id or not speaker_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="speaker_id must be provided for verification."
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty."
            )

        raw_waveform, orig_sr = load_audio_from_bytes(content, file.filename or "verify.wav")
        waveform_16k, _ = preprocess_audio(
            raw_waveform,
            orig_sr=orig_sr,
            target_sr=settings.TARGET_SAMPLE_RATE
        )

        result = real_speaker_verifier.verify_speaker(speaker_id.strip(), waveform_16k)
        return result
    except Exception as exc:
        logger.error(f"Error during speaker verification: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify speaker: {str(exc)}"
        )

@router.get("/history")
def get_analysis_history(
    limit: int = 20,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns recent analysis audit logs from SQLite database.
    If authenticated, returns only records belonging to the current user.
    """
    query = db.query(AnalysisLog)
    if current_user:
        query = query.filter((AnalysisLog.user_id == current_user.id) | (AnalysisLog.user_id.is_(None)))

    logs = query.order_by(AnalysisLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "filename": log.filename,
            "source_type": log.source_type,
            "duration_seconds": log.duration_seconds,
            "classification": log.classification,
            "ai_probability": log.ai_probability,
            "human_probability": log.human_probability,
            "confidence": log.confidence,
            "is_demo_mode": log.is_demo_mode,
            "timestamp": log.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ") if log.timestamp else None
        }
        for log in logs
    ]
