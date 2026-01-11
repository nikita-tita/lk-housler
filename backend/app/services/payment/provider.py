"""Payment provider interface (СБП)"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from decimal import Decimal
from uuid import uuid4

from app.core.config import settings


class PaymentProvider(ABC):
    """Abstract payment provider"""

    @abstractmethod
    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str = "RUB",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create payment intent and return payment link"""
        pass

    @abstractmethod
    async def get_payment_status(self, provider_intent_id: str) -> Dict[str, Any]:
        """Get payment status"""
        pass

    @abstractmethod
    async def refund_payment(
        self,
        provider_tx_id: str,
        amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """Refund payment"""
        pass


class MockPaymentProvider(PaymentProvider):
    """Mock payment provider for development"""

    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str = "RUB",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Mock create payment intent"""
        intent_id = f"mock_intent_{uuid4().hex[:16]}"
        sbp_link = f"https://mock-sbp.ru/pay/{intent_id}"

        print(f"[Payment Mock] Created intent: {intent_id}, amount: {amount} {currency}")

        return {
            "provider_intent_id": intent_id,
            "sbp_link": sbp_link,
            "status": "created",
            "amount": float(amount),
            "currency": currency,
        }

    async def get_payment_status(self, provider_intent_id: str) -> Dict[str, Any]:
        """Mock get payment status"""
        # В реальности здесь запрос к API провайдера
        return {
            "provider_intent_id": provider_intent_id,
            "status": "pending",
        }

    async def refund_payment(
        self,
        provider_tx_id: str,
        amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """Mock refund"""
        print(f"[Payment Mock] Refund: {provider_tx_id}, amount: {amount}")
        return {
            "refund_id": f"mock_refund_{uuid4().hex[:16]}",
            "status": "succeeded",
        }


class RealPaymentProvider(PaymentProvider):
    """Real СБП payment provider"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        # TODO: Initialize real provider client

    async def create_payment_intent(
        self,
        amount: Decimal,
        currency: str = "RUB",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create real payment intent"""
        # TODO: Implement real СБП integration
        # import httpx
        # async with httpx.AsyncClient() as client:
        #     response = await client.post(
        #         "https://api.provider.ru/v1/payment_intents",
        #         headers={"Authorization": f"Bearer {self.api_key}"},
        #         json={"amount": float(amount), "currency": currency}
        #     )
        #     return response.json()
        raise NotImplementedError("Real payment provider not implemented yet")

    async def get_payment_status(self, provider_intent_id: str) -> Dict[str, Any]:
        raise NotImplementedError("Real payment provider not implemented yet")

    async def refund_payment(
        self,
        provider_tx_id: str,
        amount: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        raise NotImplementedError("Real payment provider not implemented yet")


def get_payment_provider() -> PaymentProvider:
    """Get payment provider based on settings"""
    if settings.PAYMENT_PROVIDER == "mock":
        return MockPaymentProvider()
    else:
        return RealPaymentProvider(settings.PAYMENT_API_KEY)
