"""Signature schemas for public signing"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SigningInfoResponse(BaseModel):
    """Response with signing info (public, no auth required)"""

    # Document info
    document_id: UUID
    document_hash: str
    document_url: Optional[str] = None

    # Deal info
    deal_type: str
    property_address: str
    commission_total: Optional[str] = None

    # Party info
    party_role: str
    party_name: str
    phone_masked: str  # +7 (999) ***-**-67

    # Signing status
    already_signed: bool
    expires_at: datetime

    # Executor info
    executor_name: str
    executor_inn: Optional[str] = None


class RequestOTPRequest(BaseModel):
    """Request OTP for signing"""

    consent_personal_data: bool = Field(..., description="Consent to personal data processing")
    consent_pep: bool = Field(..., description="Consent to use PEP (simple electronic signature)")


class RequestOTPResponse(BaseModel):
    """Response after OTP sent"""

    message: str
    phone_masked: str
    expires_in_seconds: int = 300


class VerifySignatureRequest(BaseModel):
    """Verify OTP and sign document"""

    code: str = Field(..., min_length=6, max_length=6)


class VerifySignatureResponse(BaseModel):
    """Response after successful signing"""

    success: bool
    message: str
    signed_at: datetime
    document_url: Optional[str] = None


class SigningTokenCreate(BaseModel):
    """Create signing token (internal use)"""

    document_id: UUID
    party_id: UUID
    phone: str


class SigningTokenResponse(BaseModel):
    """Signing token response"""

    token: str
    signing_url: str
    expires_at: datetime
