"""Payment models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class TriggerType(str, PyEnum):
    """Payment trigger type"""
    IMMEDIATE = "immediate"
    MILESTONE = "milestone"
    DATE = "date"
    MANUAL = "manual"


class PaymentScheduleStatus(str, PyEnum):
    """Payment schedule status"""
    LOCKED = "locked"
    AVAILABLE = "available"
    PAID = "paid"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentIntentStatus(str, PyEnum):
    """Payment intent status"""
    CREATED = "created"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentStatus(str, PyEnum):
    """Payment status"""
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELED = "canceled"


class PaymentSchedule(BaseModel):
    """Payment schedule step"""

    __tablename__ = "payment_schedules"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False)

    step_no = Column(Integer, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB", nullable=False)

    trigger_type = Column(Enum(TriggerType), nullable=False)
    trigger_meta = Column(JSONB, nullable=True)
    # Например: {"milestone": "registration_confirmed", "proof_required": true}

    status = Column(
        Enum(PaymentScheduleStatus),
        default=PaymentScheduleStatus.LOCKED,
        nullable=False,
        index=True
    )

    # Relationships
    deal = relationship("Deal", back_populates="payment_schedules")
    intents = relationship("PaymentIntent", back_populates="schedule")


class PaymentIntent(BaseModel):
    """Payment intent (СБП link)"""

    __tablename__ = "payment_intents"

    schedule_id = Column(UUID(as_uuid=True), ForeignKey("payment_schedules.id"), nullable=False)

    provider = Column(String(50), nullable=False)  # bank_x, mock, etc.
    amount = Column(Numeric(15, 2), nullable=False)

    sbp_link = Column(String(500), nullable=True)

    expires_at = Column(DateTime, nullable=True)

    status = Column(
        Enum(PaymentIntentStatus),
        default=PaymentIntentStatus.CREATED,
        nullable=False,
        index=True
    )

    provider_intent_id = Column(String(255), nullable=True, index=True)
    idempotency_key = Column(String(255), nullable=False, unique=True, index=True)

    # Relationships
    schedule = relationship("PaymentSchedule", back_populates="intents")
    payments = relationship("Payment", back_populates="intent")


class Payment(BaseModel):
    """Completed payment"""

    __tablename__ = "payments"

    intent_id = Column(UUID(as_uuid=True), ForeignKey("payment_intents.id"), nullable=False)

    provider_tx_id = Column(String(255), nullable=False, unique=True, index=True)

    paid_at = Column(DateTime, nullable=False)
    gross_amount = Column(Numeric(15, 2), nullable=False)

    status = Column(
        Enum(PaymentStatus),
        default=PaymentStatus.SUCCEEDED,
        nullable=False,
        index=True
    )

    # Метаданные от провайдера
    provider_meta = Column(JSONB, nullable=True)

    # Relationships
    intent = relationship("PaymentIntent", back_populates="payments")
    ledger_entries = relationship("LedgerEntry", back_populates="payment")
    splits = relationship("Split", back_populates="payment")
    receipts = relationship("Receipt", back_populates="payment")
