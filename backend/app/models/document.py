"""Document and signature models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text, DateTime, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class TemplateType(str, PyEnum):
    """Contract template type"""

    SECONDARY_BUY = "secondary_buy"
    SECONDARY_SELL = "secondary_sell"
    NEWBUILD_BOOKING = "newbuild_booking"
    ACT = "act"
    ADDITIONAL_AGREEMENT = "additional_agreement"
    TERMINATION = "termination"
    PD_CONSENT = "pd_consent"
    # Bank-split contract types
    BANK_SPLIT_AGENT_AGREEMENT = "bank_split_agent_agreement"
    BANK_SPLIT_CLIENT_AGREEMENT = "bank_split_client_agreement"
    BANK_SPLIT_AGENCY_AGREEMENT = "bank_split_agency_agreement"


class TemplateStatus(str, PyEnum):
    """Template workflow status"""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class DocumentStatus(str, PyEnum):
    """Document status"""

    GENERATED = "generated"
    SENT = "sent"
    SIGNED = "signed"
    VOIDED = "voided"


class SignatureMethod(str, PyEnum):
    """Signature method"""

    PEP_SMS = "pep_sms"  # Простая электронная подпись (OTP по SMS)
    UKEP = "ukep"  # Усиленная квалифицированная (Phase 2)


class ContractTemplate(BaseModel):
    """Contract template with versioning and workflow"""

    __tablename__ = "contract_templates"

    # Identification
    code = Column(String(50), nullable=False, index=True)  # secondary_buy, act, etc.
    type = Column(Enum(TemplateType), nullable=False)
    version = Column(String(20), nullable=False)  # "1.0", "1.1", "2.0"
    name = Column(String(255), nullable=False)  # Display name
    description = Column(Text, nullable=True)  # Description for admins

    # Content
    template_body = Column(Text, nullable=False)  # HTML template
    placeholders_schema = Column(JSONB, nullable=False)  # JSON Schema of placeholders

    # Metadata
    legal_basis = Column(Text, nullable=True)  # Legal references (ГК РФ, 63-ФЗ, etc.)
    effective_from = Column(Date, nullable=True)  # Effective date

    # Workflow status
    status = Column(Enum(TemplateStatus), default=TemplateStatus.DRAFT, nullable=False, index=True)
    active = Column(Boolean, default=False, nullable=False)  # Is used for new deals
    published_at = Column(DateTime, nullable=True)

    # Audit
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


class Document(BaseModel):
    """Generated document"""

    __tablename__ = "documents"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("contract_templates.id"), nullable=True)

    version_no = Column(Integer, default=1, nullable=False)

    status = Column(Enum(DocumentStatus), default=DocumentStatus.GENERATED, nullable=False, index=True)

    # URL файла в S3
    file_url = Column(String(500), nullable=True)

    # SHA-256 хеш документа (для ПЭП)
    document_hash = Column(String(64), nullable=False, index=True)

    # Relationships
    deal = relationship("Deal", back_populates="documents")
    signatures = relationship("Signature", back_populates="document", cascade="all, delete-orphan")


class Signature(BaseModel):
    """Document signature"""

    __tablename__ = "signatures"

    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    signer_party_id = Column(UUID(as_uuid=True), ForeignKey("deal_parties.id"), nullable=False)

    method = Column(Enum(SignatureMethod), nullable=False)

    # Для ПЭП
    phone = Column(String(20), nullable=True)
    otp_request_id = Column(UUID(as_uuid=True), nullable=True)  # Ссылка на OTPSession

    signed_at = Column(DateTime, nullable=True)

    # Evidence (доказательная база для 63-ФЗ)
    evidence = Column(JSONB, nullable=True)
    # {
    #   "ip": "192.168.1.1",
    #   "user_agent": "...",
    #   "timestamp": "...",
    #   "document_hash": "...",
    #   "consent_clicked_at": "...",
    #   "geolocation": {"lat": ..., "lon": ...}
    # }

    # Relationships
    document = relationship("Document", back_populates="signatures")
    party = relationship("DealParty", back_populates="signatures")


class SigningToken(BaseModel):
    """Token for public document signing (without auth)"""

    __tablename__ = "signing_tokens"

    # Short token for URL (e.g., Xk9mZ2)
    token = Column(String(32), unique=True, nullable=False, index=True)

    # Link to document and party
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    party_id = Column(UUID(as_uuid=True), ForeignKey("deal_parties.id"), nullable=False)

    # Phone for OTP verification
    phone = Column(String(20), nullable=False)

    # Expiration (default 7 days)
    expires_at = Column(DateTime, nullable=False)

    # Status
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("Document")
    party = relationship("DealParty")


class AuditLog(BaseModel):
    """Audit log for all important actions"""

    __tablename__ = "audit_logs"

    entity_type = Column(String(50), nullable=False, index=True)  # deal, document, payment, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    action = Column(String(100), nullable=False)  # created, updated, signed, paid, etc.

    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    meta = Column(JSONB, nullable=True)

    # IP и user agent для аудита
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
