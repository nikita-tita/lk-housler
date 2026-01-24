"""Redis-based rate limiting for auth endpoints"""

from typing import Optional
from fastapi import Request, HTTPException, status
import redis.asyncio as aioredis

from app.core.config import settings


class RateLimiter:
    """Simple Redis-based rate limiter"""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get Redis connection"""
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        return self._redis

    def _make_key(self, identifier: str, endpoint: str) -> str:
        """Create Redis key for rate limit tracking"""
        return f"ratelimit:{endpoint}:{identifier}"

    async def check_rate_limit(self, identifier: str, endpoint: str, max_requests: int, window_seconds: int) -> bool:
        """
        Check if request is within rate limit.
        Returns True if allowed, raises HTTPException if rate limited.
        """
        redis = await self._get_redis()
        key = self._make_key(identifier, endpoint)

        # Get current count
        current = await redis.get(key)

        if current is None:
            # First request in window
            await redis.setex(key, window_seconds, 1)
            return True

        count = int(current)
        if count >= max_requests:
            # Rate limit exceeded
            ttl = await redis.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Try again in {ttl} seconds.",
                headers={"Retry-After": str(ttl)},
            )

        # Increment counter
        await redis.incr(key)
        return True


# Global instance
rate_limiter = RateLimiter()


async def rate_limit_otp_send(request: Request, phone: str = None, email: str = None):
    """
    Rate limit for OTP send endpoints.

    Two-layer protection:
    1. IP-based: 3 requests per 60 seconds per IP
    2. Phone/Email-based: 5 requests per hour per phone/email

    This prevents bypass via VPN/proxy (everyone behind same IP).
    """
    client_ip = request.client.host if request.client else "unknown"

    # Layer 1: Rate limit by IP (short window, strict limit)
    await rate_limiter.check_rate_limit(
        identifier=f"ip:{client_ip}",
        endpoint="otp_send",
        max_requests=3,
        window_seconds=60
    )

    # Layer 2: Rate limit by phone (longer window, prevents phone enumeration)
    if phone:
        await rate_limiter.check_rate_limit(
            identifier=f"phone:{phone}",
            endpoint="otp_send",
            max_requests=5,
            window_seconds=3600  # 1 hour
        )

    # Layer 2 (alt): Rate limit by email
    if email:
        await rate_limiter.check_rate_limit(
            identifier=f"email:{email}",
            endpoint="otp_send",
            max_requests=5,
            window_seconds=3600  # 1 hour
        )


async def rate_limit_otp_verify(request: Request, phone: str = None, email: str = None):
    """
    Rate limit for OTP verify endpoints.

    Two-layer protection:
    1. IP-based: 5 requests per 60 seconds per IP
    2. Phone/Email-based: 10 requests per hour per phone/email

    Prevents brute-force OTP guessing attacks.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Layer 1: Rate limit by IP
    await rate_limiter.check_rate_limit(
        identifier=f"ip:{client_ip}",
        endpoint="otp_verify",
        max_requests=5,
        window_seconds=60
    )

    # Layer 2: Rate limit by phone (prevents brute-force on specific phone)
    # Stricter limit: 5 attempts per hour to prevent OTP guessing
    if phone:
        await rate_limiter.check_rate_limit(
            identifier=f"phone:{phone}",
            endpoint="otp_verify",
            max_requests=5,
            window_seconds=3600  # 1 hour
        )

    # Layer 2 (alt): Rate limit by email
    if email:
        await rate_limiter.check_rate_limit(
            identifier=f"email:{email}",
            endpoint="otp_verify",
            max_requests=5,
            window_seconds=3600  # 1 hour
        )


async def rate_limit_login(request: Request, email: str = None):
    """
    Rate limit for password login.

    Two-layer protection:
    1. IP-based: 5 requests per 60 seconds per IP
    2. Email-based: 10 requests per hour per email

    Prevents brute-force password attacks.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Layer 1: Rate limit by IP
    await rate_limiter.check_rate_limit(
        identifier=f"ip:{client_ip}",
        endpoint="login",
        max_requests=5,
        window_seconds=60
    )

    # Layer 2: Rate limit by email (prevents brute-force on specific account)
    # Stricter limit: 5 attempts per hour to prevent password guessing
    if email:
        await rate_limiter.check_rate_limit(
            identifier=f"email:{email}",
            endpoint="login",
            max_requests=5,
            window_seconds=3600  # 1 hour
        )


async def rate_limit_invitation_lookup(request: Request):
    """
    Rate limit for public invitation lookup by token.

    IP-based only: 30 requests per 60 seconds per IP.
    Prevents brute-force token guessing (tokens are 43 chars, so enumeration is impractical,
    but we still want to prevent abuse).
    """
    client_ip = request.client.host if request.client else "unknown"

    await rate_limiter.check_rate_limit(
        identifier=f"ip:{client_ip}",
        endpoint="invitation_lookup",
        max_requests=30,
        window_seconds=60
    )


# ==============================================
# Token Blacklist (for logout)
# ==============================================


class TokenBlacklist:
    """Redis-based token blacklist for invalidating refresh tokens on logout"""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get Redis connection"""
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        return self._redis

    def _make_key(self, token_jti: str) -> str:
        """Create Redis key for blacklisted token"""
        return f"token_blacklist:{token_jti}"

    async def add(self, token: str, ttl_seconds: int = 86400 * 7) -> bool:
        """
        Add token to blacklist.

        Args:
            token: JWT token to blacklist
            ttl_seconds: How long to keep in blacklist (default: 7 days, matching refresh token expiry)
        """
        from app.core.security import decode_token
        import hashlib

        # Decode to get expiry (if valid) or just hash the token
        payload = decode_token(token)

        if payload and payload.get("exp"):
            # Calculate actual TTL based on token expiry
            from datetime import datetime
            exp_time = datetime.fromtimestamp(payload["exp"])
            remaining = (exp_time - datetime.utcnow()).total_seconds()
            ttl_seconds = max(int(remaining), 1)  # At least 1 second

        # Use token hash as key (shorter, no special chars)
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:32]
        key = self._make_key(token_hash)

        redis = await self._get_redis()
        await redis.setex(key, ttl_seconds, "1")
        return True

    async def is_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        import hashlib

        token_hash = hashlib.sha256(token.encode()).hexdigest()[:32]
        key = self._make_key(token_hash)

        redis = await self._get_redis()
        return await redis.exists(key) > 0


# Global instance
token_blacklist = TokenBlacklist()
