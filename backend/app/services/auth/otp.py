"""OTP service implementation using Redis"""

import json
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings
from app.core.security import generate_otp
from app.services.sms.provider import SMSProvider


class OTPData:
    """OTP data stored in Redis"""

    def __init__(
        self,
        phone: str,
        code: str,
        purpose: str,
        expires_at: datetime,
        attempts: int = 0,
        verified: bool = False,
        blocked_until: Optional[datetime] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        self.phone = phone
        self.code = code
        self.purpose = purpose
        self.expires_at = expires_at
        self.attempts = attempts
        self.verified = verified
        self.blocked_until = blocked_until
        self.ip_address = ip_address
        self.user_agent = user_agent

    def to_dict(self) -> dict:
        return {
            "phone": self.phone,
            "code": self.code,
            "purpose": self.purpose,
            "expires_at": self.expires_at.isoformat(),
            "attempts": self.attempts,
            "verified": self.verified,
            "blocked_until": self.blocked_until.isoformat() if self.blocked_until else None,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OTPData":
        return cls(
            phone=data["phone"],
            code=data["code"],
            purpose=data["purpose"],
            expires_at=datetime.fromisoformat(data["expires_at"]),
            attempts=data.get("attempts", 0),
            verified=data.get("verified", False),
            blocked_until=datetime.fromisoformat(data["blocked_until"]) if data.get("blocked_until") else None,
            ip_address=data.get("ip_address"),
            user_agent=data.get("user_agent"),
        )


class OTPService:
    """OTP service using Redis for storage"""

    def __init__(self, db, sms_provider: SMSProvider):
        """
        Note: db is kept for compatibility but not used.
        OTP data is stored in Redis.
        """
        self.db = db  # For compatibility
        self.sms = sms_provider
        self._redis = None

    async def _get_redis(self):
        """Get Redis connection"""
        if self._redis is None:
            import redis.asyncio as redis

            self._redis = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        return self._redis

    def _make_key(self, phone: str, purpose: str) -> str:
        """Create Redis key for OTP"""
        return f"otp:{phone}:{purpose}"

    async def send_otp(
        self, phone: str, purpose: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None
    ) -> OTPData:
        """Send OTP code"""
        redis = await self._get_redis()
        key = self._make_key(phone, purpose)

        # Check existing session and preserve attempt count
        existing_attempts = 0
        existing_data = await redis.get(key)
        if existing_data:
            existing = OTPData.from_dict(json.loads(existing_data))

            # Check if blocked
            if existing.blocked_until and existing.blocked_until > datetime.utcnow():
                raise ValueError("Слишком много попыток. Попробуйте позже.")

            # Check if too many attempts
            if existing.attempts >= settings.OTP_MAX_ATTEMPTS:
                existing.blocked_until = datetime.utcnow() + timedelta(minutes=settings.OTP_BLOCK_MINUTES)
                await redis.setex(key, settings.OTP_BLOCK_MINUTES * 60, json.dumps(existing.to_dict()))
                raise ValueError("Слишком много попыток. Блокировка на 10 минут.")

            # Preserve attempt count for resend (prevents rate limit bypass)
            existing_attempts = existing.attempts

        # Generate new OTP
        normalized_phone = phone.lstrip("+")
        if settings.SMS_TEST_MODE and normalized_phone.startswith("79999"):
            code = "123456"
        else:
            code = generate_otp(settings.OTP_LENGTH)

        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        # Create OTP data, preserving attempt count from previous session
        otp_data = OTPData(
            phone=phone,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            attempts=existing_attempts,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Store in Redis with TTL
        await redis.setex(key, settings.OTP_EXPIRE_MINUTES * 60, json.dumps(otp_data.to_dict()))

        # Send SMS
        message = f"Ваш код подтверждения: {code}. Действителен {settings.OTP_EXPIRE_MINUTES} минут."
        await self.sms.send(phone, message)

        return otp_data

    async def verify_otp(self, phone: str, code: str, purpose: str) -> bool:
        """Verify OTP code"""
        redis = await self._get_redis()
        key = self._make_key(phone, purpose)

        data = await redis.get(key)
        if not data:
            raise ValueError("Код не найден или истёк. Запросите новый код.")

        otp_data = OTPData.from_dict(json.loads(data))

        # Check if blocked
        if otp_data.blocked_until and otp_data.blocked_until > datetime.utcnow():
            raise ValueError("Слишком много попыток. Попробуйте позже.")

        # Check if expired
        if otp_data.expires_at < datetime.utcnow():
            await redis.delete(key)
            raise ValueError("Срок действия кода истёк. Запросите новый код.")

        # Check if already verified
        if otp_data.verified:
            raise ValueError("Код уже был использован")

        # Increment attempts
        otp_data.attempts += 1

        # Verify code
        if otp_data.code != code:
            if otp_data.attempts >= settings.OTP_MAX_ATTEMPTS:
                otp_data.blocked_until = datetime.utcnow() + timedelta(minutes=settings.OTP_BLOCK_MINUTES)

            # Update Redis
            remaining_ttl = await redis.ttl(key)
            if remaining_ttl > 0:
                await redis.setex(key, remaining_ttl, json.dumps(otp_data.to_dict()))

            raise ValueError("Неверный код подтверждения")

        # Delete OTP after successful verification to prevent reuse
        await redis.delete(key)

        return True
