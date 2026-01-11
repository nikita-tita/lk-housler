"""Organization schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.organization import OrganizationType, OrganizationStatus, KYCStatus, MemberRole, PayoutMethod


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
