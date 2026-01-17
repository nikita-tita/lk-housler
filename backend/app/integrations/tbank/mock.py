"""Mock T-Bank client for development and testing"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.integrations.tbank.base import TBankClient
from app.integrations.tbank.deals import (
    TBankDealsClient,
    TBankDeal,
    TBankRecipient,
    TBankDealSplit,
    DealStatus,
    RecipientStatus,
)

logger = logging.getLogger(__name__)


class MockTBankDealsClient(TBankDealsClient):
    """
    Mock implementation of T-Bank Deals client.

    Stores data in memory for testing purposes.
    """

    def __init__(self, *args, **kwargs):
        # Don't call parent __init__ to avoid real HTTP client
        self.base_url = "https://mock.tbank.ru/v2"
        self.terminal_key = "MOCK_TERMINAL"
        self.secret_key = "MOCK_SECRET"
        self.timeout = 30.0
        self._client = None

        # In-memory storage
        self._recipients: Dict[str, TBankRecipient] = {}
        self._deals: Dict[str, TBankDeal] = {}

        logger.info("MockTBankDealsClient initialized")

    async def health_check(self) -> bool:
        """Mock health check always returns True"""
        logger.debug("Mock health check: OK")
        return True

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
        """Create mock recipient"""
        recipient_id = f"mock_rcpt_{uuid.uuid4().hex[:8]}"

        recipient = TBankRecipient(
            external_id=recipient_id,
            inn=inn,
            name=name,
            bank_account=bank_account,
            phone=phone,
            status=RecipientStatus.ACTIVE,
            created_at=datetime.now(timezone.utc),
        )

        self._recipients[recipient_id] = recipient
        logger.info(f"Mock recipient created: {recipient_id}")

        return recipient

    async def get_recipient(self, recipient_id: str) -> TBankRecipient:
        """Get mock recipient"""
        if recipient_id not in self._recipients:
            # Create a default mock recipient if not found
            return TBankRecipient(
                external_id=recipient_id,
                inn="000000000000",
                name="Mock Recipient",
                bank_account=None,
                phone=None,
                status=RecipientStatus.ACTIVE,
                created_at=datetime.now(timezone.utc),
            )
        return self._recipients[recipient_id]

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
        """Create mock deal"""
        deal_id = f"mock_deal_{uuid.uuid4().hex[:8]}"
        account_number = f"408178{uuid.uuid4().hex[:14].upper()}"

        # Generate mock payment URL
        payment_url = f"https://mock.tbank.ru/pay/{deal_id}"
        qr_code = f"https://qr.tbank.ru/{deal_id}"

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)

        deal = TBankDeal(
            deal_id=deal_id,
            account_number=account_number,
            amount=amount,
            status=DealStatus.ACTIVE,
            payment_url=payment_url,
            qr_code=qr_code,
            expires_at=expires_at,
            paid_at=None,
            splits=splits,
            created_at=datetime.now(timezone.utc),
        )

        self._deals[deal_id] = deal
        logger.info(f"Mock deal created: {deal_id} for {amount} kopecks")

        return deal

    async def get_deal(self, deal_id: str) -> TBankDeal:
        """Get mock deal"""
        if deal_id not in self._deals:
            # Return a default mock deal
            return TBankDeal(
                deal_id=deal_id,
                account_number="40817800000000000000",
                amount=0,
                status=DealStatus.DRAFT,
                payment_url=None,
                qr_code=None,
                expires_at=None,
                paid_at=None,
                splits=[],
                created_at=datetime.now(timezone.utc),
            )
        return self._deals[deal_id]

    async def get_deal_status(self, deal_id: str) -> DealStatus:
        """Get mock deal status"""
        deal = await self.get_deal(deal_id)
        return deal.status

    async def cancel_deal(self, deal_id: str, reason: str = None) -> TBankDeal:
        """Cancel mock deal"""
        if deal_id in self._deals:
            deal = self._deals[deal_id]
            self._deals[deal_id] = TBankDeal(
                deal_id=deal.deal_id,
                account_number=deal.account_number,
                amount=deal.amount,
                status=DealStatus.CANCELLED,
                payment_url=None,
                qr_code=None,
                expires_at=deal.expires_at,
                paid_at=deal.paid_at,
                splits=deal.splits,
                created_at=deal.created_at,
            )
            logger.info(f"Mock deal cancelled: {deal_id}")

        return await self.get_deal(deal_id)

    async def release_deal(self, deal_id: str) -> TBankDeal:
        """Release mock deal from hold"""
        if deal_id in self._deals:
            deal = self._deals[deal_id]
            if deal.status == DealStatus.HOLD:
                self._deals[deal_id] = TBankDeal(
                    deal_id=deal.deal_id,
                    account_number=deal.account_number,
                    amount=deal.amount,
                    status=DealStatus.COMPLETED,
                    payment_url=deal.payment_url,
                    qr_code=deal.qr_code,
                    expires_at=deal.expires_at,
                    paid_at=deal.paid_at,
                    splits=deal.splits,
                    created_at=deal.created_at,
                )
                logger.info(f"Mock deal released: {deal_id}")

        return await self.get_deal(deal_id)

    async def regenerate_payment_link(
        self,
        deal_id: str,
        expire_minutes: int = 60,
    ) -> str:
        """Regenerate mock payment link"""
        new_url = f"https://mock.tbank.ru/pay/{deal_id}?t={uuid.uuid4().hex[:8]}"

        if deal_id in self._deals:
            deal = self._deals[deal_id]
            self._deals[deal_id] = TBankDeal(
                deal_id=deal.deal_id,
                account_number=deal.account_number,
                amount=deal.amount,
                status=deal.status,
                payment_url=new_url,
                qr_code=deal.qr_code,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=expire_minutes),
                paid_at=deal.paid_at,
                splits=deal.splits,
                created_at=deal.created_at,
            )

        logger.info(f"Mock payment link regenerated for {deal_id}")
        return new_url

    # ========================================
    # Test Helpers
    # ========================================

    def simulate_payment(self, deal_id: str) -> None:
        """Simulate payment for testing"""
        if deal_id in self._deals:
            deal = self._deals[deal_id]
            self._deals[deal_id] = TBankDeal(
                deal_id=deal.deal_id,
                account_number=deal.account_number,
                amount=deal.amount,
                status=DealStatus.HOLD,  # Go to hold after payment
                payment_url=deal.payment_url,
                qr_code=deal.qr_code,
                expires_at=deal.expires_at,
                paid_at=datetime.now(timezone.utc),
                splits=deal.splits,
                created_at=deal.created_at,
            )
            logger.info(f"Mock payment simulated for {deal_id}")

    def simulate_release(self, deal_id: str) -> None:
        """Simulate hold release for testing"""
        if deal_id in self._deals:
            deal = self._deals[deal_id]
            self._deals[deal_id] = TBankDeal(
                deal_id=deal.deal_id,
                account_number=deal.account_number,
                amount=deal.amount,
                status=DealStatus.COMPLETED,
                payment_url=deal.payment_url,
                qr_code=deal.qr_code,
                expires_at=deal.expires_at,
                paid_at=deal.paid_at,
                splits=deal.splits,
                created_at=deal.created_at,
            )
            logger.info(f"Mock release simulated for {deal_id}")

    def get_all_deals(self) -> List[TBankDeal]:
        """Get all mock deals (for testing)"""
        return list(self._deals.values())

    def get_all_recipients(self) -> List[TBankRecipient]:
        """Get all mock recipients (for testing)"""
        return list(self._recipients.values())

    def clear(self) -> None:
        """Clear all mock data"""
        self._deals.clear()
        self._recipients.clear()
        logger.info("Mock data cleared")

    async def close(self):
        """No-op for mock client"""
        pass
