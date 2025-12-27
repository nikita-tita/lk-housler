"""Ledger service implementation"""

from decimal import Decimal
from typing import List, Dict, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import (
    LedgerEntry,
    Split,
    Payout,
    EntryType,
    Account,
    SplitStatus,
)
from app.models.payment import Payment
from app.models.deal import Deal
from app.core.config import settings


class LedgerService:
    """Ledger service (append-only accounting)"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def process_payment(self, payment: Payment) -> List[LedgerEntry]:
        """Process payment and create ledger entries"""
        entries = []
        
        # 1. Payment incoming
        entry_in = LedgerEntry(
            payment_id=payment.id,
            entry_type=EntryType.PAYMENT_IN,
            amount=payment.gross_amount,
            account=Account.PLATFORM,
        )
        entries.append(entry_in)
        
        # 2. Acquirer fee (2%)
        acq_fee = payment.gross_amount * Decimal(
            settings.PAYMENT_ACQUIRER_FEE_PERCENT / 100
        )
        entry_acq = LedgerEntry(
            payment_id=payment.id,
            entry_type=EntryType.ACQ_FEE,
            amount=-acq_fee,
            account=Account.BANK,
            meta={"fee_percent": settings.PAYMENT_ACQUIRER_FEE_PERCENT}
        )
        entries.append(entry_acq)
        
        # 3. Bank rebate (1.3%)
        bank_rebate = payment.gross_amount * Decimal(
            settings.PAYMENT_PLATFORM_REBATE_PERCENT / 100
        )
        entry_rebate = LedgerEntry(
            payment_id=payment.id,
            entry_type=EntryType.BANK_REBATE,
            amount=bank_rebate,
            account=Account.PLATFORM,
            meta={"rebate_percent": settings.PAYMENT_PLATFORM_REBATE_PERCENT}
        )
        entries.append(entry_rebate)
        
        # Add all entries
        for entry in entries:
            self.db.add(entry)
        
        await self.db.flush()
        
        # Create splits
        await self._create_splits(payment)
        
        return entries
    
    async def _create_splits(self, payment: Payment) -> List[Split]:
        """Create payment splits based on deal terms"""
        # Get deal with terms
        from app.models.payment import PaymentSchedule, PaymentIntent
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Deal)
            .join(PaymentSchedule)
            .join(PaymentIntent)
            .join(Payment)
            .where(Payment.id == payment.id)
            .options(selectinload(Deal.terms))
        )
        result = await self.db.execute(stmt)
        deal = result.scalar_one()

        # For simple deals without terms, default to 100% agent split
        if not deal.terms or not deal.terms.split_rule:
            split_rule = {"agent": 100}
        else:
            split_rule = deal.terms.split_rule

        # Net amount after fees
        net_amount = payment.gross_amount * Decimal(0.98)  # After 2% acquirer fee

        splits = []

        for role, percent in split_rule.items():
            split_amount = net_amount * Decimal(percent / 100)

            # Determine recipient
            if role == "agent":
                recipient_type = "user"
                recipient_id = deal.agent_user_id
            elif role == "agency":
                recipient_type = "org"
                recipient_id = deal.executor_id
            else:
                continue

            split = Split(
                payment_id=payment.id,
                recipient_type=recipient_type,
                recipient_id=recipient_id,
                amount=split_amount,
                status=SplitStatus.SCHEDULED,
            )
            splits.append(split)
            self.db.add(split)

        await self.db.flush()

        # TODO: Schedule payouts or hold based on antifraud

        return splits
    
    async def get_payment_ledger(self, payment_id: UUID) -> List[LedgerEntry]:
        """Get ledger entries for payment"""
        stmt = (
            select(LedgerEntry)
            .where(LedgerEntry.payment_id == payment_id)
            .order_by(LedgerEntry.created_at)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_balance(self, account: Account) -> Decimal:
        """Get balance for account"""
        stmt = select(LedgerEntry).where(LedgerEntry.account == account)
        result = await self.db.execute(stmt)
        entries = result.scalars().all()
        
        balance = sum(entry.amount for entry in entries)
        return Decimal(balance)

