"""Extended Auth service - Legacy, not used in production

NOTE: Authentication is handled by agent.housler.ru.
These endpoints exist for backward compatibility but should not be used.
Frontend uses agent.housler.ru/api/auth/* directly.
"""

from datetime import datetime
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models.user import User
from app.services.user.service import UserService


class AuthServiceExtended:
    """Extended authentication service (legacy - auth is via agent.housler.ru)"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)

    # ==========================================
    # 1. SMS Auth (Agents) - NOT IMPLEMENTED
    # ==========================================

    async def send_sms_otp(self, phone: str) -> None:
        """Send SMS OTP for agent login - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")

    async def verify_sms_otp(self, phone: str, code: str) -> Tuple[User, str, str]:
        """Verify SMS OTP - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")

    # ==========================================
    # 2. Email Auth (Clients) - NOT IMPLEMENTED
    # ==========================================

    async def send_email_otp(self, email: str) -> None:
        """Send Email OTP for client login - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")

    async def verify_email_otp(self, email: str, code: str) -> Tuple[User, str, str]:
        """Verify Email OTP - NOT IMPLEMENTED"""
        raise ValueError("Authentication is handled by agent.housler.ru")

    # ==========================================
    # 3. Agency Auth (Email + Password)
    # ==========================================

    async def login_agency(self, email: str, password: str) -> Tuple[User, str, str]:
        """Agency admin login with email + password"""
        # Find user by email
        user = await self.user_service.get_by_email(email)

        if not user:
            raise ValueError("Invalid credentials")

        # Check role
        if user.role != "agency_admin":
            raise ValueError("Invalid credentials")

        # Check password
        if not user.password_hash or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")

        # Check status
        if not user.is_active:
            raise ValueError("Account is not active")

        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.db.flush()

        # Generate tokens
        tokens = self._generate_tokens(user)
        return user, tokens[0], tokens[1]

    # ==========================================
    # Registration stubs (not implemented - use agent.housler.ru)
    # ==========================================

    async def register_agent(self, **kwargs) -> User:
        """Register new agent - NOT IMPLEMENTED"""
        raise ValueError("Registration is handled by agent.housler.ru")

    async def register_agency(self, **kwargs) -> User:
        """Register new agency - NOT IMPLEMENTED"""
        raise ValueError("Registration is handled by agent.housler.ru")

    # ==========================================
    # Helpers
    # ==========================================

    def _generate_tokens(self, user: User) -> Tuple[str, str]:
        """Generate access and refresh tokens"""
        token_data = {"sub": str(user.id), "role": user.role or "client"}

        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        return access_token, refresh_token
