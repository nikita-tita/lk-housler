"""T-Bank Deals client for Nominal Accounts API"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from app.integrations.tbank.base import TBankClient, TBankClientMixin, TBankError

logger = logging.getLogger(__name__)


class DealStatus(str, Enum):
    """T-Bank deal status"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAID = "PAID"
    HOLD = "HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class RecipientStatus(str, Enum):
    """T-Bank recipient status"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"


@dataclass
class TBankRecipient:
    """T-Bank split recipient"""
    external_id: str
    inn: str
    name: str
    bank_account: Optional[str]
    phone: Optional[str]
    status: RecipientStatus
    created_at: datetime


@dataclass
class TBankDealSplit:
    """Split rule for a deal"""
    recipient_id: str
    amount: int  # in kopecks
    description: Optional[str] = None


@dataclass
class TBankDeal:
    """T-Bank deal (nominal account)"""
    deal_id: str
    account_number: str
    amount: int  # in kopecks
    status: DealStatus
    payment_url: Optional[str]
    qr_code: Optional[str]
    expires_at: Optional[datetime]
    paid_at: Optional[datetime]
    splits: List[TBankDealSplit]
    created_at: datetime


class TBankDealsClient(TBankClient, TBankClientMixin):
    """
    Client for T-Bank Nominal Accounts (Deals) API.

    This client handles:
    - Creating deals (nominal accounts)
    - Managing recipients (beneficiaries)
    - Setting up splits
    - Payment link generation
    - Deal status management
    """

    async def health_check(self) -> bool:
        """Check API availability"""
        try:
            # Simple ping request
            await self._request("GET", "/ping", sign=False)
            return True
        except Exception as e:
            logger.error(f"T-Bank health check failed: {e}")
            return False

    # ========================================
    # Recipients Management
    # ========================================

    async def create_recipient(
        self,
        inn: str,
        name: str,
        bank_account: str = None,
        phone: str = None,
    ) -> TBankRecipient:
        """
        Register a new recipient (beneficiary) for splits.

        Args:
            inn: Tax ID (INN)
            name: Full name or company name
            bank_account: Bank account number (optional for SE)
            phone: Phone number for SBP (optional)

        Returns:
            TBankRecipient with external_id
        """
        data = {
            "Inn": inn,
            "Name": name,
        }
        if bank_account:
            data["BankAccount"] = bank_account
        if phone:
            data["Phone"] = phone

        response = await self._request("POST", "/recipients/create", data=data)

        return TBankRecipient(
            external_id=response["RecipientId"],
            inn=inn,
            name=name,
            bank_account=bank_account,
            phone=phone,
            status=RecipientStatus(response.get("Status", "DRAFT")),
            created_at=self._parse_datetime(response.get("CreatedAt")) or datetime.utcnow(),
        )

    async def get_recipient(self, recipient_id: str) -> TBankRecipient:
        """Get recipient by ID"""
        response = await self._request("GET", f"/recipients/{recipient_id}")

        return TBankRecipient(
            external_id=response["RecipientId"],
            inn=response["Inn"],
            name=response["Name"],
            bank_account=response.get("BankAccount"),
            phone=response.get("Phone"),
            status=RecipientStatus(response.get("Status", "DRAFT")),
            created_at=self._parse_datetime(response.get("CreatedAt")) or datetime.utcnow(),
        )

    # ========================================
    # Deals Management
    # ========================================

    async def create_deal(
        self,
        order_id: str,
        amount: int,
        description: str,
        splits: List[TBankDealSplit],
        customer_email: str = None,
        customer_phone: str = None,
        return_url: str = None,
        expire_minutes: int = 60,
    ) -> TBankDeal:
        """
        Create a new deal with nominal account.

        Args:
            order_id: Internal order/deal ID
            amount: Total amount in kopecks
            description: Payment description
            splits: List of split rules
            customer_email: Customer email for receipt
            customer_phone: Customer phone
            return_url: URL to redirect after payment
            expire_minutes: Payment link expiration in minutes

        Returns:
            TBankDeal with payment URL
        """
        # Validate splits total matches amount
        splits_total = sum(s.amount for s in splits)
        if splits_total != amount:
            raise TBankError(
                f"Splits total ({splits_total}) doesn't match amount ({amount})",
                code="INVALID_SPLITS",
            )

        data = {
            "OrderId": order_id,
            "Amount": amount,
            "Description": description,
            "Splits": [
                {
                    "RecipientId": s.recipient_id,
                    "Amount": s.amount,
                    "Description": s.description,
                }
                for s in splits
            ],
        }

        if customer_email:
            data["CustomerEmail"] = customer_email
        if customer_phone:
            data["CustomerPhone"] = customer_phone
        if return_url:
            data["ReturnUrl"] = return_url
        if expire_minutes:
            data["ExpireMinutes"] = expire_minutes

        response = await self._request("POST", "/deals/create", data=data)

        return TBankDeal(
            deal_id=response["DealId"],
            account_number=response.get("AccountNumber", ""),
            amount=amount,
            status=DealStatus(response.get("Status", "DRAFT")),
            payment_url=response.get("PaymentUrl"),
            qr_code=response.get("QrCode"),
            expires_at=self._parse_datetime(response.get("ExpiresAt")),
            paid_at=None,
            splits=splits,
            created_at=self._parse_datetime(response.get("CreatedAt")) or datetime.utcnow(),
        )

    async def get_deal(self, deal_id: str) -> TBankDeal:
        """Get deal by ID"""
        response = await self._request("GET", f"/deals/{deal_id}")

        splits = [
            TBankDealSplit(
                recipient_id=s["RecipientId"],
                amount=s["Amount"],
                description=s.get("Description"),
            )
            for s in response.get("Splits", [])
        ]

        return TBankDeal(
            deal_id=response["DealId"],
            account_number=response.get("AccountNumber", ""),
            amount=response["Amount"],
            status=DealStatus(response.get("Status", "DRAFT")),
            payment_url=response.get("PaymentUrl"),
            qr_code=response.get("QrCode"),
            expires_at=self._parse_datetime(response.get("ExpiresAt")),
            paid_at=self._parse_datetime(response.get("PaidAt")),
            splits=splits,
            created_at=self._parse_datetime(response.get("CreatedAt")) or datetime.utcnow(),
        )

    async def get_deal_status(self, deal_id: str) -> DealStatus:
        """Get deal status"""
        response = await self._request("GET", f"/deals/{deal_id}/status")
        return DealStatus(response["Status"])

    async def cancel_deal(self, deal_id: str, reason: str = None) -> TBankDeal:
        """
        Cancel a deal and refund if paid.

        Args:
            deal_id: Deal ID to cancel
            reason: Cancellation reason

        Returns:
            Updated TBankDeal
        """
        data = {"DealId": deal_id}
        if reason:
            data["Reason"] = reason

        response = await self._request("POST", "/deals/cancel", data=data)

        return await self.get_deal(deal_id)

    async def release_deal(self, deal_id: str) -> TBankDeal:
        """
        Release held funds to recipients (end hold period early).

        Args:
            deal_id: Deal ID to release

        Returns:
            Updated TBankDeal
        """
        response = await self._request("POST", f"/deals/{deal_id}/release")
        return await self.get_deal(deal_id)

    # ========================================
    # Payment Links
    # ========================================

    async def regenerate_payment_link(
        self,
        deal_id: str,
        expire_minutes: int = 60,
    ) -> str:
        """
        Regenerate payment link for an existing deal.

        Args:
            deal_id: Deal ID
            expire_minutes: New expiration time

        Returns:
            New payment URL
        """
        data = {
            "DealId": deal_id,
            "ExpireMinutes": expire_minutes,
        }

        response = await self._request("POST", "/deals/payment-link", data=data)
        return response["PaymentUrl"]
