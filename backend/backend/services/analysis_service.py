import numpy as np
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from config.settings import settings
from backend.audio.ingest import load_audio_from_bytes
from backend.audio.preprocess import preprocess_audio
from backend.ml.factory import get_voice_detector
from backend.ml.aggregator import aggregate_chunk_predictions
from backend.models.database import AnalysisLog
from backend.models.schemas import ContextDataSchema
from backend.services.real_speaker_verifier import real_speaker_verifier
from backend.services.context_engine import ContextEngineInterface
from backend.services.trust_score_engine import compute_trust_score

logger = logging.getLogger("VoiceDetector.AnalysisService")

class AnalysisService:

    def analyze_audio_file(
        self,
        file_bytes: bytes,
        filename: str,
        speaker_id: Optional[str] = None,
        context_data: Optional[ContextDataSchema] = None,
        user_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Orchestrates full file analysis pipeline:
        1. Multi-format ingestion with FFmpeg fallback
        2. Shared preprocessing (mono -> 16kHz -> peak norm)
        3. Windowing into 3-second overlapping chunks
        4. ML/Heuristic chunk inference
        5. Prediction aggregation & explainability flag generation
        6. Three-layer risk fusion (Voice authenticity + Speaker verification + Context risk)
        7. Optional SQLite audit record saving with user ownership
        """
        logger.info(
            f"[ANALYSIS START]\n"
            f"  filename={filename}\n"
            f"  size_bytes={len(file_bytes)}\n"
            f"  user_id={user_id}"
        )

        # Step 1: Ingest
        raw_waveform, orig_sr = load_audio_from_bytes(file_bytes, filename)

        # Step 2: Shared Preprocessing
        waveform_16k, total_duration = preprocess_audio(
            raw_waveform,
            orig_sr=orig_sr,
            target_sr=settings.TARGET_SAMPLE_RATE
        )

        logger.info(
            f"[PREPROCESS]\n"
            f"  orig_sr={orig_sr}\n"
            f"  target_sr={settings.TARGET_SAMPLE_RATE}\n"
            f"  channels=1 (mono)\n"
            f"  duration={total_duration:.2f}s\n"
            f"  samples={len(waveform_16k)}"
        )

        detector = get_voice_detector()

        # Step 3: Rolling Window Chunking (3.0s window, 1.0s overlap -> step 2.0s)
        chunk_samples = int(settings.CHUNK_DURATION * settings.TARGET_SAMPLE_RATE)
        step_samples = int((settings.CHUNK_DURATION - settings.CHUNK_OVERLAP) * settings.TARGET_SAMPLE_RATE)
        if step_samples <= 0:
            step_samples = chunk_samples

        chunks_predictions = []
        num_samples = len(waveform_16k)

        if num_samples <= chunk_samples:
            # Single chunk for short audio clips
            pred = detector.predict_chunk(
                waveform_16k,
                sample_rate=settings.TARGET_SAMPLE_RATE,
                chunk_index=0,
                start_time=0.0
            )
            chunks_predictions.append(pred)
        else:
            chunk_idx = 0
            for start_idx in range(0, num_samples, step_samples):
                end_idx = min(start_idx + chunk_samples, num_samples)
                chunk_data = waveform_16k[start_idx:end_idx]

                # Skip tiny tail residual chunks (< 0.5s) unless it's the only one
                if len(chunk_data) < settings.TARGET_SAMPLE_RATE * 0.5 and len(chunks_predictions) > 0:
                    continue

                start_time = float(start_idx) / float(settings.TARGET_SAMPLE_RATE)
                pred = detector.predict_chunk(
                    chunk_data,
                    sample_rate=settings.TARGET_SAMPLE_RATE,
                    chunk_index=chunk_idx,
                    start_time=start_time
                )
                chunks_predictions.append(pred)
                chunk_idx += 1

                if end_idx >= num_samples:
                    break

        # Step 4: Layer 1 Aggregation
        summary = aggregate_chunk_predictions(
            chunks_predictions,
            is_demo_mode=detector.is_demo_mode
        )

        # Step 5: Layer 2 Speaker Verification & Layer 3 Context Evaluation -> Fusion
        speaker_result = None
        has_speaker_input = bool(speaker_id and str(speaker_id).strip())
        if has_speaker_input:
            speaker_result = real_speaker_verifier.verify_speaker(speaker_id.strip(), waveform_16k)

        has_context_input = bool(
            context_data and (
                context_data.transaction_value is not None or
                bool(context_data.claimed_identity and str(context_data.claimed_identity).strip()) or
                bool(context_data.caller_metadata) or
                bool(context_data.time_location_context and str(context_data.time_location_context).strip())
            )
        )

        ctx = context_data if context_data is not None else ContextDataSchema()
        context_result = ContextEngineInterface.evaluate_context(ctx)

        trust_score_result = compute_trust_score(
            ai_probability=summary["mean_ai_probability"],
            speaker_result=speaker_result,
            context_result=context_result,
            ai_threshold=settings.AI_THRESHOLD,
            has_speaker_input=has_speaker_input,
            has_context_input=has_context_input,
        )

        result = {
            "filename": filename,
            "duration_seconds": round(total_duration, 2),
            "overall_classification": summary["overall_classification"],
            "ai_probability": summary["ai_probability"],
            "human_probability": summary["human_probability"],
            "mean_ai_probability": summary["mean_ai_probability"],
            "median_ai_probability": summary["median_ai_probability"],
            "max_ai_probability": summary["max_ai_probability"],
            "overall_confidence": summary["overall_confidence"],
            "chunk_count": summary["chunk_count"],
            "explainability": summary["explainability"],
            "chunks": [c.model_dump() for c in chunks_predictions],
            "is_demo_mode": summary["is_demo_mode"],
            "trust_score": trust_score_result.model_dump()
        }

        logger.info(
            f"[RESULT]\n"
            f"  classification={result['overall_classification']}\n"
            f"  ai_probability={result['ai_probability']:.4f}\n"
            f"  human_probability={result['human_probability']:.4f}\n"
            f"  trust_score={trust_score_result.trust_score:.4f}\n"
            f"  verdict={trust_score_result.decision}\n"
            f"[ANALYSIS END]"
        )

        # Step 6: Save audit log to Database if session provided
        if db is not None:
            try:
                log_entry = AnalysisLog(
                    user_id=user_id,
                    filename=filename,
                    source_type="upload",
                    duration_seconds=round(total_duration, 2),
                    classification=summary["overall_classification"],
                    ai_probability=summary["ai_probability"],
                    human_probability=summary["human_probability"],
                    confidence=summary["overall_confidence"],
                    is_demo_mode=summary["is_demo_mode"]
                )
                db.add(log_entry)
                db.commit()
            except Exception as db_err:
                logger.warning(f"Failed to record analysis log in DB: {db_err}")

        return result

analysis_service = AnalysisService()
