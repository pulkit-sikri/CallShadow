from typing import Tuple
import numpy as np
import scipy.signal
import logging

logger = logging.getLogger("VoiceDetector.AudioPreprocess")

def preprocess_audio(waveform: np.ndarray, orig_sr: int, target_sr: int = 16000) -> Tuple[np.ndarray, float]:
    """
    Shared, authoritative audio preprocessing pipeline for training, upload, and live stream.
    
    Steps:
    1. Mono conversion (average across channels if 2D)
    2. Resampling to target_sr (16000 Hz)
    3. Peak amplitude normalization (-1.0 to 1.0)
    
    Returns:
        (waveform_16k, duration_seconds)
    """
    if waveform is None or len(waveform) == 0:
        return np.zeros(target_sr, dtype=np.float32), 1.0

    # Ensure float32 format
    waveform = np.asarray(waveform, dtype=np.float32)

    # 1. Mono conversion
    if waveform.ndim > 1:
        # If shape is (channels, samples) where channels < samples
        if waveform.shape[0] < waveform.shape[1]:
            waveform = np.mean(waveform, axis=0)
        else:
            waveform = np.mean(waveform, axis=1)

    # Flatten array
    waveform = waveform.flatten()

    # 2. Resampling to 16000 Hz
    if orig_sr != target_sr and orig_sr > 0:
        try:
            # Calculate GCD for exact rational resampling factor
            gcd = np.gcd(int(orig_sr), int(target_sr))
            up = int(target_sr // gcd)
            down = int(orig_sr // gcd)
            waveform = scipy.signal.resample_poly(waveform, up, down).astype(np.float32)
        except Exception as e:
            logger.warning(f"resample_poly failed ({e}), falling back to linear interpolation")
            num_samples = int(round(len(waveform) * float(target_sr) / orig_sr))
            x_old = np.linspace(0, 1, len(waveform))
            x_new = np.linspace(0, 1, num_samples)
            waveform = np.interp(x_new, x_old, waveform).astype(np.float32)

    # 3. Peak Amplitude Normalization
    max_val = np.max(np.abs(waveform))
    if max_val > 1e-7:
        waveform = waveform / max_val
    else:
        waveform = np.zeros_like(waveform)

    duration = float(len(waveform)) / float(target_sr)
    return waveform, duration
