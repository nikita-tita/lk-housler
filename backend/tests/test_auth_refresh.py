"""Tests for token refresh endpoint"""

import pytest
from unittest.mock import MagicMock


class TestTokenRefresh:
    """Test /auth/refresh endpoint"""

    def test_refresh_requires_refresh_token(self):
        """Test that refresh fails without refresh_token cookie"""
        from app.core.security import decode_token

        # No token = None
        request = MagicMock()
        request.cookies.get.return_value = None

        from app.core.security import get_refresh_token_from_request

        token = get_refresh_token_from_request(request)
        assert token is None

    def test_refresh_extracts_token_from_cookie(self):
        """Test refresh token extraction from cookie"""
        from app.core.security import get_refresh_token_from_request

        request = MagicMock()
        request.cookies.get.return_value = "refresh_token_123"

        token = get_refresh_token_from_request(request)
        assert token == "refresh_token_123"
        request.cookies.get.assert_called_with("refresh_token")

    def test_decode_refresh_token_type(self):
        """Test that refresh token has correct type"""
        from app.core.security import create_refresh_token, decode_token

        # Create a refresh token
        refresh_token = create_refresh_token(data={"sub": "user_123"})

        # Decode and verify type
        payload = decode_token(refresh_token)
        assert payload is not None
        assert payload.get("type") == "refresh"
        assert payload.get("sub") == "user_123"

    def test_access_token_has_correct_type(self):
        """Test that access token has correct type"""
        from app.core.security import create_access_token, decode_token

        # Create an access token
        access_token = create_access_token(data={"sub": "user_123"})

        # Decode and verify type
        payload = decode_token(access_token)
        assert payload is not None
        assert payload.get("type") == "access"
        assert payload.get("sub") == "user_123"

    def test_cannot_use_access_token_for_refresh(self):
        """Test that access token cannot be used for refresh"""
        from app.core.security import create_access_token, decode_token

        access_token = create_access_token(data={"sub": "user_123"})
        payload = decode_token(access_token)

        # Access token has type "access", not "refresh"
        assert payload.get("type") != "refresh"


class TestTokenTypes:
    """Test token type validation"""

    def test_refresh_token_expiry_longer_than_access(self):
        """Test that refresh token lives longer than access token"""
        from app.core.config import settings

        access_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        refresh_days = settings.REFRESH_TOKEN_EXPIRE_DAYS

        # Refresh should be at least 1 day (1440 minutes)
        refresh_minutes = refresh_days * 24 * 60
        assert refresh_minutes > access_minutes

    def test_token_contains_user_id(self):
        """Test tokens contain user identifier"""
        from app.core.security import create_access_token, create_refresh_token, decode_token

        user_id = "test_user_123"

        access = create_access_token(data={"sub": user_id})
        refresh = create_refresh_token(data={"sub": user_id})

        access_payload = decode_token(access)
        refresh_payload = decode_token(refresh)

        assert access_payload["sub"] == user_id
        assert refresh_payload["sub"] == user_id
