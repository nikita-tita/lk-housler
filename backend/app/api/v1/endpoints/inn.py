"""INN/BIK lookup API endpoints.

Endpoints for looking up company info by INN and bank info by BIK
using DaData API.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.services.inn import INNService, CompanyStatus, LegalType


router = APIRouter()


# =============================================================================
# Response Schemas
# =============================================================================


class CompanyInfoResponse(BaseModel):
    """Company information response"""
    name: str = Field(..., description="Short company name")
    full_name: str = Field(..., description="Full official name")
    inn: str = Field(..., description="INN (10 or 12 digits)")
    kpp: Optional[str] = Field(None, description="KPP (for legal entities)")
    ogrn: Optional[str] = Field(None, description="OGRN/OGRNIP")
    address: Optional[str] = Field(None, description="Legal address")
    legal_type: Optional[str] = Field(None, description="INDIVIDUAL or LEGAL")
    status: Optional[str] = Field(None, description="Company status")
    is_active: Optional[bool] = Field(None, description="Is company active")
    management_name: Optional[str] = Field(None, description="Director/CEO name")
    management_post: Optional[str] = Field(None, description="Director position")


class BankInfoResponse(BaseModel):
    """Bank information response"""
    name: str = Field(..., description="Bank short name")
    full_name: Optional[str] = Field(None, description="Bank full name")
    bik: str = Field(..., description="BIK (9 digits)")
    corr_account: Optional[str] = Field(None, description="Correspondent account")
    address: Optional[str] = Field(None, description="Bank address")
    swift: Optional[str] = Field(None, description="SWIFT code")
    inn: Optional[str] = Field(None, description="Bank INN")
    kpp: Optional[str] = Field(None, description="Bank KPP")


class INNLookupResponse(BaseModel):
    """INN lookup response"""
    success: bool
    company: Optional[CompanyInfoResponse] = None
    error: Optional[str] = None


class BIKLookupResponse(BaseModel):
    """BIK lookup response"""
    success: bool
    bank: Optional[BankInfoResponse] = None
    error: Optional[str] = None


class INNValidateRequest(BaseModel):
    """INN validation request"""
    inn: str = Field(..., description="INN to validate", min_length=10, max_length=12)


class INNValidateResponse(BaseModel):
    """INN validation response"""
    valid: bool
    inn_type: Optional[str] = Field(None, description="'individual' or 'legal_entity'")
    error: Optional[str] = None


class AutofillProfileResponse(BaseModel):
    """Autofill data for PaymentProfile"""
    company_name: Optional[str] = None
    company_full_name: Optional[str] = None
    company_inn: str
    company_kpp: Optional[str] = None
    company_ogrn: Optional[str] = None
    company_address: Optional[str] = None
    is_individual: Optional[bool] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    management_name: Optional[str] = None
    management_post: Optional[str] = None
    error: Optional[str] = None


class AutofillBankResponse(BaseModel):
    """Autofill data for bank details"""
    bank_name: Optional[str] = None
    bank_full_name: Optional[str] = None
    bank_bik: str
    bank_corr_account: Optional[str] = None
    bank_address: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_inn: Optional[str] = None
    bank_kpp: Optional[str] = None
    error: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================


@router.get(
    "/lookup",
    response_model=INNLookupResponse,
    summary="Lookup company by INN",
    description="Find company information by INN using DaData API",
)
async def lookup_inn(
    inn: str = Query(..., description="INN (10 or 12 digits)", min_length=10, max_length=12),
):
    """Lookup company by INN.

    Returns company info including name, address, KPP, OGRN, status.
    """
    service = INNService()
    result = await service.lookup_company(inn)

    if not result.success or not result.company:
        return INNLookupResponse(
            success=False,
            error=result.error_message or "Company not found"
        )

    company = result.company
    return INNLookupResponse(
        success=True,
        company=CompanyInfoResponse(
            name=company.name,
            full_name=company.full_name,
            inn=company.inn,
            kpp=company.kpp,
            ogrn=company.ogrn,
            address=company.address,
            legal_type=company.legal_type.value if company.legal_type else None,
            status=company.status.value if company.status else None,
            is_active=company.status == CompanyStatus.ACTIVE if company.status else None,
            management_name=company.management_name,
            management_post=company.management_post,
        )
    )


@router.get(
    "/autofill",
    response_model=AutofillProfileResponse,
    summary="Get autofill data for PaymentProfile",
    description="Get pre-filled data for PaymentProfile by INN",
)
async def autofill_profile(
    inn: str = Query(..., description="INN (10 or 12 digits)", min_length=10, max_length=12),
):
    """Get autofill data for PaymentProfile.

    Returns data ready for PaymentProfile form autofill.
    """
    service = INNService()
    data = await service.autofill_profile(inn)
    return AutofillProfileResponse(**data)


@router.post(
    "/validate",
    response_model=INNValidateResponse,
    summary="Validate INN checksum",
    description="Validate INN format and checksum (local validation, no API call)",
)
async def validate_inn(request: INNValidateRequest):
    """Validate INN checksum.

    Performs local checksum validation without calling external API.
    Returns INN type (individual/legal_entity) if valid.
    """
    service = INNService()
    result = await service.validate_inn(request.inn)

    return INNValidateResponse(
        valid=result.valid,
        inn_type=result.inn_type,
        error=result.error_message
    )


@router.get(
    "/bik/lookup",
    response_model=BIKLookupResponse,
    summary="Lookup bank by BIK",
    description="Find bank information by BIK using DaData API",
)
async def lookup_bik(
    bik: str = Query(..., description="BIK (9 digits)", min_length=9, max_length=9),
):
    """Lookup bank by BIK.

    Returns bank info including name, correspondent account, SWIFT.
    """
    service = INNService()
    result = await service.lookup_bank(bik)

    if not result.success or not result.bank:
        return BIKLookupResponse(
            success=False,
            error=result.error_message or "Bank not found"
        )

    bank = result.bank
    return BIKLookupResponse(
        success=True,
        bank=BankInfoResponse(
            name=bank.name,
            full_name=bank.full_name,
            bik=bank.bik,
            corr_account=bank.corr_account,
            address=bank.address,
            swift=bank.swift,
            inn=bank.inn,
            kpp=bank.kpp,
        )
    )


@router.get(
    "/bik/autofill",
    response_model=AutofillBankResponse,
    summary="Get autofill data for bank details",
    description="Get pre-filled bank data by BIK",
)
async def autofill_bank(
    bik: str = Query(..., description="BIK (9 digits)", min_length=9, max_length=9),
):
    """Get autofill data for bank details.

    Returns data ready for bank details form autofill.
    """
    service = INNService()
    data = await service.autofill_bank(bik)
    return AutofillBankResponse(**data)
