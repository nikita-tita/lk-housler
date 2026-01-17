"""Invitation schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class InvitationCreate(BaseModel):
    """Create invitation request"""
    invited_phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$", description="Phone number of invitee")
    invited_email: Optional[str] = Field(None, description="Email of invitee (optional)")
    role: str = Field(..., description="Role: coagent or agency")
    split_percent: Decimal = Field(..., ge=0, le=100, description="Split percentage (0-100)")

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate role"""
        valid_roles = ['coagent', 'agency']
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {valid_roles}")
        return v


class InvitationResponse(BaseModel):
    """Invitation response"""
    id: UUID
    deal_id: UUID
    invited_by_user_id: int
    invited_phone: str
    invited_email: Optional[str] = None
    invited_user_id: Optional[int] = None
    role: str
    split_percent: Decimal
    status: str
    expires_at: datetime
    responded_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InvitationPublicInfo(BaseModel):
    """Public invitation info (for accept/decline page)"""
    id: UUID
    deal_id: UUID
    property_address: str
    inviter_name: str
    role: str
    split_percent: Decimal
    status: str
    expires_at: datetime
    is_expired: bool


class InvitationAccept(BaseModel):
    """Accept invitation request"""
    # No fields needed - user accepts with their current auth


class InvitationDecline(BaseModel):
    """Decline invitation request"""
    reason: Optional[str] = Field(None, max_length=500, description="Reason for declining")


class InvitationResend(BaseModel):
    """Resend invitation request"""
    method: str = Field(default="sms", description="Delivery method: sms or email")


class InvitationActionResponse(BaseModel):
    """Response for invitation actions (accept/decline/resend)"""
    invitation_id: UUID
    status: str
    message: str
