"""SQLAlchemy models"""

from app.db.base import Base, BaseModel
from app.models.user import User, UserRole
from app.models.organization import Organization, OrganizationMember, PayoutAccount
from app.models.deal import Deal, DealParty, DealTerms, BankDealStatus
from app.models.document import ContractTemplate, Document, Signature, AuditLog, SigningToken, ContractLayer
from app.models.payment import PaymentSchedule, PaymentIntent, Payment
from app.models.ledger import LedgerEntry, Split, Payout
from app.models.receipt import Receipt, NPDTask
from app.models.antifraud import AntiFraudCheck, UserLimit, Blacklist
from app.models.bank_split import (
    DealSplitRecipient,
    SplitRuleTemplate,
    BankEvent,
    SelfEmployedRegistry,
    EvidenceFile,
    DealMilestone,
    ReleaseTrigger,
    MilestoneStatus,
)
from app.models.consent import DealConsent, ConsentType, CONSENT_TEXTS, get_consent_text
from app.models.invitation import DealInvitation, InvitationStatus, InvitationRole
from app.models.dispute import Dispute, DisputeEvidence, DisputeStatus, DisputeReason, RefundStatus
from app.models.service_completion import ServiceCompletion
from app.models.split_adjustment import SplitAdjustment, AdjustmentStatus
from app.models.contract import SignedContract, ContractSignature, ContractStatus
from app.models.payment_profile import (
    PaymentProfile,
    LegalType as PaymentLegalType,
    OnboardingStatus,
    KYCStatus as PaymentKYCStatus,
    FiscalizationMethod,
)
from app.models.fiscalization import FiscalizationSettings, FiscalReceipt, FiscalReceiptType, FiscalReceiptStatus
from app.models.idempotency import IdempotencyKey
from app.models.webhook_dlq import WebhookDLQ

__all__ = [
    "Base",
    "BaseModel",
    "User",
    "UserRole",
    "Organization",
    "OrganizationMember",
    "PayoutAccount",
    "Deal",
    "DealParty",
    "DealTerms",
    "BankDealStatus",
    "ContractTemplate",
    "ContractLayer",
    "Document",
    "Signature",
    "SigningToken",
    "AuditLog",
    "PaymentSchedule",
    "PaymentIntent",
    "Payment",
    "LedgerEntry",
    "Split",
    "Payout",
    "Receipt",
    "NPDTask",
    "AntiFraudCheck",
    "UserLimit",
    "Blacklist",
    # Bank Split models
    "DealSplitRecipient",
    "SplitRuleTemplate",
    "BankEvent",
    "SelfEmployedRegistry",
    "EvidenceFile",
    "DealMilestone",
    "ReleaseTrigger",
    "MilestoneStatus",
    # Consent models
    "DealConsent",
    "ConsentType",
    "CONSENT_TEXTS",
    "get_consent_text",
    # Invitation models
    "DealInvitation",
    "InvitationStatus",
    "InvitationRole",
    # Dispute models
    "Dispute",
    "DisputeEvidence",
    "DisputeStatus",
    "DisputeReason",
    "RefundStatus",
    # Service completion
    "ServiceCompletion",
    # Split adjustment
    "SplitAdjustment",
    "AdjustmentStatus",
    # Contract models
    "SignedContract",
    "ContractSignature",
    "ContractStatus",
    # Payment Profile models
    "PaymentProfile",
    "PaymentLegalType",
    "OnboardingStatus",
    "PaymentKYCStatus",
    "FiscalizationMethod",
    # Fiscalization models
    "FiscalizationSettings",
    "FiscalReceipt",
    "FiscalReceiptType",
    "FiscalReceiptStatus",
    # Idempotency
    "IdempotencyKey",
    # Webhook DLQ
    "WebhookDLQ",
]
