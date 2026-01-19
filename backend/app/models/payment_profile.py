"""Payment Profile model for bank integration and fiscalization"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class LegalType(str, PyEnum):
    """Legal entity type for payment profile"""
    SE = "se"  # Self-Employed (Samozanyatyj)
    IP = "ip"  # Individual Entrepreneur
    OOO = "ooo"  # LLC (OOO)


class OnboardingStatus(str, PyEnum):
    """Bank onboarding status"""
    NOT_STARTED = "not_started"
    DOCUMENTS_REQUIRED = "documents_required"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class KYCStatus(str, PyEnum):
    """KYC verification status"""
    NOT_STARTED = "not_started"
    DOCUMENTS_UPLOADED = "documents_uploaded"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class FiscalizationMethod(str, PyEnum):
    """Fiscalization method for receipts"""
    NPD_RECEIPT = "npd_receipt"  # Self-employed receipt via MyNalog
    TBANK_CHECKS = "tbank_checks"  # T-Bank fiscal receipts
    EXTERNAL = "external"  # External fiscalization system
    NOT_REQUIRED = "not_required"  # No fiscalization needed (platform fee, etc.)


class PaymentProfile(BaseModel):
    """Extended payment profile for bank integration

    Stores legal info, bank details, and onboarding status
    for accepting payments via T-Bank Multiracchety.

    Owner can be either:
    - user_id (for individual agents: SE or IP)
    - organization_id (for agencies: IP or OOO)
    """

    __tablename__ = "payment_profiles"

    # Owner (one of these must be set)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)

    # Legal info
    legal_type = Column(String(20), nullable=False)  # LegalType: se, ip, ooo
    legal_name = Column(String(500), nullable=False)

    # Encrypted sensitive fields (152-FZ compliance)
    # Use encrypt_inn/decrypt_inn from app.core.encryption
    inn_encrypted = Column(Text, nullable=False)
    inn_hash = Column(String(64), nullable=False, index=True)  # For search

    # KPP only for OOO (encrypted)
    kpp_encrypted = Column(Text, nullable=True)

    # OGRN/OGRNIP (not encrypted - public registry data)
    ogrn = Column(String(15), nullable=True)

    # Bank details (encrypted)
    bank_account_encrypted = Column(Text, nullable=False)  # 20 digits
    bank_bik = Column(String(9), nullable=False)  # BIK is public
    bank_name = Column(String(255), nullable=False)
    bank_corr_account = Column(String(20), nullable=False)  # Correspondent account

    # Bank integration (T-Bank Multiracchety)
    bank_onboarding_status = Column(
        String(30),
        default=OnboardingStatus.NOT_STARTED.value,
        nullable=False,
        index=True
    )
    bank_merchant_id = Column(String(100), nullable=True)  # External ID in T-Bank
    bank_onboarded_at = Column(DateTime, nullable=True)

    # Fiscalization
    fiscalization_method = Column(
        String(30),
        default=FiscalizationMethod.NOT_REQUIRED.value,
        nullable=False
    )
    tbank_checks_enabled = Column(Boolean, default=False, nullable=False)
    tbank_checks_merchant_id = Column(String(100), nullable=True)

    # KYC
    kyc_status = Column(
        String(30),
        default=KYCStatus.NOT_STARTED.value,
        nullable=False,
        index=True
    )
    kyc_submitted_at = Column(DateTime, nullable=True)
    kyc_approved_at = Column(DateTime, nullable=True)
    kyc_rejection_reason = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
