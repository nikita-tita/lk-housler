"""Bank Split Deal Service - orchestrates the bank-split deal flow"""

import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.deal import Deal, DealStatus
from app.models.bank_split import (
    DealSplitRecipient,
    DealMilestone,
    BankEvent,
    RecipientRole,
    SplitType,
    MilestoneStatus,
    PayoutStatus,
)
from app.models.user import User
from app.models.organization import Organization
from app.services.bank_split.split_service import SplitService, SplitRecipientInput
from app.services.bank_split.invoice_service import InvoiceService
from app.services.inn import INNValidationService, INNValidationLevel
from app.integrations.tbank import get_tbank_deals_client, TBankError

logger = logging.getLogger(__name__)


# State machine for bank-split deals (using DealStatus enum values)
# UC-3.2: Added AWAITING_CLIENT_CONFIRMATION for Act signing flow
BANK_SPLIT_TRANSITIONS = {
    DealStatus.DRAFT.value: {DealStatus.AWAITING_SIGNATURES.value, DealStatus.CANCELLED.value},
    DealStatus.AWAITING_SIGNATURES.value: {DealStatus.SIGNED.value, DealStatus.CANCELLED.value},
    DealStatus.SIGNED.value: {DealStatus.INVOICED.value, DealStatus.CANCELLED.value},
    DealStatus.INVOICED.value: {DealStatus.PAYMENT_PENDING.value, DealStatus.PAYMENT_FAILED.value, DealStatus.CANCELLED.value},
    DealStatus.PAYMENT_PENDING.value: {DealStatus.HOLD_PERIOD.value, DealStatus.PAYMENT_FAILED.value, DealStatus.CANCELLED.value},
    DealStatus.PAYMENT_FAILED.value: {DealStatus.INVOICED.value, DealStatus.CANCELLED.value},  # Can retry
    # UC-3.2: HOLD_PERIOD can go to AWAITING_CLIENT_CONFIRMATION (agent marks service completed)
    # or directly to PAYOUT_READY (legacy auto-release for MOR deals)
    DealStatus.HOLD_PERIOD.value: {
        DealStatus.AWAITING_CLIENT_CONFIRMATION.value,  # Agent marks service completed
        DealStatus.PAYOUT_READY.value,  # Legacy auto-release (MOR deals)
        DealStatus.DISPUTE.value,
        DealStatus.CANCELLED.value,
    },
    # UC-3.2: Client confirmation via Act signing
    # Client signs Act → PAYOUT_READY
    # 7 days without action → auto-release to PAYOUT_READY
    # Client opens dispute → DISPUTE
    DealStatus.AWAITING_CLIENT_CONFIRMATION.value: {
        DealStatus.PAYOUT_READY.value,  # Client signed Act or auto-release after 7 days
        DealStatus.DISPUTE.value,  # Client opens dispute
        DealStatus.CANCELLED.value,
    },
    DealStatus.PAYOUT_READY.value: {DealStatus.PAYOUT_IN_PROGRESS.value, DealStatus.DISPUTE.value},
    DealStatus.PAYOUT_IN_PROGRESS.value: {DealStatus.CLOSED.value},
    DealStatus.DISPUTE.value: {
        DealStatus.HOLD_PERIOD.value,  # Dispute resolved, back to hold
        DealStatus.AWAITING_CLIENT_CONFIRMATION.value,  # Dispute resolved, needs client confirmation
        DealStatus.REFUNDED.value,  # Refund to client
        DealStatus.CANCELLED.value,
    },
    DealStatus.REFUNDED.value: set(),  # Terminal
    DealStatus.CLOSED.value: set(),  # Terminal
    DealStatus.CANCELLED.value: {DealStatus.DRAFT.value},  # Can recover early cancellations
}


@dataclass
class CreateBankSplitDealInput:
    """Input for creating a bank-split deal"""
    deal_type: str
    property_address: str
    price: Decimal
    commission_total: Decimal
    description: str
    client_name: str
    client_phone: str
    client_email: Optional[str] = None

    # Agent info (creator)
    agent_user_id: int = None

    # Organization (optional - if agent works for agency)
    organization_id: Optional[UUID] = None

    # Custom split (optional - uses org default if not provided)
    agent_split_percent: Optional[int] = None


@dataclass
class BankSplitDealResult:
    """Result of bank-split deal creation"""
    deal: Deal
    recipients: List[DealSplitRecipient]
    payment_url: Optional[str] = None


class BankSplitDealService:
    """
    Main service for bank-split deal lifecycle.

    Flow:
    1. create_deal() - Create deal in DRAFT
    2. submit_for_signing() - Move to AWAITING_SIGNATURES
    3. mark_signed() - After signatures collected, move to SIGNED
    4. create_invoice() - Create T-Bank deal, move to INVOICED
    5. (webhook) payment received -> PAYMENT_PENDING -> HOLD_PERIOD
    6. (auto) hold expires -> CLOSED
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.split_service = SplitService(db)
        self.invoice_service = InvoiceService(db)

    async def create_deal(
        self,
        input: CreateBankSplitDealInput,
        creator: User,
    ) -> BankSplitDealResult:
        """
        Создание новой bank-split сделки.

        Args:
            input: Входные данные для создания сделки
            creator: Пользователь, создающий сделку

        Returns:
            BankSplitDealResult со сделкой и получателями

        Raises:
            ValueError: если сумма меньше минимальной
        """
        # Валидация минимальной суммы
        if input.commission_total < settings.MIN_DEAL_AMOUNT:
            raise ValueError(
                f"Сумма комиссии ({input.commission_total} руб) меньше минимальной "
                f"({settings.MIN_DEAL_AMOUNT} руб)"
            )

        if input.commission_total > settings.MAX_DEAL_AMOUNT:
            raise ValueError(
                f"Сумма комиссии ({input.commission_total} руб) превышает максимальную "
                f"({settings.MAX_DEAL_AMOUNT} руб)"
            )

        # Определение процентов распределения
        agent_percent = input.agent_split_percent
        if agent_percent is None and input.organization_id:
            agent_percent = await self.split_service.get_default_split_percent(
                creator.id, input.organization_id
            )
        if agent_percent is None:
            agent_percent = 100  # Solo agent gets 100%

        agency_percent = 100 - agent_percent

        # Create the deal
        deal = Deal(
            type=input.deal_type,
            created_by_user_id=creator.id,
            agent_user_id=creator.id,
            executor_type="org" if input.organization_id else "user",
            executor_id=input.organization_id or creator.id,
            property_address=input.property_address,
            price=input.price,
            commission_agent=input.commission_total,
            status="draft",
            payment_model="bank_hold_split",
            description=input.description,
            client_name=input.client_name,
            client_phone=input.client_phone,
            payer_email=input.client_email,
        )
        self.db.add(deal)
        await self.db.flush()

        # Prepare split recipients
        recipients_input = []

        # Agent recipient
        recipients_input.append(SplitRecipientInput(
            role=RecipientRole.AGENT,
            user_id=creator.id,
            split_type=SplitType.PERCENT,
            split_value=Decimal(str(agent_percent)),
            # TODO: Get agent's INN, legal_type from profile
        ))

        # Agency recipient (if applicable)
        if input.organization_id and agency_percent > 0:
            org = await self._get_organization(input.organization_id)
            if org:
                recipients_input.append(SplitRecipientInput(
                    role=RecipientRole.AGENCY,
                    organization_id=input.organization_id,
                    inn=org.inn,
                    kpp=org.kpp,
                    legal_type="ooo",  # Assume LLC for agencies
                    split_type=SplitType.PERCENT,
                    split_value=Decimal(str(agency_percent)),
                ))

        # Create split recipients
        recipients = await self.split_service.create_split_recipients(
            deal_id=deal.id,
            total_amount=input.commission_total,
            recipients=recipients_input,
        )

        await self.db.refresh(deal)

        logger.info(f"Created bank-split deal {deal.id} with {len(recipients)} recipients")

        return BankSplitDealResult(
            deal=deal,
            recipients=recipients,
        )

    async def get_deal(self, deal_id: UUID) -> Optional[Deal]:
        """Get deal by ID with related data"""
        stmt = (
            select(Deal)
            .where(Deal.id == deal_id, Deal.deleted_at.is_(None))
            .options(
                selectinload(Deal.split_recipients),
                selectinload(Deal.milestones),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def submit_for_signing(self, deal: Deal) -> Deal:
        """
        Submit deal for signatures.

        Precondition: deal.status == 'draft'
        Postcondition: deal.status == 'awaiting_signatures'
        """
        self._validate_transition(deal, "awaiting_signatures")

        # TODO: Generate contract document
        # TODO: Send signing links to parties

        deal.status = "awaiting_signatures"
        await self.db.flush()

        logger.info(f"Deal {deal.id} submitted for signing")
        return deal

    async def mark_signed(self, deal: Deal) -> Deal:
        """
        Mark deal as signed (all signatures collected).

        Precondition: deal.status == 'awaiting_signatures'
        Postcondition: deal.status == 'signed'
        """
        self._validate_transition(deal, "signed")

        # TODO: Verify all required signatures are present

        deal.status = "signed"
        await self.db.flush()

        logger.info(f"Deal {deal.id} marked as signed")
        return deal

    async def create_invoice(
        self,
        deal: Deal,
        return_url: str = None,
    ) -> BankSplitDealResult:
        """
        Create invoice in T-Bank and get payment link.

        Precondition: deal.status == 'signed'
        Postcondition: deal.status == 'invoiced'
        """
        self._validate_transition(deal, "invoiced")

        # Get recipients
        recipients = await self.split_service.get_deal_recipients(deal.id)
        if not recipients:
            raise ValueError("No split recipients found for deal")

        # Register recipients in T-Bank if not already
        await self._ensure_recipients_registered(recipients)

        # Create invoice in T-Bank
        deal = await self.invoice_service.create_invoice(
            deal=deal,
            recipients=recipients,
            customer_email=deal.payer_email,
            customer_phone=deal.client_phone,
            return_url=return_url,
        )

        deal.status = "invoiced"
        await self.db.flush()

        logger.info(f"Deal {deal.id} invoiced, payment link: {deal.payment_link_url}")

        return BankSplitDealResult(
            deal=deal,
            recipients=recipients,
            payment_url=deal.payment_link_url,
        )

    async def handle_payment_received(self, deal: Deal) -> Deal:
        """
        Handle payment received webhook.

        Precondition: deal.status == 'invoiced' or 'payment_pending'
        Postcondition: deal.status == 'hold_period'
        """
        if deal.status not in ("invoiced", "payment_pending"):
            logger.warning(f"Unexpected status for payment: {deal.status}")
            return deal

        deal.status = "hold_period"

        # Set hold expiry (use timezone-naive for DB compatibility)
        from datetime import timedelta
        deal.hold_expires_at = datetime.utcnow() + timedelta(
            seconds=settings.TBANK_HOLD_PERIOD_SECONDS
        )

        # Update recipients status
        recipients = await self.split_service.get_deal_recipients(deal.id)
        for r in recipients:
            r.payout_status = PayoutStatus.HOLD.value

        await self.db.flush()

        logger.info(f"Deal {deal.id} payment received, hold until {deal.hold_expires_at}")
        return deal

    async def request_client_confirmation(self, deal: Deal, agent_user_id: int) -> Deal:
        """
        UC-3.2: Agent marks service as completed, requesting client confirmation.

        Precondition: deal.status == 'hold_period'
        Postcondition: deal.status == 'awaiting_client_confirmation'

        Args:
            deal: The deal to request confirmation for
            agent_user_id: ID of the agent marking service completed

        Returns:
            Updated deal

        Raises:
            ValueError: If invalid transition or agent not authorized
        """
        from datetime import timedelta

        # Validate agent is authorized (must be deal's agent or coagent)
        if deal.agent_user_id != agent_user_id and deal.coagent_user_id != agent_user_id:
            raise ValueError("Only deal agent or coagent can mark service completed")

        self._validate_transition(deal, DealStatus.AWAITING_CLIENT_CONFIRMATION.value)

        # Set confirmation timestamps
        now = datetime.utcnow()
        deal.status = DealStatus.AWAITING_CLIENT_CONFIRMATION.value
        deal.client_confirmation_requested_at = now
        deal.client_confirmation_deadline = now + timedelta(days=7)  # Auto-release in 7 days

        await self.db.flush()

        logger.info(
            f"Deal {deal.id} awaiting client confirmation, deadline: {deal.client_confirmation_deadline}"
        )
        return deal

    async def handle_act_signed(self, deal: Deal) -> Deal:
        """
        UC-3.2: Handle client signing the Act of Completed Services.

        Precondition: deal.status == 'awaiting_client_confirmation'
        Postcondition: deal.status == 'payout_ready'

        Returns:
            Updated deal ready for payout
        """
        self._validate_transition(deal, DealStatus.PAYOUT_READY.value)

        deal.status = DealStatus.PAYOUT_READY.value
        deal.act_signed_at = datetime.utcnow()

        await self.db.flush()

        logger.info(f"Deal {deal.id} act signed, ready for payout")
        return deal

    async def auto_release_confirmation(self, deal: Deal) -> Deal:
        """
        UC-3.2: Auto-release after 7 days without client action.

        Precondition: deal.status == 'awaiting_client_confirmation'
        Postcondition: deal.status == 'payout_ready'

        Called by Celery task when client_confirmation_deadline expires
        without signature or dispute.
        """
        if deal.dispute_locked:
            raise ValueError(
                f"Cannot auto-release: dispute in progress. Reason: {deal.dispute_lock_reason}"
            )

        self._validate_transition(deal, DealStatus.PAYOUT_READY.value)

        deal.status = DealStatus.PAYOUT_READY.value
        # act_signed_at remains None - indicates auto-release

        await self.db.flush()

        logger.info(f"Deal {deal.id} auto-released after confirmation timeout")
        return deal

    async def release_from_hold(self, deal: Deal) -> Deal:
        """
        Release deal from hold period (auto or manual).

        Precondition: deal.status == 'hold_period'
        Postcondition: deal.status == 'closed'

        Raises:
            ValueError: If deal is locked by dispute
        """
        # TASK-2.3: Check dispute lock before release
        if deal.dispute_locked:
            raise ValueError(
                f"Cannot release: dispute in progress. Reason: {deal.dispute_lock_reason}"
            )

        self._validate_transition(deal, "closed")

        # Release in T-Bank
        deal = await self.invoice_service.release_deal(deal)

        logger.info(f"Deal {deal.id} released from hold")
        return deal

    async def cancel_deal(self, deal: Deal, reason: str = None) -> Deal:
        """
        Cancel deal.

        Can be called from most states except 'closed'.
        """
        if deal.status == "closed":
            raise ValueError("Cannot cancel closed deal")

        if deal.status == "cancelled":
            return deal

        # Cancel in T-Bank if invoice was created
        if deal.external_deal_id:
            deal = await self.invoice_service.cancel_deal(deal, reason)
        else:
            deal.status = "cancelled"

        await self.db.flush()

        logger.info(f"Deal {deal.id} cancelled: {reason}")
        return deal

    async def check_expired_holds(self) -> List[Deal]:
        """
        Check for deals with expired hold period and release them.

        Called by background task.
        TASK-2.3: Skips deals locked by dispute.

        Returns:
            List of released deals
        """
        now = datetime.utcnow()

        stmt = select(Deal).where(
            Deal.status == "hold_period",
            Deal.hold_expires_at <= now,
            Deal.deleted_at.is_(None),
            Deal.dispute_locked == False,  # TASK-2.3: Skip disputed deals
        )
        result = await self.db.execute(stmt)
        deals = list(result.scalars().all())

        released = []
        for deal in deals:
            try:
                await self.release_from_hold(deal)
                released.append(deal)
            except Exception as e:
                logger.error(f"Failed to release deal {deal.id}: {e}")

        if released:
            logger.info(f"Released {len(released)} deals from expired hold")

        return released

    async def check_expired_confirmations(self) -> List[Deal]:
        """
        UC-3.2: Check for deals with expired client confirmation deadline.

        Called by background task (Celery).
        Auto-releases deals where client hasn't signed Act within 7 days.
        Skips deals locked by dispute.

        Returns:
            List of auto-released deals
        """
        now = datetime.utcnow()

        stmt = select(Deal).where(
            Deal.status == DealStatus.AWAITING_CLIENT_CONFIRMATION.value,
            Deal.client_confirmation_deadline <= now,
            Deal.act_signed_at.is_(None),  # Not signed yet
            Deal.deleted_at.is_(None),
            Deal.dispute_locked == False,  # Skip disputed deals
        )
        result = await self.db.execute(stmt)
        deals = list(result.scalars().all())

        released = []
        for deal in deals:
            try:
                await self.auto_release_confirmation(deal)
                released.append(deal)
            except Exception as e:
                logger.error(f"Failed to auto-release confirmation for deal {deal.id}: {e}")

        if released:
            logger.info(f"Auto-released {len(released)} deals from expired confirmation")

        return released

    async def _ensure_recipients_registered(
        self,
        recipients: List[DealSplitRecipient],
    ) -> None:
        """Ensure all recipients are registered in T-Bank"""
        tbank_client = get_tbank_deals_client()

        for r in recipients:
            if r.external_recipient_id:
                continue  # Already registered

            if not r.inn:
                logger.warning(f"Recipient {r.id} has no INN, cannot register")
                continue

            # Validate INN before registration
            validation_result = await self._validate_recipient_inn(r)
            if not validation_result.is_valid:
                errors = ", ".join(validation_result.errors)
                logger.error(f"INN validation failed for recipient {r.id}: {errors}")
                raise ValueError(f"INN validation failed: {errors}")

            try:
                # Get name for recipient
                name = await self._get_recipient_name(r)

                # Register in T-Bank
                tbank_recipient = await tbank_client.create_recipient(
                    inn=r.inn,
                    name=name,
                    phone=None,  # TODO: Get phone if self-employed
                )

                r.external_recipient_id = tbank_recipient.external_id
                r.external_beneficiary_id = tbank_recipient.external_id

                logger.info(f"Registered recipient {r.id} in T-Bank: {tbank_recipient.external_id}")

            except TBankError as e:
                logger.error(f"Failed to register recipient {r.id}: {e}")
                raise

        await self.db.flush()

    async def _validate_recipient_inn(self, recipient: DealSplitRecipient):
        """Validate recipient's INN using comprehensive validation service"""
        inn_service = INNValidationService(self.db)

        # Determine role for validation
        role = recipient.role.value if hasattr(recipient.role, 'value') else str(recipient.role)

        return await inn_service.validate_recipient_inn(
            inn=recipient.inn,
            role=role,
        )

    async def _get_recipient_name(self, recipient: DealSplitRecipient) -> str:
        """Get display name for recipient"""
        if recipient.organization_id:
            org = await self._get_organization(recipient.organization_id)
            return org.legal_name if org else f"Organization {recipient.organization_id}"

        if recipient.user_id:
            user = await self._get_user(recipient.user_id)
            return user.full_name if user and user.full_name else f"User {recipient.user_id}"

        return f"Recipient {recipient.inn}"

    async def _get_organization(self, org_id: UUID) -> Optional[Organization]:
        """Get organization by ID"""
        stmt = select(Organization).where(Organization.id == org_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _validate_transition(self, deal: Deal, new_status: str) -> None:
        """Validate state transition"""
        allowed = BANK_SPLIT_TRANSITIONS.get(deal.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition: {deal.status} -> {new_status}. "
                f"Allowed: {list(allowed)}"
            )
