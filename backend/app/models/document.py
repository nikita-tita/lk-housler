"""Document and signature models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text, DateTime, Boolean
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


class DocumentStatus(str, PyEnum):
    """Document status"""
    GENERATED = "generated"
    SENT = "sent"
    SIGNED = "signed"
    VOIDED = "voided"


class SignatureMethod(str, PyEnum):
    """Signature method"""
    PEP_SMS = "pep_sms"  # Простая электронная подпись (OTP по SMS)
    UKEP = "ukep"        # Усиленная квалифицированная (Phase 2)


class ContractTemplate(BaseModel):
    """Contract template"""
    
    __tablename__ = "contract_templates"
    
    type = Column(Enum(TemplateType), nullable=False)
    version = Column(String(20), nullable=False)
    
    # JSON-схема плейсхолдеров
    placeholders_schema = Column(JSONB, nullable=False)
    # Например: {"client_name": "string", "commission": "decimal", ...}
    
    # Тело шаблона (HTML для рендеринга в PDF)
    template_body = Column(Text, nullable=False)
    
    active = Column(Boolean, default=True, nullable=False)


class Document(BaseModel):
    """Generated document"""
    
    __tablename__ = "documents"
    
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("contract_templates.id"), nullable=True)
    
    version_no = Column(Integer, default=1, nullable=False)
    
    status = Column(
        Enum(DocumentStatus),
        default=DocumentStatus.GENERATED,
        nullable=False,
        index=True
    )
    
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


class AuditLog(BaseModel):
    """Audit log for all important actions"""
    
    __tablename__ = "audit_logs"
    
    entity_type = Column(String(50), nullable=False, index=True)  # deal, document, payment, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    action = Column(String(100), nullable=False)  # created, updated, signed, paid, etc.
    
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    meta = Column(JSONB, nullable=True)
    
    # IP и user agent для аудита
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

