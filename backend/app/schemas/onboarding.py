"""Onboarding schemas (TASK-5.2)

Pydantic schemas for T-Bank onboarding API endpoints.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ============================================
# Request schemas
# ============================================


class OnboardingStartRequest(BaseModel):
    """Request to start onboarding"""
    legal_type: str = Field(..., description="Legal type: se/ip/ooo")
    legal_name: str = Field(..., min_length=1, max_length=500)
    inn: str = Field(..., pattern=r"^\d{10}$|^\d{12}$")
    kpp: Optional[str] = Field(None, pattern=r"^\d{9}$")
    ogrn: Optional[str] = Field(None, pattern=r"^\d{13}$|^\d{15}$")
    bank_account: str = Field(..., pattern=r"^\d{20}$")
    bank_bik: str = Field(..., pattern=r"^\d{9}$")
    bank_name: str = Field(..., min_length=1, max_length=255)
    bank_corr_account: str = Field(..., pattern=r"^\d{20}$")
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    email: Optional[str] = Field(None, max_length=255)
    organization_id: Optional[UUID] = Field(None, description="Organization ID for agency onboarding")

    @field_validator('legal_type')
    @classmethod
    def validate_legal_type(cls, v: str) -> str:
        allowed = {'se', 'ip', 'ooo'}
        if v.lower() not in allowed:
            raise ValueError(f"legal_type must be one of: {allowed}")
        return v.lower()

    @field_validator('inn')
    @classmethod
    def validate_inn(cls, v: str) -> str:
        """Validate INN checksum"""
        from app.utils.inn_validator import validate_inn
        return validate_inn(v)


class OnboardingDocumentUpload(BaseModel):
    """Document upload request"""
    document_type: str = Field(..., description="Document type (passport_main, bank_details, etc.)")
    file_url: str = Field(..., description="URL to uploaded file")
    file_name: str = Field(..., max_length=255)
    file_size: int = Field(..., gt=0, le=10_000_000)  # Max 10MB
    mime_type: str = Field(default="application/pdf")


class OnboardingSubmitDocumentsRequest(BaseModel):
    """Request to submit documents"""
    documents: List[OnboardingDocumentUpload] = Field(..., min_length=1)


class OnboardingWebhookPayload(BaseModel):
    """T-Bank onboarding webhook payload"""
    event_type: str = Field(..., alias="eventType")
    session_id: Optional[str] = Field(None, alias="sessionId")
    external_id: Optional[str] = Field(None, alias="externalId")
    status: Optional[str] = None
    merchant_id: Optional[str] = Field(None, alias="merchantId")
    rejection_reason: Optional[str] = Field(None, alias="rejectionReason")
    timestamp: Optional[datetime] = None

    class Config:
        populate_by_name = True
        extra = "allow"


# ============================================
# Response schemas
# ============================================


class OnboardingSessionResponse(BaseModel):
    """Onboarding session details"""
    session_id: str
    profile_id: UUID
    status: str
    created_at: datetime
    expires_at: datetime
    onboarding_url: Optional[str] = None
    required_documents: List[str] = []
    submitted_documents: List[str] = []


class OnboardingStartResponse(BaseModel):
    """Response after starting onboarding"""
    profile_id: UUID
    session_id: str
    status: str
    onboarding_url: Optional[str] = None
    required_documents: List[str] = []
    message: str = "Onboarding initiated successfully"


class OnboardingStatusResponse(BaseModel):
    """Current onboarding status"""
    profile_id: UUID
    profile_status: str
    session_status: Optional[str] = None
    progress_percent: Optional[int] = None
    current_step: Optional[str] = None
    required_documents: List[str] = []
    submitted_documents: List[str] = []
    is_complete: bool = False
    merchant_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    estimated_completion_hours: Optional[int] = None


class OnboardingDocumentSubmitResponse(BaseModel):
    """Response after submitting documents"""
    success: bool
    submitted_count: int
    remaining_documents: List[str] = []
    status: str
    message: str


class OnboardingCompleteResponse(BaseModel):
    """Response after completing onboarding"""
    profile_id: UUID
    merchant_id: str
    terminal_key: Optional[str] = None
    account_id: Optional[str] = None
    split_enabled: bool = True
    activated_at: datetime
    message: str = "Onboarding completed successfully"


class OnboardingWebhookResponse(BaseModel):
    """Webhook response"""
    success: bool = True


# ============================================
# List/Query responses
# ============================================


class PaymentProfileResponse(BaseModel):
    """Payment profile details"""
    id: UUID
    user_id: Optional[int] = None
    organization_id: Optional[UUID] = None
    legal_type: str
    legal_name: str
    inn_masked: str  # Last 4 digits only
    bank_name: str
    bank_bik: str
    bank_onboarding_status: str
    bank_merchant_id: Optional[str] = None
    bank_onboarded_at: Optional[datetime] = None
    kyc_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentProfileListResponse(BaseModel):
    """List of payment profiles"""
    items: List[PaymentProfileResponse]
    total: int
