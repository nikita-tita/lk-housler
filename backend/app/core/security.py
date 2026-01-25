"""Security utilities: JWT, password hashing, OTP, datetime"""

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional


def utc_now() -> datetime:
    """Return current UTC time as timezone-aware datetime.

    Use this instead of deprecated utc_now() (Python 3.12+).
    """
    return datetime.now(timezone.utc)

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()

    if expires_delta:
        expire = utc_now() + expires_delta
    else:
        expire = utc_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_otp(length: int = None) -> str:
    """Generate numeric OTP code"""
    length = length or settings.OTP_LENGTH
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(length))


def generate_magic_link_token() -> str:
    """Generate secure token for magic links"""
    return secrets.token_urlsafe(32)


def hash_value(value: str) -> str:
    """Hash sensitive value for storage (e.g., passport, phone)"""
    import hashlib

    return hashlib.sha256(value.encode()).hexdigest()


# ==============================================
# Cookie-based Auth (httpOnly for XSS protection)
# ==============================================

from fastapi import Response, Request


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """
    Set httpOnly cookies for access and refresh tokens.

    Security features:
    - httpOnly: Prevents JavaScript access (XSS protection)
    - Secure: Only sent over HTTPS
    - SameSite=Lax: Prevents CSRF on state-changing requests
    """
    # Access token cookie (short-lived)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        path=settings.COOKIE_PATH,
    )

    # Refresh token cookie (long-lived)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        path=settings.COOKIE_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear auth cookies on logout."""
    response.delete_cookie(
        key="access_token",
        domain=settings.COOKIE_DOMAIN or None,
        path=settings.COOKIE_PATH,
    )
    response.delete_cookie(
        key="refresh_token",
        domain=settings.COOKIE_DOMAIN or None,
        path=settings.COOKIE_PATH,
    )


def get_token_from_request(request: Request) -> Optional[str]:
    """
    Extract access token from request.

    Priority:
    1. Cookie (preferred, httpOnly)
    2. Authorization header (fallback for backward compatibility)
    """
    # Try cookie first
    access_token = request.cookies.get("access_token")
    if access_token:
        return access_token

    # Fallback to Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]  # Remove "Bearer " prefix

    return None


def get_refresh_token_from_request(request: Request) -> Optional[str]:
    """
    Extract refresh token from request (cookie only for security).
    """
    return request.cookies.get("refresh_token")
