"""Receipt and NPD task models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class ReceiptType(str, PyEnum):
    """Receipt type"""
    KKT_54FZ = "kkt_54fz"
    BANK_RECEIPT = "bank_receipt"
    NPD_ATTACHMENT = "npd_attachment"
    ACT = "act"


class ReceiptStatus(str, PyEnum):
    """Receipt status"""
    PENDING = "pending"
    READY = "ready"
    REJECTED = "rejected"


class NPDTaskStatus(str, PyEnum):
    """NPD task status"""
    OPEN = "open"
    SUBMITTED = "submitted"
    OVERDUE = "overdue"


class Receipt(BaseModel):
    """Receipt"""

    __tablename__ = "receipts"

    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)

    type = Column(Enum(ReceiptType), nullable=False)

    url = Column(String(500), nullable=True)

    status = Column(
        Enum(ReceiptStatus),
        default=ReceiptStatus.PENDING,
        nullable=False
    )

    meta = Column(JSONB, nullable=True)

    # Relationships
    payment = relationship("Payment", back_populates="receipts")


class NPDTask(BaseModel):
    """NPD task (самозанятый должен приложить чек)"""

    __tablename__ = "npd_tasks"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    due_at = Column(DateTime, nullable=False)

    status = Column(
        Enum(NPDTaskStatus),
        default=NPDTaskStatus.OPEN,
        nullable=False
    )
