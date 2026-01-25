"""Tests for httpOnly cookie authentication"""

import pytest
from unittest.mock import MagicMock, patch


class TestCookieAuth:
    """Test cookie-based authentication functions"""

    def test_set_auth_cookies(self):
        """Test that set_auth_cookies sets both tokens with correct flags"""
        with patch("app.core.security.settings") as mock_settings:
            mock_settings.ACCESS_TOKEN_EXPIRE_MINUTES = 30
            mock_settings.REFRESH_TOKEN_EXPIRE_DAYS = 7
            mock_settings.COOKIE_HTTPONLY = True
            mock_settings.COOKIE_SECURE = True
            mock_settings.COOKIE_SAMESITE = "lax"
            mock_settings.COOKIE_DOMAIN = ""
            mock_settings.COOKIE_PATH = "/"

            from app.core.security import set_auth_cookies

            response = MagicMock()
            set_auth_cookies(response, "access_token_123", "refresh_token_456")

            # Check set_cookie was called twice
            assert response.set_cookie.call_count == 2

            # Check access_token cookie
            access_call = response.set_cookie.call_args_list[0]
            assert access_call.kwargs["key"] == "access_token"
            assert access_call.kwargs["value"] == "access_token_123"
            assert access_call.kwargs["httponly"] is True
            assert access_call.kwargs["secure"] is True
            assert access_call.kwargs["samesite"] == "lax"

            # Check refresh_token cookie
            refresh_call = response.set_cookie.call_args_list[1]
            assert refresh_call.kwargs["key"] == "refresh_token"
            assert refresh_call.kwargs["value"] == "refresh_token_456"
            assert refresh_call.kwargs["httponly"] is True

    def test_clear_auth_cookies(self):
        """Test that clear_auth_cookies removes both cookies"""
        with patch("app.core.security.settings") as mock_settings:
            mock_settings.COOKIE_DOMAIN = ""
            mock_settings.COOKIE_PATH = "/"

            from app.core.security import clear_auth_cookies

            response = MagicMock()
            clear_auth_cookies(response)

            # Check delete_cookie was called twice
            assert response.delete_cookie.call_count == 2

            # Check correct keys
            keys_deleted = [
                call.kwargs["key"] for call in response.delete_cookie.call_args_list
            ]
            assert "access_token" in keys_deleted
            assert "refresh_token" in keys_deleted

    def test_get_token_from_request_cookie_priority(self):
        """Test that cookie takes priority over header"""
        from app.core.security import get_token_from_request

        request = MagicMock()
        request.cookies.get.return_value = "cookie_token"
        request.headers.get.return_value = "Bearer header_token"

        token = get_token_from_request(request)

        assert token == "cookie_token"
        request.cookies.get.assert_called_with("access_token")

    def test_get_token_from_request_header_fallback(self):
        """Test fallback to Authorization header when no cookie"""
        from app.core.security import get_token_from_request

        request = MagicMock()
        request.cookies.get.return_value = None
        request.headers.get.return_value = "Bearer header_token"

        token = get_token_from_request(request)

        assert token == "header_token"

    def test_get_token_from_request_no_auth(self):
        """Test returns None when no auth present"""
        from app.core.security import get_token_from_request

        request = MagicMock()
        request.cookies.get.return_value = None
        request.headers.get.return_value = None

        token = get_token_from_request(request)

        assert token is None

    def test_get_refresh_token_from_request(self):
        """Test refresh token extraction from cookie only"""
        from app.core.security import get_refresh_token_from_request

        request = MagicMock()
        request.cookies.get.return_value = "refresh_token_123"

        token = get_refresh_token_from_request(request)

        assert token == "refresh_token_123"
        request.cookies.get.assert_called_with("refresh_token")


class TestCookieConfig:
    """Test cookie configuration"""

    def test_cookie_config_defaults(self):
        """Test that default cookie config is secure"""
        from app.core.config import Settings

        settings = Settings(
            JWT_SECRET_KEY="test-secret-key-minimum-32-chars!",
            DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
            HOUSLER_CRYPTO_KEY="a" * 64,
        )

        assert settings.COOKIE_HTTPONLY is True
        assert settings.COOKIE_SECURE is True
        assert settings.COOKIE_SAMESITE == "lax"
        assert settings.COOKIE_PATH == "/"
