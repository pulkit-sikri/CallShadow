import io
import pytest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from main import app
from backend.api.auth_routes import limiter

app.state.limiter.enabled = False
limiter.enabled = False

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
    """Verify WS /api/audio/live handshake and binary PCM streaming.
    Must supply an allowed Origin header — origin enforcement is now active.
    """
    from config.settings import settings
    allowed_origin = list(settings.get_allowed_origins())[0]  # e.g. http://localhost:8000

    with client.websocket_connect("/api/audio/live", headers={"Origin": allowed_origin}) as websocket:
        # Handshake
        websocket.send_json({"sample_rate": 44100})
        ack = websocket.receive_json()
        assert ack["type"] == "handshake_ack"
        assert ack["authenticated"] is False  # anonymous connection from allowed origin

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
    """Verify /api/speaker/enroll and /api/speaker/verify require authentication and bind to current_user."""
    # 0. Anonymous attempts should get 401
    sr = 16000
    t = np.linspace(0, 1.5, int(sr * 1.5))
    sine_440 = 0.5 * np.sin(2 * np.pi * 440 * t)
    buf1 = io.BytesIO()
    sf.write(buf1, sine_440.astype(np.float32), sr, format='WAV')
    wav_bytes_speaker1 = buf1.getvalue()

    anon_enroll = client.post(
        "/api/speaker/enroll",
        data={"speaker_id": "anon_spk"},
        files={"file": ("enroll.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert anon_enroll.status_code == 401

    anon_verify = client.post(
        "/api/speaker/verify",
        data={"speaker_id": "anon_spk"},
        files={"file": ("verify.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert anon_verify.status_code == 401

    # Register User A and User B
    reg_a = client.post("/api/auth/register", json={
        "full_name": "Speaker User A",
        "email": "spk_a@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert reg_a.status_code in [200, 409]
    login_a = client.post("/api/auth/login", json={"email": "spk_a@example.com", "password": "Password123!"})
    token_a = login_a.json()["token"]

    reg_b = client.post("/api/auth/register", json={
        "full_name": "Speaker User B",
        "email": "spk_b@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert reg_b.status_code in [200, 409]
    login_b = client.post("/api/auth/login", json={"email": "spk_b@example.com", "password": "Password123!"})
    token_b = login_b.json()["token"]

    # 1. Enroll User A with 440Hz audio clip
    enroll_resp = client.post(
        "/api/speaker/enroll",
        headers={"Authorization": f"Bearer {token_a}"},
        data={"speaker_id": "Profile_A"},
        files={"file": ("enroll.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert enroll_resp.status_code == 200
    enroll_data = enroll_resp.json()
    assert enroll_data["success"] is True
    assert "embedding" not in enroll_data
    assert "embeddings" not in enroll_data

    # 2. Verify User A with same speaker audio -> verified == True
    verify_same_resp = client.post(
        "/api/speaker/verify",
        headers={"Authorization": f"Bearer {token_a}"},
        data={"speaker_id": "Profile_A"},
        files={"file": ("verify_same.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert verify_same_resp.status_code == 200
    vdata_same = verify_same_resp.json()
    assert vdata_same["verified"] is True
    assert "embedding" not in vdata_same
    assert "embeddings" not in vdata_same

    # 3. User B (not enrolled) verifying audio -> verified == False
    verify_user_b_resp = client.post(
        "/api/speaker/verify",
        headers={"Authorization": f"Bearer {token_b}"},
        data={"speaker_id": "Profile_B"},
        files={"file": ("verify_same.wav", wav_bytes_speaker1, "audio/wav")}
    )
    assert verify_user_b_resp.status_code == 200
    vdata_b = verify_user_b_resp.json()
    assert vdata_b["verified"] is False
    assert "No enrolled voiceprint found" in vdata_b["message"]

    # 4. User A verifying with different audio -> verified == False
    np.random.seed(42)
    different_audio = np.random.uniform(-0.5, 0.5, int(sr * 1.5))
    buf2 = io.BytesIO()
    sf.write(buf2, different_audio.astype(np.float32), sr, format='WAV')
    wav_bytes_different = buf2.getvalue()

    verify_diff_resp = client.post(
        "/api/speaker/verify",
        headers={"Authorization": f"Bearer {token_a}"},
        data={"speaker_id": "Profile_A"},
        files={"file": ("verify_diff.wav", wav_bytes_different, "audio/wav")}
    )
    assert verify_diff_resp.status_code == 200
    vdata_diff = verify_diff_resp.json()
    assert vdata_diff["verified"] is False


def test_history_endpoint_auth_and_isolation():
    """Verify /api/history strictly enforces auth (401 when anonymous) and per-user isolation."""
    # 1. Anonymous call must return 401
    clean_client = TestClient(app)
    anon_resp = clean_client.get("/api/history")
    assert anon_resp.status_code == 401

    # 2. Register two users
    client.post("/api/auth/register", json={
        "full_name": "History User 1",
        "email": "hist1@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    token1 = client.post("/api/auth/login", json={"email": "hist1@example.com", "password": "Password123!"}).json()["token"]

    client.post("/api/auth/register", json={
        "full_name": "History User 2",
        "email": "hist2@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    token2 = client.post("/api/auth/login", json={"email": "hist2@example.com", "password": "Password123!"}).json()["token"]

    # User 1 uploads an audio file
    sr = 16000
    t = np.linspace(0, 1.0, int(sr * 1.0))
    sine = 0.5 * np.sin(2 * np.pi * 440 * t)
    buf = io.BytesIO()
    sf.write(buf, sine.astype(np.float32), sr, format='WAV')
    wav_bytes = buf.getvalue()

    up1 = client.post(
        "/api/audio/upload",
        headers={"Authorization": f"Bearer {token1}"},
        files={"file": ("user1_file.wav", wav_bytes, "audio/wav")}
    )
    assert up1.status_code == 200

    # User 1 fetches history -> contains user1_file.wav
    hist1 = client.get("/api/history", headers={"Authorization": f"Bearer {token1}"}).json()
    filenames_1 = [h["filename"] for h in hist1]
    assert "user1_file.wav" in filenames_1

    # User 2 fetches history -> must NOT contain user1_file.wav
    hist2 = client.get("/api/history", headers={"Authorization": f"Bearer {token2}"}).json()
    filenames_2 = [h["filename"] for h in hist2]
    assert "user1_file.wav" not in filenames_2


def test_websocket_origin_validation():
    """Verify WS /api/audio/live rejects disallowed Origin header with close code 1008."""
    from starlette.websockets import WebSocketDisconnect
    # Bad Origin
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/audio/live", headers={"Origin": "http://evil-attacker.com"}) as ws:
            pass
    assert exc_info.value.code == 1008

    # Allowed Origin
    with client.websocket_connect("/api/audio/live", headers={"Origin": "http://localhost:8000"}) as ws:
        ws.send_json({"sample_rate": 44100})
        ack = ws.receive_json()
        assert ack["type"] == "handshake_ack"


def test_docs_and_openapi_disabled_in_production():
    """Verify /docs, /redoc, /openapi.json return 404 when DEBUG is False."""
    from config.settings import settings
    if not settings.DEBUG:
        r_docs = client.get("/docs")
        assert r_docs.status_code == 404
        r_redoc = client.get("/redoc")
        assert r_redoc.status_code == 404
        r_openapi = client.get("/openapi.json")
        assert r_openapi.status_code == 404


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
