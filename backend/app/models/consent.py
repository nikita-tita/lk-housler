"""Consent models for deal agreements"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class ConsentType(str, PyEnum):
    """Types of consent that can be given for bank-split deals"""
    # Core consents (B2B model)
    PLATFORM_FEE_DEDUCTION = "platform_fee_deduction"  # Agree to platform fee deduction from payment
    DATA_PROCESSING = "data_processing"  # Personal data processing (152-FZ)
    TERMS_OF_SERVICE = "terms_of_service"  # Platform terms
    SPLIT_AGREEMENT = "split_agreement"  # Agree to split distribution

    # Bank-led model consents (T-Bank Multiracchety)
    BANK_PAYMENT_PROCESSING = "bank_payment_processing"  # Consent for T-Bank nominal account processing
    SERVICE_CONFIRMATION_REQUIRED = "service_confirmation_required"  # Agree that service must be confirmed
    HOLD_PERIOD_ACCEPTANCE = "hold_period_acceptance"  # Accept hold period before payout

    # Legacy (deprecated, kept for backwards compatibility)
    PLATFORM_COMMISSION = "platform_commission"  # Deprecated: use PLATFORM_FEE_DEDUCTION


# Consent text templates (T-Bank nominal account model, no escrow/MoR terminology)
CONSENT_TEXTS = {
    ConsentType.PLATFORM_FEE_DEDUCTION.value: {
        "title": "Согласие на удержание комиссии платформы",
        "text": (
            "Я соглашаюсь с тем, что комиссия платформы Housler будет автоматически "
            "удержана из суммы платежа на номинальном счёте T-Bank до распределения "
            "средств между участниками сделки."
        ),
        "version": "2.0",
    },
    ConsentType.DATA_PROCESSING.value: {
        "title": "Согласие на обработку персональных данных",
        "text": (
            "Я даю согласие на обработку моих персональных данных в соответствии "
            "с Федеральным законом от 27.07.2006 N 152-ФЗ 'О персональных данных' "
            "для целей исполнения договора и осуществления расчётов."
        ),
        "version": "1.0",
    },
    ConsentType.TERMS_OF_SERVICE.value: {
        "title": "Согласие с условиями использования платформы",
        "text": (
            "Я подтверждаю, что ознакомился и согласен с Условиями использования "
            "платформы Housler и Политикой конфиденциальности."
        ),
        "version": "1.0",
    },
    ConsentType.SPLIT_AGREEMENT.value: {
        "title": "Согласие с распределением средств",
        "text": (
            "Я подтверждаю согласие с указанным распределением комиссии между "
            "участниками сделки и понимаю, что выплаты будут произведены согласно "
            "установленным долям после подтверждения оказания услуги."
        ),
        "version": "1.0",
    },
    ConsentType.BANK_PAYMENT_PROCESSING.value: {
        "title": "Согласие на обработку платежа через T-Bank",
        "text": (
            "Я соглашаюсь с тем, что платёж будет обработан через номинальный счёт T-Bank "
            "в рамках сервиса Мультирасчёты (Multiracchety). Средства будут храниться "
            "на номинальном счёте до момента подтверждения оказания услуги и последующего "
            "распределения между получателями."
        ),
        "version": "1.0",
    },
    ConsentType.SERVICE_CONFIRMATION_REQUIRED.value: {
        "title": "Согласие с требованием подтверждения услуги",
        "text": (
            "Я понимаю и соглашаюсь с тем, что выплата средств будет произведена только "
            "после подтверждения факта оказания услуги всеми сторонами сделки. "
            "До подтверждения услуги средства находятся на номинальном счёте T-Bank."
        ),
        "version": "1.0",
    },
    ConsentType.HOLD_PERIOD_ACCEPTANCE.value: {
        "title": "Принятие периода удержания средств",
        "text": (
            "Я понимаю и соглашаюсь с тем, что после поступления оплаты средства будут "
            "удерживаться на номинальном счёте T-Bank в течение установленного периода "
            "(hold period) для возможности оспаривания. Выплата производится после "
            "истечения периода удержания или после подтверждения услуги всеми сторонами."
        ),
        "version": "1.0",
    },
    # Legacy consent (deprecated)
    ConsentType.PLATFORM_COMMISSION.value: {
        "title": "Согласие на комиссию платформы (устаревшее)",
        "text": (
            "Это согласие устарело. Пожалуйста, используйте platform_fee_deduction."
        ),
        "version": "1.0",
        "deprecated": True,
    },
}


def get_consent_text(consent_type: str, language: str = "ru") -> dict:
    """
    Get consent text for the given type.

    Args:
        consent_type: The consent type string
        language: Language code (currently only 'ru' supported)

    Returns:
        Dict with title, text, and version
    """
    return CONSENT_TEXTS.get(consent_type, {
        "title": "Неизвестный тип согласия",
        "text": f"Согласие типа {consent_type}",
        "version": "1.0",
    })


class DealConsent(BaseModel):
    """User consent record for a deal"""

    __tablename__ = "deal_consents"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Consent details
    consent_type = Column(String(50), nullable=False, index=True)
    consent_version = Column(String(20), default="1.0", nullable=False)  # Version of the agreement

    # When and how consent was given
    agreed_at = Column(DateTime, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)

    # Reference to what was agreed to (optional document link)
    document_url = Column(String(500), nullable=True)
    document_hash = Column(String(64), nullable=True)  # SHA-256 of the document at time of consent

    # Withdrawal (if consent is revoked)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(Text, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="consents")
    user = relationship("User", foreign_keys=[user_id])
