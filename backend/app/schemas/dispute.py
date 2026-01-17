"""Dispute schemas"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field


class DisputeCreate(BaseModel):
    """Create dispute request"""
    reason: str = Field(..., description="Dispute reason: service_not_provided/service_quality/incorrect_amount/duplicate_payment/unauthorized_payment/other")
    description: str = Field(..., min_length=10, max_length=2000, description="Detailed description")
    refund_requested: bool = Field(default=False, description="Request refund")
    refund_amount: Optional[Decimal] = Field(None, ge=0, description="Requested refund amount (if partial)")


class DisputeEvidenceCreate(BaseModel):
    """Upload evidence request"""
    file_url: str = Field(..., description="URL of uploaded file")
    file_name: str = Field(..., max_length=255)
    file_type: str = Field(..., description="image/pdf/document")
    file_size: Optional[int] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=500)


class DisputeResolve(BaseModel):
    """Resolve dispute request (admin only)"""
    resolution: str = Field(..., description="Resolution: full_refund/partial_refund/no_refund/split_adjustment")
    resolution_notes: Optional[str] = Field(None, max_length=2000)
    refund_amount: Optional[Decimal] = Field(None, ge=0, description="Refund amount if partial")


class DisputeEvidenceResponse(BaseModel):
    """Evidence response"""
    id: UUID
    dispute_id: UUID
    file_url: str
    file_name: str
    file_type: str
    file_size: Optional[int] = None
    description: Optional[str] = None
    uploaded_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DisputeResponse(BaseModel):
    """Dispute response"""
    id: UUID
    deal_id: UUID
    initiator_user_id: int
    reason: str
    description: str
    status: str
    resolution: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_by_user_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    refund_requested: bool
    refund_amount: Optional[Decimal] = None
    refund_status: str
    refund_processed_at: Optional[datetime] = None
    evidence: List[DisputeEvidenceResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DisputeListResponse(BaseModel):
    """List of disputes"""
    items: List[DisputeResponse]
    total: int
    page: int
    size: int


# Labels for UI
DISPUTE_REASON_LABELS = {
    "service_not_provided": "Услуга не оказана",
    "service_quality": "Качество услуги",
    "incorrect_amount": "Неверная сумма",
    "duplicate_payment": "Дублирование платежа",
    "unauthorized_payment": "Несанкционированный платеж",
    "other": "Другое",
}

DISPUTE_STATUS_LABELS = {
    "open": "Открыт",
    "under_review": "На рассмотрении",
    "resolved": "Решен",
    "rejected": "Отклонен",
    "cancelled": "Отменен",
}

REFUND_STATUS_LABELS = {
    "not_requested": "Не запрошен",
    "requested": "Запрошен",
    "approved": "Одобрен",
    "processing": "В обработке",
    "completed": "Выполнен",
    "rejected": "Отклонен",
    "failed": "Ошибка",
}
