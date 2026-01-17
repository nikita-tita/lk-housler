"""Contract models for bank-split deals"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Integer, ForeignKey, Text, DateTime, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class ContractStatus(str, PyEnum):
    """Signed contract status"""

    DRAFT = "draft"
    PENDING_SIGNATURE = "pending_signature"
    PARTIALLY_SIGNED = "partially_signed"
    FULLY_SIGNED = "fully_signed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class SignedContract(BaseModel):
    """Contract instance generated from a template and signed by parties"""

    __tablename__ = "signed_contracts"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("contract_templates.id"), nullable=False)

    # Contract details
    contract_number = Column(String(50), nullable=False, unique=True)  # AUTO-123456
    contract_type = Column(String(50), nullable=False)  # bank_split_agent_agreement, etc.
    status = Column(String(30), default="draft", nullable=False)

    # Generated content
    html_content = Column(Text, nullable=True)  # Rendered HTML
    pdf_url = Column(String(500), nullable=True)  # URL in S3
    document_hash = Column(String(64), nullable=True)  # SHA-256 of PDF

    # Contract data (snapshot of deal data at generation time)
    contract_data = Column(JSONB, nullable=False)  # Placeholders filled values

    # Financial terms from deal
    commission_amount = Column(Numeric(15, 2), nullable=True)
    platform_fee = Column(Numeric(15, 2), nullable=True)
    split_percent_agent = Column(Numeric(5, 2), nullable=True)
    split_percent_agency = Column(Numeric(5, 2), nullable=True)

    # Parties who need to sign
    required_signers = Column(JSONB, nullable=False)  # [{user_id, role, signed_at}]

    # Timestamps
    generated_at = Column(DateTime, nullable=True)
    signed_at = Column(DateTime, nullable=True)  # When all parties signed
    expires_at = Column(DateTime, nullable=True)  # Signature deadline

    # Relationships
    deal = relationship("Deal", back_populates="contracts")
    template = relationship("ContractTemplate")
    signatures = relationship("ContractSignature", back_populates="contract", cascade="all, delete-orphan")


class ContractSignature(BaseModel):
    """Individual signature on a contract"""

    __tablename__ = "contract_signatures"

    contract_id = Column(UUID(as_uuid=True), ForeignKey("signed_contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Signer info snapshot
    signer_name = Column(String(255), nullable=False)
    signer_role = Column(String(50), nullable=False)  # agent, client, agency

    # Signature data
    signed_at = Column(DateTime, nullable=True)
    signature_method = Column(String(20), default="pep_sms")  # pep_sms, ukep

    # Evidence
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    otp_verified = Column(Boolean, default=False)
    otp_phone = Column(String(20), nullable=True)

    # Relationships
    contract = relationship("SignedContract", back_populates="signatures")
    user = relationship("User")
