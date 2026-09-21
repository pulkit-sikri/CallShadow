import hashlib
import hmac
import os
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from fastapi import Depends, HTTPException, status, Header, Cookie
from sqlalchemy.orm import Session

from backend.models.database import User, SessionToken, get_db

logger = logging.getLogger("VoiceDetector.AuthService")

# PBKDF2 parameters (NIST / OWASP recommended: 600,000 for SHA-256)
DEFAULT_HASH_ITERATIONS = 600_000
LEGACY_HASH_ITERATIONS = 100_000
HASH_NAME = "sha256"
SESSION_EXPIRATION_HOURS = 72

class AuthService:
    @staticmethod
    def hash_password(password: str, iterations: int = DEFAULT_HASH_ITERATIONS) -> Tuple[str, str]:
        """
        Hashes a password using PBKDF2-HMAC-SHA256 with 600,000 iterations and a unique 32-byte salt.
        Stores the iteration count with the salt as '{iterations}:{salt_hex}'.
        Returns (password_hash_hex, salt_field).
        """
        salt = secrets.token_bytes(32)
        key = hashlib.pbkdf2_hmac(
            hash_name=HASH_NAME,
            password=password.encode("utf-8"),
            salt=salt,
            iterations=iterations
        )
        salt_field = f"{iterations}:{salt.hex()}"
        return key.hex(), salt_field

    @staticmethod
    def parse_salt_and_iterations(salt_field: str) -> Tuple[bytes, int]:
        """
        Parses salt string to extract raw salt bytes and iteration count.
        Supports both modern '{iterations}:{salt_hex}' format and legacy '{salt_hex}' (100,000 iter).
        """
        if ":" in salt_field:
            parts = salt_field.split(":", 1)
            iterations = int(parts[0])
            salt_bytes = bytes.fromhex(parts[1])
        else:
            iterations = LEGACY_HASH_ITERATIONS
            salt_bytes = bytes.fromhex(salt_field)
        return salt_bytes, iterations

    @staticmethod
    def verify_password_with_migration(password: str, password_hash: str, salt_field: str) -> Tuple[bool, bool]:
        """
        Verifies password and checks if it needs rehashing to modern iteration count.
        Returns (is_valid, needs_rehash).
        """
        try:
            salt_bytes, iterations = AuthService.parse_salt_and_iterations(salt_field)
            key = hashlib.pbkdf2_hmac(
                hash_name=HASH_NAME,
                password=password.encode("utf-8"),
                salt=salt_bytes,
                iterations=iterations
            )
            is_valid = hmac.compare_digest(key.hex(), password_hash)
            needs_rehash = is_valid and (iterations < DEFAULT_HASH_ITERATIONS)
            return is_valid, needs_rehash
        except Exception as exc:
            logger.error(f"Error during password verification: {exc}")
            return False, False

    @staticmethod
    def verify_password(password: str, password_hash: str, salt: str) -> bool:
        """
        Verifies a plaintext password against stored PBKDF2 hash and salt using constant-time comparison.
        """
        is_valid, _ = AuthService.verify_password_with_migration(password, password_hash, salt)
        return is_valid

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        """Computes SHA-256 hex digest of a token string for safe database persistence."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def create_session(db: Session, user: User, duration_hours: int = SESSION_EXPIRATION_HOURS) -> str:
        """
        Generates a secure random 32-byte session token, saves only its SHA-256 hash to the database,
        and returns the raw token to the client.
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = AuthService._hash_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(hours=duration_hours)
        session_token = SessionToken(
            token=token_hash,
            user_id=user.id,
            expires_at=expires_at
        )
        db.add(session_token)
        db.commit()
        return raw_token

    @staticmethod
    def get_user_from_token(db: Session, token: str) -> Optional[User]:
        """
        Retrieves active user associated with a valid, non-expired session token.
        Hashes input token with SHA-256 before DB lookup and compares using hmac.compare_digest.
        """
        if not token:
            return None
        
        token_hash = AuthService._hash_token(token)
        session_obj = db.query(SessionToken).filter(SessionToken.token == token_hash).first()
        if not session_obj:
            return None

        # Verify hash match with constant-time comparison
        if not hmac.compare_digest(session_obj.token, token_hash):
            return None

        # Check expiration
        if session_obj.expires_at < datetime.utcnow():
            db.delete(session_obj)
            db.commit()
            return None

        user = db.query(User).filter(User.id == session_obj.user_id).first()
        if user and not user.is_active:
            return None

        return user

    @staticmethod
    def delete_session(db: Session, token: str) -> bool:
        """
        Removes session token upon logout by hashing token and querying DB.
        """
        if not token:
            return False
        token_hash = AuthService._hash_token(token)
        session_obj = db.query(SessionToken).filter(SessionToken.token == token_hash).first()
        if session_obj:
            db.delete(session_obj)
            db.commit()
            return True
        return False

    @staticmethod
    def create_password_reset_token(db: Session, email: str) -> Optional[str]:
        """
        Generates a password reset token valid for 1 hour.
        Stores only the SHA-256 hash in the database and returns raw token to caller.
        """
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if not user or not user.is_active:
            return None

        raw_reset_token = secrets.token_urlsafe(32)
        token_hash = AuthService._hash_token(raw_reset_token)
        user.reset_token = token_hash
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        return raw_reset_token

    @staticmethod
    def reset_password(db: Session, token: str, new_password: str) -> bool:
        """
        Resets user password given a valid reset token.
        Looks up by SHA-256 hash and compares using hmac.compare_digest.
        """
        if not token:
            return False

        token_hash = AuthService._hash_token(token)
        user = db.query(User).filter(User.reset_token == token_hash).first()
        if not user or not user.is_active:
            return False

        if not hmac.compare_digest(user.reset_token or "", token_hash):
            return False

        if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
            user.reset_token = None
            user.reset_token_expires = None
            db.commit()
            return False

        pw_hash, salt = AuthService.hash_password(new_password)
        user.password_hash = pw_hash
        user.salt = salt
        user.reset_token = None
        user.reset_token_expires = None
        
        # Invalidate all existing sessions on password reset
        db.query(SessionToken).filter(SessionToken.user_id == user.id).delete()
        db.commit()
        return True

auth_service = AuthService()

def extract_token_from_header(authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)) -> Optional[str]:
    """
    Extracts token from Authorization: Bearer <token> or cookie 'session_token'.
    """
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    return session_token

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(extract_token_from_header)
) -> User:
    """
    FastAPI dependency for protected routes. Returns authenticated user or raises 401.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = auth_service.get_user_from_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user

def get_optional_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(extract_token_from_header)
) -> Optional[User]:
    """
    FastAPI dependency for optionally authenticated endpoints.
    """
    if not token:
        return None
    return auth_service.get_user_from_token(db, token)
