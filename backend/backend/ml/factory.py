import logging
from config.settings import settings
from backend.ml.base import VoiceDetector
from backend.ml.trained_adapter import TrainedModelAdapter
from backend.ml.demo_adapter import DemoModeAdapter

logger = logging.getLogger("VoiceDetector")

_detector_instance = None

def get_voice_detector(model_dir: str = None) -> VoiceDetector:
    """
    Factory function for obtaining the active VoiceDetector instance.
    Tries to load TrainedModelAdapter from model_dir (default: ./trained_model).
    If loading fails, outputs a loud unmissable warning and falls back to DemoModeAdapter.
    """
    global _detector_instance
    if _detector_instance is not None:
        return _detector_instance

    target_dir = model_dir or settings.MODEL_DIR

    try:
        adapter = TrainedModelAdapter(model_dir=target_dir)
        logger.info(f"Loaded TrainedModelAdapter from {target_dir}")
        _detector_instance = adapter
        return _detector_instance
    except Exception as err:
        warning_msg = (
            "\n"
            "🚨" * 35 + "\n"
            "🚨 CRITICAL WARNING: TRAINED MODEL NOT FOUND OR FAILED TO LOAD!\n"
            f"🚨 Attempted model path: '{target_dir}'\n"
            f"🚨 Reason: {err}\n"
            "🚨 FALLING BACK TO HEURISTIC DEMO MODE (is_demo_mode = True)!\n"
            "🚨 DO NOT MISTAKE HEURISTIC DEMO OUTPUT FOR REAL TRAINED MODEL INFERENCES!\n"
            "🚨 Train a real model with: python training/train_model.py\n"
            "🚨" * 35 + "\n"
        )
        logger.error(warning_msg)
        print(warning_msg)  # Print directly to stdout/console as well

        _detector_instance = DemoModeAdapter()
        return _detector_instance

def reset_detector_instance():
    """Resets singleton instance (useful for unit testing)."""
    global _detector_instance
    _detector_instance = None
