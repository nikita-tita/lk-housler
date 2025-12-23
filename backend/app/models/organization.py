"""Organization models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class OrganizationType(str, PyEnum):
    """Organization type"""
    AGENCY = "agency"
    DEVELOPER = "developer"
    PLATFORM = "platform"


class OrganizationStatus(str, PyEnum):
    """Organization status"""
    ACTIVE = "active"
    PENDING = "pending"
    BLOCKED = "blocked"
    SUSPENDED = "suspended"


class KYCStatus(str, PyEnum):
    """KYC verification status"""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    VERIFIED = "verified"
    REJECTED = "rejected"


class MemberRole(str, PyEnum):
    """Organization member role"""
    ADMIN = "admin"
    AGENT = "agent"
    ACCOUNTANT = "accountant"
    SIGNER = "signer"


class PayoutMethod(str, PyEnum):
    """Payout method"""
    SBP_PHONE = "sbp_phone"
    BANK_ACCOUNT = "bank_account"
    CARD = "card"


class Organization(BaseModel):
    """Organization (agency, developer)"""
    
    __tablename__ = "organizations"
    
    type = Column(Enum(OrganizationType), nullable=False)
    
    # Юридические данные
    legal_name = Column(String(500), nullable=False)
    inn = Column(String(12), nullable=False, unique=True, index=True)
    kpp = Column(String(9), nullable=True)
    ogrn = Column(String(15), nullable=True)
    
    legal_address = Column(Text, nullable=True)
    
    # Банковские реквизиты (JSON для гибкости)
    bank_details = Column(JSONB, nullable=True)
    
    status = Column(
        Enum(OrganizationStatus),
        default=OrganizationStatus.PENDING,
        nullable=False
    )
    
    kyc_status = Column(
        Enum(KYCStatus),
        default=KYCStatus.PENDING,
        nullable=False
    )
    
    kyc_checked_at = Column(DateTime, nullable=True)
    kyc_meta = Column(JSONB, nullable=True)
    
    # Настройки для агентств
    default_split_percent_agent = Column(Integer, default=60, nullable=True)  # 60% агенту по умолчанию
    
    # Relationships
    members = relationship("OrganizationMember", back_populates="organization")
    payout_accounts = relationship("PayoutAccount", back_populates="organization")


class OrganizationMember(BaseModel):
    """Organization membership"""
    
    __tablename__ = "organization_members"
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    role = Column(Enum(MemberRole), nullable=False)
    
    # Персональная настройка сплита для агента
    default_split_percent_agent = Column(Integer, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="organizations")


class PayoutAccount(BaseModel):
    """Payout account for users and organizations"""
    
    __tablename__ = "payout_accounts"
    
    # Polymorphic owner
    owner_type = Column(String(20), nullable=False)  # 'user' or 'org'
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    method = Column(Enum(PayoutMethod), nullable=False)
    
    # Реквизиты (гибкая структура)
    details = Column(JSONB, nullable=False)
    # Например:
    # {"phone": "+79001234567"} для SBP
    # {"account": "40817...", "bik": "044525225", "bank_name": "..."} для bank_account
    
    verified_at = Column(DateTime, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="payout_accounts", foreign_keys=[owner_id])

