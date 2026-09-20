import io
import os
import sys
import wave
import struct
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from main import app
from backend.models.database import SessionLocal, User, SessionToken, AnalysisLog

client = TestClient(app)

def generate_test_wav_bytes(duration_sec=3.0, sample_rate=16000):
    buf = io.BytesIO()
    num_samples = int(duration_sec * sample_rate)
    # Generate simple 440Hz tone
    t = np.linspace(0, duration_sec, num_samples, endpoint=False)
    samples = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
    
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())
    return buf.getvalue()

def run_tests():
    print("=== STARTING STAGE 2 INTEGRATION VERIFICATION ===")
    
    # 1. Register User A
    email_a = f"test_user_a_{int(np.random.randint(10000, 99999))}@callshadow.test"
    resp_reg_a = client.post("/api/auth/register", json={
        "full_name": "Test User Alpha",
        "email": email_a,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert resp_reg_a.status_code == 200, f"Register A failed: {resp_reg_a.text}"
    token_a = resp_reg_a.json()["token"]
    user_a_id = resp_reg_a.json()["user"]["id"]
    print(f"[PASS] 1. User A registered: {email_a} (ID: {user_a_id})")

    # 2. Register User B
    email_b = f"test_user_b_{int(np.random.randint(10000, 99999))}@callshadow.test"
    resp_reg_b = client.post("/api/auth/register", json={
        "full_name": "Test User Beta",
        "email": email_b,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert resp_reg_b.status_code == 200, f"Register B failed: {resp_reg_b.text}"
    token_b = resp_reg_b.json()["token"]
    user_b_id = resp_reg_b.json()["user"]["id"]
    print(f"[PASS] 2. User B registered: {email_b} (ID: {user_b_id})")

    # 3. Cross-Login User A
    resp_login_a = client.post("/api/auth/login", json={
        "email": email_a,
        "password": "Password123!"
    })
    assert resp_login_a.status_code == 200, f"Login A failed: {resp_login_a.text}"
    assert resp_login_a.json()["user"]["id"] == user_a_id
    print("[PASS] 3. Cross-client Login for User A successful.")

    # 4. User A Uploads Audio Sample
    wav_a = generate_test_wav_bytes(3.0)
    resp_upload_a = client.post(
        "/api/audio/upload",
        files={"file": ("user_a_call_sample.wav", wav_a, "audio/wav")},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_upload_a.status_code == 200, f"Upload A failed: {resp_upload_a.text}"
    data_a = resp_upload_a.json()
    assert "ai_probability" in data_a
    print(f"[PASS] 4. User A audio upload analyzed: {data_a['filename']}, AI Prob: {data_a['ai_probability']}")

    # 5. User B Uploads Audio Sample
    wav_b = generate_test_wav_bytes(3.0)
    resp_upload_b = client.post(
        "/api/audio/upload",
        files={"file": ("user_b_urgent_transfer.wav", wav_b, "audio/wav")},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp_upload_b.status_code == 200, f"Upload B failed: {resp_upload_b.text}"
    data_b = resp_upload_b.json()
    print(f"[PASS] 5. User B audio upload analyzed: {data_b['filename']}, AI Prob: {data_b['ai_probability']}")

    # 6. Verify User-Specific History Isolation
    hist_a = client.get("/api/history", headers={"Authorization": f"Bearer {token_a}"}).json()
    hist_b = client.get("/api/history", headers={"Authorization": f"Bearer {token_b}"}).json()

    filenames_a = [h["filename"] for h in hist_a]
    filenames_b = [h["filename"] for h in hist_b]

    assert "user_a_call_sample.wav" in filenames_a, f"User A missing their upload in {filenames_a}"
    assert "user_b_urgent_transfer.wav" not in filenames_a, f"User A leaked User B upload! {filenames_a}"

    assert "user_b_urgent_transfer.wav" in filenames_b, f"User B missing their upload in {filenames_b}"
    assert "user_a_call_sample.wav" not in filenames_b, f"User B leaked User A upload! {filenames_b}"
    print(f"[PASS] 6. History ownership isolation verified: User A has {len(hist_a)} items, User B has {len(hist_b)} items.")

    # 7. Verify Unauthenticated History does NOT leak private user uploads
    # Clear client cookie jar so it's truly anonymous
    client.cookies.clear()
    hist_anon = client.get("/api/history").json()
    anon_filenames = [h["filename"] for h in hist_anon]
    assert "user_a_call_sample.wav" not in anon_filenames, f"User A leaked in anonymous: {anon_filenames}"
    assert "user_b_urgent_transfer.wav" not in anon_filenames, f"User B leaked in anonymous: {anon_filenames}"
    print("[PASS] 7. Unauthenticated history privacy verified (zero leak).")

    # 8. Test WebSocket Handshake & Token Authentication
    with client.websocket_connect(f"/api/audio/live?token={token_a}") as ws:
        ws.send_text('{"sample_rate": 16000, "context_data": {"claimed_identity": "Caller Alpha"}}')
        ack = ws.receive_json()
        assert ack["type"] == "handshake_ack"
        assert ack["authenticated"] is True
        assert ack["user_email"] == email_a
        print("[PASS] 8. WebSocket Token Authentication & Handshake Ack verified.")

        # Send PCM16 chunk
        pcm16_chunk = (np.random.randn(16000 * 3) * 1000).astype(np.int16).tobytes()
        ws.send_bytes(pcm16_chunk)
        chunk_res = ws.receive_json()
        assert chunk_res["type"] == "chunk_result"
        assert "ai_probability" in chunk_res
        print(f"[PASS] 9. WebSocket chunk inference verified: classification={chunk_res['classification']}")

        # Send Stop
        ws.send_text('{"type": "stop"}')
        summary = ws.receive_json()
        assert summary["type"] == "session_summary"
        assert "trust_score" in summary
        print(f"[PASS] 10. WebSocket Session Summary verified: classification={summary['overall_classification']}")

    # 9. Verify Website Frontend Serving & Regression
    resp_site = client.get("/")
    assert resp_site.status_code == 200
    assert "text/html" in resp_site.headers.get("content-type", "")
    print("[PASS] 11. Website index.html serving verified.")

    resp_css = client.get("/styles.css")
    assert resp_css.status_code == 200
    print("[PASS] 12. Website styles.css serving verified.")

    resp_health = client.get("/api/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "ok"
    print("[PASS] 13. Health endpoint verified.")

    print("\nALL STAGE 2 INTEGRATION VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
