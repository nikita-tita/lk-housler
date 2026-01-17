"""Dispute models for deal conflicts and refunds"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    Numeric,
    Boolean,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class DisputeStatus(str, PyEnum):
    """Dispute status"""
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DisputeReason(str, PyEnum):
    """Predefined dispute reasons"""
    SERVICE_NOT_PROVIDED = "service_not_provided"
    SERVICE_QUALITY = "service_quality"
    INCORRECT_AMOUNT = "incorrect_amount"
    DUPLICATE_PAYMENT = "duplicate_payment"
    UNAUTHORIZED_PAYMENT = "unauthorized_payment"
    OTHER = "other"


class RefundStatus(str, PyEnum):
    """Refund status"""
    NOT_REQUESTED = "not_requested"
    REQUESTED = "requested"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"


class DisputeResolution(str, PyEnum):
    """Resolution type"""
    FULL_REFUND = "full_refund"
    PARTIAL_REFUND = "partial_refund"
    NO_REFUND = "no_refund"
    SPLIT_ADJUSTMENT = "split_adjustment"


class Dispute(BaseModel):
    """Dispute record for a deal"""

    __tablename__ = "disputes"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    initiator_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Dispute details
    reason = Column(String(50), nullable=False)  # DisputeReason
    description = Column(Text, nullable=False)

    # Status
    status = Column(String(20), default="open", nullable=False, index=True)

    # Resolution (set when resolved)
    resolution = Column(String(50), nullable=True)  # DisputeResolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Refund tracking
    refund_requested = Column(Boolean, default=False, nullable=False)
    refund_amount = Column(Numeric(15, 2), nullable=True)
    refund_status = Column(String(20), default="not_requested", nullable=False)
    refund_external_id = Column(String(255), nullable=True)  # T-Bank refund ID
    refund_processed_at = Column(DateTime, nullable=True)

    # Admin notes (internal)
    admin_notes = Column(Text, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="disputes")
    initiator = relationship("User", foreign_keys=[initiator_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
    evidence = relationship("DisputeEvidence", back_populates="dispute", cascade="all, delete-orphan")


class DisputeEvidence(BaseModel):
    """Evidence files attached to disputes"""

    __tablename__ = "dispute_evidence"

    dispute_id = Column(UUID(as_uuid=True), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False, index=True)

    # File info
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # image, pdf, document
    file_size = Column(Integer, nullable=True)  # bytes

    # Upload info
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    dispute = relationship("Dispute", back_populates="evidence")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])
