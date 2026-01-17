"""Bank Split schemas"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# ============================================
# Split Recipient schemas
# ============================================


class SplitRecipientBase(BaseModel):
    """Base split recipient schema"""
    role: str = Field(..., description="agent/agency/lead/platform_fee")
    split_type: str = Field(default="percent", description="percent/fixed")
    split_value: Decimal = Field(..., description="Percent (0-100) or fixed amount")


class SplitRecipientCreate(SplitRecipientBase):
    """Create split recipient"""
    user_id: Optional[int] = None
    organization_id: Optional[UUID] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    legal_type: Optional[str] = None

    @field_validator('inn')
    @classmethod
    def validate_inn(cls, v: Optional[str]) -> Optional[str]:
        """Validate INN checksum if provided"""
        if v is None:
            return v
        from app.utils.inn_validator import validate_inn
        return validate_inn(v)


class SplitRecipientResponse(SplitRecipientBase):
    """Split recipient response"""
    id: UUID
    deal_id: UUID
    user_id: Optional[int] = None
    organization_id: Optional[UUID] = None
    calculated_amount: Optional[Decimal] = None
    payout_status: str
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Bank Split Deal schemas
# ============================================


class BankSplitDealCreate(BaseModel):
    """Create bank-split deal"""
    type: str = Field(..., description="secondary_buy/secondary_sell/newbuild_booking")

    # Property
    property_address: str = Field(..., min_length=1)
    price: Decimal = Field(..., gt=0, description="Property price in rubles")

    # Commission
    commission_total: Decimal = Field(..., gt=0, description="Total commission in rubles")
    description: Optional[str] = Field(None, max_length=500)

    # Client info
    client_name: str = Field(..., min_length=1)
    client_phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    client_email: Optional[str] = None

    # Organization (optional - for agency deals)
    organization_id: Optional[UUID] = None

    # Custom split (optional)
    agent_split_percent: Optional[int] = Field(None, ge=0, le=100)


class BankSplitDealResponse(BaseModel):
    """Bank-split deal response"""
    id: UUID
    type: str
    status: str
    payment_model: str

    # Property
    property_address: str
    price: Decimal
    commission_agent: Decimal

    # Platform fee (computed)
    platform_fee_percent: Decimal = Field(default=Decimal("4.0"), description="Platform fee percent")
    platform_fee_amount: Decimal = Field(default=Decimal("0"), description="Platform fee amount in rubles")
    total_client_payment: Decimal = Field(default=Decimal("0"), description="Total amount client pays (commission + platform fee)")

    # Client
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    payer_email: Optional[str] = None

    # Bank integration
    external_provider: Optional[str] = None
    external_deal_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    payment_qr_payload: Optional[str] = None
    expires_at: Optional[datetime] = None
    hold_expires_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Split recipients
    recipients: List[SplitRecipientResponse] = []

    class Config:
        from_attributes = True


class BankSplitDealList(BaseModel):
    """List of bank-split deals"""
    items: List[BankSplitDealResponse]
    total: int
    page: int
    size: int


# ============================================
# Invoice schemas
# ============================================


class CreateInvoiceRequest(BaseModel):
    """Request to create invoice (payment link)"""
    return_url: Optional[str] = None


class CreateInvoiceResponse(BaseModel):
    """Invoice creation response"""
    deal_id: UUID
    external_deal_id: str
    payment_url: str
    qr_code: Optional[str] = None
    expires_at: Optional[datetime] = None


class RegeneratePaymentLinkResponse(BaseModel):
    """Payment link regeneration response"""
    payment_url: str
    expires_at: datetime


class PaymentInfoResponse(BaseModel):
    """Public payment info for payment page"""
    deal_id: UUID
    property_address: str
    amount: Decimal
    payment_url: Optional[str] = None
    qr_code: Optional[str] = None
    expires_at: Optional[datetime] = None
    status: str  # 'pending', 'paid', 'expired', 'cancelled'
    client_name: Optional[str] = None


# ============================================
# Webhook schemas
# ============================================


class TBankWebhookPayload(BaseModel):
    """T-Bank webhook payload"""
    TerminalKey: Optional[str] = None
    OrderId: Optional[str] = None
    DealId: Optional[str] = None
    PaymentId: Optional[str] = None
    Amount: Optional[int] = None
    Status: Optional[str] = None
    Success: Optional[bool] = None
    ErrorCode: Optional[str] = None
    Message: Optional[str] = None
    Token: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


class WebhookResponse(BaseModel):
    """Webhook response"""
    Success: bool = True


# ============================================
# Status transition schemas
# ============================================


class DealStatusTransition(BaseModel):
    """Deal status transition request"""
    reason: Optional[str] = Field(None, max_length=500)


class DealStatusResponse(BaseModel):
    """Deal status response"""
    deal_id: UUID
    old_status: str
    new_status: str
    timestamp: datetime


# ============================================
# Payment link delivery schemas
# ============================================


class SendPaymentLinkRequest(BaseModel):
    """Request to send payment link to client"""
    method: str = Field(default="sms", description="Delivery method: sms/email")


class SendPaymentLinkResponse(BaseModel):
    """Response after sending payment link"""
    success: bool
    method: str
    recipient: str  # Masked phone or email
    message: str


# ============================================
# Consent schemas
# ============================================


class ConsentCreate(BaseModel):
    """Create consent record"""
    consent_type: str = Field(..., description="platform_commission/data_processing/terms_of_service/split_agreement")
    consent_version: str = Field(default="1.0", description="Version of the agreement")
    document_url: Optional[str] = Field(None, description="URL to the agreement document")


class ConsentResponse(BaseModel):
    """Consent record response"""
    id: UUID
    deal_id: UUID
    user_id: int
    consent_type: str
    consent_version: str
    agreed_at: datetime
    document_url: Optional[str] = None
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConsentCheckResponse(BaseModel):
    """Response for checking required consents"""
    deal_id: UUID
    required_consents: List[str]
    given_consents: List[str]
    missing_consents: List[str]
    all_consents_given: bool
