"""Document and signature models"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text, DateTime, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class ContractLayer(str, PyEnum):
    """Уровень договора в двухслойной архитектуре

    PLATFORM: Договоры между пользователем и платформой Housler
              (Terms of Service, User Agreement)
    TRANSACTION: Договоры между участниками сделки
                 (агент-клиент, агентство-агент и т.д.)
    """

    PLATFORM = "platform"  # Housler - User (ToS)
    TRANSACTION = "transaction"  # Agent - Client, Agency - Agent


class TemplateType(str, PyEnum):
    """Тип шаблона договора"""

    # Platform layer - соглашения с платформой
    USER_AGREEMENT = "user_agreement"  # Пользовательское соглашение (Terms of Service)

    # Основные шаблоны по сценариям
    TPL_001_BUY = "tpl_001_buy"  # Договор оказания услуг (покупка)
    TPL_002_SELL = "tpl_002_sell"  # Договор оказания услуг (продажа)
    TPL_003_RENT = "tpl_003_rent"  # Договор оказания услуг (аренда)
    TPL_004_EXCLUSIVE = "tpl_004_exclusive"  # Эксклюзивный договор
    TPL_005_COAGENT = "tpl_005_coagent"  # Соглашение о разделе комиссии
    TPL_006_AGENCY_AGENT = "tpl_006_agency_agent"  # Агентский договор (агентство-агент)

    # Вспомогательные документы
    ACT = "act"  # Акт выполненных работ
    ADDITIONAL_AGREEMENT = "additional_agreement"  # Дополнительное соглашение
    TERMINATION = "termination"  # Соглашение о расторжении
    PD_CONSENT = "pd_consent"  # Согласие на обработку ПД

    # Bank-split специфичные
    BANK_SPLIT_AGENT_AGREEMENT = "bank_split_agent_agreement"
    BANK_SPLIT_CLIENT_AGREEMENT = "bank_split_client_agreement"
    BANK_SPLIT_AGENCY_AGREEMENT = "bank_split_agency_agreement"

    # Legacy (обратная совместимость)
    SECONDARY_BUY = "secondary_buy"
    SECONDARY_SELL = "secondary_sell"
    NEWBUILD_BOOKING = "newbuild_booking"


class TemplateStatus(str, PyEnum):
    """Статус шаблона в workflow"""

    DRAFT = "draft"  # Черновик
    PENDING_REVIEW = "pending_review"  # На проверке
    APPROVED = "approved"  # Одобрен
    PUBLISHED = "published"  # Опубликован
    ARCHIVED = "archived"  # В архиве


class DocumentStatus(str, PyEnum):
    """Статус документа"""

    GENERATED = "generated"  # Сгенерирован
    SENT = "sent"  # Отправлен
    SIGNED = "signed"  # Подписан
    VOIDED = "voided"  # Аннулирован


class SignatureMethod(str, PyEnum):
    """Метод подписания"""

    PEP_SMS = "pep_sms"  # Простая электронная подпись (OTP по SMS)
    UKEP = "ukep"  # Усиленная квалифицированная (Phase 2)


class PartyTypeCode(str, PyEnum):
    """Тип участников сделки для шаблона"""

    AGENT_CLIENT = "agent_client"  # Агент - Клиент
    AGENCY_CLIENT = "agency_client"  # Агентство - Клиент
    AGENT_AGENT = "agent_agent"  # Агент - Со-агент
    AGENCY_AGENT = "agency_agent"  # Агентство - Агент


class ContractTemplate(BaseModel):
    """Шаблон договора с версионированием и workflow"""

    __tablename__ = "contract_templates"

    # Идентификация
    code = Column(String(50), nullable=False, index=True)  # TPL-001, TPL-002 и т.д.
    type = Column(String(50), nullable=False)  # String в БД, значения из TemplateType
    version = Column(String(20), nullable=False)  # "1.0", "1.1", "2.0"
    name = Column(String(255), nullable=False)  # Название для отображения
    description = Column(Text, nullable=True)  # Описание для админов

    # Contract Layer (two-layer architecture)
    layer = Column(String(20), nullable=False, default="transaction", index=True)  # platform / transaction

    # Применимость шаблона
    deal_types = Column(JSONB, nullable=True)  # ["sale_buy", "sale_sell"] - к каким типам сделок применим
    party_types = Column(JSONB, nullable=True)  # ["agent_client", "agency_client"] - какие стороны

    # Контент
    template_body = Column(Text, nullable=False)  # HTML/Jinja шаблон
    placeholders_schema = Column(JSONB, nullable=False)  # JSON Schema плейсхолдеров

    # Метаданные
    legal_basis = Column(Text, nullable=True)  # Правовые ссылки (ГК РФ, 63-ФЗ и т.д.)
    effective_from = Column(Date, nullable=True)  # Дата вступления в силу

    # Статус workflow
    status = Column(String(20), default="draft", nullable=False, index=True)  # String в БД
    active = Column(Boolean, default=False, nullable=False)  # Используется для новых сделок
    published_at = Column(DateTime, nullable=True)

    # Аудит
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
