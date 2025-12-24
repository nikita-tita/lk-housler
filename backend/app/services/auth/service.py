"""Auth service implementation - Legacy, not used in production

NOTE: Authentication is handled by agent.housler.ru.
These endpoints exist for backward compatibility but should not be used.
Frontend uses agent.housler.ru/api/auth/* directly.
"""

from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.services.auth.otp import OTPService
from app.services.user.service import UserService
from app.services.sms.provider import get_sms_provider


class AuthService:
    """Authentication service (legacy - not used)"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
        self.otp_service = OTPService(db, get_sms_provider())

    async def send_otp(self, phone: str, purpose: str = "login") -> None:
        """Send OTP for authentication"""
        await self.otp_service.send_otp(phone, purpose)

    async def login_with_otp(
        self,
        phone: str,
        code: str
    ) -> Tuple[User, str, str]:
        """Login with OTP - finds existing user only (no registration)"""
        # Verify OTP
        verified = await self.otp_service.verify_otp(phone, code, "login")

        if not verified:
            raise ValueError("Invalid OTP code")

        # Get user (must exist - created via agent.housler.ru)
        user = await self.user_service.get_by_phone(phone)

        if not user:
            raise ValueError("User not found. Please register via agent.housler.ru")

        if not user.is_active:
            raise ValueError("User account is not active")

        # Generate tokens
        access_token = create_access_token(
            data={"sub": str(user.id), "phone": user.phone}
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "phone": user.phone}
        )

        return user, access_token, refresh_token
