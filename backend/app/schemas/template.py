"""Template schemas for contract template management"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.document import TemplateType, TemplateStatus


class TemplateBase(BaseModel):
    """Base template schema"""
    code: str = Field(..., min_length=1, max_length=50)
    type: TemplateType
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    template_body: str = Field(..., min_length=1)
    placeholders_schema: Dict[str, Any]
    legal_basis: Optional[str] = None
    effective_from: Optional[date] = None


class TemplateCreate(TemplateBase):
    """Create template schema"""
    version: str = Field(default="1.0", max_length=20)


class TemplateUpdate(BaseModel):
    """Update template schema (only for drafts)"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    template_body: Optional[str] = None
    placeholders_schema: Optional[Dict[str, Any]] = None
    legal_basis: Optional[str] = None
    effective_from: Optional[date] = None


class TemplateResponse(TemplateBase):
    """Template response schema"""
    id: UUID
    version: str
    status: TemplateStatus
    active: bool
    published_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateListItem(BaseModel):
    """Template list item (lightweight)"""
    id: UUID
    code: str
    type: TemplateType
    version: str
    name: str
    status: TemplateStatus
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """Template list response"""
    items: List[TemplateListItem]
    total: int


class TemplatePreviewRequest(BaseModel):
    """Request to preview template with test data"""
    test_data: Dict[str, Any] = Field(
        default_factory=lambda: {
            "contract_number": "ДУ-2024-ABC123",
            "contract_date": "24.12.2024",
            "executor_name": "ООО \"Тест\"",
            "executor_inn": "1234567890",
            "executor_kpp": "123456789",
            "executor_ogrn": "1234567890123",
            "executor_address": "г. Москва, ул. Тестовая, д. 1",
            "executor_phone": "+7 (999) 123-45-67",
            "executor_email": "test@example.com",
            "executor_bank_block": "",
            "client_name": "Иванов Иван Иванович",
            "client_phone": "+7 (999) 987-65-43",
            "property_address": "г. Москва, ул. Примерная, д. 10, кв. 5",
            "commission_total": "100 000",
            "commission_words": "сто тысяч рублей",
            "payment_plan_rows": "<tr><td>Этап 1</td><td>100 000</td><td>При подписании</td></tr>",
            "document_hash": "abc123def456...",
        }
    )


class TemplatePreviewResponse(BaseModel):
    """Preview response"""
    html: str
    placeholders_used: List[str]
    placeholders_missing: List[str]


class TemplateValidationResponse(BaseModel):
    """Validation response"""
    valid: bool
    errors: List[str]
    warnings: List[str]
    placeholders_found: List[str]
