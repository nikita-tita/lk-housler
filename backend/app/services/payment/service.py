"""Payment service implementation"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import (
    PaymentSchedule,
    PaymentIntent,
    Payment,
    PaymentScheduleStatus,
    PaymentIntentStatus,
    PaymentStatus,
    TriggerType,
)
from app.models.deal import Deal
from app.services.payment.provider import get_payment_provider


# Valid state transitions for PaymentSchedule
SCHEDULE_TRANSITIONS: dict[PaymentScheduleStatus, set[PaymentScheduleStatus]] = {
    PaymentScheduleStatus.LOCKED: {PaymentScheduleStatus.AVAILABLE, PaymentScheduleStatus.CANCELLED},
    PaymentScheduleStatus.AVAILABLE: {PaymentScheduleStatus.PAID, PaymentScheduleStatus.CANCELLED},
    PaymentScheduleStatus.PAID: {PaymentScheduleStatus.REFUNDED},
    PaymentScheduleStatus.REFUNDED: set(),  # Terminal
    PaymentScheduleStatus.CANCELLED: set(),  # Terminal
}


class PaymentService:
    """Payment service"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = get_payment_provider()
    
    async def create_payment_intent(
        self,
        schedule: PaymentSchedule
    ) -> PaymentIntent:
        """Create payment intent for schedule step"""
        if schedule.status != PaymentScheduleStatus.AVAILABLE:
            raise ValueError("Payment schedule step is not available")

        # Check if already has pending intent
        stmt = (
            select(PaymentIntent)
            .where(
                PaymentIntent.schedule_id == schedule.id,
                PaymentIntent.status.in_([
                    PaymentIntentStatus.CREATED,
                    PaymentIntentStatus.PENDING
                ])
            )
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return existing

        # Create intent via provider
        idempotency_key = f"{schedule.deal_id}_{schedule.step_no}_{uuid4().hex[:8]}"

        provider_result = await self.provider.create_payment_intent(
            amount=schedule.amount,
            currency=schedule.currency,
            metadata={
                "deal_id": str(schedule.deal_id),
                "step_no": schedule.step_no,
            }
        )

        # Create intent record
        intent = PaymentIntent(
            schedule_id=schedule.id,
            provider="mock",  # TODO: get from settings
            amount=schedule.amount,
            sbp_link=provider_result["sbp_link"],
            expires_at=datetime.utcnow() + timedelta(hours=24),
            status=PaymentIntentStatus.CREATED,
            provider_intent_id=provider_result["provider_intent_id"],
            idempotency_key=idempotency_key,
        )

        self.db.add(intent)
        await self.db.flush()

        # Transition deal to PAYMENT_PENDING (first payment intent)
        stmt_deal = select(Deal).where(Deal.id == schedule.deal_id)
        result_deal = await self.db.execute(stmt_deal)
        deal = result_deal.scalar_one_or_none()

        if deal:
            from app.services.deal.service import DealService
            deal_service = DealService(self.db)
            try:
                await deal_service.transition_to_payment_pending(deal)
            except ValueError:
                # Deal may already be in PAYMENT_PENDING or later state
                pass

        await self.db.refresh(intent)

        return intent
    
    async def process_payment_webhook(
        self,
        provider_intent_id: str,
        provider_tx_id: str,
        status: str,
        metadata: Optional[dict] = None
    ) -> Payment:
        """Process payment webhook from provider"""
        # Find intent
        stmt = select(PaymentIntent).where(
            PaymentIntent.provider_intent_id == provider_intent_id
        )
        result = await self.db.execute(stmt)
        intent = result.scalar_one_or_none()
        
        if not intent:
            raise ValueError("Payment intent not found")
        
        if status == "paid":
            # Create payment record
            payment = Payment(
                intent_id=intent.id,
                provider_tx_id=provider_tx_id,
                paid_at=datetime.utcnow(),
                gross_amount=intent.amount,
                status=PaymentStatus.SUCCEEDED,
                provider_meta=metadata,
            )
            self.db.add(payment)

            # Update intent status
            intent.status = PaymentIntentStatus.PAID

            # Update schedule status with validation
            stmt_schedule = (
                select(PaymentSchedule)
                .where(PaymentSchedule.id == intent.schedule_id)
            )
            result_schedule = await self.db.execute(stmt_schedule)
            schedule = result_schedule.scalar_one()
            await self._set_schedule_status(schedule, PaymentScheduleStatus.PAID)

            # Create ledger entries and splits
            from app.services.ledger.service import LedgerService
            ledger_service = LedgerService(self.db)
            await ledger_service.process_payment(payment)

            # Activate next payment step if exists
            await self.activate_next_step(schedule.deal_id, schedule.step_no)

            # Transition deal to IN_PROGRESS
            stmt_deal = select(Deal).where(Deal.id == schedule.deal_id)
            result_deal = await self.db.execute(stmt_deal)
            deal = result_deal.scalar_one_or_none()

            if deal:
                from app.services.deal.service import DealService
                deal_service = DealService(self.db)
                try:
                    await deal_service.transition_to_in_progress(deal)
                except ValueError:
                    # Deal may not be in correct state yet (needs signatures first)
                    pass

            await self.db.refresh(payment)
            return payment
        
        elif status == "failed":
            intent.status = PaymentIntentStatus.FAILED
            await self.db.flush()
            raise ValueError("Payment failed")
        
        else:
            raise ValueError(f"Unknown payment status: {status}")
    
    async def get_deal_payment_schedules(self, deal_id: UUID) -> list[PaymentSchedule]:
        """Get all payment schedules for deal"""
        stmt = (
            select(PaymentSchedule)
            .where(PaymentSchedule.deal_id == deal_id)
            .order_by(PaymentSchedule.step_no)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def create_intent(
        self,
        deal_id: str,
        amount: int,
        description: Optional[str] = None
    ) -> PaymentIntent:
        """Create payment intent for deal (simplified API)"""
        # Convert deal_id to UUID
        from uuid import UUID
        deal_uuid = UUID(deal_id)
        
        # Find or create payment schedule
        stmt = select(PaymentSchedule).where(
            PaymentSchedule.deal_id == deal_uuid
        ).order_by(PaymentSchedule.step_no)
        result = await self.db.execute(stmt)
        schedule = result.scalars().first()
        
        if not schedule:
            # Create default schedule
            schedule = PaymentSchedule(
                deal_id=deal_uuid,
                step_no=1,
                amount=amount,
                currency="RUB",
                status=PaymentScheduleStatus.AVAILABLE
            )
            self.db.add(schedule)
            await self.db.flush()
        
        # Create intent
        return await self.create_payment_intent(schedule)
    
    async def get_payment(self, payment_id: str) -> Optional[Payment]:
        """Get payment by ID"""
        from uuid import UUID
        payment_uuid = UUID(payment_id)

        stmt = select(Payment).where(Payment.id == payment_uuid)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_payment_with_details(self, payment_id: str) -> Optional[Payment]:
        """Get payment by ID with related intent and schedule loaded"""
        from uuid import UUID
        payment_uuid = UUID(payment_id)

        stmt = (
            select(Payment)
            .where(Payment.id == payment_uuid)
            .options(
                selectinload(Payment.intent).selectinload(PaymentIntent.schedule)
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_payment_by_provider_tx_id(self, provider_tx_id: str) -> Optional[Payment]:
        """Get payment by provider transaction ID (for deduplication)"""
        stmt = select(Payment).where(Payment.provider_tx_id == provider_tx_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_payment_status(
        self,
        payment_id: str,
        status: str,
        provider_payment_id: Optional[str] = None
    ):
        """Update payment status from webhook"""
        from uuid import UUID
        payment_uuid = UUID(payment_id)
        
        stmt = select(Payment).where(Payment.id == payment_uuid)
        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise ValueError("Payment not found")
        
        # Update status
        if status == "succeeded":
            payment.status = PaymentStatus.SUCCEEDED
            payment.paid_at = datetime.utcnow()
        elif status == "failed":
            payment.status = PaymentStatus.FAILED
        elif status == "canceled":
            payment.status = PaymentStatus.CANCELED
        
        if provider_payment_id:
            payment.provider_tx_id = provider_payment_id

        await self.db.flush()

    def _validate_schedule_transition(
        self,
        schedule: PaymentSchedule,
        new_status: PaymentScheduleStatus
    ) -> None:
        """Validate payment schedule status transition"""
        allowed = SCHEDULE_TRANSITIONS.get(schedule.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid schedule transition: {schedule.status.value} -> {new_status.value}"
            )

    async def _set_schedule_status(
        self,
        schedule: PaymentSchedule,
        new_status: PaymentScheduleStatus
    ) -> None:
        """Set schedule status with validation"""
        self._validate_schedule_transition(schedule, new_status)
        schedule.status = new_status
        await self.db.flush()

    async def activate_next_step(self, deal_id: UUID, current_step_no: int) -> Optional[PaymentSchedule]:
        """Activate next payment step after current step is paid"""
        # Find next step
        stmt = (
            select(PaymentSchedule)
            .where(
                PaymentSchedule.deal_id == deal_id,
                PaymentSchedule.step_no == current_step_no + 1,
                PaymentSchedule.status == PaymentScheduleStatus.LOCKED
            )
        )
        result = await self.db.execute(stmt)
        next_step = result.scalar_one_or_none()

        if not next_step:
            return None

        # Check trigger type - only activate immediate triggers automatically
        if next_step.trigger_type == TriggerType.IMMEDIATE:
            await self._set_schedule_status(next_step, PaymentScheduleStatus.AVAILABLE)
            return next_step

        # For MILESTONE/DATE triggers, leave as LOCKED until triggered externally
        return None

