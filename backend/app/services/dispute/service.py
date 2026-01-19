"""Dispute service for managing disputes and deal locking (TASK-2.3)"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deal import Deal, DealStatus
from app.models.dispute import (
    Dispute,
    DisputeStatus,
    DisputeResolution,
    RefundStatus,
    EscalationLevel,
)
from app.models.user import User
from app.integrations.tbank import get_tbank_deals_client, TBankError

logger = logging.getLogger(__name__)


# Dispute timing constants
AGENCY_DEADLINE_HOURS = 24  # Agency must respond within 24h
PLATFORM_DEADLINE_HOURS = 72  # Platform must resolve within 72h after escalation
MAX_DEADLINE_DAYS = 7  # Maximum resolution time from creation


class DisputeLockError(Exception):
    """Exception raised when deal is locked by dispute"""
    pass


class DisputeService:
    """
    Service for managing disputes with deal lock mechanism.

    When a dispute is opened:
    1. Deal gets locked (dispute_locked=True)
    2. Deal status changes to DISPUTE
    3. Escalation timers are set

    When a dispute is resolved:
    1. Deal gets unlocked (dispute_locked=False)
    2. Depending on resolution: release funds, refund, or partial refund
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_dispute(
        self,
        deal_id: UUID,
        user_id: int,
        reason: str,
        description: str,
        refund_requested: bool = False,
        refund_amount: Optional[Decimal] = None,
    ) -> Dispute:
        """
        Create a new dispute and lock the deal.

        Args:
            deal_id: ID of the deal to dispute
            user_id: ID of the user creating the dispute
            reason: Dispute reason (from DisputeReason enum)
            description: Detailed description of the dispute
            refund_requested: Whether refund is requested
            refund_amount: Specific refund amount (for partial refund)

        Returns:
            Created Dispute object

        Raises:
            HTTPException: If deal not found, user not participant, or invalid state
        """
        # Get deal with eager load
        deal = await self._get_deal(deal_id)
        if not deal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )

        # Check if user is participant
        if not self._is_participant(deal, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only deal participants can open disputes"
            )

        # Check deal status - can only dispute during HOLD_PERIOD or PAYOUT_READY
        allowed_statuses = [
            DealStatus.HOLD_PERIOD.value,
            DealStatus.PAYOUT_READY.value,
            "hold_period",  # String fallback
            "payout_ready",
        ]
        if deal.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot open dispute at this stage. Deal status: {deal.status}"
            )

        # Check if there's already an open dispute
        existing = await self._get_open_dispute(deal_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="There is already an open dispute for this deal"
            )

        now = datetime.utcnow()

        # Create dispute with escalation timers
        dispute = Dispute(
            deal_id=deal_id,
            initiator_user_id=user_id,
            reason=reason,
            description=description,
            status=DisputeStatus.OPEN.value,
            escalation_level=EscalationLevel.AGENCY.value,
            agency_deadline=now + timedelta(hours=AGENCY_DEADLINE_HOURS),
            max_deadline=now + timedelta(days=MAX_DEADLINE_DAYS),
            refund_requested=refund_requested,
            refund_amount=refund_amount if refund_requested else None,
            refund_status=(
                RefundStatus.REQUESTED.value if refund_requested
                else RefundStatus.NOT_REQUESTED.value
            ),
        )
        self.db.add(dispute)

        # Lock the deal
        await self._lock_deal(deal, dispute, reason)

        await self.db.commit()
        await self.db.refresh(dispute)

        logger.info(
            f"Created dispute {dispute.id} for deal {deal_id}. "
            f"Deal locked. Agency deadline: {dispute.agency_deadline}"
        )

        return dispute

    async def resolve_dispute(
        self,
        dispute_id: UUID,
        resolution: str,
        admin_user_id: int,
        resolution_notes: Optional[str] = None,
        refund_amount: Optional[Decimal] = None,
    ) -> Dispute:
        """
        Resolve a dispute and unlock the deal.

        Args:
            dispute_id: ID of the dispute to resolve
            resolution: Resolution type (full_refund/partial_refund/no_refund/split_adjustment)
            admin_user_id: ID of the admin resolving the dispute
            resolution_notes: Optional notes about the resolution
            refund_amount: Amount for partial refund (required if resolution is partial_refund)

        Returns:
            Updated Dispute object

        Raises:
            HTTPException: If dispute not found, already resolved, or resolution fails
        """
        dispute = await self._get_dispute_with_deal(dispute_id)
        if not dispute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispute not found"
            )

        # Check if dispute can be resolved
        open_statuses = [
            DisputeStatus.OPEN.value,
            DisputeStatus.AGENCY_REVIEW.value,
            DisputeStatus.PLATFORM_REVIEW.value,
            "open",
            "agency_review",
            "platform_review",
        ]
        if dispute.status not in open_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dispute is already resolved or cancelled"
            )

        # Validate resolution
        valid_resolutions = [
            DisputeResolution.FULL_REFUND.value,
            DisputeResolution.PARTIAL_REFUND.value,
            DisputeResolution.NO_REFUND.value,
            DisputeResolution.SPLIT_ADJUSTMENT.value,
        ]
        if resolution not in valid_resolutions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid resolution. Must be one of: {valid_resolutions}"
            )

        # Partial refund requires amount
        if resolution == DisputeResolution.PARTIAL_REFUND.value and not refund_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount required for partial refund"
            )

        now = datetime.utcnow()
        deal = dispute.deal

        # Update dispute
        dispute.status = DisputeStatus.RESOLVED.value
        dispute.resolution = resolution
        dispute.resolution_notes = resolution_notes
        dispute.resolved_by_user_id = admin_user_id
        dispute.resolved_at = now

        # Handle resolution based on type
        if resolution in [
            DisputeResolution.FULL_REFUND.value,
            DisputeResolution.PARTIAL_REFUND.value,
        ]:
            await self._process_refund(dispute, deal, resolution, refund_amount)
        elif resolution == DisputeResolution.NO_REFUND.value:
            # No refund - release funds to recipients
            await self._process_release(deal)
        elif resolution == DisputeResolution.SPLIT_ADJUSTMENT.value:
            # Split was adjusted - can proceed with release
            await self._process_release(deal)

        # Unlock the deal
        await self._unlock_deal(deal)

        await self.db.commit()
        await self.db.refresh(dispute)

        logger.info(
            f"Resolved dispute {dispute_id} with resolution: {resolution}. "
            f"Deal {deal.id} unlocked. New deal status: {deal.status}"
        )

        return dispute

    async def cancel_dispute(
        self,
        dispute_id: UUID,
        user_id: int,
    ) -> Dispute:
        """
        Cancel a dispute (by initiator only).

        Args:
            dispute_id: ID of the dispute to cancel
            user_id: ID of the user cancelling

        Returns:
            Updated Dispute object

        Raises:
            HTTPException: If not authorized or dispute cannot be cancelled
        """
        dispute = await self._get_dispute_with_deal(dispute_id)
        if not dispute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispute not found"
            )

        if dispute.initiator_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the initiator can cancel the dispute"
            )

        open_statuses = [DisputeStatus.OPEN.value, "open"]
        if dispute.status not in open_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only cancel disputes in OPEN status"
            )

        deal = dispute.deal

        # Cancel dispute
        dispute.status = DisputeStatus.CANCELLED.value

        # Unlock deal and return to previous state
        await self._unlock_deal(deal)
        deal.status = DealStatus.HOLD_PERIOD.value

        await self.db.commit()
        await self.db.refresh(dispute)

        logger.info(f"Dispute {dispute_id} cancelled by initiator. Deal {deal.id} unlocked.")

        return dispute

    async def escalate_to_platform(
        self,
        dispute_id: UUID,
    ) -> Dispute:
        """
        Escalate dispute from agency level to platform level.

        Called automatically when agency_deadline passes or manually by admin.

        Args:
            dispute_id: ID of the dispute to escalate

        Returns:
            Updated Dispute object
        """
        dispute = await self._get_dispute_with_deal(dispute_id)
        if not dispute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispute not found"
            )

        if dispute.escalation_level == EscalationLevel.PLATFORM.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dispute is already at platform level"
            )

        now = datetime.utcnow()

        dispute.escalation_level = EscalationLevel.PLATFORM.value
        dispute.escalated_at = now
        dispute.status = DisputeStatus.PLATFORM_REVIEW.value
        dispute.platform_deadline = now + timedelta(hours=PLATFORM_DEADLINE_HOURS)

        await self.db.commit()
        await self.db.refresh(dispute)

        logger.info(
            f"Dispute {dispute_id} escalated to platform level. "
            f"Platform deadline: {dispute.platform_deadline}"
        )

        return dispute

    async def check_and_escalate_expired(self) -> List[Dispute]:
        """
        Check for disputes that have passed agency deadline and escalate them.

        Called by background task.

        Returns:
            List of escalated disputes
        """
        now = datetime.utcnow()

        stmt = (
            select(Dispute)
            .where(
                Dispute.status.in_([DisputeStatus.OPEN.value, "open"]),
                Dispute.escalation_level == EscalationLevel.AGENCY.value,
                Dispute.agency_deadline <= now,
            )
        )
        result = await self.db.execute(stmt)
        disputes = list(result.scalars().all())

        escalated = []
        for dispute in disputes:
            try:
                await self.escalate_to_platform(dispute.id)
                escalated.append(dispute)
            except Exception as e:
                logger.error(f"Failed to escalate dispute {dispute.id}: {e}")

        if escalated:
            logger.info(f"Auto-escalated {len(escalated)} disputes to platform level")

        return escalated

    def check_dispute_lock(self, deal: Deal) -> None:
        """
        Check if deal is locked by dispute.

        Raises:
            DisputeLockError: If deal is locked

        Usage:
            service.check_dispute_lock(deal)  # Raises if locked
        """
        if deal.dispute_locked:
            raise DisputeLockError(
                f"Cannot perform operation: dispute in progress. "
                f"Reason: {deal.dispute_lock_reason}"
            )

    async def get_dispute(self, dispute_id: UUID) -> Optional[Dispute]:
        """Get dispute by ID with evidence loaded"""
        stmt = (
            select(Dispute)
            .options(selectinload(Dispute.evidence))
            .where(Dispute.id == dispute_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_deal_disputes(self, deal_id: UUID) -> List[Dispute]:
        """Get all disputes for a deal"""
        stmt = (
            select(Dispute)
            .options(selectinload(Dispute.evidence))
            .where(Dispute.deal_id == deal_id)
            .order_by(Dispute.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ==================== Private methods ====================

    async def _get_deal(self, deal_id: UUID) -> Optional[Deal]:
        """Get deal by ID"""
        stmt = (
            select(Deal)
            .where(Deal.id == deal_id, Deal.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_dispute_with_deal(self, dispute_id: UUID) -> Optional[Dispute]:
        """Get dispute with deal loaded"""
        stmt = (
            select(Dispute)
            .options(selectinload(Dispute.deal))
            .where(Dispute.id == dispute_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_open_dispute(self, deal_id: UUID) -> Optional[Dispute]:
        """Get open dispute for deal if exists"""
        open_statuses = [
            DisputeStatus.OPEN.value,
            DisputeStatus.AGENCY_REVIEW.value,
            DisputeStatus.PLATFORM_REVIEW.value,
            "open",
            "agency_review",
            "platform_review",
        ]
        stmt = (
            select(Dispute)
            .where(
                Dispute.deal_id == deal_id,
                Dispute.status.in_(open_statuses),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _is_participant(self, deal: Deal, user_id: int) -> bool:
        """Check if user is a participant of the deal"""
        return (
            deal.created_by_user_id == user_id or
            deal.agent_user_id == user_id or
            deal.client_id == user_id
        )

    async def _lock_deal(
        self,
        deal: Deal,
        dispute: Dispute,
        reason: str,
    ) -> None:
        """Lock deal due to dispute"""
        deal.dispute_locked = True
        deal.dispute_locked_at = datetime.utcnow()
        deal.dispute_lock_reason = f"Dispute: {reason}"
        deal.status = DealStatus.DISPUTE.value
        logger.info(f"Deal {deal.id} locked due to dispute")

    async def _unlock_deal(self, deal: Deal) -> None:
        """Unlock deal after dispute resolution"""
        deal.dispute_locked = False
        deal.dispute_locked_at = None
        deal.dispute_lock_reason = None
        logger.info(f"Deal {deal.id} unlocked")

    async def _process_refund(
        self,
        dispute: Dispute,
        deal: Deal,
        resolution: str,
        refund_amount: Optional[Decimal] = None,
    ) -> None:
        """Process refund in T-Bank"""
        dispute.refund_status = RefundStatus.APPROVED.value
        if refund_amount:
            dispute.refund_amount = refund_amount

        # Only process via T-Bank for bank-split deals with external ID
        if deal.external_deal_id and deal.payment_model == "bank_hold_split":
            try:
                dispute.refund_status = RefundStatus.PROCESSING.value
                tbank = get_tbank_deals_client()

                await tbank.cancel_deal(
                    deal.external_deal_id,
                    reason=f"Dispute resolved: {resolution}"
                )

                dispute.refund_status = RefundStatus.COMPLETED.value
                dispute.refund_external_id = deal.external_deal_id
                dispute.refund_processed_at = datetime.utcnow()
                deal.status = DealStatus.REFUNDED.value

                logger.info(f"Deal {deal.id} refunded via T-Bank")

            except TBankError as e:
                dispute.refund_status = RefundStatus.FAILED.value
                logger.error(f"T-Bank refund failed for deal {deal.id}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Refund processing failed: {str(e)}"
                )
        else:
            # For legacy deals or deals without external ID
            deal.status = DealStatus.REFUNDED.value
            logger.info(f"Deal {deal.id} marked as refunded (manual processing required)")

    async def _process_release(self, deal: Deal) -> None:
        """Process release to recipients"""
        # Only process via T-Bank for bank-split deals with external ID
        if deal.external_deal_id and deal.payment_model == "bank_hold_split":
            try:
                tbank = get_tbank_deals_client()
                await tbank.release_deal(deal.external_deal_id)
                deal.status = DealStatus.CLOSED.value
                logger.info(f"Deal {deal.id} released via T-Bank")

            except TBankError as e:
                logger.error(f"T-Bank release failed for deal {deal.id}: {e}")
                # Don't fail - mark as payout ready for manual processing
                deal.status = DealStatus.PAYOUT_READY.value
        else:
            # Return to hold period or payout ready for manual processing
            deal.status = DealStatus.PAYOUT_READY.value
            logger.info(f"Deal {deal.id} marked as payout ready")
