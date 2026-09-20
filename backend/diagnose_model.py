"""
Diagnostic script: full inference pipeline probe for SIH_MVP voice deepfake detector.
Run from c:\Projects\SIH_MVP\ with the venv activated.

Usage:
    python diagnose_model.py

Reports:
  - Which adapter (Trained vs Demo) is actually loaded
  - Model architecture and label mapping
  - Raw logits and softmax probabilities
  - Preprocessing values (shape, dtype, sample rate, normalization)
"""

import sys
import os
import json
import logging
import numpy as np

# Make sure the project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.WARNING, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
logger = logging.getLogger("DIAGNOSE")

# ─── Step 1: Load settings ────────────────────────────────────────────────────
print("\n" + "="*70)
print("STEP 1: Settings")
print("="*70)
from config.settings import settings
print(f"  MODEL_DIR          : {settings.MODEL_DIR}")
print(f"  TARGET_SAMPLE_RATE : {settings.TARGET_SAMPLE_RATE}")
print(f"  AI_THRESHOLD       : {settings.AI_THRESHOLD}")
print(f"  CHUNK_DURATION     : {settings.CHUNK_DURATION}")

# ─── Step 2: Check model directory ───────────────────────────────────────────
print("\n" + "="*70)
print("STEP 2: Model Directory Check")
print("="*70)
model_dir = settings.MODEL_DIR
abs_model_dir = os.path.abspath(model_dir)
print(f"  Resolved path      : {abs_model_dir}")
print(f"  Exists             : {os.path.exists(abs_model_dir)}")
if os.path.exists(abs_model_dir):
    files = os.listdir(abs_model_dir)
    print(f"  Contents           : {files}")
    for f in files:
        fpath = os.path.join(abs_model_dir, f)
        size_mb = os.path.getsize(fpath) / 1e6
        print(f"    {f}: {size_mb:.2f} MB")

# ─── Step 3: Read config.json label mapping ───────────────────────────────────
print("\n" + "="*70)
print("STEP 3: Model config.json label mapping")
print("="*70)
cfg_path = os.path.join(abs_model_dir, "config.json")
if os.path.exists(cfg_path):
    with open(cfg_path) as f:
        cfg = json.load(f)
    print(f"  architectures : {cfg.get('architectures')}")
    print(f"  num_labels    : {cfg.get('num_labels', 'NOT SET')}")
    print(f"  id2label      : {cfg.get('id2label')}")
    print(f"  label2id      : {cfg.get('label2id')}")
    print(f"  model_type    : {cfg.get('model_type')}")
else:
    print("  config.json NOT FOUND!")

# ─── Step 4: Read preprocessor_config.json ───────────────────────────────────
print("\n" + "="*70)
print("STEP 4: Preprocessor config")
print("="*70)
pre_path = os.path.join(abs_model_dir, "preprocessor_config.json")
if os.path.exists(pre_path):
    with open(pre_path) as f:
        pre = json.load(f)
    print(f"  feature_extractor_type : {pre.get('feature_extractor_type')}")
    print(f"  sampling_rate          : {pre.get('sampling_rate')}")
    print(f"  do_normalize           : {pre.get('do_normalize')}")
    print(f"  return_attention_mask  : {pre.get('return_attention_mask')}")
else:
    print("  preprocessor_config.json NOT FOUND!")

# ─── Step 5: Load detector via factory ──────────────────────────────────────
print("\n" + "="*70)
print("STEP 5: Detector Factory")
print("="*70)
from backend.ml.factory import get_voice_detector, reset_detector_instance
reset_detector_instance()
detector = get_voice_detector()
print(f"  Adapter class  : {type(detector).__name__}")
print(f"  model_name     : {detector.model_name}")
print(f"  is_demo_mode   : {detector.is_demo_mode}")

if detector.is_demo_mode:
    print("\n  *** CRITICAL: TrainedModelAdapter FAILED to load. Running in DEMO mode! ***")
    print("  This means ALL predictions are heuristic-based, NOT from the Wav2Vec2 model.")
    print("  The heuristic tends to score most speech as 'Human Genuine'.")
else:
    print("\n  TrainedModelAdapter loaded successfully.")

# ─── Step 6: Check model internals ───────────────────────────────────────────
if not detector.is_demo_mode:
    print("\n" + "="*70)
    print("STEP 6: Model Internals Inspection")
    print("="*70)
    m = detector.model
    print(f"  Model class           : {type(m).__name__}")
    print(f"  Config num_labels     : {m.config.num_labels}")
    print(f"  Config id2label       : {m.config.id2label}")
    print(f"  Config label2id       : {m.config.label2id}")
    
    try:
        proj_weight = m.projector.weight
        print(f"  projector.weight shape: {tuple(proj_weight.shape)}")
    except Exception as e:
        print(f"  projector: N/A ({e})")
    try:
        clf_weight = m.classifier.weight
        print(f"  classifier.weight shape: {tuple(clf_weight.shape)}")
    except Exception as e:
        print(f"  classifier: {e}")

# ─── Step 7: Direct torch inference — raw logits ────────────────────────────
if not detector.is_demo_mode:
    import torch

    print("\n" + "="*70)
    print("STEP 7: Direct torch inference — 440 Hz pure sine tone")
    print("="*70)
    sr = 16000
    tone_wave = np.sin(2 * np.pi * 440 * np.arange(sr * 3) / sr).astype(np.float32)
    print(f"  shape  : {tone_wave.shape}")
    print(f"  dtype  : {tone_wave.dtype}")
    print(f"  min    : {tone_wave.min():.4f}, max: {tone_wave.max():.4f}")

    inputs = detector.feature_extractor(
        tone_wave, sampling_rate=16000, return_tensors="pt", padding=True
    )
    input_values = inputs.input_values.to(detector.device)
    print(f"  input_values shape : {tuple(input_values.shape)}")
    print(f"  input_values stats : min={input_values.min().item():.4f}, max={input_values.max().item():.4f}, mean={input_values.mean().item():.6f}")

    with torch.no_grad():
        outputs = detector.model(input_values)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

    id2label = m.config.id2label
    print(f"\n  [MODEL] Raw logits          : {logits.cpu().numpy()[0].tolist()}")
    print(f"  [MODEL] Softmax probs       : {probs.tolist()}")
    print(f"  [MODEL] probs[0] ({id2label.get(0, id2label.get('0', 'UNKNOWN'))}) : {probs[0]:.6f}")
    print(f"  [MODEL] probs[1] ({id2label.get(1, id2label.get('1', 'UNKNOWN'))}) : {probs[1]:.6f}")
    print(f"  [MODEL] argmax class idx    : {int(np.argmax(probs))}")
    print(f"  [MODEL] AI threshold        : {settings.AI_THRESHOLD}")
    print(f"  [MODEL] Decision (probs[1] >= thresh): {'AI Generated' if probs[1] >= settings.AI_THRESHOLD else 'Human Genuine'}")

# ─── Step 8: Full pipeline test via analysis_service ─────────────────────────
print("\n" + "="*70)
print("STEP 8: End-to-end pipeline test via analysis_service")
print("="*70)
import io
import soundfile as sf

sr = 16000
# Use a 440 Hz sine tone as "synthetic-like" input
tone_wave = np.sin(2 * np.pi * 440 * np.arange(sr * 3) / sr).astype(np.float32)
buf = io.BytesIO()
sf.write(buf, tone_wave, sr, format='WAV', subtype='FLOAT')
wav_bytes = buf.getvalue()
print(f"  Synthetic WAV size : {len(wav_bytes)} bytes")

from backend.services.analysis_service import analysis_service
result = analysis_service.analyze_audio_file(
    file_bytes=wav_bytes,
    filename="diagnostic_tone.wav"
)

print(f"\n  [PIPELINE] overall_classification : {result['overall_classification']}")
print(f"  [PIPELINE] ai_probability         : {result['ai_probability']}")
print(f"  [PIPELINE] human_probability      : {result['human_probability']}")
print(f"  [PIPELINE] overall_confidence     : {result['overall_confidence']}")
print(f"  [PIPELINE] is_demo_mode           : {result['is_demo_mode']}")
print(f"  [PIPELINE] chunk_count            : {result['chunk_count']}")
print(f"  [PIPELINE] duration_seconds       : {result['duration_seconds']}")
print(f"\n  Full explainability: {json.dumps(result.get('explainability', {}), indent=2)}")

safe_keys = ['filename', 'duration_seconds', 'overall_classification', 'ai_probability',
             'human_probability', 'mean_ai_probability', 'median_ai_probability',
             'max_ai_probability', 'overall_confidence', 'chunk_count', 'is_demo_mode']
print(f"\n  Sanitized JSON response:")
print(json.dumps({k: result[k] for k in safe_keys if k in result}, indent=2))

print("\n" + "="*70)
print("DIAGNOSIS COMPLETE")
print("="*70)
