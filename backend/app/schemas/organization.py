"""Organization schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.organization import OrganizationType, OrganizationStatus, KYCStatus, MemberRole, PayoutMethod, EmployeeInviteStatus


class OrganizationBase(BaseModel):
    """Base organization schema"""

    type: OrganizationType
    legal_name: str = Field(..., description="Legal name")
    inn: str = Field(..., description="INN", min_length=10, max_length=12)
    kpp: Optional[str] = Field(None, description="KPP")
    ogrn: Optional[str] = Field(None, description="OGRN")
    legal_address: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    """Organization creation schema"""

    default_split_percent_agent: int = Field(60, description="Default agent split %", ge=0, le=100)


class OrganizationUpdate(BaseModel):
    """Organization update schema"""

    legal_name: Optional[str] = None
    legal_address: Optional[str] = None
    default_split_percent_agent: Optional[int] = Field(None, ge=0, le=100)


class Organization(OrganizationBase):
    """Organization response schema"""

    id: UUID
    status: OrganizationStatus
    kyc_status: KYCStatus
    default_split_percent_agent: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberBase(BaseModel):
    """Base organization member schema"""

    user_id: UUID
    role: MemberRole


class OrganizationMemberCreate(OrganizationMemberBase):
    """Organization member creation schema"""

    default_split_percent_agent: Optional[int] = Field(None, ge=0, le=100)


class OrganizationMember(OrganizationMemberBase):
    """Organization member response schema"""

    id: UUID
    org_id: UUID
    default_split_percent_agent: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PayoutAccountBase(BaseModel):
    """Base payout account schema"""

    method: PayoutMethod
    details: dict = Field(..., description="Payout details (JSON)")


class PayoutAccountCreate(PayoutAccountBase):
    """Payout account creation schema"""

    is_default: bool = False


class PayoutAccount(PayoutAccountBase):
    """Payout account response schema"""

    id: UUID
    owner_type: str
    owner_id: UUID
    is_default: bool
    verified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Employee Invitation Schemas

class EmployeeInvitationCreate(BaseModel):
    """Create employee invitation schema"""

    phone: str = Field(..., description="Phone number (will be normalized)")
    name: Optional[str] = Field(None, description="Employee name (optional)")
    position: Optional[str] = Field(None, description="Position (optional)")


class EmployeeInvitation(BaseModel):
    """Employee invitation response schema"""

    id: UUID
    phone: str
    name: Optional[str] = None
    position: Optional[str] = None
    status: EmployeeInviteStatus
    invite_token: str = Field(..., alias="inviteToken")
    expires_at: datetime = Field(..., alias="expiresAt")
    created_at: datetime = Field(..., alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class EmployeeInvitationsListResponse(BaseModel):
    """Employee invitations list response"""

    items: list[EmployeeInvitation]
    total: int


class EmployeeInvitePublicInfo(BaseModel):
    """Public info about employee invite (for registration page)"""

    token: str
    agency_name: str = Field(..., alias="agencyName")
    agency_id: UUID = Field(..., alias="agencyId")
    phone: str
    position: Optional[str] = None
    expires_at: datetime = Field(..., alias="expiresAt")
    is_expired: bool = Field(..., alias="isExpired")

    class Config:
        populate_by_name = True


class EmployeeRegisterRequest(BaseModel):
    """Request to complete employee registration"""

    token: str
    name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., description="Email address")
    consents: dict = Field(..., description="Consent flags")
