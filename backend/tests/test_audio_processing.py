import os
import io
import pytest
import numpy as np
import soundfile as sf

from backend.audio.preprocess import preprocess_audio
from backend.audio.ingest import load_audio_from_bytes

def test_preprocess_audio_numerical_consistency():
    """
    Regression test for Section 4 bug: Verify upload and live-mic preprocessing
    produce numerically consistent output for identical input audio arrays.
    """
    sr = 44100
    duration_sec = 2.0
    t = np.linspace(0, duration_sec, int(sr * duration_sec))
    # Generate 44.1kHz stereo audio waveform
    stereo_wave = np.column_stack([
        0.5 * np.sin(2 * np.pi * 440 * t),
        0.5 * np.cos(2 * np.pi * 440 * t)
    ]).astype(np.float32)

    # 1. Simulate File Upload path
    file_wave_16k, file_dur = preprocess_audio(stereo_wave, orig_sr=sr, target_sr=16000)

    # 2. Simulate Live Mic path (mono float array converted from PCM16)
    mono_wave = np.mean(stereo_wave, axis=1)
    mic_wave_16k, mic_dur = preprocess_audio(mono_wave, orig_sr=sr, target_sr=16000)

    # Assert duration and sampling rate targets match
    assert abs(file_dur - mic_dur) < 1e-4
    assert len(file_wave_16k) == len(mic_wave_16k)

    # Assert peak amplitude is normalized to 1.0
    assert abs(np.max(np.abs(file_wave_16k)) - 1.0) < 1e-5
    assert abs(np.max(np.abs(mic_wave_16k)) - 1.0) < 1e-5

    # Assert maximum absolute difference between normalized signals is negligible
    max_diff = np.max(np.abs(file_wave_16k - mic_wave_16k))
    assert max_diff < 1e-4

def test_audio_format_decoding_wav():
    """Verify loading standard WAV bytes."""
    sr = 16000
    t = np.linspace(0, 1.0, sr)
    sine = 0.5 * np.sin(2 * np.pi * 440 * t)

    buf = io.BytesIO()
    sf.write(buf, sine.astype(np.float32), sr, format='WAV')
    wav_bytes = buf.getvalue()

    waveform, loaded_sr = load_audio_from_bytes(wav_bytes, "test.wav")
    assert loaded_sr == sr
    assert len(waveform) > 0
