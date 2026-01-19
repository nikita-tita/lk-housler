"""User schemas - matches agent.housler.ru database schema"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user schema"""

    email: EmailStr = Field(..., description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    name: Optional[str] = Field(None, description="Display name")


class AgencyInfo(BaseModel):
    """Basic agency info for user response"""
    id: str
    legal_name: str
    short_name: Optional[str] = None


class UserResponse(BaseModel):
    """User response schema - matches agent.housler.ru users table"""

    id: int
    email: str
    phone: Optional[str] = None
    name: Optional[str] = None
    role: str
    is_active: bool = True
    agency_id: Optional[int] = None
    agency: Optional[AgencyInfo] = None  # Populated if agency_id exists
    city: Optional[str] = None
    is_self_employed: Optional[bool] = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user info (safe to expose)"""

    id: int
    name: Optional[str] = None
    role: str
    city: Optional[str] = None

    class Config:
        from_attributes = True


# Aliases for backward compatibility
User = UserResponse
