import numpy as np
import logging
from backend.ml.base import VoiceDetector, ChunkPrediction
from backend.ml.features import extract_acoustic_features

logger = logging.getLogger("VoiceDetector.DemoAdapter")

class DemoModeAdapter(VoiceDetector):
    """
    Fallback acoustic heuristic detector.
    Used ONLY when the fine-tuned model checkpoint cannot be loaded.
    Always returns is_demo_mode = True.
    """

    def __init__(self):
        logger.warning("Initializing DemoModeAdapter (Heuristic Fallback Engine)")

    @property
    def is_demo_mode(self) -> bool:
        return True

    @property
    def model_name(self) -> str:
        return "Acoustic Heuristic Fallback (Demo Mode)"

    def predict_chunk(
        self,
        waveform_16k: np.ndarray,
        sample_rate: int = 16000,
        chunk_index: int = 0,
        start_time: float = 0.0
    ) -> ChunkPrediction:
        duration = len(waveform_16k) / float(sample_rate) if sample_rate > 0 else 0.0
        end_time = start_time + duration

        # Extract features
        features = extract_acoustic_features(waveform_16k, sample_rate)

        # Heuristic scoring logic:
        # Synthetic speech often exhibits unnatural monotonicity (low pitch std),
        # unnaturally static spectral centroids, or abnormal spectral flatness.
        score = 0.5  # Neutral baseline

        pitch_std = features.get("pitch_std", 0.0)
        centroid_ratio = features.get("spectral_centroid_std_ratio", 0.0)
        flatness = features.get("energy_flatness", 0.0)

        # Pitch monotonicity (unrealistically flat pitch contour)
        if pitch_std < 12.0 and pitch_std > 0.0:
            score += 0.22
        elif pitch_std > 35.0:
            score -= 0.15

        # Spectral variance
        if centroid_ratio < 0.25 and centroid_ratio > 0.0:
            score += 0.18
        elif centroid_ratio > 0.45:
            score -= 0.12

        # Energy / spectral flatness anomaly
        if flatness > 0.05:
            score += 0.15

        ai_prob = float(np.clip(score, 0.02, 0.98))
        human_prob = float(1.0 - ai_prob)

        classification = "AI Generated" if ai_prob >= 0.5 else "Human Genuine"
        confidence = float(max(ai_prob, human_prob))

        return ChunkPrediction(
            chunk_index=chunk_index,
            start_time=round(start_time, 2),
            end_time=round(end_time, 2),
            ai_probability=round(ai_prob, 4),
            human_probability=round(human_prob, 4),
            classification=classification,
            confidence=round(confidence, 4),
            features=features,
            is_demo_mode=True
        )
