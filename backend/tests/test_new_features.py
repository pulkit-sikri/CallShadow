import io
import os
import sys
import unittest

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "CallShadow", "backend")))

from fastapi.testclient import TestClient
from main import app
from backend.api.auth_routes import limiter
from config.settings import settings

app.state.limiter.enabled = False
limiter.enabled = False

client = TestClient(app)


def _make_wav(hz=440.0, duration=1.5, sr=16000):
    t = np.linspace(0, duration, int(sr * duration))
    wave = (0.5 * np.sin(2 * np.pi * hz * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, wave, sr, format="WAV")
    return buf.getvalue()


def _register_and_login(cl, email, name="Test User"):
    cl.post("/api/auth/register", json={
        "full_name": name,
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
    })
    resp = cl.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["token"]


class TestWebSocketOriginFromSettings(unittest.TestCase):
    """Part A.1 - WebSocket origin validation from env setting."""

    def test_allowed_origin_accepted(self):
        """A whitelisted origin must be accepted."""
        allowed = list(settings.get_allowed_origins())[0]
        with client.websocket_connect("/api/audio/live", headers={"Origin": allowed}) as ws:
            ws.send_json({"sample_rate": 44100})
            ack = ws.receive_json()
            self.assertEqual(ack["type"], "handshake_ack")

    def test_disallowed_origin_rejected_1008(self):
        """An origin not in ALLOWED_ORIGINS must be rejected with code 1008."""
        from starlette.websockets import WebSocketDisconnect
        with self.assertRaises(WebSocketDisconnect) as ctx:
            with client.websocket_connect(
                "/api/audio/live",
                headers={"Origin": "http://evil-attacker.io"}
            ) as ws:
                pass
        self.assertEqual(ctx.exception.code, 1008)

    def test_origin_list_from_settings(self):
        """settings.get_allowed_origins_set() must match ALLOWED_ORIGINS env var."""
        raw = settings.ALLOWED_ORIGINS or ""
        expected = {o.strip().lower() for o in raw.split(",") if o.strip()}
        self.assertEqual(settings.get_allowed_origins_set(), expected)

    def test_missing_origin_with_token_allowed(self):
        """Missing Origin + valid token: accepted even in production."""
        token = _register_and_login(client, "ws_origin_test@example.com", "WS Origin Tester")
        with client.websocket_connect(f"/api/audio/live?token={token}") as ws:
            ws.send_json({"sample_rate": 44100})
            ack = ws.receive_json()
            self.assertEqual(ack["type"], "handshake_ack")
            self.assertTrue(ack["authenticated"])

    def test_missing_origin_without_token_allowed_in_debug(self):
        """Missing Origin + no token: ALLOWED when DEBUG=True (dev convenience)."""
        if not settings.DEBUG:
            self.skipTest("Only relevant in DEBUG mode")
        with client.websocket_connect("/api/audio/live") as ws:
            ws.send_json({"sample_rate": 44100})
            ack = ws.receive_json()
            self.assertEqual(ack["type"], "handshake_ack")



class TestSpeakerEnrollUpsert(unittest.TestCase):
    """Part A.2 - Speaker enrollment upsert."""

    def setUp(self):
        self.token_a = _register_and_login(client, "enroll_upsert_a@example.com", "Enroll A")
        self.token_b = _register_and_login(client, "enroll_upsert_b@example.com", "Enroll B")
        self.wav_a = _make_wav(440.0)
        self.wav_b = _make_wav(880.0)

    def test_enroll_twice_leaves_exactly_one_voiceprint(self):
        """Re-enrolling must upsert (replace), not duplicate."""
        from backend.services.real_speaker_verifier import real_speaker_verifier
        from backend.models.database import SessionLocal, User

        r1 = client.post(
            "/api/speaker/enroll",
            headers={"Authorization": f"Bearer {self.token_a}"},
            files={"file": ("enroll1.wav", self.wav_a, "audio/wav")},
        )
        self.assertEqual(r1.status_code, 200)
        self.assertFalse(r1.json().get("upserted", True))

        r2 = client.post(
            "/api/speaker/enroll",
            headers={"Authorization": f"Bearer {self.token_a}"},
            files={"file": ("enroll2.wav", self.wav_a, "audio/wav")},
        )
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.json().get("upserted", False))

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == "enroll_upsert_a@example.com").first()
            bound_key = str(user.id)
        finally:
            db.close()

        keys = [k for k in real_speaker_verifier.registered_speakers if k == bound_key]
        self.assertEqual(len(keys), 1)

    def test_user_b_cannot_verify_against_user_a_voiceprint(self):
        """User B (not enrolled) must get clear not-enrolled error, not user A's result."""
        client.post(
            "/api/speaker/enroll",
            headers={"Authorization": f"Bearer {self.token_a}"},
            files={"file": ("enroll_a.wav", self.wav_a, "audio/wav")},
        )
        r = client.post(
            "/api/speaker/verify",
            headers={"Authorization": f"Bearer {self.token_b}"},
            files={"file": ("verify_b.wav", self.wav_a, "audio/wav")},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertFalse(data["verified"])
        self.assertIn("No enrolled voiceprint found", data["message"])

    def test_user_b_enroll_does_not_overwrite_user_a(self):
        """Enrolling User B must not touch User A's embedding."""
        from backend.services.real_speaker_verifier import real_speaker_verifier
        from backend.models.database import SessionLocal, User

        db = SessionLocal()
        try:
            user_a = db.query(User).filter(User.email == "enroll_upsert_a@example.com").first()
            bound_key_a = str(user_a.id)
        finally:
            db.close()

        client.post("/api/speaker/enroll",
            headers={"Authorization": f"Bearer {self.token_a}"},
            files={"file": ("enroll_a.wav", self.wav_a, "audio/wav")})
        emb_a_before = real_speaker_verifier.registered_speakers.get(bound_key_a).copy()

        client.post("/api/speaker/enroll",
            headers={"Authorization": f"Bearer {self.token_b}"},
            files={"file": ("enroll_b.wav", self.wav_b, "audio/wav")})

        emb_a_after = real_speaker_verifier.registered_speakers.get(bound_key_a)
        self.assertIsNotNone(emb_a_after)
        np.testing.assert_array_equal(emb_a_before, emb_a_after)


class TestBearerTokenAuth(unittest.TestCase):
    """Part A.3 - Bearer token authentication."""

    def test_bearer_token_for_me(self):
        token = _register_and_login(client, "bearer_test@example.com", "Bearer User")
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["email"], "bearer_test@example.com")

    def test_bearer_token_for_history(self):
        token = _register_and_login(client, "bearer_hist@example.com", "Bearer Hist")
        r = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.json(), list)

    def test_bearer_token_for_enroll(self):
        token = _register_and_login(client, "bearer_enroll@example.com", "Bearer Enroll")
        wav = _make_wav()
        r = client.post("/api/speaker/enroll",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.wav", wav, "audio/wav")})
        self.assertEqual(r.status_code, 200)

    def test_invalid_bearer_returns_401(self):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer notavalidtoken12345"})
        self.assertEqual(r.status_code, 401)

    def test_ws_bearer_via_query_param(self):
        token = _register_and_login(client, "ws_bearer@example.com", "WS Bearer")
        allowed = list(settings.get_allowed_origins())[0]
        with client.websocket_connect(f"/api/audio/live?token={token}",
                                       headers={"Origin": allowed}) as ws:
            ws.send_json({"sample_rate": 44100})
            ack = ws.receive_json()
            self.assertEqual(ack["type"], "handshake_ack")
            self.assertTrue(ack["authenticated"])


class TestProxyIPResolution(unittest.TestCase):
    """Part A.4 - TRUST_PROXY_HEADERS IP resolution."""

    def test_get_client_ip_ignores_xff_by_default(self):
        """When TRUST_PROXY_HEADERS=False, X-Forwarded-For is ignored."""
        from backend.api.auth_routes import get_client_ip
        from unittest.mock import MagicMock
        mock_request = MagicMock()
        mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        mock_request.client.host = "10.0.0.1"
        original = settings.TRUST_PROXY_HEADERS
        try:
            settings.__dict__["TRUST_PROXY_HEADERS"] = False
            result = get_client_ip(mock_request)
            self.assertEqual(result, "10.0.0.1")
        finally:
            settings.__dict__["TRUST_PROXY_HEADERS"] = original

    def test_get_client_ip_uses_xff_when_trust_enabled(self):
        """When TRUST_PROXY_HEADERS=True, first IP from X-Forwarded-For is used."""
        from backend.api.auth_routes import get_client_ip
        from unittest.mock import MagicMock
        mock_request = MagicMock()
        mock_request.headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        original = settings.TRUST_PROXY_HEADERS
        try:
            settings.__dict__["TRUST_PROXY_HEADERS"] = True
            result = get_client_ip(mock_request)
            self.assertEqual(result, "1.2.3.4")
        finally:
            settings.__dict__["TRUST_PROXY_HEADERS"] = original


if __name__ == "__main__":
    unittest.main()
