"""Fiscalization settings and configuration models.

TASK-3.1: Fiscalization Infrastructure
TASK-3.2: T-Bank Checks Integration

This module contains:
- FiscalizationSettings: Configuration per legal type and deal type
- FiscalReceipt: Fiscal receipt records for T-Bank Checks integration
"""

from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Column, String, Boolean, Integer, Text, UniqueConstraint, ForeignKey, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel
from app.models.payment_profile import LegalType, FiscalizationMethod


class FiscalReceiptType(str, PyEnum):
    """Fiscal receipt type for T-Bank Checks"""
    INCOME = "income"  # Приход - receipt for payment received
    INCOME_RETURN = "income_return"  # Возврат прихода - refund receipt


class FiscalReceiptStatus(str, PyEnum):
    """Fiscal receipt processing status"""
    PENDING = "pending"  # Created, waiting to be sent to T-Bank
    CREATED = "created"  # Successfully created in T-Bank
    FAILED = "failed"  # Failed to create
    CANCELLED = "cancelled"  # Receipt was cancelled/voided
    # NPD-specific statuses
    AWAITING_UPLOAD = "awaiting_upload"  # NPD: waiting for self-employed to upload receipt
    UPLOADED = "uploaded"  # NPD: receipt uploaded by user
    OVERDUE = "overdue"  # NPD: receipt not uploaded within deadline


class NPDReceiptSource(str, PyEnum):
    """Source/method of NPD receipt"""
    MY_NALOG_APP = "my_nalog_app"  # Manual upload from "Moy Nalog" app
    MY_NALOG_API = "my_nalog_api"  # Auto via FNS API (future)
    MANUAL = "manual"  # Manual entry of receipt number


class FiscalReceipt(BaseModel):
    """Fiscal receipt record for T-Bank Checks and NPD tracking.

    Created automatically when:
    - A bank-split deal is released (income receipt) -> T-Bank Checks
    - A refund is processed (income_return receipt) -> T-Bank Checks
    - Payment released to self-employed (SE) -> NPD receipt tracking

    For T-Bank Checks: Receipt is sent to API automatically.
    For NPD (self-employed): Receipt tracking only - user uploads receipt from "Moy Nalog" app.
    """

    __tablename__ = "fiscal_receipts"

    # Link to deal
    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)

    # Recipient (who should create the receipt) - for NPD tracking
    # Links to users.id (Integer, compatible with agent.housler.ru)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Receipt type
    type = Column(String(30), nullable=False, default=FiscalReceiptType.INCOME.value)

    # Amount in kopeks (for verification)
    amount = Column(Integer, nullable=False)  # Amount in kopeks

    # External ID from T-Bank
    external_id = Column(String(100), nullable=True, index=True)

    # Status
    status = Column(String(30), nullable=False, default=FiscalReceiptStatus.PENDING.value, index=True)

    # Receipt URL (link to PDF from T-Bank)
    receipt_url = Column(String(500), nullable=True)

    # Fiscal data (FN, FD, FP numbers)
    fiscal_data = Column(JSONB, nullable=True)
    # Example: {"fiscal_number": "...", "fiscal_sign": "...", "fiscal_document": "...", "fn_number": "..."}

    # Client info (who receives the receipt)
    client_email = Column(String(255), nullable=True)
    client_phone = Column(String(20), nullable=True)

    # Error info (if failed)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    sent_at = Column(DateTime, nullable=True)  # When sent to T-Bank
    confirmed_at = Column(DateTime, nullable=True)  # When confirmed by T-Bank

    # Retry tracking
    retry_count = Column(Integer, default=0, nullable=False)
    last_retry_at = Column(DateTime, nullable=True)

    # Linked original receipt (for income_return)
    original_receipt_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_receipts.id"), nullable=True)

    # Metadata
    meta = Column(JSONB, nullable=True)

    # =========================================================================
    # NPD Receipt Tracking Fields (TASK-3.3)
    # =========================================================================

    # Fiscalization method used (npd_receipt, tbank_checks, etc.)
    fiscalization_method = Column(String(30), nullable=True)

    # NPD-specific: receipt number from "Moy Nalog" app (format: XXXXXXXXXX)
    npd_receipt_number = Column(String(50), nullable=True, index=True)

    # NPD-specific: source of receipt data
    npd_source = Column(String(30), nullable=True)  # NPDReceiptSource

    # NPD-specific: when receipt was uploaded by user
    npd_uploaded_at = Column(DateTime, nullable=True)

    # Reminder tracking
    reminder_count = Column(Integer, default=0, nullable=False)
    first_reminder_at = Column(DateTime, nullable=True)
    last_reminder_at = Column(DateTime, nullable=True)
    next_reminder_at = Column(DateTime, nullable=True, index=True)
    escalated_at = Column(DateTime, nullable=True)  # When escalated to admin

    # Deadline for receipt upload (calculated: release_at + 7 days)
    receipt_deadline = Column(DateTime, nullable=True, index=True)

    # Relationships
    deal = relationship("Deal", foreign_keys=[deal_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    original_receipt = relationship("FiscalReceipt", remote_side="FiscalReceipt.id")


class FiscalizationSettings(BaseModel):
    """Fiscalization configuration per legal type and deal type combination.

    Defines which fiscalization method should be used for different
    combinations of legal entity type and deal type.

    Examples:
    - Self-employed (SE) + any deal -> NPD receipt via MyNalog
    - IP/OOO + bank-split -> T-Bank checks
    - Platform fee -> Not required (platform handles own fiscalization)
    """

    __tablename__ = "fiscalization_settings"

    # Configuration key
    legal_type = Column(String(20), nullable=False)  # LegalType: se, ip, ooo, platform
    deal_type = Column(String(50), nullable=True)  # DealType or None for default

    # Fiscalization method
    method = Column(
        String(30),
        default=FiscalizationMethod.NOT_REQUIRED.value,
        nullable=False
    )

    # Requirements
    is_required = Column(Boolean, default=False, nullable=False)
    min_amount_threshold = Column(Integer, nullable=True)  # Min amount for fiscalization (kopeks)
    max_amount_threshold = Column(Integer, nullable=True)  # Max amount (for NPD limits)

    # Provider configuration (JSON for flexibility)
    provider_config = Column(JSONB, nullable=True)
    # Example: {"mynalog_service_name": "Agency services", "tax_rate": 4}

    # Feature flags
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    priority = Column(Integer, default=0, nullable=False)  # Higher = higher priority

    # Description
    description = Column(Text, nullable=True)

    # Unique constraint on legal_type + deal_type
    __table_args__ = (
        UniqueConstraint('legal_type', 'deal_type', name='uq_fiscalization_settings_legal_deal'),
    )

    @classmethod
    def get_method_key(cls, legal_type: str, deal_type: Optional[str] = None) -> str:
        """Generate lookup key for settings"""
        if deal_type:
            return f"{legal_type}:{deal_type}"
        return f"{legal_type}:default"
