import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.api.auth_routes import router as auth_router
from backend.models.database import SessionLocal, User, SessionToken, init_db

test_app = FastAPI()
test_app.include_router(auth_router)
client = TestClient(test_app)

class TestAuthentication(unittest.TestCase):
    def setUp(self):
        init_db()
        db = SessionLocal()
        db.query(SessionToken).delete()
        db.query(User).filter(User.email.like("%test%@example.com")).delete()
        db.commit()
        db.close()

    def test_user_registration_success(self):
        payload = {
            "full_name": "Test Sophia",
            "email": "test_sophia@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        }
        response = client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["full_name"], "Test Sophia")
        self.assertEqual(data["user"]["email"], "test_sophia@example.com")
        self.assertNotIn("password_hash", data["user"])
        self.assertNotIn("salt", data["user"])

    def test_user_registration_duplicate_email(self):
        payload = {
            "full_name": "Test User",
            "email": "test_dup@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        r1 = client.post("/api/auth/register", json=payload)
        self.assertEqual(r1.status_code, 200)

        r2 = client.post("/api/auth/register", json=payload)
        self.assertEqual(r2.status_code, 409)
        self.assertIn("already exists", r2.json()["detail"].lower())

    def test_user_login_success_and_failure(self):
        reg_payload = {
            "full_name": "Login Tester",
            "email": "test_login@example.com",
            "password": "CorrectPassword123",
            "confirm_password": "CorrectPassword123"
        }
        r_reg = client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(r_reg.status_code, 200)

        # Test bad password
        bad_login = client.post("/api/auth/login", json={
            "email": "test_login@example.com",
            "password": "WrongPassword123"
        })
        self.assertEqual(bad_login.status_code, 401)
        self.assertIn("Invalid email or password", bad_login.json()["detail"])

        # Test good password
        good_login = client.post("/api/auth/login", json={
            "email": "test_login@example.com",
            "password": "CorrectPassword123"
        })
        self.assertEqual(good_login.status_code, 200)
        self.assertIn("token", good_login.json())
        self.assertEqual(good_login.json()["user"]["full_name"], "Login Tester")

    def test_protected_profile_endpoint(self):
        # Attempt without token
        unauth = client.get("/api/auth/me")
        self.assertEqual(unauth.status_code, 401)

        # Register and get token
        reg = client.post("/api/auth/register", json={
            "full_name": "Profile User",
            "email": "test_profile@example.com",
            "password": "MySecretPassword8",
            "confirm_password": "MySecretPassword8"
        })
        token = reg.json()["token"]

        # Query /api/auth/me with Bearer token
        auth_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(auth_resp.status_code, 200)
        self.assertEqual(auth_resp.json()["email"], "test_profile@example.com")
        self.assertEqual(auth_resp.json()["full_name"], "Profile User")

    def test_logout_invalidates_session(self):
        reg = client.post("/api/auth/register", json={
            "full_name": "Logout User",
            "email": "test_logout@example.com",
            "password": "LogoutPassword123",
            "confirm_password": "LogoutPassword123"
        })
        token = reg.json()["token"]

        # Verify active
        check1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(check1.status_code, 200)

        # Logout
        logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout_resp.status_code, 200)

        # Verify now unauthorized
        check2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(check2.status_code, 401)

    def test_forgot_and_reset_password_flow(self):
        reg = client.post("/api/auth/register", json={
            "full_name": "Reset Tester",
            "email": "test_reset@example.com",
            "password": "InitialPassword123",
            "confirm_password": "InitialPassword123"
        })
        self.assertEqual(reg.status_code, 200)

        # Forgot password
        forgot = client.post("/api/auth/forgot-password", json={"email": "test_reset@example.com"})
        self.assertEqual(forgot.status_code, 200)

        # Query DB directly to get the generated reset token
        db = SessionLocal()
        user = db.query(User).filter(User.email == "test_reset@example.com").first()
        reset_token = user.reset_token
        self.assertIsNotNone(reset_token)
        db.close()

        # Reset password with token
        reset_resp = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "NewSecretPassword456",
            "confirm_password": "NewSecretPassword456"
        })
        self.assertEqual(reset_resp.status_code, 200)

        # Try login with old password (should fail)
        old_login = client.post("/api/auth/login", json={
            "email": "test_reset@example.com",
            "password": "InitialPassword123"
        })
        self.assertEqual(old_login.status_code, 401)

        # Try login with new password (should succeed)
        new_login = client.post("/api/auth/login", json={
            "email": "test_reset@example.com",
            "password": "NewSecretPassword456"
        })
        self.assertEqual(new_login.status_code, 200)

if __name__ == "__main__":
    unittest.main()
