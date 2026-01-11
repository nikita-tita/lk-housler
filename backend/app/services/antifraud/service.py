"""Antifraud service implementation"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.antifraud import (
    AntiFraudCheck,
    UserLimit,
    Blacklist,
    CheckType,
    CheckResult,
    BlacklistType,
)
from app.models.user import User
from app.models.deal import Deal
from app.core.config import settings
from app.core.security import hash_value


class AntiFraudService:
    """Antifraud service"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_new_user(self, user: User) -> bool:
        """Check new user and set initial limits"""
        # Check blacklist
        if user.profile:
            if user.profile.passport_number:
                passport_hash = hash_value(user.profile.passport_number)
                if await self._is_blacklisted(BlacklistType.PASSPORT, passport_hash):
                    await self._log_check(
                        "user", user.id, CheckType.BLACKLIST, CheckResult.BLOCK, "Passport in blacklist"
                    )
                    return False

            if user.profile.inn:
                inn_hash = hash_value(user.profile.inn)
                if await self._is_blacklisted(BlacklistType.INN, inn_hash):
                    await self._log_check("user", user.id, CheckType.BLACKLIST, CheckResult.BLOCK, "INN in blacklist")
                    return False

        # Set initial limits for new users
        await self._set_new_user_limits(user)

        await self._log_check(
            "user", user.id, CheckType.NEW_AGENT, CheckResult.PASS, "New user initialized with limits"
        )

        return True

    async def check_deal(self, deal: Deal, user: User) -> tuple[bool, Optional[str]]:
        """Check deal before creation/approval"""
        # Get user limits
        limits = await self._get_user_limits(user.id)

        # Check amount limit
        if limits and limits.max_deal_amount:
            if deal.terms.commission_total > limits.max_deal_amount:
                await self._log_check(
                    "deal",
                    deal.id,
                    CheckType.AMOUNT_LIMIT,
                    CheckResult.BLOCK,
                    f"Deal amount {deal.terms.commission_total} exceeds limit {limits.max_deal_amount}",
                )
                return False, f"Deal amount exceeds your limit of {limits.max_deal_amount}"

        # Check velocity (deals per day)
        deals_today = await self._count_user_deals_today(user.id)
        if deals_today >= 5:  # Max 5 deals per day for new users
            await self._log_check(
                "deal", deal.id, CheckType.VELOCITY, CheckResult.FLAG, f"User created {deals_today} deals today"
            )
            return False, "Too many deals created today. Please contact support."

        # Check user age (days since registration)
        user_age_days = (datetime.utcnow() - user.created_at).days

        # For new users (0-7 days): stricter limits
        if user_age_days < 7:
            if deal.terms.commission_total > settings.ANTIFRAUD_NEW_AGENT_MAX_DEAL_AMOUNT:
                return False, f"Maximum deal amount for new users: {settings.ANTIFRAUD_NEW_AGENT_MAX_DEAL_AMOUNT}"

        await self._log_check("deal", deal.id, CheckType.NEW_AGENT, CheckResult.PASS, "Deal passed antifraud checks")

        return True, None

    async def _set_new_user_limits(self, user: User) -> UserLimit:
        """Set initial limits for new user"""
        limits = UserLimit(
            user_id=user.id,
            max_deal_amount=settings.ANTIFRAUD_NEW_AGENT_MAX_DEAL_AMOUNT,
            max_monthly_gmv=settings.ANTIFRAUD_NEW_AGENT_MAX_MONTHLY_GMV,
            payout_hold_days=settings.ANTIFRAUD_NEW_AGENT_PAYOUT_HOLD_DAYS,
        )
        self.db.add(limits)
        await self.db.flush()
        return limits

    async def _get_user_limits(self, user_id: UUID) -> Optional[UserLimit]:
        """Get user limits"""
        stmt = select(UserLimit).where(UserLimit.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _count_user_deals_today(self, user_id: UUID) -> int:
        """Count deals created by user today"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = select(func.count(Deal.id)).where(Deal.created_by_user_id == user_id, Deal.created_at >= today)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def _is_blacklisted(self, bl_type: BlacklistType, value_hash: str) -> bool:
        """Check if value is in blacklist"""
        stmt = select(Blacklist).where(Blacklist.type == bl_type, Blacklist.value_hash == value_hash)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def add_to_blacklist(self, bl_type: BlacklistType, value: str, reason: str) -> Blacklist:
        """Add to blacklist"""
        value_hash = hash_value(value)

        entry = Blacklist(
            type=bl_type,
            value_hash=value_hash,
            reason=reason,
        )
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)

        return entry

    async def _log_check(
        self,
        entity_type: str,
        entity_id: UUID,
        check_type: CheckType,
        result: CheckResult,
        reason: Optional[str] = None,
    ):
        """Log antifraud check"""
        check = AntiFraudCheck(
            entity_type=entity_type,
            entity_id=entity_id,
            check_type=check_type,
            result=result,
            reason=reason,
        )
        self.db.add(check)
        await self.db.flush()
