"""Bank Split models for T-Bank integration"""

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
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class PaymentModel(str, PyEnum):
    """Payment model type"""
    MOR = "mor"  # Merchant of Record (legacy)
    BANK_HOLD_SPLIT = "bank_hold_split"  # T-Bank instant split


class RecipientRole(str, PyEnum):
    """Split recipient role"""
    AGENT = "agent"
    AGENCY = "agency"
    LEAD = "lead"
    PLATFORM_FEE = "platform_fee"


class LegalType(str, PyEnum):
    """Legal entity type"""
    IP = "ip"  # Individual Entrepreneur
    OOO = "ooo"  # LLC
    SE = "se"  # Self-Employed


class SplitType(str, PyEnum):
    """Split calculation type"""
    PERCENT = "percent"
    FIXED = "fixed"


class PayoutStatus(str, PyEnum):
    """Payout status for recipient"""
    PENDING = "pending"
    HOLD = "hold"
    RELEASED = "released"
    FAILED = "failed"


class BankEventStatus(str, PyEnum):
    """Bank event processing status"""
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"
    IGNORED = "ignored"


class SEBankStatus(str, PyEnum):
    """Self-Employed bank registration status"""
    DRAFT = "draft"
    ACTIVE = "active"
    BLOCKED = "blocked"


class MilestoneStatus(str, PyEnum):
    """Deal milestone status"""
    PENDING = "pending"
    READY_TO_PAY = "ready_to_pay"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    HOLD = "hold"
    RELEASED = "released"
    CANCELLED = "cancelled"


class EvidenceStatus(str, PyEnum):
    """Evidence file status"""
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    REJECTED = "rejected"


class DealSplitRecipient(BaseModel):
    """Deal split participant - who receives money from the deal"""

    __tablename__ = "deal_split_recipients"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, index=True)

    # Recipient role and legal info
    role = Column(String(50), nullable=False)  # agent/agency/lead/platform_fee
    legal_type = Column(String(20), nullable=True)  # IP/OOO/SE
    inn = Column(String(12), nullable=True)
    kpp = Column(String(9), nullable=True)

    # Link to internal entities (one of these should be set)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    payout_account_id = Column(UUID(as_uuid=True), ForeignKey("payout_accounts.id"), nullable=True)

    # T-Bank external IDs
    external_beneficiary_id = Column(String(100), nullable=True)
    external_recipient_id = Column(String(100), nullable=True)

    # Split calculation
    split_type = Column(String(20), default="percent", nullable=False)  # percent/fixed
    split_value = Column(Numeric(10, 4), nullable=False)  # Percent (0-100) or fixed amount
    calculated_amount = Column(Numeric(15, 2), nullable=True)  # Actual amount after calculation

    # Payout tracking
    payout_status = Column(String(20), default="pending", nullable=False, index=True)
    paid_at = Column(DateTime, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="split_recipients")
    user = relationship("User", foreign_keys=[user_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    payout_account = relationship("PayoutAccount", foreign_keys=[payout_account_id])


class SplitRuleTemplate(BaseModel):
    """Reusable split rule template for organization"""

    __tablename__ = "split_rule_templates"

    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    # Template identification
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False)  # e.g., "standard_60_35_5"
    description = Column(Text, nullable=True)

    # Applicability
    applies_to_deal_types = Column(JSONB, nullable=True)  # ["secondary_buy", "secondary_sell"]

    # Rules definition
    rules = Column(JSONB, nullable=False)
    # Example:
    # {
    #   "recipients": [
    #     {"role": "agent", "type": "percent", "value": 60},
    #     {"role": "agency", "type": "percent", "value": 35},
    #     {"role": "platform_fee", "type": "percent", "value": 5}
    #   ],
    #   "min_platform_fee": 500,
    #   "rounding": "floor"
    # }

    # Versioning
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Approval workflow
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="split_rule_templates")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


class BankEvent(BaseModel):
    """Immutable log of bank webhook events"""

    __tablename__ = "bank_events"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=True, index=True)
    payment_intent_id = Column(UUID(as_uuid=True), ForeignKey("payment_intents.id"), nullable=True, index=True)

    # Provider info
    provider = Column(String(50), default="tbank", nullable=False)
    external_event_id = Column(String(255), nullable=True, unique=True)

    # Event details
    event_type = Column(String(100), nullable=False, index=True)  # payment.completed, deal.cancelled, etc.
    payload = Column(JSONB, nullable=False)

    # Processing
    status = Column(String(20), default="pending", nullable=False, index=True)
    signature_valid = Column(Boolean, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    processing_error = Column(Text, nullable=True)
    received_at = Column(DateTime, nullable=False)

    # Relationships
    deal = relationship("Deal", back_populates="bank_events")
    payment_intent = relationship("PaymentIntent", back_populates="bank_events")


class SelfEmployedRegistry(BaseModel):
    """Registry of self-employed workers managed by organization"""

    __tablename__ = "self_employed_registry"

    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Personal data
    inn = Column(String(12), nullable=False)
    full_name = Column(String(255), nullable=False)

    # T-Bank integration
    external_recipient_id = Column(String(100), nullable=True)  # T-Bank beneficiary ID

    # Status
    bank_status = Column(String(20), default="draft", nullable=False, index=True)  # draft/active/blocked

    # NPD (tax status) verification
    npd_status = Column(String(50), nullable=True)
    npd_checked_at = Column(DateTime, nullable=True)

    # Risk management
    receipt_cancel_count = Column(Integer, default=0, nullable=False)
    last_receipt_cancel_at = Column(DateTime, nullable=True)
    risk_flag = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="self_employed_workers")
    user = relationship("User", foreign_keys=[user_id])


class EvidenceFile(BaseModel):
    """Evidence files attached to deals (photos, documents, etc.)"""

    __tablename__ = "evidence_files"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, index=True)

    # File type
    kind = Column(String(50), nullable=False)  # contract, act, photo, passport_scan, etc.

    # File storage
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)  # bytes
    mime_type = Column(String(100), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256

    # Upload tracking
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False)
    upload_ip = Column(String(45), nullable=True)
    upload_user_agent = Column(Text, nullable=True)

    # Review
    status = Column(String(20), default="uploaded", nullable=False)  # uploaded/verified/rejected
    notes = Column(Text, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="evidence_files")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])


class DealMilestone(BaseModel):
    """Deal payment milestone (step)"""

    __tablename__ = "deal_milestones"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, index=True)

    # Step identification
    step_no = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Payment
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB", nullable=False)

    # Trigger
    trigger_type = Column(String(50), nullable=False)  # immediate, manual, date, condition
    trigger_config = Column(JSONB, nullable=True)
    # Example: {"date": "2026-02-01"} or {"condition": "registration_confirmed"}

    # T-Bank integration
    external_step_id = Column(String(100), nullable=True)
    payment_link_url = Column(String(500), nullable=True)

    # Status
    status = Column(String(20), default="pending", nullable=False, index=True)

    # Payment tracking
    paid_at = Column(DateTime, nullable=True)
    hold_expires_at = Column(DateTime, nullable=True)

    # Confirmation
    confirmed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="milestones")
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_user_id])
