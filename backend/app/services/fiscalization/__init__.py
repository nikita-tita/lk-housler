"""Fiscalization service for receipt generation and tax compliance.

TASK-3.1: Fiscalization Infrastructure
TASK-3.2: T-Bank Checks Integration
TASK-3.3: NPD Receipt Tracking
"""

from app.services.fiscalization.service import FiscalizationService
from app.services.fiscalization.fiscal_receipt_service import FiscalReceiptService
from app.services.fiscalization.npd_service import NPDReceiptService
from app.services.fiscalization.tbank_checks import (
    TBankChecksClient,
    TBankChecksError,
    get_tbank_checks_client,
    ReceiptType,
    ReceiptItem,
    ReceiptClient,
    CreateReceiptRequest,
    ReceiptResponse,
    TBankChecksReceiptStatus,
    TaxSystem,
    VatType,
    PaymentMethod,
    PaymentObject,
)

__all__ = [
    "FiscalizationService",
    "FiscalReceiptService",
    "NPDReceiptService",
    # T-Bank Checks
    "TBankChecksClient",
    "TBankChecksError",
    "get_tbank_checks_client",
    "ReceiptType",
    "ReceiptItem",
    "ReceiptClient",
    "CreateReceiptRequest",
    "ReceiptResponse",
    "TBankChecksReceiptStatus",
    "TaxSystem",
    "VatType",
    "PaymentMethod",
    "PaymentObject",
]
