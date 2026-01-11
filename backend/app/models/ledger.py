"""Ledger and payout models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, ForeignKey, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class EntryType(str, PyEnum):
    """Ledger entry type"""

    PAYMENT_IN = "payment_in"
    ACQ_FEE = "acq_fee"
    BANK_REBATE = "bank_rebate"
    SPLIT_HOLD = "split_hold"
    PAYOUT = "payout"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class Account(str, PyEnum):
    """Ledger account"""

    PLATFORM = "platform"
    BANK = "bank"
    AGENCY = "agency"
    AGENT = "agent"
    DEVELOPER = "developer"
    HOLD = "hold"


class SplitStatus(str, PyEnum):
    """Split status"""

    SCHEDULED = "scheduled"
    HELD = "held"
    PAID = "paid"
    FAILED = "failed"


class PayoutStatus(str, PyEnum):
    """Payout status"""

    INITIATED = "initiated"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class LedgerEntry(BaseModel):
    """Ledger entry (append-only)"""

    __tablename__ = "ledger_entries"

    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)

    entry_type = Column(Enum(EntryType), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    account = Column(Enum(Account), nullable=False, index=True)

    meta = Column(JSONB, nullable=True)

    # Relationships
    payment = relationship("Payment", back_populates="ledger_entries")


class Split(BaseModel):
    """Payment split between participants"""

    __tablename__ = "splits"

    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)

    recipient_type = Column(String(20), nullable=False)  # 'user' or 'org'
    recipient_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    amount = Column(Numeric(15, 2), nullable=False)

    status = Column(Enum(SplitStatus), default=SplitStatus.SCHEDULED, nullable=False, index=True)

    # Relationships
    payment = relationship("Payment", back_populates="splits")
    payout = relationship("Payout", back_populates="split", uselist=False)


class Payout(BaseModel):
    """Payout to recipient"""

    __tablename__ = "payouts"

    split_id = Column(UUID(as_uuid=True), ForeignKey("splits.id"), nullable=False, unique=True)

    provider_payout_id = Column(String(255), nullable=True, index=True)

    status = Column(Enum(PayoutStatus), default=PayoutStatus.INITIATED, nullable=False, index=True)

    error_code = Column(String(100), nullable=True)
    hold_until = Column(DateTime, nullable=True)

    # Метаданные
    provider_meta = Column(JSONB, nullable=True)

    # Relationships
    split = relationship("Split", back_populates="payout")
