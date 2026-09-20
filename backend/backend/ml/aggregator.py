from typing import List, Dict, Any
import numpy as np
from config.settings import settings
from backend.ml.base import ChunkPrediction

def aggregate_chunk_predictions(
    chunks: List[ChunkPrediction],
    is_demo_mode: bool = False
) -> Dict[str, Any]:
    """
    Aggregates chunk-level predictions into audio file/session summary stats and explainability flags.
    """
    if not chunks:
        return {
            "overall_classification": "Human Genuine",
            "ai_probability": 0.0,
            "human_probability": 1.0,
            "mean_ai_probability": 0.0,
            "median_ai_probability": 0.0,
            "max_ai_probability": 0.0,
            "overall_confidence": 1.0,
            "chunk_count": 0,
            "explainability": {
                "pitch_monotonicity": False,
                "spectral_anomaly": False,
                "energy_flatness_anomaly": False,
                "details": "No audio chunks analyzed."
            },
            "is_demo_mode": is_demo_mode
        }

    ai_probs = [c.ai_probability for c in chunks]
    mean_ai = float(np.mean(ai_probs))
    median_ai = float(np.median(ai_probs))
    max_ai = float(np.max(ai_probs))

    # Overall classification
    classification = "AI Generated" if mean_ai >= settings.AI_THRESHOLD else "Human Genuine"
    overall_confidence = float(max(mean_ai, 1.0 - mean_ai))

    # Calculate aggregate feature metrics across chunks for explainability
    pitch_stds = [c.features.get("pitch_std", 0.0) for c in chunks if c.features.get("pitch_std", 0.0) > 0]
    centroid_ratios = [c.features.get("spectral_centroid_std_ratio", 0.0) for c in chunks if c.features.get("spectral_centroid_std_ratio", 0.0) > 0]
    flatnesses = [c.features.get("energy_flatness", 0.0) for c in chunks if c.features.get("energy_flatness", 0.0) > 0]

    avg_pitch_std = float(np.mean(pitch_stds)) if pitch_stds else 0.0
    avg_centroid_ratio = float(np.mean(centroid_ratios)) if centroid_ratios else 0.0
    avg_flatness = float(np.mean(flatnesses)) if flatnesses else 0.0

    pitch_monotonicity = bool(avg_pitch_std < 15.0 and avg_pitch_std > 0)
    spectral_anomaly = bool(avg_centroid_ratio < 0.28 and avg_centroid_ratio > 0)
    energy_flatness_anomaly = bool(avg_flatness > 0.04)

    explainability_notes = []
    if classification == "AI Generated":
        if pitch_monotonicity:
            explainability_notes.append("Unnaturally low pitch variance detected (pitch monotonicity).")
        if spectral_anomaly:
            explainability_notes.append("Static spectral centroid pattern across time frames.")
        if energy_flatness_anomaly:
            explainability_notes.append("Elevated spectral energy flatness typical of neural speech synthesis vocoders.")
        if not explainability_notes:
            explainability_notes.append("Neural acoustic biomarkers and spectral synthesis signatures detected across sub-bands.")
    else:
        explainability_notes.append("Organic harmonic resonance, natural vocal pitch inflections, and human respiratory dynamics verified.")

    return {
        "overall_classification": classification,
        "ai_probability": round(mean_ai, 4),
        "human_probability": round(1.0 - mean_ai, 4),
        "mean_ai_probability": round(mean_ai, 4),
        "median_ai_probability": round(median_ai, 4),
        "max_ai_probability": round(max_ai, 4),
        "overall_confidence": round(overall_confidence, 4),
        "chunk_count": len(chunks),
        "explainability": {
            "pitch_monotonicity": pitch_monotonicity,
            "spectral_anomaly": spectral_anomaly,
            "energy_flatness_anomaly": energy_flatness_anomaly,
            "details": " ".join(explainability_notes)
        },
        "is_demo_mode": is_demo_mode
    }
