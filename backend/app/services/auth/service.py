"""Auth service implementation"""

from datetime import timedelta
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User, UserStatus
from app.services.auth.otp import OTPService
from app.services.user.service import UserService
from app.services.sms.provider import get_sms_provider


class AuthService:
    """Authentication service"""
    
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
        """Login or register with OTP"""
        # Verify OTP
        verified = await self.otp_service.verify_otp(phone, code, "login")
        
        if not verified:
            raise ValueError("Invalid OTP code")
        
        # Get or create user
        user = await self.user_service.get_by_phone(phone)
        
        if not user:
            # Create new user
            from app.schemas.user import UserCreate
            user = await self.user_service.create(
                UserCreate(phone=phone)
            )
        
        # Activate user if pending
        if user.status == UserStatus.PENDING:
            from app.schemas.user import UserUpdate
            user = await self.user_service.update(
                user,
                UserUpdate(status=UserStatus.ACTIVE)
            )
        
        # Generate tokens
        access_token = create_access_token(
            data={"sub": str(user.id), "phone": user.phone}
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "phone": user.phone}
        )
        
        return user, access_token, refresh_token

