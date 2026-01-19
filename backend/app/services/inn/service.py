"""INN lookup service for autofilling payment profiles.

This service provides:
1. Company lookup by INN (via DaData)
2. Bank lookup by BIK (via DaData)
3. INN checksum validation
4. PaymentProfile autofill data
"""

import logging
from dataclasses import dataclass
from typing import Optional

from app.services.inn.dadata_client import (
    DaDataClient,
    CompanyInfo,
    BankInfo,
    DaDataResponse,
    LegalType,
    CompanyStatus,
)
from app.utils.inn_validator import (
    validate_inn_checksum,
    get_inn_type,
)


logger = logging.getLogger(__name__)


@dataclass
class INNLookupResult:
    """Result of INN lookup"""
    success: bool
    company: Optional[CompanyInfo] = None
    error_message: Optional[str] = None


@dataclass
class BIKLookupResult:
    """Result of BIK lookup"""
    success: bool
    bank: Optional[BankInfo] = None
    error_message: Optional[str] = None


@dataclass
class INNValidationResult:
    """Result of INN checksum validation"""
    valid: bool
    inn_type: Optional[str] = None  # 'individual' or 'legal_entity'
    error_message: Optional[str] = None


class INNService:
    """Service for INN/BIK lookup and validation.

    Usage:
        service = INNService()

        # Lookup company
        result = await service.lookup_company("7707083893")
        if result.success:
            print(result.company.name)

        # Lookup bank
        result = await service.lookup_bank("044525225")
        if result.success:
            print(result.bank.name)

        # Validate INN
        result = await service.validate_inn("7707083893")
        if result.valid:
            print(f"INN type: {result.inn_type}")

        # Get autofill data for PaymentProfile
        data = await service.autofill_profile("7707083893")
    """

    def __init__(self, dadata_client: Optional[DaDataClient] = None):
        """Initialize INN service.

        Args:
            dadata_client: DaData client (creates default if not provided)
        """
        self.dadata = dadata_client or DaDataClient()

    async def lookup_company(self, inn: str) -> INNLookupResult:
        """Lookup company by INN.

        Args:
            inn: 10-digit (legal) or 12-digit (individual) INN

        Returns:
            INNLookupResult with company info if found
        """
        inn = inn.strip()

        # Validate INN format first
        is_valid, error = validate_inn_checksum(inn)
        if not is_valid:
            return INNLookupResult(
                success=False,
                error_message=error or "Invalid INN format"
            )

        # Lookup via DaData
        result = await self.dadata.find_by_inn(inn)

        if result.success and isinstance(result.data, CompanyInfo):
            return INNLookupResult(
                success=True,
                company=result.data
            )

        return INNLookupResult(
            success=False,
            error_message=result.error_message or "Company not found"
        )

    async def lookup_bank(self, bik: str) -> BIKLookupResult:
        """Lookup bank by BIK.

        Args:
            bik: 9-digit BIK code

        Returns:
            BIKLookupResult with bank info if found
        """
        bik = bik.strip()

        # Validate BIK format
        if not bik.isdigit() or len(bik) != 9:
            return BIKLookupResult(
                success=False,
                error_message="BIK must be 9 digits"
            )

        # Lookup via DaData
        result = await self.dadata.find_bank_by_bik(bik)

        if result.success and isinstance(result.data, BankInfo):
            return BIKLookupResult(
                success=True,
                bank=result.data
            )

        return BIKLookupResult(
            success=False,
            error_message=result.error_message or "Bank not found"
        )

    async def validate_inn(self, inn: str) -> INNValidationResult:
        """Validate INN checksum.

        Args:
            inn: INN string to validate

        Returns:
            INNValidationResult with validation status
        """
        inn = inn.strip()

        is_valid, error = validate_inn_checksum(inn)

        if is_valid:
            inn_type = get_inn_type(inn)
            return INNValidationResult(
                valid=True,
                inn_type=inn_type
            )

        return INNValidationResult(
            valid=False,
            error_message=error
        )

    async def autofill_profile(self, inn: str) -> dict:
        """Get autofill data for PaymentProfile.

        Args:
            inn: Company/individual INN

        Returns:
            Dictionary with PaymentProfile fields:
            - company_name: str
            - company_inn: str
            - company_kpp: str (optional)
            - company_ogrn: str
            - company_address: str
            - is_individual: bool
        """
        result = await self.lookup_company(inn)

        if not result.success or not result.company:
            return {
                "error": result.error_message or "Company not found",
                "company_inn": inn,
            }

        company = result.company

        return {
            "company_name": company.name,
            "company_full_name": company.full_name,
            "company_inn": company.inn,
            "company_kpp": company.kpp or "",
            "company_ogrn": company.ogrn or "",
            "company_address": company.address or "",
            "is_individual": company.legal_type == LegalType.INDIVIDUAL,
            "status": company.status.value if company.status else None,
            "is_active": company.status == CompanyStatus.ACTIVE if company.status else None,
            "management_name": company.management_name,
            "management_post": company.management_post,
        }

    async def autofill_bank(self, bik: str) -> dict:
        """Get autofill data for bank details.

        Args:
            bik: Bank BIK code

        Returns:
            Dictionary with bank fields:
            - bank_name: str
            - bank_bik: str
            - bank_corr_account: str
            - bank_address: str
        """
        result = await self.lookup_bank(bik)

        if not result.success or not result.bank:
            return {
                "error": result.error_message or "Bank not found",
                "bank_bik": bik,
            }

        bank = result.bank

        return {
            "bank_name": bank.name,
            "bank_full_name": bank.full_name or bank.name,
            "bank_bik": bank.bik,
            "bank_corr_account": bank.corr_account or "",
            "bank_address": bank.address or "",
            "bank_swift": bank.swift,
            "bank_inn": bank.inn,
            "bank_kpp": bank.kpp,
        }
