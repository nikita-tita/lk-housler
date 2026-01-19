"""Onboarding Service for T-Bank integration (TASK-5.2)

Business logic for managing bank onboarding flow.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import encrypt_inn
from app.models.payment_profile import (
    PaymentProfile,
    OnboardingStatus as ProfileOnboardingStatus,
    LegalType,
)
from app.models.user import User
from app.services.bank_split.onboarding_client import (
    TBankOnboardingClient,
    OnboardingSession,
    OnboardingStatus,
    OnboardingDocument,
    MerchantCredentials,
    OnboardingSessionStatus,
    TBankOnboardingError,
)

logger = logging.getLogger(__name__)


@dataclass
class StartOnboardingInput:
    """Input data for starting onboarding"""
    legal_type: str  # se, ip, ooo
    legal_name: str
    inn: str
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    bank_account: str = ""
    bank_bik: str = ""
    bank_name: str = ""
    bank_corr_account: str = ""
    phone: str = ""
    email: Optional[str] = None


@dataclass
class StartOnboardingResult:
    """Result of start_onboarding operation"""
    profile: PaymentProfile
    session: OnboardingSession
    onboarding_url: Optional[str] = None


@dataclass
class OnboardingStatusResult:
    """Result of check_status operation"""
    profile_id: UUID
    profile_status: str
    session_status: Optional[OnboardingStatus] = None
    is_complete: bool = False
    merchant_id: Optional[str] = None


class OnboardingService:
    """
    Service for managing T-Bank onboarding flow.

    Handles:
    - Creating PaymentProfile with legal info
    - Initiating onboarding session
    - Checking onboarding status
    - Processing webhooks from T-Bank
    - Completing onboarding and storing credentials
    """

    def __init__(self, db: AsyncSession, mock_mode: Optional[bool] = None):
        """Initialize service.

        Args:
            db: Database session
            mock_mode: Override mock mode (for testing)
        """
        self.db = db
        self.client = TBankOnboardingClient(mock_mode=mock_mode)

    async def start_onboarding(
        self,
        user_id: int,
        profile_data: StartOnboardingInput,
        organization_id: Optional[UUID] = None,
    ) -> StartOnboardingResult:
        """Start onboarding process for a user.

        Creates or updates PaymentProfile and initiates onboarding with T-Bank.

        Args:
            user_id: User initiating onboarding
            profile_data: Legal and bank details
            organization_id: Optional organization ID (for agency onboarding)

        Returns:
            StartOnboardingResult with profile and session

        Raises:
            ValueError: If profile already has active onboarding
            TBankOnboardingError: On API error
        """
        # Check for existing profile
        existing = await self._get_existing_profile(user_id, organization_id)

        if existing and existing.bank_onboarding_status == ProfileOnboardingStatus.APPROVED.value:
            raise ValueError("Profile already has approved bank onboarding")

        if existing and existing.bank_onboarding_status == ProfileOnboardingStatus.PENDING_REVIEW.value:
            raise ValueError(
                "Onboarding already in progress. "
                "Use check_status to get current status."
            )

        # Create or update profile
        profile = existing or PaymentProfile(
            user_id=user_id if not organization_id else None,
            organization_id=organization_id,
        )

        # Update profile with legal info
        profile.legal_type = profile_data.legal_type
        profile.legal_name = profile_data.legal_name

        # encrypt_inn returns (encrypted, hash)
        inn_encrypted, inn_hash = encrypt_inn(profile_data.inn)
        profile.inn_encrypted = inn_encrypted
        profile.inn_hash = inn_hash

        if profile_data.kpp:
            # Use same encryption for KPP (it's like a partial INN)
            kpp_encrypted, _ = encrypt_inn(profile_data.kpp)
            profile.kpp_encrypted = kpp_encrypted

        profile.ogrn = profile_data.ogrn

        # Bank account also needs encryption
        bank_acc_encrypted, _ = encrypt_inn(profile_data.bank_account)
        profile.bank_account_encrypted = bank_acc_encrypted
        profile.bank_bik = profile_data.bank_bik
        profile.bank_name = profile_data.bank_name
        profile.bank_corr_account = profile_data.bank_corr_account

        # Set initial status
        profile.bank_onboarding_status = ProfileOnboardingStatus.DOCUMENTS_REQUIRED.value

        if not existing:
            self.db.add(profile)

        await self.db.flush()
        await self.db.refresh(profile)

        # Initiate onboarding with T-Bank
        try:
            session = await self.client.initiate_onboarding(
                profile_id=profile.id,
                legal_type=profile_data.legal_type,
                legal_name=profile_data.legal_name,
                inn=profile_data.inn,
                phone=profile_data.phone,
                email=profile_data.email,
                bank_bik=profile_data.bank_bik,
                bank_account=profile_data.bank_account,
            )

            logger.info(
                f"Started onboarding for profile {profile.id}, "
                f"session: {session.session_id}"
            )

            return StartOnboardingResult(
                profile=profile,
                session=session,
                onboarding_url=session.onboarding_url,
            )

        except TBankOnboardingError as e:
            # Rollback profile status on API error
            profile.bank_onboarding_status = ProfileOnboardingStatus.NOT_STARTED.value
            await self.db.flush()
            raise

    async def check_status(
        self,
        profile_id: UUID,
        user_id: Optional[int] = None,
    ) -> OnboardingStatusResult:
        """Check current onboarding status.

        Args:
            profile_id: PaymentProfile ID
            user_id: Optional user ID for access check

        Returns:
            OnboardingStatusResult with current status

        Raises:
            ValueError: If profile not found or access denied
        """
        profile = await self._get_profile(profile_id)

        if not profile:
            raise ValueError(f"Profile {profile_id} not found")

        # Access check
        if user_id and profile.user_id != user_id:
            raise ValueError("Access denied to this profile")

        result = OnboardingStatusResult(
            profile_id=profile_id,
            profile_status=profile.bank_onboarding_status,
        )

        # If already approved, return immediately
        if profile.bank_onboarding_status == ProfileOnboardingStatus.APPROVED.value:
            result.is_complete = True
            result.merchant_id = profile.bank_merchant_id
            return result

        # If not started, nothing to check
        if profile.bank_onboarding_status == ProfileOnboardingStatus.NOT_STARTED.value:
            return result

        # Query T-Bank for current status
        # Note: In production, we'd store session_id in profile
        # For now, we use profile_id as external reference
        try:
            # In mock mode, this uses profile_id-based lookup
            session_id = f"mock_session_{str(profile_id)[:8]}"  # Simplified for mock
            status = await self.client.get_onboarding_status(session_id)

            result.session_status = status

            # Update profile status based on T-Bank status
            await self._sync_profile_status(profile, status)

            if status.status == OnboardingSessionStatus.APPROVED:
                result.is_complete = True
                result.merchant_id = profile.bank_merchant_id

        except TBankOnboardingError as e:
            logger.warning(f"Failed to get onboarding status: {e}")
            # Return cached profile status

        return result

    async def submit_documents(
        self,
        profile_id: UUID,
        documents: List[OnboardingDocument],
        user_id: Optional[int] = None,
    ) -> bool:
        """Submit documents for onboarding.

        Args:
            profile_id: PaymentProfile ID
            documents: List of documents to submit
            user_id: Optional user ID for access check

        Returns:
            True if submission successful
        """
        profile = await self._get_profile(profile_id)

        if not profile:
            raise ValueError(f"Profile {profile_id} not found")

        if user_id and profile.user_id != user_id:
            raise ValueError("Access denied to this profile")

        # Get session ID (in real implementation, stored in profile)
        session_id = f"mock_session_{str(profile_id)[:8]}"

        success = await self.client.submit_documents(session_id, documents)

        if success:
            # Check updated status
            status = await self.client.get_onboarding_status(session_id)
            await self._sync_profile_status(profile, status)

        return success

    async def handle_webhook(
        self,
        event_type: str,
        payload: Dict[str, Any],
    ) -> bool:
        """Handle webhook from T-Bank.

        Args:
            event_type: Type of webhook event
            payload: Webhook payload

        Returns:
            True if handled successfully
        """
        logger.info(f"Handling onboarding webhook: {event_type}")

        # Extract profile/session reference
        external_id = payload.get("externalId")
        session_id = payload.get("sessionId")

        if not external_id and not session_id:
            logger.warning("Webhook missing externalId and sessionId")
            return False

        # Find profile
        profile = None
        if external_id:
            try:
                profile_id = UUID(external_id)
                profile = await self._get_profile(profile_id)
            except (ValueError, TypeError):
                pass

        if not profile:
            logger.warning(f"Profile not found for webhook: {external_id}")
            return False

        # Handle event types
        if event_type == "onboarding.approved":
            await self._handle_approved(profile, payload)

        elif event_type == "onboarding.rejected":
            await self._handle_rejected(profile, payload)

        elif event_type == "onboarding.documents_required":
            profile.bank_onboarding_status = ProfileOnboardingStatus.DOCUMENTS_REQUIRED.value

        elif event_type == "onboarding.pending_review":
            profile.bank_onboarding_status = ProfileOnboardingStatus.PENDING_REVIEW.value

        await self.db.flush()
        return True

    async def complete_onboarding(
        self,
        profile_id: UUID,
        user_id: Optional[int] = None,
    ) -> MerchantCredentials:
        """Complete onboarding and get merchant credentials.

        Args:
            profile_id: PaymentProfile ID
            user_id: Optional user ID for access check

        Returns:
            MerchantCredentials with merchant details
        """
        profile = await self._get_profile(profile_id)

        if not profile:
            raise ValueError(f"Profile {profile_id} not found")

        if user_id and profile.user_id != user_id:
            raise ValueError("Access denied to this profile")

        # Get session ID
        session_id = f"mock_session_{str(profile_id)[:8]}"

        credentials = await self.client.complete_onboarding(session_id)

        # Update profile with merchant ID
        profile.bank_merchant_id = credentials.merchant_id
        profile.bank_onboarding_status = ProfileOnboardingStatus.APPROVED.value
        profile.bank_onboarded_at = credentials.activated_at

        await self.db.flush()

        logger.info(
            f"Onboarding completed for profile {profile_id}, "
            f"merchant: {credentials.merchant_id}"
        )

        return credentials

    # =========================================================================
    # Private helper methods
    # =========================================================================

    async def _get_profile(self, profile_id: UUID) -> Optional[PaymentProfile]:
        """Get payment profile by ID"""
        stmt = select(PaymentProfile).where(PaymentProfile.id == profile_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_existing_profile(
        self,
        user_id: int,
        organization_id: Optional[UUID] = None,
    ) -> Optional[PaymentProfile]:
        """Get existing profile for user/org"""
        if organization_id:
            stmt = select(PaymentProfile).where(
                PaymentProfile.organization_id == organization_id,
                PaymentProfile.is_active == True,
            )
        else:
            stmt = select(PaymentProfile).where(
                PaymentProfile.user_id == user_id,
                PaymentProfile.is_active == True,
            )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _sync_profile_status(
        self,
        profile: PaymentProfile,
        status: OnboardingStatus,
    ) -> None:
        """Sync profile status with T-Bank status"""
        status_map = {
            OnboardingSessionStatus.CREATED: ProfileOnboardingStatus.NOT_STARTED,
            OnboardingSessionStatus.DOCUMENTS_REQUIRED: ProfileOnboardingStatus.DOCUMENTS_REQUIRED,
            OnboardingSessionStatus.DOCUMENTS_SUBMITTED: ProfileOnboardingStatus.DOCUMENTS_REQUIRED,
            OnboardingSessionStatus.PENDING_REVIEW: ProfileOnboardingStatus.PENDING_REVIEW,
            OnboardingSessionStatus.ADDITIONAL_INFO_REQUIRED: ProfileOnboardingStatus.DOCUMENTS_REQUIRED,
            OnboardingSessionStatus.APPROVED: ProfileOnboardingStatus.APPROVED,
            OnboardingSessionStatus.REJECTED: ProfileOnboardingStatus.REJECTED,
            OnboardingSessionStatus.EXPIRED: ProfileOnboardingStatus.NOT_STARTED,
        }

        new_status = status_map.get(status.status, ProfileOnboardingStatus.NOT_STARTED)
        profile.bank_onboarding_status = new_status.value

    async def _handle_approved(
        self,
        profile: PaymentProfile,
        payload: Dict[str, Any],
    ) -> None:
        """Handle approval webhook"""
        profile.bank_onboarding_status = ProfileOnboardingStatus.APPROVED.value
        profile.bank_merchant_id = payload.get("merchantId")
        profile.bank_onboarded_at = datetime.utcnow()

        logger.info(
            f"Profile {profile.id} onboarding approved, "
            f"merchant: {profile.bank_merchant_id}"
        )

    async def _handle_rejected(
        self,
        profile: PaymentProfile,
        payload: Dict[str, Any],
    ) -> None:
        """Handle rejection webhook"""
        profile.bank_onboarding_status = ProfileOnboardingStatus.REJECTED.value
        profile.kyc_rejection_reason = payload.get("rejectionReason", "Rejected by bank")

        logger.info(
            f"Profile {profile.id} onboarding rejected: "
            f"{profile.kyc_rejection_reason}"
        )
