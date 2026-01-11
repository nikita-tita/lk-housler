"""Deal schemas"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.deal import DealType, DealStatus, ExecutorType, PartyRole


# ============================================
# Address schemas
# ============================================

class AddressCreate(BaseModel):
    """Structured address for deal"""
    city: str = Field(..., min_length=1, max_length=100)
    street: str = Field(..., min_length=1, max_length=255)
    house: str = Field(..., min_length=1, max_length=20)
    building: Optional[str] = Field(None, max_length=20)
    apartment: Optional[str] = Field(None, max_length=20)

    def to_full_address(self) -> str:
        """Format as full address string"""
        parts = [f"г. {self.city}", self.street, f"д. {self.house}"]
        if self.building:
            parts.append(f"корп. {self.building}")
        if self.apartment:
            parts.append(f"кв. {self.apartment}")
        return ", ".join(parts)


# ============================================
# Simplified deal creation (MVP)
# ============================================

class DealCreateSimple(BaseModel):
    """Simplified deal creation for MVP"""
    type: DealType

    # Address
    address: AddressCreate

    # Financials
    price: int = Field(..., gt=0, description="Property price in rubles")
    commission: int = Field(..., gt=0, description="Agent commission in rubles")

    # Client
    client_name: str = Field(..., min_length=2, max_length=255)
    client_phone: str = Field(..., min_length=10, max_length=20)

    @field_validator('client_phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Remove all non-digits
        digits = ''.join(filter(str.isdigit, v))
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError('Phone must have 10-11 digits')
        # Normalize to 7XXXXXXXXXX format
        if len(digits) == 11 and digits.startswith('8'):
            digits = '7' + digits[1:]
        elif len(digits) == 10:
            digits = '7' + digits
        return digits


class DealSimpleResponse(BaseModel):
    """Simplified deal response for frontend"""
    id: UUID
    type: DealType
    status: DealStatus
    address: str
    price: int
    commission_agent: int
    client_name: Optional[str] = None
    agent_user_id: int  # Integer - compatible with agent.housler.ru users table
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DealListSimple(BaseModel):
    """Simplified deal list response"""
    items: List[DealSimpleResponse]
    total: int
    page: int
    size: int


# ============================================
# Full deal schemas (for complex operations)
# ============================================

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
    party_id: Optional[int] = None  # For registered users (Integer ID)


class DealParty(DealPartyBase):
    """Deal party response schema"""
    id: UUID
    deal_id: UUID
    party_type: str
    party_id: Optional[int] = None

    class Config:
        from_attributes = True


class DealBase(BaseModel):
    """Base deal schema"""
    type: DealType
    property_address: Optional[str] = None


class DealCreate(DealBase):
    """Deal creation schema"""
    executor_type: ExecutorType
    executor_id: int  # Integer - compatible with agent.housler.ru
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
    created_by_user_id: int  # Integer - compatible with agent.housler.ru users table
    agent_user_id: int
    executor_type: ExecutorType
    executor_id: int
    client_id: Optional[int] = None
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
