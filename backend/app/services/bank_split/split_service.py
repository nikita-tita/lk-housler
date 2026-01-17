"""Split calculation service"""

import logging
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_split import (
    DealSplitRecipient,
    SplitRuleTemplate,
    RecipientRole,
    SplitType,
    PayoutStatus,
)
from app.models.organization import Organization, OrganizationMember

logger = logging.getLogger(__name__)


@dataclass
class SplitRecipientInput:
    """Input data for split recipient"""
    role: RecipientRole
    user_id: Optional[int] = None
    organization_id: Optional[UUID] = None
    payout_account_id: Optional[UUID] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    legal_type: Optional[str] = None  # IP/OOO/SE
    split_type: SplitType = SplitType.PERCENT
    split_value: Decimal = Decimal("0")


@dataclass
class SplitCalculationResult:
    """Result of split calculation"""
    recipient: SplitRecipientInput
    calculated_amount: Decimal
    description: str


class SplitService:
    """
    Service for calculating and managing payment splits.

    Handles:
    - Split rule validation
    - Amount calculation based on rules
    - Creating split recipient records
    - Applying organization templates
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_template(
        self,
        organization_id: UUID,
        code: str = None,
    ) -> Optional[SplitRuleTemplate]:
        """Get split rule template for organization"""
        stmt = select(SplitRuleTemplate).where(
            SplitRuleTemplate.organization_id == organization_id,
            SplitRuleTemplate.is_active == True,
        )
        if code:
            stmt = stmt.where(SplitRuleTemplate.code == code)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_default_split_percent(
        self,
        user_id: int,
        organization_id: UUID,
    ) -> int:
        """Get default split percent for agent in organization"""
        # First check member-specific setting
        stmt = select(OrganizationMember).where(
            OrganizationMember.org_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == True,
        )
        result = await self.db.execute(stmt)
        member = result.scalar_one_or_none()

        if member and member.default_split_percent_agent is not None:
            return member.default_split_percent_agent

        # Fall back to organization default
        stmt = select(Organization).where(Organization.id == organization_id)
        result = await self.db.execute(stmt)
        org = result.scalar_one_or_none()

        if org and org.default_split_percent_agent is not None:
            return org.default_split_percent_agent

        # System default
        return 60

    def validate_split_rules(
        self,
        recipients: List[SplitRecipientInput],
    ) -> bool:
        """
        Validate that split rules are correct.

        Rules:
        - Percent splits must sum to 100
        - Fixed splits must not exceed total
        - At least one recipient required
        """
        if not recipients:
            raise ValueError("At least one split recipient required")

        # Separate percent and fixed splits
        percent_total = Decimal("0")
        has_fixed = False

        for r in recipients:
            if r.split_type == SplitType.PERCENT:
                percent_total += r.split_value
            elif r.split_type == SplitType.FIXED:
                has_fixed = True

        # If no fixed splits, percent must equal 100
        if not has_fixed and percent_total != Decimal("100"):
            raise ValueError(f"Percent splits must sum to 100, got {percent_total}")

        # If has fixed splits, percent should be <= 100
        if has_fixed and percent_total > Decimal("100"):
            raise ValueError(f"Percent splits exceed 100: {percent_total}")

        return True

    def calculate_splits(
        self,
        total_amount: Decimal,
        recipients: List[SplitRecipientInput],
    ) -> List[SplitCalculationResult]:
        """
        Calculate actual amounts for each recipient.

        Args:
            total_amount: Total amount to split (in rubles)
            recipients: List of recipient configurations

        Returns:
            List of calculated splits with amounts
        """
        self.validate_split_rules(recipients)

        results = []
        remaining = total_amount

        # First pass: calculate fixed amounts
        for r in recipients:
            if r.split_type == SplitType.FIXED:
                amount = min(r.split_value, remaining)
                results.append(SplitCalculationResult(
                    recipient=r,
                    calculated_amount=amount,
                    description=f"Fixed: {amount} RUB",
                ))
                remaining -= amount

        # Second pass: calculate percent amounts from remaining
        percent_results = []
        for r in recipients:
            if r.split_type == SplitType.PERCENT:
                # Calculate with 2 decimal places, round down
                amount = (remaining * r.split_value / Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_DOWN
                )
                percent_results.append(SplitCalculationResult(
                    recipient=r,
                    calculated_amount=amount,
                    description=f"{r.split_value}% of {remaining}",
                ))

        # Adjust for rounding: add remainder to largest recipient
        if percent_results:
            total_percent = sum(r.calculated_amount for r in percent_results)
            rounding_diff = remaining - total_percent

            if rounding_diff > 0:
                # Add to first (usually largest) recipient
                percent_results[0].calculated_amount += rounding_diff

            results.extend(percent_results)

        return results

    async def create_split_recipients(
        self,
        deal_id: UUID,
        total_amount: Decimal,
        recipients: List[SplitRecipientInput],
    ) -> List[DealSplitRecipient]:
        """
        Create split recipient records for a deal.

        Args:
            deal_id: Deal ID
            total_amount: Total amount to split
            recipients: Recipient configurations

        Returns:
            Created DealSplitRecipient records
        """
        calculations = self.calculate_splits(total_amount, recipients)

        created = []
        for calc in calculations:
            r = calc.recipient
            recipient = DealSplitRecipient(
                deal_id=deal_id,
                role=r.role.value,
                legal_type=r.legal_type,
                inn=r.inn,
                kpp=r.kpp,
                user_id=r.user_id,
                organization_id=r.organization_id,
                payout_account_id=r.payout_account_id,
                split_type=r.split_type.value,
                split_value=r.split_value,
                calculated_amount=calc.calculated_amount,
                payout_status=PayoutStatus.PENDING.value,
            )
            self.db.add(recipient)
            created.append(recipient)

        await self.db.flush()

        logger.info(f"Created {len(created)} split recipients for deal {deal_id}")
        return created

    async def get_deal_recipients(self, deal_id: UUID) -> List[DealSplitRecipient]:
        """Get all split recipients for a deal"""
        stmt = select(DealSplitRecipient).where(
            DealSplitRecipient.deal_id == deal_id
        ).order_by(DealSplitRecipient.created_at)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_payout_status(
        self,
        recipient_id: UUID,
        status: PayoutStatus,
    ) -> DealSplitRecipient:
        """Update payout status for a recipient"""
        stmt = select(DealSplitRecipient).where(DealSplitRecipient.id == recipient_id)
        result = await self.db.execute(stmt)
        recipient = result.scalar_one_or_none()

        if not recipient:
            raise ValueError(f"Recipient {recipient_id} not found")

        recipient.payout_status = status.value
        await self.db.flush()

        return recipient
