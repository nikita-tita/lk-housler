"""User models"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class UserRole(str, PyEnum):
    """User role in Housler ecosystem"""
    CLIENT = "client"           # Клиент (покупатель/продавец)
    AGENT = "agent"            # Частный риелтор (самозанятый/ИП)
    AGENCY_ADMIN = "agency_admin"  # Администратор агентства
    OPERATOR = "operator"      # Оператор платформы
    ADMIN = "admin"            # Администратор платформы


class UserStatus(str, PyEnum):
    """User account status"""
    ACTIVE = "active"
    BLOCKED = "blocked"
    PENDING = "pending"


class ConsentType(str, PyEnum):
    """Consent types (согласия)"""
    PERSONAL_DATA = "personal_data"    # Обработка ПД
    TERMS = "terms"                     # Пользовательское соглашение
    MARKETING = "marketing"             # Маркетинговые рассылки
    REALTOR_OFFER = "realtor_offer"    # Оферта для риелторов
    AGENCY_OFFER = "agency_offer"      # Оферта для агентств


class TaxStatus(str, PyEnum):
    """Tax status for users"""
    NPD = "npd"  # Самозанятый
    IP = "ip"    # Индивидуальный предприниматель
    OOO = "ooo"  # ООО
    EMPLOYEE = "employee"  # Сотрудник агентства


class VerificationLevel(int, PyEnum):
    """KYC verification level (115-ФЗ)"""
    NONE = 0           # Нет верификации
    SIMPLIFIED = 1     # Упрощенная: ФИО, телефон (до 15K₽)
    STANDARD = 2       # Стандартная: паспорт, ИНН (до 600K₽)
    FULL = 3          # Полная: юрлицо (без ограничений)


class User(BaseModel):
    """User account with PII encryption (152-ФЗ)"""
    
    __tablename__ = "users"
    
    # Role (определяет способ авторизации)
    role = Column(
        Enum(UserRole),
        default=UserRole.CLIENT,
        nullable=False,
        index=True
    )
    
    # PII: Phone (encrypted + hash for search)
    phone = Column(String(20), unique=True, nullable=True, index=True)  # Plain for now (deprecated)
    phone_encrypted = Column(Text, nullable=True)  # Encrypted phone
    phone_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for search
    
    # PII: Email (encrypted + hash for search)
    email = Column(String(255), unique=True, nullable=True, index=True)  # Plain for now (deprecated)
    email_encrypted = Column(Text, nullable=True)  # Encrypted email
    email_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for search
    
    # Password (только для agency_admin)
    password_hash = Column(String(255), nullable=True)
    
    # Status
    status = Column(
        Enum(UserStatus),
        default=UserStatus.PENDING,
        nullable=False
    )
    
    # Last login
    last_login_at = Column(DateTime, nullable=True)
    
    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    organizations = relationship("OrganizationMember", back_populates="user")
    deals_created = relationship("Deal", foreign_keys="Deal.created_by_user_id", back_populates="creator")
    deals_as_agent = relationship("Deal", foreign_keys="Deal.agent_user_id", back_populates="agent")
    consents = relationship("UserConsent", back_populates="user", cascade="all, delete-orphan")


class UserProfile(BaseModel):
    """User profile with KYC data"""
    
    __tablename__ = "user_profiles"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    
    # PII: Full name (encrypted)
    full_name = Column(String(255), nullable=True)  # Plain (deprecated)
    full_name_encrypted = Column(Text, nullable=True)  # Encrypted

    # PII: Паспортные данные (encrypted, 152-ФЗ)
    passport_series = Column(String(10), nullable=True)  # Plain (deprecated)
    passport_number = Column(String(20), nullable=True)  # Plain (deprecated)
    passport_series_encrypted = Column(Text, nullable=True)  # Encrypted series
    passport_number_encrypted = Column(Text, nullable=True)  # Encrypted number
    passport_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for duplicate check
    passport_issued_by = Column(Text, nullable=True)  # Plain (deprecated)
    passport_issued_by_encrypted = Column(Text, nullable=True)  # Encrypted
    passport_issued_at = Column(DateTime, nullable=True)
    
    # PII: Налоговые данные (encrypted + hash)
    inn = Column(String(12), nullable=True, index=True)  # Plain (deprecated)
    personal_inn_encrypted = Column(Text, nullable=True)  # Encrypted INN
    personal_inn_hash = Column(String(64), nullable=True, index=True)  # SHA-256
    
    tax_status = Column(Enum(TaxStatus), nullable=True)
    
    # Адрес
    address = Column(Text, nullable=True)
    
    # Город (для риелторов)
    city = Column(String(100), nullable=True)
    
    # Верификация
    verified_level = Column(
        Enum(VerificationLevel),
        default=VerificationLevel.NONE,
        nullable=False
    )
    kyc_checked_at = Column(DateTime, nullable=True)
    kyc_meta = Column(JSONB, nullable=True)  # Результаты проверок
    
    # Relationships
    user = relationship("User", back_populates="profile")


class UserConsent(BaseModel):
    """User consents (согласия по 152-ФЗ)"""
    
    __tablename__ = "user_consents"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    consent_type = Column(Enum(ConsentType), nullable=False)
    
    # Согласие дано
    granted = Column(Boolean, default=False, nullable=False)
    granted_at = Column(DateTime, nullable=True)
    
    # IP и user agent для аудита
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Отзыв согласия
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="consents")


class OTPSession(BaseModel):
    """OTP session for phone verification"""
    
    __tablename__ = "otp_sessions"
    
    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    
    purpose = Column(String(50), nullable=False)  # login, signup, signature, etc.
    
    attempts = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    
    expires_at = Column(DateTime, nullable=False)
    blocked_until = Column(DateTime, nullable=True)
    
    # Метаданные для audit
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

