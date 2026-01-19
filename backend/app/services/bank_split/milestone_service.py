"""Milestone Service - Two-Stage Payment (TASK-2.4)

Manages deal payment milestones with different release triggers:
- IMMEDIATE: Release immediately after payment (minimal hold)
- SHORT_HOLD: Release after N hours hold
- CONFIRMATION: Release after manual confirmation
- DATE: Release on specific date
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.deal import Deal
from app.models.bank_split import (
    DealMilestone,
    MilestoneStatus,
    ReleaseTrigger,
)
from app.models.user import User
from app.integrations.tbank import get_tbank_deals_client, TBankError

logger = logging.getLogger(__name__)


@dataclass
class MilestoneConfig:
    """Configuration for creating a milestone"""
    name: str
    percent: Decimal  # 0-100
    trigger: ReleaseTrigger
    description: Optional[str] = None
    release_delay_hours: Optional[int] = None  # For SHORT_HOLD
    release_date: Optional[datetime] = None  # For DATE


@dataclass
class MilestoneReleaseResult:
    """Result of milestone release operation"""
    milestone: DealMilestone
    success: bool
    error_message: Optional[str] = None
    released_amount: Optional[Decimal] = None


class MilestoneService:
    """
    Service for managing deal payment milestones.

    Supports two-stage payment flow:
    - Advance (Milestone A): Released quickly with IMMEDIATE trigger
    - Remainder (Milestone B): Released after confirmation/date/hold

    Example usage:
    ```python
    milestones = [
        MilestoneConfig(name="Advance", percent=30, trigger=ReleaseTrigger.IMMEDIATE),
        MilestoneConfig(name="Remainder", percent=70, trigger=ReleaseTrigger.CONFIRMATION),
    ]
    await milestone_service.create_milestones_for_deal(deal_id, milestones)
    ```
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_milestones_for_deal(
        self,
        deal_id: UUID,
        config: List[MilestoneConfig],
        total_amount: Optional[Decimal] = None,
    ) -> List[DealMilestone]:
        """
        Create milestones for a deal based on configuration.

        Args:
            deal_id: Deal UUID
            config: List of milestone configurations
            total_amount: Optional total amount (if not provided, fetches from deal)

        Returns:
            List of created DealMilestone objects

        Raises:
            ValueError: If percentages don't sum to 100 or deal not found
        """
        # Validate percentages sum to 100
        total_percent = sum(c.percent for c in config)
        if total_percent != Decimal("100"):
            raise ValueError(f"Milestone percentages must sum to 100, got {total_percent}")

        # Get deal if total_amount not provided
        if total_amount is None:
            deal = await self._get_deal(deal_id)
            if not deal:
                raise ValueError(f"Deal not found: {deal_id}")
            total_amount = deal.commission_agent

        milestones = []
        for step_no, cfg in enumerate(config, start=1):
            # Calculate amount from percentage
            amount = (total_amount * cfg.percent / Decimal("100")).quantize(Decimal("0.01"))

            # Calculate scheduled release time based on trigger
            release_scheduled_at = None
            if cfg.trigger == ReleaseTrigger.SHORT_HOLD and cfg.release_delay_hours:
                # Will be set when payment is received
                pass
            elif cfg.trigger == ReleaseTrigger.DATE and cfg.release_date:
                release_scheduled_at = cfg.release_date

            milestone = DealMilestone(
                deal_id=deal_id,
                step_no=step_no,
                name=cfg.name,
                description=cfg.description,
                amount=amount,
                percent=cfg.percent,
                currency="RUB",
                trigger_type=cfg.trigger.value,  # Legacy field
                trigger_config={
                    "trigger": cfg.trigger.value,
                    "delay_hours": cfg.release_delay_hours,
                    "date": cfg.release_date.isoformat() if cfg.release_date else None,
                },
                release_trigger=cfg.trigger.value,
                release_delay_hours=cfg.release_delay_hours,
                release_date=cfg.release_date,
                release_scheduled_at=release_scheduled_at,
                status=MilestoneStatus.PENDING.value,
            )
            self.db.add(milestone)
            milestones.append(milestone)

        await self.db.flush()

        logger.info(
            f"Created {len(milestones)} milestones for deal {deal_id}, "
            f"total amount: {total_amount}"
        )

        return milestones

    async def get_deal_milestones(self, deal_id: UUID) -> List[DealMilestone]:
        """Get all milestones for a deal ordered by step_no"""
        stmt = (
            select(DealMilestone)
            .where(DealMilestone.deal_id == deal_id)
            .order_by(DealMilestone.step_no)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_milestone(self, milestone_id: UUID) -> Optional[DealMilestone]:
        """Get milestone by ID"""
        stmt = select(DealMilestone).where(DealMilestone.id == milestone_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_payable_milestone(self, deal_id: UUID) -> Optional[DealMilestone]:
        """
        Get the next milestone that can be paid.

        Returns the first milestone in PENDING or READY_TO_PAY status.
        """
        stmt = (
            select(DealMilestone)
            .where(
                DealMilestone.deal_id == deal_id,
                DealMilestone.status.in_([
                    MilestoneStatus.PENDING.value,
                    MilestoneStatus.READY_TO_PAY.value,
                ])
            )
            .order_by(DealMilestone.step_no)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def mark_milestone_paid(
        self,
        milestone_id: UUID,
        paid_at: Optional[datetime] = None,
    ) -> DealMilestone:
        """
        Mark milestone as paid and schedule release based on trigger.

        Args:
            milestone_id: Milestone UUID
            paid_at: Payment timestamp (defaults to now)

        Returns:
            Updated DealMilestone

        Raises:
            ValueError: If milestone not found or invalid state
        """
        milestone = await self.get_milestone(milestone_id)
        if not milestone:
            raise ValueError(f"Milestone not found: {milestone_id}")

        if milestone.status not in (
            MilestoneStatus.PENDING.value,
            MilestoneStatus.READY_TO_PAY.value,
            MilestoneStatus.PAYMENT_PENDING.value,
        ):
            raise ValueError(f"Cannot mark as paid: milestone is {milestone.status}")

        paid_at = paid_at or datetime.utcnow()
        milestone.paid_at = paid_at
        milestone.status = MilestoneStatus.PAID.value

        # Schedule release based on trigger
        trigger = ReleaseTrigger(milestone.release_trigger)

        if trigger == ReleaseTrigger.IMMEDIATE:
            # Immediate release - set minimal hold (configurable, default 1 hour)
            minimal_hold_hours = getattr(settings, 'MILESTONE_IMMEDIATE_HOLD_HOURS', 1)
            milestone.release_scheduled_at = paid_at + timedelta(hours=minimal_hold_hours)
            milestone.hold_expires_at = milestone.release_scheduled_at
            milestone.status = MilestoneStatus.HOLD.value

        elif trigger == ReleaseTrigger.SHORT_HOLD:
            # Short hold - release after N hours
            delay_hours = milestone.release_delay_hours or 24
            milestone.release_scheduled_at = paid_at + timedelta(hours=delay_hours)
            milestone.hold_expires_at = milestone.release_scheduled_at
            milestone.status = MilestoneStatus.HOLD.value

        elif trigger == ReleaseTrigger.DATE:
            # Date-based release
            if milestone.release_date:
                milestone.release_scheduled_at = milestone.release_date
                milestone.hold_expires_at = milestone.release_date
            milestone.status = MilestoneStatus.HOLD.value

        elif trigger == ReleaseTrigger.CONFIRMATION:
            # Manual confirmation required - stays in PAID until confirmed
            milestone.status = MilestoneStatus.PAID.value

        await self.db.flush()

        logger.info(
            f"Milestone {milestone_id} marked as paid, "
            f"trigger: {trigger.value}, "
            f"scheduled_release: {milestone.release_scheduled_at}"
        )

        return milestone

    async def confirm_milestone(
        self,
        milestone_id: UUID,
        user: User,
        notes: Optional[str] = None,
    ) -> DealMilestone:
        """
        Confirm milestone for release (CONFIRMATION trigger).

        Args:
            milestone_id: Milestone UUID
            user: User confirming the milestone
            notes: Optional confirmation notes

        Returns:
            Updated DealMilestone with status HOLD (ready for release)

        Raises:
            ValueError: If milestone not in confirmable state
        """
        milestone = await self.get_milestone(milestone_id)
        if not milestone:
            raise ValueError(f"Milestone not found: {milestone_id}")

        if milestone.status != MilestoneStatus.PAID.value:
            raise ValueError(f"Cannot confirm: milestone is {milestone.status}, expected 'paid'")

        trigger = ReleaseTrigger(milestone.release_trigger)
        if trigger != ReleaseTrigger.CONFIRMATION:
            raise ValueError(
                f"Cannot manually confirm milestone with trigger {trigger.value}"
            )

        milestone.confirmed_by_user_id = user.id
        milestone.confirmed_at = datetime.utcnow()
        milestone.status = MilestoneStatus.HOLD.value

        # Set immediate release after confirmation
        milestone.release_scheduled_at = datetime.utcnow()
        milestone.hold_expires_at = datetime.utcnow()

        await self.db.flush()

        logger.info(
            f"Milestone {milestone_id} confirmed by user {user.id}, "
            f"ready for release"
        )

        return milestone

    async def process_milestone_release(
        self,
        milestone_id: UUID,
        force: bool = False,
    ) -> MilestoneReleaseResult:
        """
        Process release for a milestone.

        Args:
            milestone_id: Milestone UUID
            force: Force release even if scheduled time not reached

        Returns:
            MilestoneReleaseResult with success status

        Note:
            This method handles T-Bank integration if external_step_id is set.
            Otherwise, it updates local status only (for manual payouts).
        """
        milestone = await self.get_milestone(milestone_id)
        if not milestone:
            return MilestoneReleaseResult(
                milestone=None,
                success=False,
                error_message=f"Milestone not found: {milestone_id}",
            )

        # Check if already released
        if milestone.status == MilestoneStatus.RELEASED.value:
            return MilestoneReleaseResult(
                milestone=milestone,
                success=True,
                released_amount=milestone.amount,
            )

        # Check if ready for release
        if milestone.status != MilestoneStatus.HOLD.value:
            return MilestoneReleaseResult(
                milestone=milestone,
                success=False,
                error_message=f"Milestone not in HOLD status: {milestone.status}",
            )

        # Check scheduled release time
        now = datetime.utcnow()
        if not force and milestone.release_scheduled_at and now < milestone.release_scheduled_at:
            return MilestoneReleaseResult(
                milestone=milestone,
                success=False,
                error_message=f"Release scheduled for {milestone.release_scheduled_at}",
            )

        # Mark release requested
        milestone.release_requested_at = now

        # Attempt T-Bank release if external ID exists
        if milestone.external_step_id:
            try:
                tbank_client = get_tbank_deals_client()
                await tbank_client.release_step(milestone.external_step_id)
                logger.info(f"Released milestone {milestone_id} in T-Bank")
            except TBankError as e:
                milestone.release_error = str(e)
                await self.db.flush()
                logger.error(f"T-Bank release failed for milestone {milestone_id}: {e}")
                return MilestoneReleaseResult(
                    milestone=milestone,
                    success=False,
                    error_message=f"T-Bank error: {e}",
                )

        # Mark as released
        milestone.status = MilestoneStatus.RELEASED.value
        milestone.released_at = now
        milestone.release_error = None

        await self.db.flush()

        logger.info(
            f"Milestone {milestone_id} released, amount: {milestone.amount}"
        )

        return MilestoneReleaseResult(
            milestone=milestone,
            success=True,
            released_amount=milestone.amount,
        )

    async def check_milestone_triggers(self) -> List[MilestoneReleaseResult]:
        """
        Background task: Check and process milestones ready for automatic release.

        Returns:
            List of MilestoneReleaseResult for processed milestones

        This should be called periodically (e.g., every 5 minutes) to:
        - Release IMMEDIATE milestones after minimal hold
        - Release SHORT_HOLD milestones after delay
        - Release DATE milestones when date is reached
        """
        now = datetime.utcnow()

        # Find milestones ready for release
        stmt = select(DealMilestone).where(
            and_(
                DealMilestone.status == MilestoneStatus.HOLD.value,
                DealMilestone.release_scheduled_at <= now,
                DealMilestone.release_trigger.in_([
                    ReleaseTrigger.IMMEDIATE.value,
                    ReleaseTrigger.SHORT_HOLD.value,
                    ReleaseTrigger.DATE.value,
                ]),
            )
        )
        result = await self.db.execute(stmt)
        milestones = list(result.scalars().all())

        if not milestones:
            return []

        logger.info(f"Processing {len(milestones)} milestones for automatic release")

        results = []
        for milestone in milestones:
            release_result = await self.process_milestone_release(milestone.id)
            results.append(release_result)

        return results

    async def cancel_milestone(
        self,
        milestone_id: UUID,
        reason: Optional[str] = None,
    ) -> DealMilestone:
        """
        Cancel a milestone.

        Args:
            milestone_id: Milestone UUID
            reason: Cancellation reason

        Returns:
            Updated DealMilestone

        Raises:
            ValueError: If milestone already released
        """
        milestone = await self.get_milestone(milestone_id)
        if not milestone:
            raise ValueError(f"Milestone not found: {milestone_id}")

        if milestone.status == MilestoneStatus.RELEASED.value:
            raise ValueError("Cannot cancel released milestone")

        milestone.status = MilestoneStatus.CANCELLED.value
        if reason:
            milestone.release_error = f"Cancelled: {reason}"

        await self.db.flush()

        logger.info(f"Milestone {milestone_id} cancelled: {reason}")

        return milestone

    async def get_milestones_summary(self, deal_id: UUID) -> dict:
        """
        Get summary of milestones for a deal.

        Returns dict with:
        - total_amount: Total deal amount across milestones
        - released_amount: Amount already released
        - pending_amount: Amount pending release
        - milestones: List of milestone summaries
        """
        milestones = await self.get_deal_milestones(deal_id)

        total_amount = Decimal("0")
        released_amount = Decimal("0")
        pending_amount = Decimal("0")

        milestone_summaries = []
        for m in milestones:
            total_amount += m.amount

            if m.status == MilestoneStatus.RELEASED.value:
                released_amount += m.amount
            elif m.status != MilestoneStatus.CANCELLED.value:
                pending_amount += m.amount

            milestone_summaries.append({
                "id": str(m.id),
                "step_no": m.step_no,
                "name": m.name,
                "amount": float(m.amount),
                "percent": float(m.percent) if m.percent else None,
                "status": m.status,
                "release_trigger": m.release_trigger,
                "release_scheduled_at": m.release_scheduled_at.isoformat() if m.release_scheduled_at else None,
                "released_at": m.released_at.isoformat() if m.released_at else None,
                "paid_at": m.paid_at.isoformat() if m.paid_at else None,
            })

        return {
            "total_amount": float(total_amount),
            "released_amount": float(released_amount),
            "pending_amount": float(pending_amount),
            "milestones_count": len(milestones),
            "released_count": sum(1 for m in milestones if m.status == MilestoneStatus.RELEASED.value),
            "milestones": milestone_summaries,
        }

    async def _get_deal(self, deal_id: UUID) -> Optional[Deal]:
        """Get deal by ID"""
        stmt = select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


# Default milestone configurations
DEFAULT_MILESTONE_CONFIGS = {
    "standard_30_70": [
        MilestoneConfig(
            name="Advance",
            percent=Decimal("30"),
            trigger=ReleaseTrigger.IMMEDIATE,
            description="Advance payment released after minimal hold",
        ),
        MilestoneConfig(
            name="Remainder",
            percent=Decimal("70"),
            trigger=ReleaseTrigger.CONFIRMATION,
            description="Remainder released after service confirmation",
        ),
    ],
    "standard_50_50": [
        MilestoneConfig(
            name="First Payment",
            percent=Decimal("50"),
            trigger=ReleaseTrigger.IMMEDIATE,
            description="First payment released immediately",
        ),
        MilestoneConfig(
            name="Second Payment",
            percent=Decimal("50"),
            trigger=ReleaseTrigger.CONFIRMATION,
            description="Second payment released after confirmation",
        ),
    ],
    "single_confirmation": [
        MilestoneConfig(
            name="Full Payment",
            percent=Decimal("100"),
            trigger=ReleaseTrigger.CONFIRMATION,
            description="Full payment released after service confirmation",
        ),
    ],
    "single_immediate": [
        MilestoneConfig(
            name="Full Payment",
            percent=Decimal("100"),
            trigger=ReleaseTrigger.IMMEDIATE,
            description="Full payment released immediately",
        ),
    ],
}


def get_milestone_config(config_name: str) -> List[MilestoneConfig]:
    """Get predefined milestone configuration by name"""
    if config_name not in DEFAULT_MILESTONE_CONFIGS:
        raise ValueError(
            f"Unknown milestone config: {config_name}. "
            f"Available: {list(DEFAULT_MILESTONE_CONFIGS.keys())}"
        )
    return DEFAULT_MILESTONE_CONFIGS[config_name]
