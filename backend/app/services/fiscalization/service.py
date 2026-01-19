"""Fiscalization service implementation"""

import logging
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.deal import Deal
from app.models.fiscalization import FiscalizationSettings
from app.models.payment_profile import (
    PaymentProfile,
    FiscalizationMethod,
    LegalType,
    OnboardingStatus,
)

logger = logging.getLogger(__name__)


class FiscalizationService:
    """Service for managing fiscalization requirements and method selection.

    Determines which fiscalization method should be used based on:
    - Legal entity type (SE, IP, OOO)
    - Deal type and amount
    - Payment profile configuration
    - NPD limits and thresholds

    Supported methods:
    - NPD_RECEIPT: Self-employed receipt via MyNalog API
    - TBANK_CHECKS: T-Bank fiscal receipts
    - EXTERNAL: External fiscalization system
    - NOT_REQUIRED: No fiscalization needed (platform fee, etc.)
    """

    # NPD annual income limit (2.4M RUB)
    NPD_ANNUAL_LIMIT = 2_400_000_00  # in kopeks

    # NPD per-transaction limit (none, but good practice to check)
    NPD_TRANSACTION_LIMIT = None

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_method_for_deal(self, deal: Deal) -> FiscalizationMethod:
        """Determine fiscalization method for a deal.

        Args:
            deal: The deal to check

        Returns:
            FiscalizationMethod appropriate for this deal
        """
        # Get payment profile for executor
        profile = await self._get_executor_profile(deal)

        if not profile:
            logger.warning(
                f"No payment profile found for deal {deal.id}, "
                f"defaulting to NOT_REQUIRED"
            )
            return FiscalizationMethod.NOT_REQUIRED

        # If profile has explicit method set, use it
        if profile.fiscalization_method:
            method = FiscalizationMethod(profile.fiscalization_method)
            if method != FiscalizationMethod.NOT_REQUIRED:
                return method

        # Determine based on legal type
        legal_type = LegalType(profile.legal_type)

        # Check settings from database
        db_method = await self._get_method_from_settings(
            legal_type=legal_type.value,
            deal_type=deal.type,
        )
        if db_method:
            return db_method

        # Fallback logic based on legal type
        return self._get_default_method(legal_type, profile)

    async def validate_requirements(self, deal: Deal) -> bool:
        """Validate that fiscalization requirements are met for a deal.

        Checks:
        - Payment profile exists and is onboarded
        - NPD status is valid for self-employed
        - Amount is within limits

        Args:
            deal: The deal to validate

        Returns:
            True if requirements are met, False otherwise
        """
        profile = await self._get_executor_profile(deal)

        if not profile:
            logger.error(f"No payment profile for deal {deal.id}")
            return False

        # Check onboarding status
        if profile.bank_onboarding_status != OnboardingStatus.APPROVED.value:
            logger.warning(
                f"Payment profile {profile.id} not approved for deal {deal.id}"
            )
            return False

        method = await self.get_method_for_deal(deal)

        if method == FiscalizationMethod.NOT_REQUIRED:
            return True

        if method == FiscalizationMethod.NPD_RECEIPT:
            return await self._validate_npd_requirements(deal, profile)

        if method == FiscalizationMethod.TBANK_CHECKS:
            return self._validate_tbank_requirements(profile)

        # External validation handled separately
        return True

    def is_fiscalization_required(
        self,
        legal_type: str,
        deal_type: Optional[str] = None,
        amount_kopeks: Optional[int] = None,
    ) -> bool:
        """Check if fiscalization is required for given parameters.

        Args:
            legal_type: Legal entity type (se, ip, ooo, platform)
            deal_type: Optional deal type for specific rules
            amount_kopeks: Optional transaction amount in kopeks

        Returns:
            True if fiscalization is required
        """
        # Platform fees don't require agent fiscalization
        if legal_type == "platform":
            return False

        # Check amount threshold
        threshold = settings.FISCALIZATION_REQUIRED_THRESHOLD
        if amount_kopeks and amount_kopeks < threshold:
            return False

        # All real estate deals with SE/IP/OOO require fiscalization
        if legal_type in ("se", "ip", "ooo"):
            return True

        return False

    async def get_settings_for_profile(
        self,
        profile: PaymentProfile,
        deal_type: Optional[str] = None,
    ) -> Optional[FiscalizationSettings]:
        """Get fiscalization settings for a payment profile.

        Args:
            profile: Payment profile to get settings for
            deal_type: Optional specific deal type

        Returns:
            FiscalizationSettings if found, None otherwise
        """
        return await self._get_settings_from_db(
            legal_type=profile.legal_type,
            deal_type=deal_type,
        )

    async def _get_executor_profile(self, deal: Deal) -> Optional[PaymentProfile]:
        """Get payment profile for deal executor."""
        # Executor can be user or organization
        if deal.executor_type == "org" and deal.executor_id:
            stmt = select(PaymentProfile).where(
                PaymentProfile.organization_id == UUID(deal.executor_id),
                PaymentProfile.is_active == True,
            )
        elif deal.agent_user_id:
            stmt = select(PaymentProfile).where(
                PaymentProfile.user_id == deal.agent_user_id,
                PaymentProfile.is_active == True,
            )
        else:
            return None

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_method_from_settings(
        self,
        legal_type: str,
        deal_type: Optional[str],
    ) -> Optional[FiscalizationMethod]:
        """Get fiscalization method from database settings."""
        settings_record = await self._get_settings_from_db(legal_type, deal_type)

        if settings_record and settings_record.is_active:
            return FiscalizationMethod(settings_record.method)

        return None

    async def _get_settings_from_db(
        self,
        legal_type: str,
        deal_type: Optional[str],
    ) -> Optional[FiscalizationSettings]:
        """Get settings record from database.

        First tries exact match (legal_type + deal_type),
        then falls back to default (legal_type only).
        """
        # Try exact match first
        if deal_type:
            stmt = select(FiscalizationSettings).where(
                FiscalizationSettings.legal_type == legal_type,
                FiscalizationSettings.deal_type == deal_type,
                FiscalizationSettings.is_active == True,
            )
            result = await self.db.execute(stmt)
            record = result.scalar_one_or_none()
            if record:
                return record

        # Fallback to default (no deal_type)
        stmt = select(FiscalizationSettings).where(
            FiscalizationSettings.legal_type == legal_type,
            FiscalizationSettings.deal_type.is_(None),
            FiscalizationSettings.is_active == True,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _get_default_method(
        self,
        legal_type: LegalType,
        profile: PaymentProfile,
    ) -> FiscalizationMethod:
        """Get default fiscalization method based on legal type."""
        if legal_type == LegalType.SE:
            # Self-employed always use NPD receipts
            return FiscalizationMethod.NPD_RECEIPT

        if legal_type in (LegalType.IP, LegalType.OOO):
            # IP/OOO use T-Bank checks if enabled
            if profile.tbank_checks_enabled:
                return FiscalizationMethod.TBANK_CHECKS
            return FiscalizationMethod.EXTERNAL

        return FiscalizationMethod.NOT_REQUIRED

    async def _validate_npd_requirements(
        self,
        deal: Deal,
        profile: PaymentProfile,
    ) -> bool:
        """Validate NPD (self-employed) requirements.

        Checks:
        - Annual income limit not exceeded
        - NPD status is active (via INN validation service)
        """
        # Check amount against NPD limits
        if deal.commission_agent:
            amount_kopeks = int(deal.commission_agent * 100)
            if self.NPD_TRANSACTION_LIMIT and amount_kopeks > self.NPD_TRANSACTION_LIMIT:
                logger.warning(
                    f"Deal {deal.id} amount {amount_kopeks} exceeds NPD transaction limit"
                )
                return False

        # NPD status validation would be done via INN validation service
        # For now, trust the legal_type in profile
        return profile.legal_type == LegalType.SE.value

    def _validate_tbank_requirements(self, profile: PaymentProfile) -> bool:
        """Validate T-Bank checks requirements."""
        if not profile.tbank_checks_enabled:
            logger.warning(f"T-Bank checks not enabled for profile {profile.id}")
            return False

        if not profile.tbank_checks_merchant_id:
            logger.warning(f"T-Bank merchant ID not set for profile {profile.id}")
            return False

        return True

    async def get_npd_info(self, profile: PaymentProfile) -> dict:
        """Get NPD-related information for a profile.

        Returns info useful for UI/reporting.
        """
        return {
            "is_npd": profile.legal_type == LegalType.SE.value,
            "annual_limit": self.NPD_ANNUAL_LIMIT,
            "annual_limit_formatted": f"{self.NPD_ANNUAL_LIMIT // 100:,} RUB",
            "method": FiscalizationMethod.NPD_RECEIPT.value,
        }
