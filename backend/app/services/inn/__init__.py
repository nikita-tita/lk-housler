"""INN validation and lookup services"""

from app.services.inn.validation import (
    INNValidationService,
    INNValidationResult,
    INNValidationLevel,
    validate_inn_full,
)
from app.services.inn.dadata_client import (
    DaDataClient,
    CompanyInfo,
    BankInfo,
    DaDataResponse,
    LegalType,
    CompanyStatus,
)
from app.services.inn.service import (
    INNService,
    INNLookupResult,
    BIKLookupResult,
)

__all__ = [
    # Validation (existing)
    "INNValidationService",
    "INNValidationResult",
    "INNValidationLevel",
    "validate_inn_full",
    # DaData client (new)
    "DaDataClient",
    "CompanyInfo",
    "BankInfo",
    "DaDataResponse",
    "LegalType",
    "CompanyStatus",
    # INN service (new)
    "INNService",
    "INNLookupResult",
    "BIKLookupResult",
]
