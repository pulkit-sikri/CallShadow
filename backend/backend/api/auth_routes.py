import re
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from config.settings import settings
from backend.models.database import get_db, User, SessionToken
from backend.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    AuthResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)
from backend.services.auth_service import (
    auth_service,
    get_current_user,
    extract_token_from_header
)

logger = logging.getLogger("VoiceDetector.AuthRoutes")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def get_client_ip(request: Request) -> str:
    """
    Returns client IP address. If TRUST_PROXY_HEADERS is enabled, inspects the
    first IP in X-Forwarded-For; otherwise uses direct socket remote address.
    """
    if getattr(settings, "TRUST_PROXY_HEADERS", False):
        forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip
    return get_remote_address(request)

# IP-based rate limiter instance for auth endpoints (proxy-safe when enabled)
limiter = Limiter(key_func=get_client_ip)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

def is_secure_cookie(request: Request) -> bool:
    """Returns True if the Secure flag should be set on auth cookies (production / HTTPS / non-localhost)."""
    if settings.DEBUG:
        return False
    host = (request.url.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "testserver", "::1"):
        return False
    return True

def validate_email_format(email: str) -> str:
    cleaned = email.strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid email address."
        )
    return cleaned

@router.post("/register", response_model=AuthResponse)
@limiter.limit("10/minute")
def register(
    request: Request,
    payload: UserRegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Registers a new user, hashes password with PBKDF2-HMAC-SHA256 (600,000 iterations),
    generates session token, and returns authenticated user data.
    Rate limited to 10 requests/min per IP.
    """
    full_name = payload.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter your full name."
        )

    email = validate_email_format(payload.email)

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters."
        )

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Passwords do not match."
        )

    # Check for existing email
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Hash password with 600,000 PBKDF2 iterations and per-user salt
    password_hash, salt = auth_service.hash_password(payload.password)

    new_user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        salt=salt,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create active session token
    token = auth_service.create_session(db, new_user)

    # Set secure cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=is_secure_cookie(request),
        samesite="lax",
        max_age=72 * 3600
    )

    user_resp = UserResponse(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        is_active=new_user.is_active,
        created_at=new_user.created_at.strftime("%Y-%m-%d %H:%M:%S") if new_user.created_at else None
    )

    logger.info(f"New user registered successfully: {new_user.email} (ID: {new_user.id})")
    return AuthResponse(
        user=user_resp,
        token=token,
        message="Account created successfully"
    )

@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    payload: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates user credentials and returns session token and profile.
    Automatically upgrades legacy password hashes to 600,000 iterations on successful login.
    Rate limited to 5 requests/min per IP.
    """
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Verify password against hash & salt with transparent upgrade check
    is_valid, needs_rehash = auth_service.verify_password_with_migration(payload.password, user.password_hash, user.salt)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Seamlessly re-hash legacy passwords to modern 600,000 iterations
    if needs_rehash:
        new_hash, new_salt = auth_service.hash_password(payload.password)
        user.password_hash = new_hash
        user.salt = new_salt
        db.commit()
        logger.info(f"Upgraded password hash iterations to 600k for user ID: {user.id}")

    # Create new session token
    token = auth_service.create_session(db, user)

    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=is_secure_cookie(request),
        samesite="lax",
        max_age=72 * 3600
    )

    user_resp = UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else None
    )

    logger.info(f"User logged in successfully: {user.email} (ID: {user.id})")
    return AuthResponse(
        user=user_resp,
        token=token,
        message="Logged in successfully"
    )

@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    token: Optional[str] = Depends(extract_token_from_header),
    db: Session = Depends(get_db)
):
    """
    Invalidates current session token.
    """
    if token:
        auth_service.delete_session(db, token)

    response.delete_cookie(
        key="session_token",
        httponly=True,
        secure=is_secure_cookie(request),
        samesite="lax"
    )
    return MessageResponse(message="Logged out successfully")

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns current authenticated user profile.
    """
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at.strftime("%Y-%m-%d %H:%M:%S") if current_user.created_at else None
    )

@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Initiates password reset process. Generates a secure reset token in DB.
    Rate limited to 5 requests/min per IP.
    """
    email = payload.email.strip().lower()
    reset_token = auth_service.create_password_reset_token(db, email)
    if reset_token:
        logger.info(f"Password reset token generated for {email}")
        # In production this triggers an email dispatch.

    # Always return generic success message to avoid email enumeration
    return MessageResponse(
        message="If an account with that email exists, password reset instructions have been sent."
    )

@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Resets user password using a valid reset token.
    Rate limited to 5 requests/min per IP.
    """
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters."
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Passwords do not match."
        )

    success = auth_service.reset_password(db, payload.token.strip(), payload.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    return MessageResponse(message="Password reset successfully. You can now log in.")
