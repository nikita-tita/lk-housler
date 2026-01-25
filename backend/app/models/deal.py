"""Модели сделок"""

from enum import Enum as PyEnum

from decimal import Decimal
from sqlalchemy import Column, String, Enum, Integer, ForeignKey, Text, Numeric, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property

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


class PaymentScheme(str, PyEnum):
    """Схема оплаты услуг агента

    Определяет когда и как клиент оплачивает комиссию:
    - PREPAYMENT_FULL: 100% предоплата до оказания услуги
    - ADVANCE_POSTPAY: Аванс (часть суммы) + постоплата остатка
    - POSTPAYMENT_FULL: 100% постоплата после оказания услуги
    """
    PREPAYMENT_FULL = "prepayment_full"      # 100% предоплата
    ADVANCE_POSTPAY = "advance_postpay"      # Аванс + постоплата
    POSTPAYMENT_FULL = "postpayment_full"    # 100% постоплата


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
    AWAITING_CLIENT_CONFIRMATION = "awaiting_client_confirmation"  # Waiting for client to sign Act
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
    client_name = Column(String(255), nullable=True)  # Legacy plaintext (deprecated)
    client_name_encrypted = Column(String(500), nullable=True)  # 152-FZ compliant
    client_phone = Column(String(20), nullable=True)  # Legacy plaintext (deprecated)
    client_phone_encrypted = Column(String(500), nullable=True)  # 152-FZ compliant
    client_phone_hash = Column(String(64), nullable=True, index=True)  # For search

    # Commission split (TASK-002)
    agent_split_percent = Column(Integer, nullable=True)  # Agent's share %
    coagent_split_percent = Column(Integer, nullable=True)  # Co-agent's share %
    coagent_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    coagent_phone = Column(String(20), nullable=True)  # For invitation if not registered
    agency_split_percent = Column(Integer, nullable=True)  # Agency's share %

    # Паспортные данные клиента (encrypted для 152-ФЗ)
    client_passport_series_encrypted = Column(String(500), nullable=True)
    client_passport_number_encrypted = Column(String(500), nullable=True)
    client_passport_hash = Column(String(64), nullable=True, index=True)  # SHA-256 для дедупликации
    client_passport_issued_by_encrypted = Column(String(500), nullable=True)
    client_passport_issued_date = Column(DateTime, nullable=True)
    client_passport_issued_code = Column(String(10), nullable=True)  # Код подразделения
    client_birth_date = Column(DateTime, nullable=True)
    client_birth_place_encrypted = Column(String(500), nullable=True)
    client_registration_address_encrypted = Column(Text, nullable=True)

    status = Column(String(50), default="draft", nullable=False, index=True)

    # Адрес объекта недвижимости
    property_address = Column(Text, nullable=True)

    # Финансы (для MVP - простые поля)
    price = Column(Numeric(15, 2), nullable=True)
    # TASK-005: commission_agent is the denormalized/cached commission amount.
    # It can be calculated from payment_type + commission_percent/commission_fixed using calculated_commission property.
    # Kept for backward compatibility - many services depend on this field directly.
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
    coagent = relationship("User", foreign_keys=[coagent_user_id])
    parties = relationship("DealParty", back_populates="deal", cascade="all, delete-orphan")
    terms = relationship("DealTerms", back_populates="deal", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="deal", cascade="all, delete-orphan", foreign_keys="[Document.deal_id]")
    payment_schedules = relationship("PaymentSchedule", back_populates="deal", cascade="all, delete-orphan")

    # Тип объекта недвижимости
    property_type = Column(String(30), nullable=True)

    # Условия оплаты
    payment_type = Column(String(20), default="percent", nullable=False)  # percent/fixed/mixed
    commission_percent = Column(Numeric(5, 2), nullable=True)  # Процент от суммы сделки
    commission_fixed = Column(Numeric(15, 2), nullable=True)  # Фиксированная сумма комиссии

    @hybrid_property
    def calculated_commission(self) -> Decimal:
        """Calculate commission from typed fields (TASK-005).

        Returns commission_agent if set, otherwise calculates from:
        - percent: price * commission_percent / 100
        - fixed: commission_fixed
        - mixed: commission_fixed + (price * commission_percent / 100)
        """
        # If commission_agent is already set, use it
        if self.commission_agent is not None:
            return Decimal(self.commission_agent)

        # Calculate from typed fields
        if self.payment_type == "percent" and self.price and self.commission_percent:
            return (Decimal(self.price) * Decimal(self.commission_percent) / Decimal("100")).quantize(Decimal("0.01"))
        elif self.payment_type == "fixed" and self.commission_fixed:
            return Decimal(self.commission_fixed)
        elif self.payment_type == "mixed":
            total = Decimal("0")
            if self.commission_fixed:
                total += Decimal(self.commission_fixed)
            if self.price and self.commission_percent:
                total += (Decimal(self.price) * Decimal(self.commission_percent) / Decimal("100")).quantize(Decimal("0.01"))
            return total

        return Decimal("0")

    def sync_commission_agent(self) -> None:
        """Sync commission_agent from typed fields for backward compatibility."""
        self.commission_agent = self.calculated_commission

    # Схема оплаты
    payment_scheme = Column(String(30), default="prepayment_full", nullable=False)  # prepayment_full/advance_postpay/postpayment_full

    # Аванс (используется при payment_scheme = advance_postpay)
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

    # Client confirmation / Act signing (UC-3.2)
    act_document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    client_confirmation_requested_at = Column(DateTime, nullable=True)  # When agent marked service completed
    client_confirmation_deadline = Column(DateTime, nullable=True)  # +7 days from request
    act_signed_at = Column(DateTime, nullable=True)  # When client signed the act
    act_document = relationship("Document", foreign_keys=[act_document_id])

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
    invoices = relationship("DealInvoice", back_populates="deal", cascade="all, delete-orphan")


class DealParty(BaseModel):
    """Deal participant"""

    __tablename__ = "deal_parties"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False)

    # Using String instead of native Enum to avoid PostgreSQL enum type issues
    party_role = Column(String(50), nullable=False)
    party_type = Column(String(50), nullable=False)
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
