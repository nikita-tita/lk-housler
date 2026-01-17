"""Consent models for deal agreements"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class ConsentType(str, PyEnum):
    """Types of consent that can be given"""
    PLATFORM_COMMISSION = "platform_commission"  # Agree to platform fee
    DATA_PROCESSING = "data_processing"  # Personal data processing (152-FZ)
    TERMS_OF_SERVICE = "terms_of_service"  # Platform terms
    SPLIT_AGREEMENT = "split_agreement"  # Agree to split distribution


class DealConsent(BaseModel):
    """User consent record for a deal"""

    __tablename__ = "deal_consents"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Consent details
    consent_type = Column(String(50), nullable=False, index=True)
    consent_version = Column(String(20), default="1.0", nullable=False)  # Version of the agreement

    # When and how consent was given
    agreed_at = Column(DateTime, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)

    # Reference to what was agreed to (optional document link)
    document_url = Column(String(500), nullable=True)
    document_hash = Column(String(64), nullable=True)  # SHA-256 of the document at time of consent

    # Withdrawal (if consent is revoked)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(Text, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="consents")
    user = relationship("User", foreign_keys=[user_id])
