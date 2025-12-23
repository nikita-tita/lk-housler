"""Payment service implementation"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import (
    PaymentSchedule,
    PaymentIntent,
    Payment,
    PaymentScheduleStatus,
    PaymentIntentStatus,
    PaymentStatus,
)
from app.models.deal import Deal
from app.services.payment.provider import get_payment_provider


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
            
            # Update schedule status
            stmt_schedule = select(PaymentSchedule).where(
                PaymentSchedule.id == intent.schedule_id
            )
            result_schedule = await self.db.execute(stmt_schedule)
            schedule = result_schedule.scalar_one()
            schedule.status = PaymentScheduleStatus.PAID
            
            await self.db.flush()
            
            # TODO: Create ledger entries
            # TODO: Create splits
            # TODO: Trigger next payment schedule step if needed
            
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

