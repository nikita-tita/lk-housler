"""Tests for auth API endpoints"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException


class TestSMSAuth:
    """Test SMS auth endpoints logic"""

    @pytest.mark.asyncio
    async def test_send_sms_success(self):
        """Test successful SMS send"""
        from app.schemas.auth import SMSOTPRequest

        request = SMSOTPRequest(phone="+79991234567")
        assert request.phone == "+79991234567"

    def test_sms_phone_validation_requires_plus7(self):
        """Test phone validation requires +7 prefix"""
        from app.schemas.auth import SMSOTPRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SMSOTPRequest(phone="89991234567")  # Missing +7

    def test_sms_phone_validation_requires_11_digits(self):
        """Test phone validation requires exactly 11 digits"""
        from app.schemas.auth import SMSOTPRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SMSOTPRequest(phone="+7999123456")  # Only 10 digits

    def test_sms_verify_requires_code(self):
        """Test SMS verify requires code"""
        from app.schemas.auth import SMSOTPVerify

        request = SMSOTPVerify(phone="+79991234567", code="123456")
        assert request.code == "123456"


class TestEmailAuth:
    """Test Email auth endpoints logic"""

    def test_email_request_valid(self):
        """Test valid email request"""
        from app.schemas.auth import EmailOTPRequest

        request = EmailOTPRequest(email="test@example.com")
        assert request.email == "test@example.com"

    def test_email_request_invalid(self):
        """Test invalid email is rejected"""
        from app.schemas.auth import EmailOTPRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            EmailOTPRequest(email="not-an-email")

    def test_email_verify_requires_code(self):
        """Test email verify requires code"""
        from app.schemas.auth import EmailOTPVerify

        request = EmailOTPVerify(email="test@example.com", code="123456")
        assert request.code == "123456"


class TestAgencyAuth:
    """Test Agency auth endpoints logic"""

    def test_agency_login_request_valid(self):
        """Test valid agency login request"""
        from app.schemas.auth import AgencyLoginRequest

        request = AgencyLoginRequest(
            email="admin@agency.com",
            password="securepassword123"
        )
        assert request.email == "admin@agency.com"

    def test_agency_login_password_min_length(self):
        """Test password minimum length validation"""
        from app.schemas.auth import AgencyLoginRequest
        from pydantic import ValidationError

        # Short password should fail
        with pytest.raises(ValidationError) as exc_info:
            AgencyLoginRequest(
                email="admin@agency.com",
                password="123"  # Too short (min 8 chars)
            )
        assert "at least 8 characters" in str(exc_info.value)


class TestTokenRefresh:
    """Test token refresh endpoint logic"""

    @pytest.mark.asyncio
    async def test_refresh_without_token_raises_401(self):
        """Test refresh without token returns 401"""
        from app.api.v1.endpoints.auth import refresh_access_token

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"

        with pytest.raises(HTTPException) as exc_info:
            await refresh_access_token(
                request=None,
                http_request=http_request,
                http_response=MagicMock()
            )

        assert exc_info.value.status_code == 401
        assert "Refresh token required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token_raises_401(self):
        """Test refresh with invalid token returns 401"""
        from app.api.v1.endpoints.auth import refresh_access_token
        from app.schemas.auth import TokenRefresh

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"

        request = TokenRefresh(refresh_token="invalid_token")

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.is_blacklisted = AsyncMock(return_value=False)

            with pytest.raises(HTTPException) as exc_info:
                await refresh_access_token(
                    request=request,
                    http_request=http_request,
                    http_response=MagicMock()
                )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_blacklisted_token_raises_401(self):
        """Test refresh with blacklisted token returns 401"""
        from app.api.v1.endpoints.auth import refresh_access_token
        from app.schemas.auth import TokenRefresh
        from app.core.security import create_refresh_token

        # Create a valid refresh token
        refresh_token = create_refresh_token(data={"sub": "user_123"})

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"

        request = TokenRefresh(refresh_token=refresh_token)

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.is_blacklisted = AsyncMock(return_value=True)

            with pytest.raises(HTTPException) as exc_info:
                await refresh_access_token(
                    request=request,
                    http_request=http_request,
                    http_response=MagicMock()
                )

        assert exc_info.value.status_code == 401
        assert "revoked" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_raises_401(self):
        """Test refresh with access token (wrong type) returns 401"""
        from app.api.v1.endpoints.auth import refresh_access_token
        from app.schemas.auth import TokenRefresh
        from app.core.security import create_access_token

        # Create an ACCESS token (not refresh)
        access_token = create_access_token(data={"sub": "user_123"})

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"

        request = TokenRefresh(refresh_token=access_token)

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.is_blacklisted = AsyncMock(return_value=False)

            with pytest.raises(HTTPException) as exc_info:
                await refresh_access_token(
                    request=request,
                    http_request=http_request,
                    http_response=MagicMock()
                )

        assert exc_info.value.status_code == 401
        assert "Invalid token type" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_refresh_success(self):
        """Test successful token refresh"""
        from app.api.v1.endpoints.auth import refresh_access_token
        from app.schemas.auth import TokenRefresh
        from app.core.security import create_refresh_token

        # Create a valid refresh token
        refresh_token = create_refresh_token(data={"sub": "user_123"})

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"
        http_response = MagicMock()

        request = TokenRefresh(refresh_token=refresh_token)

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.is_blacklisted = AsyncMock(return_value=False)

            with patch("app.api.v1.endpoints.auth.log_audit_event"):
                result = await refresh_access_token(
                    request=request,
                    http_request=http_request,
                    http_response=http_response
                )

        assert result.access_token is not None
        assert result.token_type == "bearer"
        # Verify cookies were set
        http_response.set_cookie.assert_called()


class TestLogout:
    """Test logout endpoint logic"""

    @pytest.mark.asyncio
    async def test_logout_success_with_token(self):
        """Test successful logout with token"""
        from app.api.v1.endpoints.auth import logout
        from app.schemas.auth import TokenRefresh
        from app.core.security import create_refresh_token

        refresh_token = create_refresh_token(data={"sub": "user_123"})

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"
        http_response = MagicMock()

        request = TokenRefresh(refresh_token=refresh_token)

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.add = AsyncMock()

            with patch("app.api.v1.endpoints.auth.log_audit_event"):
                result = await logout(
                    request=request,
                    http_request=http_request,
                    http_response=http_response
                )

        assert result["message"] == "Logged out successfully"
        # Token should be blacklisted
        mock_blacklist.add.assert_called_once_with(refresh_token)
        # Cookies should be cleared
        http_response.delete_cookie.assert_called()

    @pytest.mark.asyncio
    async def test_logout_success_without_token(self):
        """Test logout without token still succeeds (clears cookies)"""
        from app.api.v1.endpoints.auth import logout

        http_request = MagicMock()
        http_request.cookies.get.return_value = None
        http_request.client.host = "127.0.0.1"
        http_response = MagicMock()

        with patch("app.api.v1.endpoints.auth.token_blacklist") as mock_blacklist:
            mock_blacklist.add = AsyncMock()

            with patch("app.api.v1.endpoints.auth.log_audit_event"):
                result = await logout(
                    request=None,
                    http_request=http_request,
                    http_response=http_response
                )

        assert result["message"] == "Logged out successfully"
        # Blacklist should NOT be called (no token)
        mock_blacklist.add.assert_not_called()


class TestRegistration:
    """Test registration schemas"""

    def test_agent_register_request_valid(self):
        """Test valid agent registration request"""
        from app.schemas.auth import AgentRegisterRequest, ConsentInput

        consents = ConsentInput(
            personal_data=True,
            terms=True,
            marketing=False,
        )
        request = AgentRegisterRequest(
            phone="+79991234567",
            name="Иван Иванов",
            email="ivan@example.com",
            consents=consents,
            city="Москва",
            is_self_employed=True,
            personal_inn="123456789012",
        )
        assert request.name == "Иван Иванов"
        assert request.consents.terms is True

    def test_agency_register_request_valid(self):
        """Test valid agency registration request"""
        from app.schemas.auth import AgencyRegisterRequest, ConsentInput

        consents = ConsentInput(
            personal_data=True,
            terms=True,
            agency_offer=True,
        )
        request = AgencyRegisterRequest(
            inn="1234567890",
            name="ООО Агентство",
            legal_address="Москва, ул. Примерная, 1",
            contact_name="Директор",
            contact_phone="+79991234567",
            contact_email="director@agency.com",
            password="securepassword123",
            consents=consents,
        )
        assert request.inn == "1234567890"
        assert request.name == "ООО Агентство"


class TestTokenSchemas:
    """Test token response schemas"""

    def test_token_response(self):
        """Test Token response schema"""
        from app.schemas.auth import Token

        token = Token(
            access_token="access_123",
            refresh_token="refresh_456"
        )
        assert token.access_token == "access_123"
        assert token.refresh_token == "refresh_456"
        assert token.token_type == "bearer"

    def test_token_refresh_request(self):
        """Test TokenRefresh request schema"""
        from app.schemas.auth import TokenRefresh

        request = TokenRefresh(refresh_token="refresh_token_123")
        assert request.refresh_token == "refresh_token_123"
