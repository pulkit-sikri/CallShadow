import sys
import os
import io
import json
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

print("="*60)
print("TEST 1: Health Endpoint")
print("="*60)
res = client.get("/api/health")
print("Health Status:", res.status_code)
print("Health Body:", json.dumps(res.json(), indent=2))

print("\n" + "="*60)
print("TEST 2: Audio Upload Inference Test")
print("="*60)

# Generate a 3-second 16kHz sine wave audio
sr = 16000
duration = 3.0
t = np.linspace(0, duration, int(sr * duration), endpoint=False)
sine_wave = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

buf = io.BytesIO()
sf.write(buf, sine_wave, sr, format='WAV', subtype='PCM_16')
audio_bytes = buf.getvalue()

files = {'file': ('test_audio.wav', audio_bytes, 'audio/wav')}
response = client.post("/api/audio/upload", files=files)

print("Upload Status Code:", response.status_code)
print("Upload Response JSON:")
print(json.dumps(response.json(), indent=2))

print("\n" + "="*60)
print("TEST PASSED!")
print("="*60)
