"""
Backend-only standalone test script for direct Wav2Vec2 model inference.
Usage:
    python test_model_inference.py <audio_file_path>
    OR (run without arguments to test 3 synthetic & generated audio signals):
    python test_model_inference.py
"""

import sys
import os
import io
import json
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import settings
from backend.audio.ingest import load_audio_from_bytes
from backend.audio.preprocess import preprocess_audio
from backend.ml.factory import get_voice_detector, reset_detector_instance

def run_test_on_file(file_path: str):
    print("\n" + "="*70)
    print(f"TESTING AUDIO FILE: {file_path}")
    print("="*70)

    if not os.path.exists(file_path):
        print(f"ERROR: File not found at {file_path}")
        return

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    print(f"  Loaded {len(file_bytes)} raw bytes.")

    # Step 1: Preprocess
    raw_waveform, orig_sr = load_audio_from_bytes(file_bytes, os.path.basename(file_path))
    waveform_16k, total_duration = preprocess_audio(raw_waveform, orig_sr=orig_sr, target_sr=settings.TARGET_SAMPLE_RATE)

    print(f"  [PREPROCESS] Original SR: {orig_sr} Hz -> Resampled SR: 16000 Hz")
    print(f"  [PREPROCESS] Duration: {total_duration:.2f}s (Samples: {len(waveform_16k)})")

    # Step 2: Inference
    detector = get_voice_detector()
    if detector.is_demo_mode:
        print("  [WARN] Detector loaded in DEMO mode!")
    else:
        print(f"  [OK] Detector loaded: {detector.model_name}")

    pred = detector.predict_chunk(waveform_16k, sample_rate=settings.TARGET_SAMPLE_RATE)

    print(f"\n  [INFERENCE RESULTS]")
    print(f"    AI Probability   : {pred.ai_probability:.4f} ({pred.ai_probability * 100:.1f}%)")
    print(f"    Human Probability: {pred.human_probability:.4f} ({pred.human_probability * 100:.1f}%)")
    print(f"    Classification   : {pred.classification}")
    print(f"    Confidence       : {pred.confidence:.4f}")
    print(f"    Demo Mode        : {pred.is_demo_mode}")
    print("="*70)

def generate_test_audios():
    os.makedirs("scratch", exist_ok=True)
    sr = 16000

    # Signal A: 440 Hz Sine wave (Simple pure tone)
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    sine_wave = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    path_a = os.path.join("scratch", "test_sine_440hz.wav")
    sf.write(path_a, sine_wave, sr, format='WAV', subtype='PCM_16')

    # Signal B: 880 Hz High-pitch Sine wave with harmonic overtone
    harmonic_wave = (0.4 * np.sin(2 * np.pi * 880 * t) + 0.3 * np.sin(2 * np.pi * 1760 * t)).astype(np.float32)
    path_b = os.path.join("scratch", "test_harmonic_880hz.wav")
    sf.write(path_b, harmonic_wave, sr, format='WAV', subtype='PCM_16')

    # Signal C: Filtered White Noise (simulated unmodulated acoustic noise)
    noise = (0.2 * np.random.randn(int(sr * 3.0))).astype(np.float32)
    path_c = os.path.join("scratch", "test_noise.wav")
    sf.write(path_c, noise, sr, format='WAV', subtype='PCM_16')

    return [path_a, path_b, path_c]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        run_test_on_file(target)
    else:
        print("No audio file argument provided. Generating 3 distinct test audio signals in scratch/...")
        test_files = generate_test_audios()
        reset_detector_instance()
        for f in test_files:
            run_test_on_file(f)
