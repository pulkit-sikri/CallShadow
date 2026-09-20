import logging
import pytest
import numpy as np

from backend.ml.demo_adapter import DemoModeAdapter
from backend.ml.factory import get_voice_detector, reset_detector_instance

def test_demo_mode_adapter_predict():
    """Verify demo mode adapter produces valid predictions summing to 1.0 and sets is_demo_mode=True."""
    adapter = DemoModeAdapter()
    assert adapter.is_demo_mode is True

    # 16kHz audio sample (1 second)
    sample = np.random.normal(0, 0.1, 16000).astype(np.float32)
    pred = adapter.predict_chunk(sample, sample_rate=16000, chunk_index=0)

    assert pred.is_demo_mode is True
    assert 0.0 <= pred.ai_probability <= 1.0
    assert 0.0 <= pred.human_probability <= 1.0
    assert abs((pred.ai_probability + pred.human_probability) - 1.0) < 1e-4
    assert pred.classification in ["AI Generated", "Human Genuine"]
    assert "pitch_std" in pred.features

def test_factory_fallback_warning(caplog):
    """Verify factory triggers loud warning when loading missing model dir and returns DemoModeAdapter."""
    reset_detector_instance()

    with caplog.at_level(logging.ERROR):
        detector = get_voice_detector(model_dir="./non_existent_directory_xyz")

    assert detector.is_demo_mode is True
    assert "CRITICAL WARNING: TRAINED MODEL NOT FOUND OR FAILED TO LOAD!" in caplog.text
    reset_detector_instance()
