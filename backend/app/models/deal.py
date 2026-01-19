"""Модели сделок"""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text, Numeric, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel, SoftDeleteMixin


class DealType(str, PyEnum):
    """Тип сделки с недвижимостью"""
    SALE_BUY = "sale_buy"           # Покупка
    SALE_SELL = "sale_sell"         # Продажа
    RENT_TENANT = "rent_tenant"     # Аренда (арендатор ищет)
    RENT_LANDLORD = "rent_landlord" # Аренда (владелец сдаёт)
    # Legacy (для обратной совместимости)
    SECONDARY_BUY = "secondary_buy"
    SECONDARY_SELL = "secondary_sell"
    NEWBUILD_BOOKING = "newbuild_booking"


class PropertyType(str, PyEnum):
    """Тип объекта недвижимости"""
    APARTMENT = "apartment"       # Квартира
    ROOM = "room"                 # Комната
    HOUSE = "house"               # Дом / Коттедж
    TOWNHOUSE = "townhouse"       # Таунхаус
    LAND = "land"                 # Земельный участок
    COMMERCIAL = "commercial"     # Коммерческая недвижимость
    PARKING = "parking"           # Машиноместо / Гараж


class PaymentType(str, PyEnum):
    """Тип оплаты услуг агента"""
    PERCENT = "percent"           # Процент от суммы сделки
    FIXED = "fixed"               # Фиксированная сумма
    MIXED = "mixed"               # Фикс + процент


class AdvanceType(str, PyEnum):
    """Тип аванса"""
    NONE = "none"                 # Без аванса
    FIXED = "advance_fixed"       # Фиксированный аванс
    PERCENT = "advance_percent"   # Процент от комиссии


class DealStatus(str, PyEnum):
    """Deal status - unified for all payment models"""

    # Common statuses
    DRAFT = "draft"
    AWAITING_SIGNATURES = "awaiting_signatures"
    SIGNED = "signed"
    CANCELLED = "cancelled"
    DISPUTE = "dispute"

    # Legacy statuses (kept for backward compatibility)
    PAYMENT_PENDING = "payment_pending"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"

    # Bank-split specific statuses
    INVOICED = "invoiced"                    # Invoice created in T-Bank
    HOLD_PERIOD = "hold_period"              # Payment in hold, awaiting release
    PAYMENT_FAILED = "payment_failed"        # Payment attempt failed
    REFUNDED = "refunded"                    # Funds returned to client
    PAYOUT_READY = "payout_ready"            # Ready for payout to recipients
    PAYOUT_IN_PROGRESS = "payout_in_progress"  # Payouts being processed


class BankDealStatus(str, PyEnum):
    """Bank-side deal status for T-Bank integration"""
    NOT_CREATED = "not_created"       # Deal not yet created in bank
    CREATED = "created"               # Deal created, awaiting payment
    PAYMENT_PENDING = "payment_pending"  # Payment initiated
    HOLD = "hold"                     # Funds on hold
    RELEASED = "released"             # Funds released to recipients
    CANCELLED = "cancelled"           # Deal cancelled in bank
    REFUNDED = "refunded"             # Funds refunded to payer


class ExecutorType(str, PyEnum):
    """Executor type"""

    USER = "user"  # Агент сам на себя
    ORG = "org"  # Агентство
    DEVELOPER = "developer"  # Застройщик (Phase 2)


class PartyRole(str, PyEnum):
    """Deal party role"""

    CLIENT = "client"
    EXECUTOR = "executor"
    AGENT = "agent"
    AGENCY = "agency"
    DEVELOPER = "developer"


class PartyType(str, PyEnum):
    """Party type"""

    USER = "user"
    ORG = "org"
    EXTERNAL = "external"  # Клиент без регистрации


class Deal(BaseModel, SoftDeleteMixin):
    """Deal with soft delete support"""

    # Using separate table name to avoid conflict with agent.housler.ru deals table
    __tablename__ = "lk_deals"

    # Using String instead of Enum to match migration schema
    type = Column(String(50), nullable=False)

    # Создатель сделки (INTEGER - совместимость с agent.housler.ru users table)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Агент (исполнитель сделки)
    agent_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Исполнитель (кто получает деньги: агент или агентство)
    executor_type = Column(String(20), default="user", nullable=False)
    executor_id = Column(String(36), nullable=True)  # user.id (as string) или organization.id (UUID)

    # Клиент (для MVP - просто текстовые поля)
    client_id = Column(Integer, nullable=True)  # Может быть external party
    client_name = Column(String(255), nullable=True)
    client_phone = Column(String(20), nullable=True)

    status = Column(String(50), default="draft", nullable=False, index=True)

    # Адрес объекта недвижимости
    property_address = Column(Text, nullable=True)

    # Финансы (для MVP - простые поля)
    price = Column(Numeric(15, 2), nullable=True)
    commission_agent = Column(Numeric(15, 2), nullable=True)

    # Bank Split fields (T-Bank integration)
    payment_model = Column(String(30), default="mor", nullable=False)  # mor (legacy) / bank_hold_split
    external_provider = Column(String(50), nullable=True)  # tbank
    external_deal_id = Column(String(255), nullable=True, index=True)  # T-Bank deal ID
    external_account_number = Column(String(50), nullable=True)  # Nominal account number
    payment_link_url = Column(String(500), nullable=True)  # SBP/card payment link
    payment_qr_payload = Column(Text, nullable=True)  # QR code data
    expires_at = Column(DateTime, nullable=True)  # Payment link expiry
    hold_expires_at = Column(DateTime, nullable=True)  # Hold period expiry (for instant split) - legacy
    payer_email = Column(String(255), nullable=True)  # For receipt
    description = Column(Text, nullable=True)  # Deal description for bank

    # Configurable Hold Period (TASK-2.1)
    hold_duration_hours = Column(Integer, default=72, nullable=False)  # Dispute window in hours
    auto_release_days = Column(Integer, default=7, nullable=False)  # Auto-release if no disputes
    hold_started_at = Column(DateTime, nullable=True)  # When hold period started
    auto_release_at = Column(DateTime, nullable=True)  # Computed: hold_started_at + auto_release_days

    # Bank-led status tracking (TASK-1.1)
    bank_status = Column(String(30), default="not_created", nullable=False)  # BankDealStatus
    bank_created_at = Column(DateTime, nullable=True)  # When deal was created in bank
    bank_released_at = Column(DateTime, nullable=True)  # When funds were released

    # Relationships
    creator = relationship("User", foreign_keys=[created_by_user_id], back_populates="deals_created")
    agent = relationship("User", foreign_keys=[agent_user_id], back_populates="deals_as_agent")
    parties = relationship("DealParty", back_populates="deal", cascade="all, delete-orphan")
    terms = relationship("DealTerms", back_populates="deal", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="deal", cascade="all, delete-orphan")
    payment_schedules = relationship("PaymentSchedule", back_populates="deal", cascade="all, delete-orphan")

    # Тип объекта недвижимости
    property_type = Column(String(30), nullable=True)

    # Условия оплаты
    payment_type = Column(String(20), default="percent", nullable=False)  # percent/fixed/mixed
    commission_percent = Column(Numeric(5, 2), nullable=True)  # Процент от суммы сделки
    commission_fixed = Column(Numeric(15, 2), nullable=True)  # Фиксированная сумма комиссии

    # Аванс
    advance_type = Column(String(20), default="none", nullable=False)  # none/advance_fixed/advance_percent
    advance_amount = Column(Numeric(15, 2), nullable=True)  # Сумма аванса (фикс)
    advance_percent = Column(Numeric(5, 2), nullable=True)  # Процент аванса
    advance_paid = Column(Boolean, default=False, nullable=False)  # Аванс оплачен?
    advance_paid_at = Column(DateTime, nullable=True)  # Дата оплаты аванса

    # Эксклюзивный договор
    is_exclusive = Column(Boolean, default=False, nullable=False)
    exclusive_until = Column(DateTime, nullable=True)  # Срок эксклюзива

    # Dispute lock (TASK-2.3)
    dispute_locked = Column(Boolean, default=False, nullable=False)
    dispute_locked_at = Column(DateTime, nullable=True)
    dispute_lock_reason = Column(String(500), nullable=True)

    # Bank Split relationships
    split_recipients = relationship("DealSplitRecipient", back_populates="deal", cascade="all, delete-orphan")
    bank_events = relationship("BankEvent", back_populates="deal", cascade="all, delete-orphan")
    evidence_files = relationship("EvidenceFile", back_populates="deal", cascade="all, delete-orphan")
    milestones = relationship("DealMilestone", back_populates="deal", cascade="all, delete-orphan")
    consents = relationship("DealConsent", back_populates="deal", cascade="all, delete-orphan")
    invitations = relationship("DealInvitation", back_populates="deal", cascade="all, delete-orphan")
    disputes = relationship("Dispute", back_populates="deal", cascade="all, delete-orphan")
    service_completions = relationship("ServiceCompletion", back_populates="deal", cascade="all, delete-orphan")
    split_adjustments = relationship("SplitAdjustment", back_populates="deal", cascade="all, delete-orphan")
    contracts = relationship("SignedContract", back_populates="deal", cascade="all, delete-orphan")


class DealParty(BaseModel):
    """Deal participant"""

    __tablename__ = "deal_parties"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False)

    party_role = Column(Enum(PartyRole), nullable=False)
    party_type = Column(Enum(PartyType), nullable=False)
    party_id = Column(Integer, nullable=True)  # user_id или org_id

    # Snapshot данных участника на момент создания сделки
    display_name_snapshot = Column(String(255), nullable=False)
    phone_snapshot = Column(String(20), nullable=True)
    passport_snapshot_hash = Column(String(64), nullable=True)  # SHA-256

    # Подпись
    signing_required = Column(Boolean, default=True, nullable=False)
    signing_order = Column(Integer, default=0, nullable=False)

    # Relationships
    deal = relationship("Deal", back_populates="parties")
    signatures = relationship("Signature", back_populates="party")


class DealTerms(BaseModel):
    """Deal terms and conditions"""

    __tablename__ = "deal_terms"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, unique=True)

    # Комиссия
    commission_total = Column(Numeric(15, 2), nullable=False)

    # План платежей (JSON)
    payment_plan = Column(JSONB, nullable=False)
    # Например: [{"step": 1, "amount": 50000, "trigger": "immediate"}, ...]

    # Правило распределения комиссии
    split_rule = Column(JSONB, nullable=False)
    # Например: {"agent": 60, "agency": 40} или {"agent": 100}

    # Условия этапов (milestones)
    milestone_rules = Column(JSONB, nullable=True)
    # Например: [{"step": 2, "trigger": "registration_confirmed", "proof_required": true}]

    # Политика отмены
    cancellation_policy = Column(JSONB, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="terms")
