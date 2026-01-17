"""SQLAlchemy models"""

from app.db.base import Base, BaseModel
from app.models.user import User, UserRole
from app.models.organization import Organization, OrganizationMember, PayoutAccount
from app.models.deal import Deal, DealParty, DealTerms
from app.models.document import ContractTemplate, Document, Signature, AuditLog, SigningToken
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
)
from app.models.consent import DealConsent, ConsentType
from app.models.invitation import DealInvitation, InvitationStatus, InvitationRole
from app.models.dispute import Dispute, DisputeEvidence, DisputeStatus, DisputeReason, RefundStatus
from app.models.service_completion import ServiceCompletion
from app.models.split_adjustment import SplitAdjustment, AdjustmentStatus
from app.models.contract import SignedContract, ContractSignature, ContractStatus

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
    "ContractTemplate",
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
    # Consent models
    "DealConsent",
    "ConsentType",
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
]
