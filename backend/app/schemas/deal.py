"""Deal schemas"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.deal import DealType, DealStatus, ExecutorType, PartyRole


class DealTermsBase(BaseModel):
    """Base deal terms schema"""
    commission_total: Decimal = Field(..., description="Total commission", gt=0)
    payment_plan: List[Dict[str, Any]] = Field(..., description="Payment plan")
    split_rule: Dict[str, int] = Field(..., description="Split rule")
    milestone_rules: Optional[List[Dict[str, Any]]] = None
    cancellation_policy: Optional[Dict[str, Any]] = None


class DealPartyBase(BaseModel):
    """Base deal party schema"""
    party_role: PartyRole
    display_name_snapshot: str
    phone_snapshot: Optional[str] = None
    signing_required: bool = True
    signing_order: int = 0


class DealPartyCreate(DealPartyBase):
    """Deal party creation schema"""
    party_id: Optional[UUID] = None  # For registered users


class DealParty(DealPartyBase):
    """Deal party response schema"""
    id: UUID
    deal_id: UUID
    party_type: str
    party_id: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class DealBase(BaseModel):
    """Base deal schema"""
    type: DealType
    property_address: Optional[str] = None


class DealCreate(DealBase):
    """Deal creation schema"""
    executor_type: ExecutorType
    executor_id: UUID
    client_phone: str
    client_name: str
    terms: DealTermsBase
    parties: Optional[List[DealPartyCreate]] = None


class DealUpdate(BaseModel):
    """Deal update schema"""
    property_address: Optional[str] = None
    status: Optional[DealStatus] = None


class Deal(DealBase):
    """Deal response schema"""
    id: UUID
    created_by_user_id: UUID
    agent_user_id: UUID
    executor_type: ExecutorType
    executor_id: UUID
    client_id: Optional[UUID] = None
    status: DealStatus
    created_at: datetime
    updated_at: datetime
    
    # Relationships (optional, can be loaded separately)
    parties: Optional[List[DealParty]] = None
    terms: Optional[DealTermsBase] = None
    
    class Config:
        from_attributes = True


class DealList(BaseModel):
    """Deal list response"""
    deals: List[Deal]
    total: int
    page: int
    page_size: int

