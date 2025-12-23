"""OTP service implementation"""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_otp
from app.models.user import OTPSession
from app.services.sms.provider import SMSProvider


class OTPService:
    """OTP service"""
    
    def __init__(self, db: AsyncSession, sms_provider: SMSProvider):
        self.db = db
        self.sms = sms_provider
    
    async def send_otp(
        self,
        phone: str,
        purpose: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> OTPSession:
        """Send OTP code"""
        # Check if there's a recent session
        existing = await self._get_active_session(phone, purpose)
        
        if existing:
            # Check if blocked
            if existing.blocked_until and existing.blocked_until > datetime.utcnow():
                raise ValueError("OTP attempts blocked. Try again later.")
            
            # Check if too many attempts
            if existing.attempts >= settings.OTP_MAX_ATTEMPTS:
                existing.blocked_until = datetime.utcnow() + timedelta(
                    minutes=settings.OTP_BLOCK_MINUTES
                )
                await self.db.flush()
                raise ValueError("Too many attempts. Blocked for 10 minutes.")
        
        # Generate new OTP
        # For test phones in test mode, use fixed code
        normalized_phone = phone.lstrip('+')
        if settings.SMS_TEST_MODE and normalized_phone.startswith('79999'):
            code = "123456"
        else:
            code = generate_otp(settings.OTP_LENGTH)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        
        # Create session
        session = OTPSession(
            phone=phone,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        self.db.add(session)
        await self.db.flush()
        
        # Send SMS
        message = f"Ваш код подтверждения: {code}. Действителен {settings.OTP_EXPIRE_MINUTES} минут."
        await self.sms.send(phone, message)
        
        return session
    
    async def verify_otp(
        self,
        phone: str,
        code: str,
        purpose: str
    ) -> bool:
        """Verify OTP code"""
        session = await self._get_active_session(phone, purpose)
        
        if not session:
            raise ValueError("Invalid or expired OTP session")
        
        # Check if blocked
        if session.blocked_until and session.blocked_until > datetime.utcnow():
            raise ValueError("OTP attempts blocked. Try again later.")
        
        # Check if expired
        if session.expires_at < datetime.utcnow():
            raise ValueError("OTP code expired")
        
        # Check if already verified
        if session.verified:
            raise ValueError("OTP already used")
        
        # Increment attempts
        session.attempts += 1
        
        # Verify code
        if session.code != code:
            if session.attempts >= settings.OTP_MAX_ATTEMPTS:
                session.blocked_until = datetime.utcnow() + timedelta(
                    minutes=settings.OTP_BLOCK_MINUTES
                )
            await self.db.flush()
            raise ValueError("Invalid OTP code")
        
        # Mark as verified
        session.verified = True
        await self.db.flush()
        
        return True
    
    async def _get_active_session(
        self,
        phone: str,
        purpose: str
    ) -> Optional[OTPSession]:
        """Get active OTP session"""
        stmt = (
            select(OTPSession)
            .where(
                OTPSession.phone == phone,
                OTPSession.purpose == purpose,
                OTPSession.verified == False,  # noqa
                OTPSession.expires_at > datetime.utcnow()
            )
            .order_by(OTPSession.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

