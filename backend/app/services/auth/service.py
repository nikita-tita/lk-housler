"""Auth service implementation - Legacy, not used in production

NOTE: Authentication is handled by agent.housler.ru.
These endpoints exist for backward compatibility but should not be used.
Frontend uses agent.housler.ru/api/auth/* directly.
"""

from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.user.service import UserService


class AuthService:
    """Authentication service (legacy - auth is via agent.housler.ru)"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)

    async def send_otp(self, phone: str, purpose: str = "login") -> None:
        """Send OTP for authentication - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")

    async def login_with_otp(
        self,
        phone: str,
        code: str
    ) -> Tuple[User, str, str]:
        """Login with OTP - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")
