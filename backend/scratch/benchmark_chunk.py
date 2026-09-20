import time
import numpy as np
import torch
from backend.ml.factory import get_voice_detector
from backend.ml.features import extract_acoustic_features

detector = get_voice_detector()
dummy_wav = (0.5 * np.sin(2 * np.pi * 440 * np.linspace(0, 3, 48000))).astype(np.float32)

# Benchmark features alone
t0 = time.time()
feat = extract_acoustic_features(dummy_wav, 16000)
t1 = time.time()
print(f"extract_acoustic_features took: {(t1 - t0)*1000:.1f}ms")

# Benchmark full predict_chunk
t0 = time.time()
pred = detector.predict_chunk(dummy_wav, 16000, 0, 0.0)
t1 = time.time()
print(f"detector.predict_chunk took: {(t1 - t0)*1000:.1f}ms")
