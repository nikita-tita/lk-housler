"""User schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserStatus, TaxStatus, VerificationLevel


class UserBase(BaseModel):
    """Base user schema"""
    phone: str = Field(..., description="Phone number")
    email: Optional[EmailStr] = Field(None, description="Email address")


class UserCreate(UserBase):
    """User creation schema"""
    pass


class UserUpdate(BaseModel):
    """User update schema"""
    email: Optional[EmailStr] = None
    status: Optional[UserStatus] = None


class UserProfileBase(BaseModel):
    """Base user profile schema"""
    full_name: str = Field(..., description="Full name")
    inn: Optional[str] = Field(None, description="INN")
    tax_status: Optional[TaxStatus] = Field(None, description="Tax status")
    address: Optional[str] = Field(None, description="Address")


class UserProfileCreate(UserProfileBase):
    """User profile creation schema"""
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    passport_issued_by: Optional[str] = None
    passport_issued_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    """User profile update schema"""
    full_name: Optional[str] = None
    inn: Optional[str] = None
    tax_status: Optional[TaxStatus] = None
    address: Optional[str] = None
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    passport_issued_by: Optional[str] = None
    passport_issued_at: Optional[datetime] = None


class UserProfile(UserProfileBase):
    """User profile response schema"""
    id: UUID
    user_id: UUID
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    verified_level: VerificationLevel
    kyc_checked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class User(UserBase):
    """User response schema"""
    id: UUID
    status: UserStatus
    profile: Optional[UserProfile] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

