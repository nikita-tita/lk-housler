"""
Pytest fixtures for TBank integration tests.

Fixtures:
- mock_client: MockTBankDealsClient instance
- webhook_handler: TBankWebhookHandler with test secret
- tbank_client: TBankDealsClient with mocked httpx
- sample_recipient: Sample TBankRecipient data
- sample_deal: Sample TBankDeal data
- sample_splits: Sample TBankDealSplit list
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.integrations.tbank.mock import MockTBankDealsClient
from app.integrations.tbank.deals import (
    TBankDealsClient,
    TBankDeal,
    TBankRecipient,
    TBankDealSplit,
    DealStatus,
    RecipientStatus,
)
from app.integrations.tbank.webhooks import TBankWebhookHandler, WebhookEventType


# ========================================
# Mock Client Fixtures
# ========================================


@pytest.fixture
def mock_client():
    """
    Создает mock T-Bank клиент для тестирования.
    Автоматически очищает данные после теста.
    """
    client = MockTBankDealsClient()
    yield client
    client.clear()


# ========================================
# Webhook Handler Fixtures
# ========================================


@pytest.fixture
def webhook_handler():
    """Создает webhook handler с тестовым секретом."""
    return TBankWebhookHandler(secret_key="test_secret_key_12345")


@pytest.fixture
def webhook_handler_no_secret():
    """Создает webhook handler без секрета (для тестов без валидации)."""
    return TBankWebhookHandler(secret_key="")


# ========================================
# Real Client Fixtures (с мокированным httpx)
# ========================================


@pytest.fixture
def tbank_client():
    """
    Создает реальный TBankDealsClient для тестирования.
    HTTP запросы будут мокироваться в тестах.
    """
    client = TBankDealsClient(
        base_url="https://test.tbank.ru/v2",
        terminal_key="TEST_TERMINAL",
        secret_key="TEST_SECRET_KEY",
        timeout=10.0,
    )
    yield client


# ========================================
# Sample Data Fixtures
# ========================================


@pytest.fixture
def sample_recipient_data():
    """Возвращает тестовые данные получателя."""
    return {
        "inn": "123456789012",
        "name": "ООО Тестовое Агентство",
        "bank_account": "40702810000000000001",
        "phone": "+79001234567",
    }


@pytest.fixture
def sample_recipient(sample_recipient_data):
    """Создает тестовый объект TBankRecipient."""
    return TBankRecipient(
        external_id="rcpt_test_12345",
        inn=sample_recipient_data["inn"],
        name=sample_recipient_data["name"],
        bank_account=sample_recipient_data["bank_account"],
        phone=sample_recipient_data["phone"],
        status=RecipientStatus.ACTIVE,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_splits(sample_recipient):
    """Создает тестовый список сплитов."""
    return [
        TBankDealSplit(
            recipient_id=sample_recipient.external_id,
            amount=10000000,  # 100,000 рублей в копейках
            description="Комиссия агента",
        ),
    ]


@pytest.fixture
def sample_deal_data():
    """Возвращает тестовые данные сделки."""
    return {
        "order_id": "order_test_12345",
        "amount": 10000000,  # 100,000 рублей в копейках
        "description": "Тестовая сделка по недвижимости",
        "customer_email": "customer@example.com",
        "customer_phone": "+79009876543",
        "return_url": "https://lk.housler.ru/deals/callback",
        "expire_minutes": 60,
    }


@pytest.fixture
def sample_deal(sample_splits):
    """Создает тестовый объект TBankDeal."""
    now = datetime.now(timezone.utc)
    return TBankDeal(
        deal_id="deal_test_12345",
        account_number="40817810000000000001",
        amount=10000000,
        status=DealStatus.ACTIVE,
        payment_url="https://test.tbank.ru/pay/deal_test_12345",
        qr_code="https://qr.tbank.ru/deal_test_12345",
        expires_at=now + timedelta(hours=1),
        paid_at=None,
        splits=sample_splits,
        created_at=now,
    )


# ========================================
# Webhook Payload Fixtures
# ========================================


@pytest.fixture
def payment_confirmed_payload():
    """Возвращает payload для события подтверждения платежа."""
    return {
        "EventId": "evt_pay_12345",
        "EventType": "payment.confirmed",
        "DealId": "deal_test_12345",
        "PaymentId": "pay_67890",
        "Amount": 10000000,
        "Status": "CONFIRMED",
        "DateTime": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def deal_paid_payload():
    """Возвращает payload для события оплаты сделки."""
    return {
        "EventId": "evt_deal_12345",
        "EventType": "deal.paid",
        "DealId": "deal_test_12345",
        "Amount": 10000000,
        "Status": "PAID",
        "DateTime": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def deal_hold_payload():
    """Возвращает payload для события холда."""
    return {
        "EventId": "evt_hold_12345",
        "EventType": "deal.hold_started",
        "DealId": "deal_test_12345",
        "Amount": 10000000,
        "Status": "HOLD",
        "DateTime": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def deal_released_payload():
    """Возвращает payload для события релиза."""
    return {
        "EventId": "evt_release_12345",
        "EventType": "deal.released",
        "DealId": "deal_test_12345",
        "Amount": 10000000,
        "Status": "RELEASED",
        "DateTime": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def deal_cancelled_payload():
    """Возвращает payload для события отмены."""
    return {
        "EventId": "evt_cancel_12345",
        "EventType": "deal.cancelled",
        "DealId": "deal_test_12345",
        "ErrorCode": "USER_CANCELLED",
        "ErrorMessage": "Отменено пользователем",
        "DateTime": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def split_completed_payload():
    """Возвращает payload для события завершения сплита."""
    return {
        "EventId": "evt_split_12345",
        "EventType": "split.completed",
        "DealId": "deal_test_12345",
        "Amount": 6000000,  # Комиссия агента
        "DateTime": "2026-01-17T12:00:00Z",
    }


# ========================================
# API Response Fixtures
# ========================================


@pytest.fixture
def create_recipient_response():
    """Возвращает мок ответа API на создание получателя."""
    return {
        "Success": True,
        "RecipientId": "rcpt_api_12345",
        "Inn": "123456789012",
        "Name": "ООО Тестовое Агентство",
        "Status": "ACTIVE",
        "CreatedAt": "2026-01-17T10:00:00Z",
    }


@pytest.fixture
def create_deal_response():
    """Возвращает мок ответа API на создание сделки."""
    return {
        "Success": True,
        "DealId": "deal_api_12345",
        "AccountNumber": "40817810000000000099",
        "Status": "ACTIVE",
        "PaymentUrl": "https://api.tbank.ru/pay/deal_api_12345",
        "QrCode": "https://qr.tbank.ru/deal_api_12345",
        "ExpiresAt": "2026-01-17T13:00:00Z",
        "CreatedAt": "2026-01-17T12:00:00Z",
    }


@pytest.fixture
def get_deal_response():
    """Возвращает мок ответа API на получение сделки."""
    return {
        "Success": True,
        "DealId": "deal_api_12345",
        "AccountNumber": "40817810000000000099",
        "Amount": 10000000,
        "Status": "HOLD",
        "PaymentUrl": "https://api.tbank.ru/pay/deal_api_12345",
        "QrCode": "https://qr.tbank.ru/deal_api_12345",
        "ExpiresAt": "2026-01-17T13:00:00Z",
        "PaidAt": "2026-01-17T12:30:00Z",
        "CreatedAt": "2026-01-17T12:00:00Z",
        "Splits": [
            {
                "RecipientId": "rcpt_api_12345",
                "Amount": 10000000,
                "Description": "Комиссия агента",
            }
        ],
    }


@pytest.fixture
def error_response_400():
    """Возвращает мок ответа API с ошибкой 400."""
    return {
        "Success": False,
        "ErrorCode": "INVALID_REQUEST",
        "Message": "Неверный формат запроса",
    }


@pytest.fixture
def error_response_404():
    """Возвращает мок ответа API с ошибкой 404."""
    return {
        "Success": False,
        "ErrorCode": "NOT_FOUND",
        "Message": "Сделка не найдена",
    }


@pytest.fixture
def error_response_500():
    """Возвращает мок ответа API с ошибкой 500."""
    return {
        "Success": False,
        "ErrorCode": "INTERNAL_ERROR",
        "Message": "Внутренняя ошибка сервера",
    }
