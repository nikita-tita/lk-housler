"""
Tests for TBankDealsClient with httpx mocking.

Тестирует реальный клиент TBank с мокированными HTTP запросами:
- Создание получателей
- Создание и управление сделками
- Генерация подписей
- Обработка ошибок (сетевые, таймауты, некорректные ответы)
"""

import pytest
import hashlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from app.integrations.tbank.deals import (
    TBankDealsClient,
    TBankDeal,
    TBankRecipient,
    TBankDealSplit,
    DealStatus,
    RecipientStatus,
)
from app.integrations.tbank.base import (
    TBankError,
    TBankAPIError,
    TBankTimeoutError,
    TBankConnectionError,
)


class TestTBankDealsClientSignature:
    """Tests for signature generation"""

    def test_generate_signature_basic(self, tbank_client):
        """Тест базовой генерации подписи."""
        data = {
            "Amount": 10000,
            "OrderId": "test-123",
        }

        signature = tbank_client._generate_signature(data)

        # Подпись должна быть SHA-256 хэшем
        assert len(signature) == 64
        assert all(c in "0123456789abcdef" for c in signature)

    def test_generate_signature_excludes_token(self, tbank_client):
        """Тест что Token исключается из подписи."""
        data_with_token = {
            "Amount": 10000,
            "Token": "should_be_excluded",
            "OrderId": "test-123",
        }
        data_without_token = {
            "Amount": 10000,
            "OrderId": "test-123",
        }

        sig_with = tbank_client._generate_signature(data_with_token)
        sig_without = tbank_client._generate_signature(data_without_token)

        # Подписи должны быть одинаковыми
        assert sig_with == sig_without

    def test_generate_signature_sorted_keys(self, tbank_client):
        """Тест что ключи сортируются при генерации подписи."""
        data1 = {"B": "2", "A": "1", "C": "3"}
        data2 = {"A": "1", "C": "3", "B": "2"}

        sig1 = tbank_client._generate_signature(data1)
        sig2 = tbank_client._generate_signature(data2)

        # Порядок ключей не должен влиять на подпись
        assert sig1 == sig2

    def test_generate_signature_with_none_values(self, tbank_client):
        """Тест что None значения исключаются из подписи."""
        data_with_none = {
            "Amount": 10000,
            "Description": None,
            "OrderId": "test-123",
        }
        data_without_none = {
            "Amount": 10000,
            "OrderId": "test-123",
        }

        sig_with = tbank_client._generate_signature(data_with_none)
        sig_without = tbank_client._generate_signature(data_without_none)

        assert sig_with == sig_without


class TestTBankDealsClientRecipients:
    """Tests for recipient management"""

    @pytest.mark.asyncio
    async def test_create_recipient_success(
        self, tbank_client, sample_recipient_data, create_recipient_response
    ):
        """Тест успешного создания получателя."""
        mock_response = httpx.Response(
            status_code=200,
            json=create_recipient_response,
        )

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = create_recipient_response

            recipient = await tbank_client.create_recipient(
                inn=sample_recipient_data["inn"],
                name=sample_recipient_data["name"],
                bank_account=sample_recipient_data["bank_account"],
                phone=sample_recipient_data["phone"],
            )

            assert recipient.external_id == "rcpt_api_12345"
            assert recipient.inn == sample_recipient_data["inn"]
            assert recipient.name == sample_recipient_data["name"]
            assert recipient.status == RecipientStatus.ACTIVE

            # Проверяем что запрос был вызван с правильными параметрами
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == "POST"
            assert call_args[0][1] == "/recipients/create"

    @pytest.mark.asyncio
    async def test_create_recipient_minimal(self, tbank_client, create_recipient_response):
        """Тест создания получателя с минимальными данными."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = create_recipient_response

            recipient = await tbank_client.create_recipient(
                inn="123456789012",
                name="Тестовый получатель",
            )

            assert recipient.external_id == "rcpt_api_12345"

            # Проверяем что bank_account и phone не были переданы
            call_data = mock_request.call_args[1]["data"]
            assert "BankAccount" not in call_data
            assert "Phone" not in call_data

    @pytest.mark.asyncio
    async def test_get_recipient_success(self, tbank_client):
        """Тест успешного получения получателя."""
        api_response = {
            "RecipientId": "rcpt_12345",
            "Inn": "123456789012",
            "Name": "Test Recipient",
            "BankAccount": "40702810000000000001",
            "Phone": "+79001234567",
            "Status": "ACTIVE",
            "CreatedAt": "2026-01-17T10:00:00Z",
        }

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = api_response

            recipient = await tbank_client.get_recipient("rcpt_12345")

            assert recipient.external_id == "rcpt_12345"
            assert recipient.inn == "123456789012"
            assert recipient.bank_account == "40702810000000000001"
            mock_request.assert_called_once_with("GET", "/recipients/rcpt_12345")


class TestTBankDealsClientDeals:
    """Tests for deal management"""

    @pytest.mark.asyncio
    async def test_create_deal_success(
        self, tbank_client, sample_deal_data, sample_splits, create_deal_response
    ):
        """Тест успешного создания сделки."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = create_deal_response

            deal = await tbank_client.create_deal(
                order_id=sample_deal_data["order_id"],
                amount=sample_deal_data["amount"],
                description=sample_deal_data["description"],
                splits=sample_splits,
                customer_email=sample_deal_data["customer_email"],
                customer_phone=sample_deal_data["customer_phone"],
                return_url=sample_deal_data["return_url"],
                expire_minutes=sample_deal_data["expire_minutes"],
            )

            assert deal.deal_id == "deal_api_12345"
            assert deal.status == DealStatus.ACTIVE
            assert deal.payment_url is not None
            assert deal.qr_code is not None
            assert deal.expires_at is not None

    @pytest.mark.asyncio
    async def test_create_deal_splits_validation_error(self, tbank_client):
        """Тест ошибки при несовпадении суммы сплитов с общей суммой."""
        splits = [
            TBankDealSplit(recipient_id="rcpt_1", amount=5000000),  # 50,000 руб
            TBankDealSplit(recipient_id="rcpt_2", amount=3000000),  # 30,000 руб
        ]

        with pytest.raises(TBankError) as exc_info:
            await tbank_client.create_deal(
                order_id="test-123",
                amount=10000000,  # 100,000 руб (не совпадает с суммой сплитов)
                description="Test",
                splits=splits,
            )

        assert "doesn't match" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_deal_success(self, tbank_client, get_deal_response):
        """Тест успешного получения сделки."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = get_deal_response

            deal = await tbank_client.get_deal("deal_api_12345")

            assert deal.deal_id == "deal_api_12345"
            assert deal.status == DealStatus.HOLD
            assert deal.amount == 10000000
            assert deal.paid_at is not None
            assert len(deal.splits) == 1
            assert deal.splits[0].recipient_id == "rcpt_api_12345"

    @pytest.mark.asyncio
    async def test_get_deal_status(self, tbank_client):
        """Тест получения статуса сделки."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = {"Status": "COMPLETED"}

            status = await tbank_client.get_deal_status("deal_12345")

            assert status == DealStatus.COMPLETED
            mock_request.assert_called_once_with(
                "GET", "/deals/deal_12345/status"
            )

    @pytest.mark.asyncio
    async def test_cancel_deal_success(self, tbank_client, get_deal_response):
        """Тест успешной отмены сделки."""
        cancelled_response = get_deal_response.copy()
        cancelled_response["Status"] = "CANCELLED"

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            # Первый вызов - POST для отмены, второй - GET для получения данных
            mock_request.side_effect = [
                {"Success": True},
                cancelled_response,
            ]

            deal = await tbank_client.cancel_deal(
                "deal_api_12345", reason="Отменено по запросу клиента"
            )

            assert deal.status == DealStatus.CANCELLED
            assert mock_request.call_count == 2

    @pytest.mark.asyncio
    async def test_release_deal_success(self, tbank_client, get_deal_response):
        """Тест успешного релиза сделки."""
        released_response = get_deal_response.copy()
        released_response["Status"] = "COMPLETED"

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = [
                {"Success": True},
                released_response,
            ]

            deal = await tbank_client.release_deal("deal_api_12345")

            assert deal.status == DealStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_regenerate_payment_link_success(self, tbank_client):
        """Тест успешной перегенерации платежной ссылки."""
        new_url = "https://api.tbank.ru/pay/deal_12345?t=new_token"

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = {"PaymentUrl": new_url}

            result = await tbank_client.regenerate_payment_link(
                "deal_12345", expire_minutes=30
            )

            assert result == new_url
            call_data = mock_request.call_args[1]["data"]
            assert call_data["DealId"] == "deal_12345"
            assert call_data["ExpireMinutes"] == 30


class TestTBankDealsClientErrors:
    """Tests for error handling"""

    @pytest.mark.asyncio
    async def test_api_error_400(self, tbank_client, error_response_400):
        """Тест обработки ошибки 400 от API."""
        mock_response = httpx.Response(
            status_code=400,
            json=error_response_400,
        )

        async def mock_request(*args, **kwargs):
            raise TBankAPIError(
                message=error_response_400["Message"],
                status_code=400,
                code=error_response_400["ErrorCode"],
                details=error_response_400,
            )

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock, side_effect=mock_request
        ):
            with pytest.raises(TBankAPIError) as exc_info:
                await tbank_client.get_deal("invalid_deal_id")

            assert exc_info.value.status_code == 400
            assert exc_info.value.code == "INVALID_REQUEST"

    @pytest.mark.asyncio
    async def test_api_error_404(self, tbank_client, error_response_404):
        """Тест обработки ошибки 404 от API."""
        async def mock_request(*args, **kwargs):
            raise TBankAPIError(
                message=error_response_404["Message"],
                status_code=404,
                code=error_response_404["ErrorCode"],
                details=error_response_404,
            )

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock, side_effect=mock_request
        ):
            with pytest.raises(TBankAPIError) as exc_info:
                await tbank_client.get_deal("nonexistent_deal")

            assert exc_info.value.status_code == 404
            assert exc_info.value.code == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_api_error_500(self, tbank_client, error_response_500):
        """Тест обработки ошибки 500 от API."""
        async def mock_request(*args, **kwargs):
            raise TBankAPIError(
                message=error_response_500["Message"],
                status_code=500,
                code=error_response_500["ErrorCode"],
                details=error_response_500,
            )

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock, side_effect=mock_request
        ):
            with pytest.raises(TBankAPIError) as exc_info:
                await tbank_client.get_deal("deal_12345")

            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_timeout_error(self, tbank_client):
        """Тест обработки таймаута."""
        async def mock_request(*args, **kwargs):
            raise TBankTimeoutError("Request timeout: Connection timed out")

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock, side_effect=mock_request
        ):
            with pytest.raises(TBankTimeoutError):
                await tbank_client.get_deal("deal_12345")

    @pytest.mark.asyncio
    async def test_connection_error(self, tbank_client):
        """Тест обработки ошибки соединения."""
        async def mock_request(*args, **kwargs):
            raise TBankConnectionError("Connection error: Unable to connect")

        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock, side_effect=mock_request
        ):
            with pytest.raises(TBankConnectionError):
                await tbank_client.get_deal("deal_12345")


class TestTBankDealsClientHTTPIntegration:
    """Tests for HTTP layer with mocked httpx client"""

    @pytest.mark.asyncio
    async def test_request_adds_terminal_key(self, tbank_client):
        """Тест что TerminalKey добавляется к запросам."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"Success": True}

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            tbank_client, "_get_client", new_callable=AsyncMock, return_value=mock_client
        ):
            await tbank_client._request("POST", "/test", data={"Amount": 1000})

            call_kwargs = mock_client.request.call_args[1]
            request_json = call_kwargs["json"]
            assert request_json["TerminalKey"] == "TEST_TERMINAL"
            assert "Token" in request_json

    @pytest.mark.asyncio
    async def test_request_handles_http_timeout(self, tbank_client):
        """Тест обработки HTTP таймаута."""
        from tenacity import RetryError

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client.is_closed = False

        with patch.object(
            tbank_client, "_get_client", new_callable=AsyncMock, return_value=mock_client
        ):
            # tenacity wraps the final exception in RetryError after all retries exhausted
            with pytest.raises(RetryError) as exc_info:
                await tbank_client._request("GET", "/test")

            # Check that the original cause is TBankTimeoutError
            assert isinstance(exc_info.value.__cause__, TBankTimeoutError)
            assert "timeout" in str(exc_info.value.__cause__).lower()

    @pytest.mark.asyncio
    async def test_request_handles_connection_error(self, tbank_client):
        """Тест обработки ошибки соединения HTTP."""
        from tenacity import RetryError

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        mock_client.is_closed = False

        with patch.object(
            tbank_client, "_get_client", new_callable=AsyncMock, return_value=mock_client
        ):
            # tenacity wraps the final exception in RetryError after all retries exhausted
            with pytest.raises(RetryError) as exc_info:
                await tbank_client._request("GET", "/test")

            # Check that the original cause is TBankConnectionError
            assert isinstance(exc_info.value.__cause__, TBankConnectionError)
            assert "connection" in str(exc_info.value.__cause__).lower()

    @pytest.mark.asyncio
    async def test_request_handles_http_error_response(self, tbank_client):
        """Тест обработки HTTP ошибки в ответе."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.content = b'{"ErrorCode": "BAD_REQUEST", "Message": "Invalid"}'
        mock_response.json.return_value = {
            "ErrorCode": "BAD_REQUEST",
            "Message": "Invalid request",
        }

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False

        with patch.object(
            tbank_client, "_get_client", new_callable=AsyncMock, return_value=mock_client
        ):
            with pytest.raises(TBankAPIError) as exc_info:
                await tbank_client._request("POST", "/test", data={})

            assert exc_info.value.status_code == 400
            assert exc_info.value.code == "BAD_REQUEST"

    @pytest.mark.asyncio
    async def test_health_check_success(self, tbank_client):
        """Тест успешной проверки здоровья API."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = {"Status": "OK"}

            result = await tbank_client.health_check()

            assert result is True
            mock_request.assert_called_once_with("GET", "/ping", sign=False)

    @pytest.mark.asyncio
    async def test_health_check_failure(self, tbank_client):
        """Тест неуспешной проверки здоровья API."""
        with patch.object(
            tbank_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = Exception("Connection failed")

            result = await tbank_client.health_check()

            assert result is False

    @pytest.mark.asyncio
    async def test_close_client(self, tbank_client):
        """Тест закрытия HTTP клиента."""
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        tbank_client._client = mock_client

        await tbank_client.close()

        mock_client.aclose.assert_called_once()
        assert tbank_client._client is None

    @pytest.mark.asyncio
    async def test_close_client_already_closed(self, tbank_client):
        """Тест закрытия уже закрытого клиента."""
        tbank_client._client = None

        # Не должно вызвать ошибку
        await tbank_client.close()


class TestTBankClientMixin:
    """Tests for TBankClientMixin helper methods"""

    def test_parse_datetime_valid(self, tbank_client):
        """Тест парсинга валидной даты."""
        result = tbank_client._parse_datetime("2026-01-17T12:30:45Z")

        assert result is not None
        assert result.year == 2026
        assert result.month == 1
        assert result.day == 17
        assert result.hour == 12
        assert result.minute == 30

    def test_parse_datetime_with_timezone(self, tbank_client):
        """Тест парсинга даты с таймзоной."""
        result = tbank_client._parse_datetime("2026-01-17T12:30:45+03:00")

        assert result is not None
        assert result.hour == 12

    def test_parse_datetime_none(self, tbank_client):
        """Тест парсинга None значения."""
        result = tbank_client._parse_datetime(None)
        assert result is None

    def test_parse_datetime_empty(self, tbank_client):
        """Тест парсинга пустой строки."""
        result = tbank_client._parse_datetime("")
        assert result is None

    def test_parse_datetime_invalid(self, tbank_client):
        """Тест парсинга некорректной даты."""
        result = tbank_client._parse_datetime("not-a-date")
        assert result is None

    def test_format_amount(self, tbank_client):
        """Тест конвертации копеек в рубли."""
        assert tbank_client._format_amount(10000) == 100.0
        assert tbank_client._format_amount(10050) == 100.5
        assert tbank_client._format_amount(99) == 0.99

    def test_to_kopecks(self, tbank_client):
        """Тест конвертации рублей в копейки."""
        assert tbank_client._to_kopecks(100.0) == 10000
        assert tbank_client._to_kopecks(100.50) == 10050
        assert tbank_client._to_kopecks(0.99) == 99
