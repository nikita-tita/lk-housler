"""Bank Split services package"""

from app.services.bank_split.deal_service import BankSplitDealService
from app.services.bank_split.split_service import SplitService
from app.services.bank_split.invoice_service import InvoiceService
from app.services.bank_split.completion_service import ServiceCompletionService
from app.services.bank_split.webhook_service import WebhookService, verify_webhook_signature
from app.services.bank_split.onboarding_client import TBankOnboardingClient, TBankOnboardingError
from app.services.bank_split.onboarding_service import OnboardingService
from app.services.bank_split.milestone_service import (
    MilestoneService,
    MilestoneConfig,
    MilestoneReleaseResult,
    get_milestone_config,
    DEFAULT_MILESTONE_CONFIGS,
)

__all__ = [
    "BankSplitDealService",
    "SplitService",
    "InvoiceService",
    "ServiceCompletionService",
    "WebhookService",
    "verify_webhook_signature",
    "TBankOnboardingClient",
    "TBankOnboardingError",
    "OnboardingService",
    # TASK-2.4: Milestone service
    "MilestoneService",
    "MilestoneConfig",
    "MilestoneReleaseResult",
    "get_milestone_config",
    "DEFAULT_MILESTONE_CONFIGS",
]
