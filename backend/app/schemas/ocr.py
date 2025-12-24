"""OCR schemas for passport recognition"""

from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class PassportFieldConfidence(BaseModel):
    """Confidence level for extracted field"""
    value: str
    confidence: float = Field(ge=0.0, le=1.0)


class PassportData(BaseModel):
    """Extracted passport data"""
    # Main fields
    surname: Optional[str] = Field(None, description="Surname (Фамилия)")
    name: Optional[str] = Field(None, description="First name (Имя)")
    patronymic: Optional[str] = Field(None, description="Patronymic (Отчество)")

    # Combined full name for convenience
    full_name: Optional[str] = Field(None, description="Full name combined")

    # Passport identifiers
    series: Optional[str] = Field(None, description="Passport series (4 digits)")
    number: Optional[str] = Field(None, description="Passport number (6 digits)")

    # Issue info
    issued_by: Optional[str] = Field(None, description="Issued by (Кем выдан)")
    issued_at: Optional[date] = Field(None, description="Issue date")
    department_code: Optional[str] = Field(None, description="Department code (Код подразделения)")

    # Personal info
    birth_date: Optional[date] = Field(None, description="Birth date")
    birth_place: Optional[str] = Field(None, description="Birth place")
    gender: Optional[str] = Field(None, description="Gender (М/Ж)")


class PassportOCRResponse(BaseModel):
    """Response from passport OCR endpoint"""
    success: bool
    confidence: float = Field(ge=0.0, le=1.0, description="Overall confidence")
    data: PassportData
    warnings: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = Field(None, description="Raw OCR text for debugging")


class PassportOCRError(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    details: Optional[str] = None
