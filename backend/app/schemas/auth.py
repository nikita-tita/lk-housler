"""Auth schemas"""

from typing import Dict
from pydantic import BaseModel, EmailStr, Field


# === SMS/Phone Auth (Agents) ===

class SMSOTPRequest(BaseModel):
    """SMS OTP request schema (for agents)"""
    phone: str = Field(..., description="Phone number", pattern=r"^\+7\d{10}$")


class SMSOTPVerify(BaseModel):
    """SMS OTP verification schema"""
    phone: str = Field(..., description="Phone number")
    code: str = Field(..., description="OTP code", min_length=6, max_length=6)


# === Email Auth (Clients) ===

class EmailOTPRequest(BaseModel):
    """Email OTP request schema (for clients)"""
    email: EmailStr = Field(..., description="Email address")


class EmailOTPVerify(BaseModel):
    """Email OTP verification schema"""
    email: EmailStr = Field(..., description="Email address")
    code: str = Field(..., description="OTP code", min_length=6, max_length=6)


# === Agency Auth (Email + Password) ===

class AgencyLoginRequest(BaseModel):
    """Agency login request schema"""
    email: EmailStr = Field(..., description="Agency email")
    password: str = Field(..., description="Password", min_length=8)


# === Registration ===

class ConsentInput(BaseModel):
    """Consent input"""
    personal_data: bool
    terms: bool
    marketing: bool = False
    realtor_offer: bool = False
    agency_offer: bool = False


class AgentRegisterRequest(BaseModel):
    """Agent registration request"""
    phone: str = Field(..., pattern=r"^\+7\d{10}$")
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    city: str = Field(None, max_length=100)
    is_self_employed: bool = False
    personal_inn: str = Field(None, min_length=12, max_length=12)
    consents: ConsentInput


class AgencyRegisterRequest(BaseModel):
    """Agency registration request"""
    inn: str = Field(..., min_length=10, max_length=12)
    name: str = Field(..., max_length=500)
    legal_address: str
    contact_name: str
    contact_phone: str = Field(..., pattern=r"^\+7\d{10}$")
    contact_email: EmailStr
    password: str = Field(..., min_length=8)
    consents: ConsentInput


# === Responses ===

class Token(BaseModel):
    """Token response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Token refresh request"""
    refresh_token: str


# === Legacy (backward compatibility) ===

class OTPRequest(BaseModel):
    """OTP request schema (deprecated, use SMSOTPRequest)"""
    phone: str = Field(..., description="Phone number", pattern=r"^\+7\d{10}$")
    purpose: str = Field(..., description="OTP purpose (login, signup, signature)")


class OTPVerify(BaseModel):
    """OTP verification schema (deprecated, use SMSOTPVerify)"""
    phone: str = Field(..., description="Phone number")
    code: str = Field(..., description="OTP code", min_length=6, max_length=6)
    purpose: str = Field(..., description="OTP purpose")

