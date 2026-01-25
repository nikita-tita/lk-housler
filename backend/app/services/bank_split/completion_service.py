"""Service completion service - handles service completion confirmations (TASK-2.2, UC-3.2)

This service manages the process of confirming service delivery and triggering
client confirmation through Act signing.

UC-3.2 Flow:
1. Agent(s) confirm service completed → AWAITING_CLIENT_CONFIRMATION
2. Act generated, signing link sent to client
3. Client signs Act via PEP → PAYOUT_READY → release
4. If no action in 7 days → auto-release
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
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
from app.models.document import Document

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
    # UC-3.2: Act signing
    act_document: Optional[Document] = None
    signing_url: Optional[str] = None
    awaiting_client_confirmation: bool = False


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

        UC-3.2: Both agent AND coagent (if exists) must confirm.
        The creator is included only if they are the agent.

        Args:
            deal: The deal

        Returns:
            Set of user IDs required to confirm
        """
        required = set()

        # Primary agent must confirm
        if deal.agent_user_id:
            required.add(deal.agent_user_id)

        # UC-3.2: Coagent must also confirm if exists
        if deal.coagent_user_id:
            required.add(deal.coagent_user_id)

        # If no agents set (shouldn't happen), fall back to creator
        if not required and deal.created_by_user_id:
            required.add(deal.created_by_user_id)

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
        Confirm service completion.

        UC-3.2 Flow:
        1. Agent confirms → record ServiceCompletion
        2. If coagent exists, both must confirm
        3. When all agents confirmed → generate Act → AWAITING_CLIENT_CONFIRMATION
        4. Client receives signing link
        5. Client signs Act → PAYOUT_READY → release

        Args:
            deal: The deal to confirm
            user: The user confirming
            notes: Optional notes
            evidence_file_ids: Optional evidence file IDs
            trigger_release: Whether to trigger client confirmation flow
            client_ip: Client IP address
            user_agent: Client user agent

        Returns:
            CompletionResult with confirmation details

        Raises:
            ValueError: If confirmation not allowed
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

        # 6. Check if all required agents confirmed
        required = await self.get_required_confirmers(deal)
        confirmations = await self.get_existing_confirmations(deal.id)
        confirmed_user_ids = {c.confirmed_by_user_id for c in confirmations}
        all_confirmed = required.issubset(confirmed_user_ids)

        # UC-3.2: Initialize result fields
        act_document = None
        signing_url = None
        awaiting_client_confirmation = False
        release_triggered = False

        # 7. UC-3.2: When all agents confirmed → generate Act → AWAITING_CLIENT_CONFIRMATION
        if trigger_release and all_confirmed:
            act_document, signing_url = await self._initiate_client_confirmation(deal)
            awaiting_client_confirmation = True

            logger.info(
                f"Deal {deal.id} moved to AWAITING_CLIENT_CONFIRMATION, "
                f"act_document: {act_document.id}, signing_url: {signing_url}"
            )

        await self.db.flush()

        logger.info(
            f"Service completion confirmed for deal {deal.id} by user {user.id} "
            f"(role: {reason}, all_confirmed: {all_confirmed}, "
            f"awaiting_client: {awaiting_client_confirmation})"
        )

        return CompletionResult(
            completion=completion,
            all_confirmed=all_confirmed,
            release_triggered=release_triggered,
            confirmations_count=len(confirmed_user_ids),
            required_count=len(required),
            act_document=act_document,
            signing_url=signing_url,
            awaiting_client_confirmation=awaiting_client_confirmation,
        )

    async def _initiate_client_confirmation(
        self, deal: Deal
    ) -> tuple[Document, str]:
        """
        UC-3.2: Initiate client confirmation flow.

        1. Generate Act of Completed Services
        2. Create signing token for client
        3. Transition deal to AWAITING_CLIENT_CONFIRMATION
        4. Schedule Celery tasks for reminders and auto-release

        Args:
            deal: The deal to initiate confirmation for

        Returns:
            Tuple of (act_document, signing_url)
        """
        from app.services.bank_split.deal_service import BankSplitDealService
        from app.services.document.act_service import ActGenerationService

        deal_service = BankSplitDealService(self.db)
        act_service = ActGenerationService(self.db)

        # 1. Transition to AWAITING_CLIENT_CONFIRMATION
        await deal_service.request_client_confirmation(deal, deal.agent_user_id)

        # 2. Generate Act document
        act_document = await act_service.generate_act_for_deal(deal)

        # 3. Create signing token
        client_phone = deal.client_phone
        if not client_phone:
            # Try to get from parties
            parties = getattr(deal, "parties", None) or []
            for party in parties:
                if str(party.party_role) == "client" and party.phone_snapshot:
                    client_phone = party.phone_snapshot
                    break

        if not client_phone:
            raise ValueError("Client phone is required for Act signing")

        signing_token = await act_service.create_signing_token(
            document=act_document,
            phone=client_phone,
            expires_days=7,
        )
        signing_url = act_service.get_signing_url(signing_token.token)

        # 4. Schedule Celery tasks for reminders and auto-release
        await self._schedule_confirmation_tasks(deal)

        logger.info(
            f"Client confirmation initiated for deal {deal.id}: "
            f"act={act_document.id}, deadline={deal.client_confirmation_deadline}"
        )

        return act_document, signing_url

    async def _schedule_confirmation_tasks(self, deal: Deal) -> None:
        """
        Schedule Celery tasks for confirmation reminders and auto-release.

        Reminders: Day 1, 3, 5, 6
        Auto-release: Day 7
        """
        try:
            from app.tasks.bank_split import (
                send_act_signing_reminder,
                check_act_signature_timeout,
            )

            deal_id = str(deal.id)
            requested_at = deal.client_confirmation_requested_at

            if not requested_at:
                logger.warning(f"No confirmation requested_at for deal {deal.id}")
                return

            # Schedule reminders at day 1, 3, 5, 6
            reminder_days = [1, 3, 5, 6]
            for day in reminder_days:
                eta = requested_at + timedelta(days=day)
                send_act_signing_reminder.apply_async(
                    args=[deal_id, day],
                    eta=eta,
                )
                logger.debug(f"Scheduled reminder for deal {deal_id} at day {day}")

            # Schedule auto-release check at day 7
            auto_release_eta = requested_at + timedelta(days=7)
            check_act_signature_timeout.apply_async(
                args=[deal_id],
                eta=auto_release_eta,
            )
            logger.debug(f"Scheduled auto-release check for deal {deal_id} at day 7")

        except ImportError:
            logger.warning("Celery tasks not available, skipping scheduling")
        except Exception as e:
            logger.error(f"Failed to schedule confirmation tasks for deal {deal.id}: {e}")
            # Don't raise - tasks can be manually triggered later

    async def _trigger_release(self, deal: Deal, completion: ServiceCompletion) -> bool:
        """
        Trigger fund release for the deal (legacy method).

        Note: UC-3.2 uses _initiate_client_confirmation instead.

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
