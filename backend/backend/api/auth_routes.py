import re
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

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

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

def validate_email_format(email: str) -> str:
    cleaned = email.strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid email address."
        )
    return cleaned

@router.post("/register", response_model=AuthResponse)
def register(
    payload: UserRegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Registers a new user, hashes password with PBKDF2-HMAC-SHA256, generates session token,
    and returns authenticated user data.
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

    # Hash password with per-user salt
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
def login(
    payload: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates user credentials and returns session token and profile.
    """
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Verify password against hash & salt
    if not auth_service.verify_password(payload.password, user.password_hash, user.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Create new session token
    token = auth_service.create_session(db, user)

    # Set cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
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
    response: Response,
    token: Optional[str] = Depends(extract_token_from_header),
    db: Session = Depends(get_db)
):
    """
    Invalidates current session token.
    """
    if token:
        auth_service.delete_session(db, token)

    response.delete_cookie(key="session_token")
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
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Initiates password reset process. Generates a secure reset token in DB.
    """
    email = payload.email.strip().lower()
    reset_token = auth_service.create_password_reset_token(db, email)
    if reset_token:
        logger.info(f"Password reset token generated for {email}")
        # In production this triggers an email dispatch. For developer/local use, it is safely logged internally.

    # Always return success message to avoid email enumeration
    return MessageResponse(
        message="If an account with that email exists, password reset instructions have been sent."
    )

@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Resets user password using a valid reset token.
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
