"""Bank Split schemas"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# ============================================
# TASK-2.4: Milestone schemas
# ============================================


class ReleaseTriggerEnum(str, Enum):
    """Release trigger type for milestones"""
    IMMEDIATE = "immediate"
    SHORT_HOLD = "short_hold"
    CONFIRMATION = "confirmation"
    DATE = "date"


class MilestoneStatusEnum(str, Enum):
    """Milestone status"""
    PENDING = "pending"
    READY_TO_PAY = "ready_to_pay"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    HOLD = "hold"
    RELEASED = "released"
    CANCELLED = "cancelled"


class MilestoneConfigCreate(BaseModel):
    """Configuration for creating a single milestone"""
    name: str = Field(..., min_length=1, max_length=255)
    percent: Decimal = Field(..., ge=0, le=100, description="Percentage of total deal (0-100)")
    trigger: ReleaseTriggerEnum = Field(..., description="Release trigger type")
    description: Optional[str] = Field(None, max_length=500)
    release_delay_hours: Optional[int] = Field(
        None,
        ge=1,
        le=720,
        description="Hours to wait before release (for SHORT_HOLD trigger, max 30 days)"
    )
    release_date: Optional[datetime] = Field(
        None,
        description="Specific date for release (for DATE trigger)"
    )

    @field_validator('release_delay_hours')
    @classmethod
    def validate_delay_hours(cls, v, info):
        """Validate delay hours is set for SHORT_HOLD trigger"""
        if info.data.get('trigger') == ReleaseTriggerEnum.SHORT_HOLD and not v:
            raise ValueError("release_delay_hours required for SHORT_HOLD trigger")
        return v

    @field_validator('release_date')
    @classmethod
    def validate_release_date(cls, v, info):
        """Validate release date is set for DATE trigger"""
        if info.data.get('trigger') == ReleaseTriggerEnum.DATE and not v:
            raise ValueError("release_date required for DATE trigger")
        return v


class CreateMilestonesRequest(BaseModel):
    """Request to create milestones for a deal"""
    milestones: List[MilestoneConfigCreate] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="List of milestone configurations"
    )

    @field_validator('milestones')
    @classmethod
    def validate_milestones_sum(cls, v):
        """Validate that milestone percentages sum to 100"""
        total = sum(m.percent for m in v)
        if total != Decimal("100"):
            raise ValueError(f"Milestone percentages must sum to 100, got {total}")
        return v


class MilestoneResponse(BaseModel):
    """Response schema for a milestone"""
    id: UUID
    deal_id: UUID
    step_no: int
    name: str
    description: Optional[str] = None
    amount: Decimal
    percent: Optional[Decimal] = None
    currency: str = "RUB"
    status: str
    release_trigger: str
    release_delay_hours: Optional[int] = None
    release_date: Optional[datetime] = None
    release_scheduled_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    confirmed_by_user_id: Optional[int] = None
    external_step_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MilestoneListResponse(BaseModel):
    """Response for list of milestones"""
    items: List[MilestoneResponse]
    total: int
    total_amount: Decimal
    released_amount: Decimal
    pending_amount: Decimal


class MilestoneReleaseRequest(BaseModel):
    """Request to release a milestone"""
    force: bool = Field(
        default=False,
        description="Force release even if scheduled time not reached"
    )


class MilestoneReleaseResponse(BaseModel):
    """Response after releasing a milestone"""
    milestone_id: UUID
    success: bool
    released_amount: Optional[Decimal] = None
    error_message: Optional[str] = None
    new_status: str


class MilestoneConfirmRequest(BaseModel):
    """Request to confirm a milestone"""
    notes: Optional[str] = Field(None, max_length=500, description="Confirmation notes")


class MilestoneConfirmResponse(BaseModel):
    """Response after confirming a milestone"""
    milestone_id: UUID
    confirmed_at: datetime
    confirmed_by_user_id: int
    new_status: str
    release_scheduled_at: Optional[datetime] = None


class MilestonesSummaryResponse(BaseModel):
    """Summary of all milestones for a deal"""
    total_amount: Decimal
    released_amount: Decimal
    pending_amount: Decimal
    milestones_count: int
    released_count: int
    milestones: List[dict]


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
    """Request to create invoice (payment link) - LEGACY: creates invoice for full amount"""
    return_url: Optional[str] = None


class CreateInvoiceResponse(BaseModel):
    """Invoice creation response"""
    deal_id: UUID
    external_deal_id: str
    payment_url: str
    qr_code: Optional[str] = None
    expires_at: Optional[datetime] = None


# ============================================
# Partial Invoice schemas (multiple invoices per deal)
# ============================================


class CreatePartialInvoiceRequest(BaseModel):
    """Request to create invoice for specific amount

    Allows agent to create multiple invoices:
    - Advance (e.g., 30% of commission)
    - Remainder after service
    - Or full amount at once

    Validation:
    - Amount must be <= remaining commission (total - already invoiced)
    - Deal must be in signed status or partially paid
    """
    amount: Decimal = Field(..., gt=0, description="Invoice amount in rubles")
    description: Optional[str] = Field(None, max_length=500, description="Invoice description, e.g. 'Advance 30%'")
    return_url: Optional[str] = Field(None, description="URL to redirect after payment")
    milestone_id: Optional[UUID] = Field(None, description="Optional link to milestone")


class PartialInvoiceResponse(BaseModel):
    """Response for partial invoice creation"""
    invoice_id: UUID
    deal_id: UUID
    amount: Decimal
    description: Optional[str] = None
    status: str
    payment_url: Optional[str] = None
    qr_code: Optional[str] = None
    expires_at: Optional[datetime] = None

    # Summary
    total_commission: Decimal  # Total deal commission
    total_invoiced: Decimal    # Sum of all invoices
    total_paid: Decimal        # Sum of paid invoices
    remaining_amount: Decimal  # Amount that can still be invoiced

    class Config:
        from_attributes = True


class InvoiceListItem(BaseModel):
    """Invoice item in list"""
    id: UUID
    invoice_number: Optional[str] = None
    amount: Decimal
    description: Optional[str] = None
    status: str
    payment_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    """List of invoices for a deal"""
    deal_id: UUID
    invoices: List[InvoiceListItem]

    # Summary
    total_commission: Decimal
    total_invoiced: Decimal
    total_paid: Decimal
    remaining_amount: Decimal


class PaymentSummaryResponse(BaseModel):
    """Payment summary for a deal"""
    deal_id: UUID
    payment_scheme: str  # prepayment_full / advance_postpay / postpayment_full

    # Commission info
    total_commission: Decimal
    commission_type: str  # percent / fixed / mixed
    commission_percent: Optional[Decimal] = None
    commission_fixed: Optional[Decimal] = None

    # Advance info (if payment_scheme == advance_postpay)
    advance_type: Optional[str] = None  # none / advance_fixed / advance_percent
    advance_amount: Optional[Decimal] = None
    advance_percent: Optional[Decimal] = None
    calculated_advance: Optional[Decimal] = None  # Actual advance amount

    # Invoice summary
    total_invoiced: Decimal
    total_paid: Decimal
    remaining_amount: Decimal
    invoices_count: int
    paid_invoices_count: int


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
    """Create consent record for bank-split deals"""
    consent_type: str = Field(
        ...,
        description=(
            "Consent types: platform_fee_deduction, data_processing, terms_of_service, "
            "split_agreement, bank_payment_processing, service_confirmation_required, "
            "hold_period_acceptance"
        )
    )
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


# ============================================
# Client Passport schemas (152-FZ)
# ============================================


class ClientPassportUpdate(BaseModel):
    """Update client passport data for deal (152-FZ compliant)"""
    passport_series: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    passport_number: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    passport_issued_by: str = Field(..., min_length=5, max_length=500)
    passport_issued_date: datetime
    passport_issued_code: str = Field(..., min_length=6, max_length=7, pattern=r"^\d{3}-?\d{3}$")
    birth_date: datetime
    birth_place: str = Field(..., min_length=2, max_length=255)
    registration_address: str = Field(..., min_length=10, max_length=500)

    @field_validator('passport_series', 'passport_number')
    @classmethod
    def validate_digits_only(cls, v: str) -> str:
        """Ensure only digits"""
        return ''.join(filter(str.isdigit, v))

    @field_validator('passport_issued_code')
    @classmethod
    def normalize_code(cls, v: str) -> str:
        """Normalize issued code to XXX-XXX format"""
        digits = ''.join(filter(str.isdigit, v))
        if len(digits) == 6:
            return f"{digits[:3]}-{digits[3:]}"
        return v


class ClientPassportResponse(BaseModel):
    """Response with masked client passport data"""
    has_passport_data: bool
    passport_series_masked: Optional[str] = None  # "XX XX"
    passport_number_masked: Optional[str] = None  # "XXX XXX"
    passport_issued_date: Optional[datetime] = None
    passport_issued_code: Optional[str] = None
    birth_date: Optional[datetime] = None
    # Note: Full decrypted data is NOT returned for security


class ClientPassportCheckResponse(BaseModel):
    """Check if passport data is complete"""
    deal_id: UUID
    has_passport_data: bool
    missing_fields: List[str]
