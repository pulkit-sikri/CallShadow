import io
import pytest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_health_endpoint():
    """Verify /api/health endpoint structure and is_demo_mode boolean."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "ok"
    assert "model_name" in data
    assert "is_demo_mode" in data
    assert isinstance(data["is_demo_mode"], bool)
    assert data["sample_rate"] == 16000

def test_upload_endpoint():
    """Verify /api/audio/upload endpoint processes uploaded wav file."""
    sr = 16000
    t = np.linspace(0, 1.5, int(sr * 1.5))
    sine = 0.5 * np.sin(2 * np.pi * 440 * t)

    buf = io.BytesIO()
    sf.write(buf, sine.astype(np.float32), sr, format='WAV')
    wav_bytes = buf.getvalue()

    response = client.post(
        "/api/audio/upload",
        files={"file": ("test_sine.wav", wav_bytes, "audio/wav")}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["filename"] == "test_sine.wav"
    assert data["overall_classification"] in ["AI Generated", "Human Genuine"]
    assert 0.0 <= data["ai_probability"] <= 1.0
    assert 0.0 <= data["human_probability"] <= 1.0
    assert "explainability" in data
    assert len(data["chunks"]) > 0

def test_websocket_live_stream():
    """Verify WS /api/audio/live handshake and binary PCM streaming."""
    with client.websocket_connect("/api/audio/live") as websocket:
        # Handshake
        websocket.send_json({"sample_rate": 44100})
        ack = websocket.receive_json()
        assert ack["type"] == "handshake_ack"

        # Send ~3 seconds of PCM16 audio (44100 * 3 * 2 bytes)
        pcm16_data = np.zeros(44100 * 3, dtype=np.int16).tobytes()
        websocket.send_bytes(pcm16_data)

        # Receive chunk result
        chunk_res = websocket.receive_json()
        assert chunk_res["type"] == "chunk_result"
        assert "ai_probability" in chunk_res

        # Send stop
        websocket.send_json({"type": "stop"})
        summary = websocket.receive_json()
        assert summary["type"] == "session_summary"
        assert "overall_classification" in summary
        assert "trust_score" in summary

def test_speaker_enroll_and_verify():
    """Verify /api/speaker/enroll and /api/speaker/verify endpoints with same and different audio clips."""
    sr = 16000
    t = np.linspace(0, 1.5, int(sr * 1.5))
    sine_440 = 0.5 * np.sin(2 * np.pi * 440 * t)

    buf1 = io.BytesIO()
    sf.write(buf1, sine_440.astype(np.float32), sr, format='WAV')
    wav_bytes_speaker1 = buf1.getvalue()

    # 1. Enroll speaker_1 with 440Hz audio clip
    enroll_resp = client.post(
        "/api/speaker/enroll",
        data={"speaker_id": "test_speaker_1"},
        files={"file": ("enroll.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert enroll_resp.status_code == 200
    enroll_data = enroll_resp.json()
    assert enroll_data["success"] is True

    # 2. Verify with same speaker audio -> verified == True
    verify_same_resp = client.post(
        "/api/speaker/verify",
        data={"speaker_id": "test_speaker_1"},
        files={"file": ("verify_same.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert verify_same_resp.status_code == 200
    vdata_same = verify_same_resp.json()
    assert vdata_same["registered_speaker_id"] == "test_speaker_1"
    assert vdata_same["verified"] is True

    # 3. Verify with genuinely different speaker audio (noise clip) -> verified == False
    np.random.seed(42)
    different_audio = np.random.uniform(-0.5, 0.5, int(sr * 1.5))
    buf2 = io.BytesIO()
    sf.write(buf2, different_audio.astype(np.float32), sr, format='WAV')
    wav_bytes_different = buf2.getvalue()

    verify_diff_resp = client.post(
        "/api/speaker/verify",
        data={"speaker_id": "test_speaker_1"},
        files={"file": ("verify_diff.wav", wav_bytes_different, "audio/wav")}
    )
    assert verify_diff_resp.status_code == 200
    vdata_diff = verify_diff_resp.json()
    assert vdata_diff["registered_speaker_id"] == "test_speaker_1"
    assert vdata_diff["verified"] is False


from unittest.mock import patch
from backend.ml.base import ChunkPrediction

def test_upload_with_context_and_trust_score():
    """Verify /api/audio/upload generates exact 3-layer TrustScoreResult decision values."""
    sr = 16000
    t = np.linspace(0, 1.5, int(sr * 1.5))
    sine = 0.5 * np.sin(2 * np.pi * 440 * t)

    buf = io.BytesIO()
    sf.write(buf, sine.astype(np.float32), sr, format='WAV')
    wav_bytes = buf.getvalue()

    # Mock Layer 1 detector to simulate human genuine audio (ai_prob = 0.1 < 0.7)
    with patch("backend.services.analysis_service.get_voice_detector") as mock_get_detector:
        mock_detector = mock_get_detector.return_value
        mock_detector.is_demo_mode = True
        mock_detector.predict_chunk.return_value = ChunkPrediction(
            chunk_index=0,
            start_time=0.0,
            end_time=1.5,
            ai_probability=0.1,
            human_probability=0.9,
            classification="Human Genuine",
            confidence=0.9,
            features={},
            is_demo_mode=True
        )

        # Case 1: Flagged context (high-value transaction + unusual hour) -> CONTEXT_RISK_STEP_UP
        response_flagged = client.post(
            "/api/audio/upload",
            data={
                "transaction_value": 15000.0,
                "time_location_context": "unusual_hour"
            },
            files={"file": ("test_sine.wav", wav_bytes, "audio/wav")}
        )
        assert response_flagged.status_code == 200
        data_flagged = response_flagged.json()
        assert "trust_score" in data_flagged
        ts_flagged = data_flagged["trust_score"]
        assert ts_flagged["decision"] == "STEP_UP_VERIFICATION_REQUIRED"

        # Case 2: Missing inputs (no speaker_id or context) -> STEP_UP_VERIFICATION_REQUIRED
        response_empty = client.post(
            "/api/audio/upload",
            files={"file": ("test_sine.wav", wav_bytes, "audio/wav")}
        )
        assert response_empty.status_code == 200
        data_empty = response_empty.json()
        assert "trust_score" in data_empty
        ts_empty = data_empty["trust_score"]
        assert ts_empty["decision"] == "STEP_UP_VERIFICATION_REQUIRED"
