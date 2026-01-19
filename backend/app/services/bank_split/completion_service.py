"""Service completion service - handles service completion confirmations (TASK-2.2)

This service manages the process of confirming service delivery and triggering
fund release when appropriate.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deal import Deal, DealStatus
from app.models.service_completion import ServiceCompletion
from app.models.dispute import Dispute, DisputeStatus
from app.models.user import User
from app.models.organization import OrganizationMember, MemberRole
from app.models.bank_split import DealSplitRecipient

logger = logging.getLogger(__name__)


# RBAC roles that can confirm completion
COMPLETION_ALLOWED_ROLES = {
    "agent": ["agent"],  # Agent on the deal
    "agency": ["admin", "signer"],  # Agency admin or signer can confirm for agency
}


@dataclass
class CompletionResult:
    """Result of service completion confirmation"""
    completion: ServiceCompletion
    all_confirmed: bool
    release_triggered: bool
    confirmations_count: int
    required_count: int


class ServiceCompletionService:
    """
    Service for managing service completion confirmations.

    Key responsibilities:
    1. RBAC - verify who can confirm completion
    2. Dispute check - block confirmation if open dispute exists
    3. Release trigger - trigger fund release when confirmed
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def can_confirm_completion(self, user: User, deal: Deal) -> tuple[bool, str]:
        """
        Check if user can confirm service completion.

        Args:
            user: The user attempting to confirm
            deal: The deal being confirmed

        Returns:
            Tuple of (can_confirm: bool, reason: str)
        """
        # Agent of the deal can always confirm
        if user.id == deal.agent_user_id:
            return True, "agent"

        # Creator of the deal can confirm
        if user.id == deal.created_by_user_id:
            return True, "creator"

        # If executor is an organization, check membership
        if deal.executor_type == "org" and deal.executor_id:
            try:
                org_id = UUID(deal.executor_id)
                member = await self._get_org_membership(user.id, org_id)
                if member and member.is_active:
                    # Check if role is allowed
                    if member.role.value in COMPLETION_ALLOWED_ROLES["agency"]:
                        return True, f"agency_{member.role.value}"
            except (ValueError, TypeError):
                pass

        return False, "not_authorized"

    async def check_open_disputes(self, deal_id: UUID) -> Optional[Dispute]:
        """
        Check if deal has any open disputes.

        Args:
            deal_id: The deal to check

        Returns:
            The open dispute if found, None otherwise
        """
        stmt = select(Dispute).where(
            Dispute.deal_id == deal_id,
            Dispute.status == DisputeStatus.OPEN.value,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_required_confirmers(self, deal: Deal) -> Set[int]:
        """
        Get set of user IDs that need to confirm service completion.

        For now: creator and agent (if different)
        Future: could include all split recipients

        Args:
            deal: The deal

        Returns:
            Set of user IDs required to confirm
        """
        required = {deal.created_by_user_id, deal.agent_user_id}

        # Optionally include split recipients (users only, not orgs)
        # This is commented out for now - can be enabled if all parties
        # need to confirm before release
        #
        # stmt = select(DealSplitRecipient).where(
        #     DealSplitRecipient.deal_id == deal.id,
        #     DealSplitRecipient.user_id.isnot(None),
        # )
        # result = await self.db.execute(stmt)
        # for r in result.scalars().all():
        #     required.add(r.user_id)

        return required

    async def get_existing_confirmations(self, deal_id: UUID) -> List[ServiceCompletion]:
        """Get all existing confirmations for a deal"""
        stmt = select(ServiceCompletion).where(
            ServiceCompletion.deal_id == deal_id
        ).order_by(ServiceCompletion.confirmed_at)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def confirm_service_completion(
        self,
        deal: Deal,
        user: User,
        notes: Optional[str] = None,
        evidence_file_ids: Optional[List[UUID]] = None,
        trigger_release: bool = True,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> CompletionResult:
        """
        Confirm service completion and optionally trigger release.

        Args:
            deal: The deal to confirm
            user: The user confirming
            notes: Optional notes
            evidence_file_ids: Optional evidence file IDs
            trigger_release: Whether this confirmation should trigger release
            client_ip: Client IP address
            user_agent: Client user agent

        Returns:
            CompletionResult with confirmation details

        Raises:
            ValueError: If confirmation not allowed (open dispute, not authorized, etc)
        """
        # 1. Check RBAC
        can_confirm, reason = await self.can_confirm_completion(user, deal)
        if not can_confirm:
            raise ValueError("Not authorized to confirm service completion")

        # 2. Check deal status
        if deal.status != DealStatus.HOLD_PERIOD.value:
            raise ValueError(
                f"Service confirmation is only available during hold period, "
                f"current status: {deal.status}"
            )

        # 3. Check for open disputes
        open_dispute = await self.check_open_disputes(deal.id)
        if open_dispute:
            raise ValueError(
                "Cannot confirm: open dispute exists. "
                "Resolve the dispute before confirming service completion."
            )

        # 4. Check if user already confirmed
        existing = await self.db.execute(
            select(ServiceCompletion).where(
                ServiceCompletion.deal_id == deal.id,
                ServiceCompletion.confirmed_by_user_id == user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("You have already confirmed completion for this deal")

        # 5. Create confirmation
        now = datetime.utcnow()
        completion = ServiceCompletion(
            deal_id=deal.id,
            confirmed_by_user_id=user.id,
            confirmed_at=now,
            notes=notes,
            evidence_file_ids=[str(fid) for fid in evidence_file_ids] if evidence_file_ids else None,
            client_ip=client_ip,
            client_user_agent=user_agent,
            triggers_release=trigger_release,
        )

        self.db.add(completion)
        await self.db.flush()

        # 6. Check if all required parties confirmed
        required = await self.get_required_confirmers(deal)
        confirmations = await self.get_existing_confirmations(deal.id)
        confirmed_user_ids = {c.confirmed_by_user_id for c in confirmations}
        all_confirmed = required.issubset(confirmed_user_ids)

        # 7. Handle release trigger
        release_triggered = False

        if trigger_release and all_confirmed:
            # Check if hold period has passed
            if deal.hold_expires_at:
                if now >= deal.hold_expires_at:
                    # Hold expired, trigger immediate release
                    release_triggered = await self._trigger_release(deal, completion)
                else:
                    # Hold still active, schedule release at expiry
                    deal.auto_release_at = deal.hold_expires_at
                    logger.info(
                        f"Deal {deal.id} release scheduled for {deal.hold_expires_at}"
                    )
            else:
                # No hold expiry set, trigger immediate release
                release_triggered = await self._trigger_release(deal, completion)

        await self.db.flush()

        logger.info(
            f"Service completion confirmed for deal {deal.id} by user {user.id} "
            f"(role: {reason}, all_confirmed: {all_confirmed}, release: {release_triggered})"
        )

        return CompletionResult(
            completion=completion,
            all_confirmed=all_confirmed,
            release_triggered=release_triggered,
            confirmations_count=len(confirmed_user_ids),
            required_count=len(required),
        )

    async def _trigger_release(self, deal: Deal, completion: ServiceCompletion) -> bool:
        """
        Trigger fund release for the deal.

        Args:
            deal: The deal to release
            completion: The completion record that triggered release

        Returns:
            True if release was triggered successfully
        """
        try:
            # Import here to avoid circular imports
            from app.services.bank_split.deal_service import BankSplitDealService

            deal_service = BankSplitDealService(self.db)

            # Update completion record
            completion.release_triggered_at = datetime.utcnow()

            # Trigger release through deal service
            await deal_service.release_from_hold(deal)

            logger.info(f"Release triggered for deal {deal.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to trigger release for deal {deal.id}: {e}")
            # Don't raise - let the confirmation succeed even if release fails
            # Release can be retried later
            return False

    async def _get_org_membership(
        self, user_id: int, org_id: UUID
    ) -> Optional[OrganizationMember]:
        """Get user's membership in an organization"""
        stmt = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.org_id == org_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
