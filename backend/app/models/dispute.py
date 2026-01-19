"""Модели споров для конфликтов и возвратов по сделкам"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    Numeric,
    Boolean,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class DisputeStatus(str, PyEnum):
    """Статус спора"""
    OPEN = "open"  # Открыт
    AGENCY_REVIEW = "agency_review"  # На рассмотрении агентства
    PLATFORM_REVIEW = "platform_review"  # Эскалирован на платформу
    RESOLVED = "resolved"  # Решён
    REJECTED = "rejected"  # Отклонён
    CANCELLED = "cancelled"  # Отменён


class DisputeReason(str, PyEnum):
    """Причины спора"""
    SERVICE_NOT_PROVIDED = "service_not_provided"  # Услуга не оказана
    SERVICE_QUALITY = "service_quality"  # Качество услуги
    INCORRECT_AMOUNT = "incorrect_amount"  # Неверная сумма
    DUPLICATE_PAYMENT = "duplicate_payment"  # Дублирующий платёж
    UNAUTHORIZED_PAYMENT = "unauthorized_payment"  # Несанкционированный платёж
    OTHER = "other"  # Другое


class RefundStatus(str, PyEnum):
    """Статус возврата"""
    NOT_REQUESTED = "not_requested"  # Не запрошен
    REQUESTED = "requested"  # Запрошен
    APPROVED = "approved"  # Одобрен
    PROCESSING = "processing"  # В обработке
    COMPLETED = "completed"  # Выполнен
    REJECTED = "rejected"  # Отклонён
    FAILED = "failed"  # Ошибка


class DisputeResolution(str, PyEnum):
    """Тип решения спора"""
    FULL_REFUND = "full_refund"  # Полный возврат
    PARTIAL_REFUND = "partial_refund"  # Частичный возврат
    NO_REFUND = "no_refund"  # Без возврата
    SPLIT_ADJUSTMENT = "split_adjustment"  # Корректировка распределения


class EscalationLevel(str, PyEnum):
    """Уровень эскалации спора"""
    NONE = "none"  # Без эскалации
    AGENCY = "agency"  # На уровне агентства
    PLATFORM = "platform"  # На уровне платформы


class Dispute(BaseModel):
    """Запись о споре по сделке"""

    __tablename__ = "disputes"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    initiator_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Детали спора
    reason = Column(String(50), nullable=False)  # DisputeReason
    description = Column(Text, nullable=False)

    # Статус
    status = Column(String(20), default="open", nullable=False, index=True)

    # Эскалация спора (агентство -> платформа)
    escalation_level = Column(String(20), default="agency", nullable=False)  # EscalationLevel: agency/platform
    agency_id = Column(UUID(as_uuid=True), nullable=True)  # Агентство для первичного рассмотрения
    escalated_at = Column(DateTime, nullable=True)  # Время эскалации на уровень platform

    # Escalation timers (TASK-2.3)
    agency_deadline = Column(DateTime, nullable=True)  # 24h после создания - deadline для agency
    platform_deadline = Column(DateTime, nullable=True)  # 72h после эскалации на platform
    max_deadline = Column(DateTime, nullable=True)  # 7 дней от создания - максимальный срок

    # Решение агентства (первый уровень)
    agency_decision = Column(String(50), nullable=True)  # DisputeResolution
    agency_decision_notes = Column(Text, nullable=True)
    agency_decision_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    agency_decision_at = Column(DateTime, nullable=True)

    # Финальное решение (set when resolved)
    resolution = Column(String(50), nullable=True)  # DisputeResolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Отслеживание возврата
    refund_requested = Column(Boolean, default=False, nullable=False)
    refund_amount = Column(Numeric(15, 2), nullable=True)
    refund_status = Column(String(20), default="not_requested", nullable=False)
    refund_external_id = Column(String(255), nullable=True)  # T-Bank refund ID
    refund_processed_at = Column(DateTime, nullable=True)

    # Артефакты для суда/досудебного урегулирования
    court_artifacts_notes = Column(Text, nullable=True)  # Рекомендации по сбору артефактов

    # Примечания администратора (внутренние)
    admin_notes = Column(Text, nullable=True)

    # Связи
    deal = relationship("Deal", back_populates="disputes")
    initiator = relationship("User", foreign_keys=[initiator_user_id])
    agency_decision_user = relationship("User", foreign_keys=[agency_decision_by])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
    evidence = relationship("DisputeEvidence", back_populates="dispute", cascade="all, delete-orphan")


class DisputeEvidence(BaseModel):
    """Доказательства (файлы) по спору"""

    __tablename__ = "dispute_evidence"

    dispute_id = Column(UUID(as_uuid=True), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False, index=True)

    # Информация о файле
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # image, pdf, document
    file_size = Column(Integer, nullable=True)  # байты

    # Информация о загрузке
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)

    # Связи
    dispute = relationship("Dispute", back_populates="evidence")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])
