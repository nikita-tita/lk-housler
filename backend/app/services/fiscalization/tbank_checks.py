"""T-Bank Checks API Client for fiscal receipt generation.

TASK-3.2: T-Bank Checks Integration

This client integrates with T-Bank "Cheki T-Biznesa" API for automatic
fiscalization when releasing bank-split deals.

API Documentation: https://www.tbank.ru/kassa/dev/checks/

Supported operations:
- create_receipt(): Create a fiscal receipt (income/income_return)
- get_receipt_status(): Get receipt status by ID
- cancel_receipt(): Cancel/void a receipt

Mock mode is available for development and testing.
"""

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ReceiptType(str, Enum):
    """Fiscal receipt type"""
    INCOME = "income"  # Приход - receipt for payment received
    INCOME_RETURN = "income_return"  # Возврат прихода - refund receipt


class TaxSystem(str, Enum):
    """Tax system for receipt"""
    OSN = "osn"  # Общая система налогообложения
    USN_INCOME = "usn_income"  # УСН доходы
    USN_INCOME_OUTCOME = "usn_income_outcome"  # УСН доходы - расходы
    PATENT = "patent"  # Патент
    ENVD = "envd"  # ЕНВД (deprecated)
    ESN = "esn"  # ЕСХН


class VatType(str, Enum):
    """VAT type for receipt items"""
    NONE = "none"  # Без НДС
    VAT0 = "vat0"  # НДС 0%
    VAT10 = "vat10"  # НДС 10%
    VAT20 = "vat20"  # НДС 20%
    VAT110 = "vat110"  # НДС 10/110
    VAT120 = "vat120"  # НДС 20/120


class PaymentMethod(str, Enum):
    """Payment method for receipt"""
    FULL_PREPAYMENT = "full_prepayment"  # Полная предоплата
    PREPAYMENT = "prepayment"  # Частичная предоплата
    ADVANCE = "advance"  # Аванс
    FULL_PAYMENT = "full_payment"  # Полный расчет
    PARTIAL_PAYMENT = "partial_payment"  # Частичный расчет и кредит
    CREDIT = "credit"  # Кредит
    CREDIT_PAYMENT = "credit_payment"  # Выплата по кредиту


class PaymentObject(str, Enum):
    """Payment object (what is being paid for)"""
    COMMODITY = "commodity"  # Товар
    EXCISE = "excise"  # Подакцизный товар
    JOB = "job"  # Работа
    SERVICE = "service"  # Услуга
    GAMBLING_BET = "gambling_bet"  # Ставка
    GAMBLING_PRIZE = "gambling_prize"  # Выигрыш
    LOTTERY = "lottery"  # Лотерейный билет
    LOTTERY_PRIZE = "lottery_prize"  # Выигрыш лотереи
    INTELLECTUAL_ACTIVITY = "intellectual_activity"  # Интеллектуальная деятельность
    PAYMENT = "payment"  # Платеж
    AGENT_COMMISSION = "agent_commission"  # Агентское вознаграждение
    COMPOSITE = "composite"  # Составной предмет расчета
    ANOTHER = "another"  # Иной предмет расчета


class AgentSign(str, Enum):
    """Признак агента (тег 1057 ФФД)"""
    BANK_PAYING_AGENT = "bank_paying_agent"
    BANK_PAYING_SUBAGENT = "bank_paying_subagent"
    PAYING_AGENT = "paying_agent"
    PAYING_SUBAGENT = "paying_subagent"
    ATTORNEY = "attorney"
    COMMISSION_AGENT = "commission_agent"
    AGENT = "agent"


class TBankChecksReceiptStatus(str, Enum):
    """Receipt status from T-Bank Checks API"""
    NEW = "new"  # Создан, ожидает отправки
    PENDING = "pending"  # В обработке
    DONE = "done"  # Успешно сформирован
    FAIL = "fail"  # Ошибка формирования
    WAIT = "wait"  # Ожидает ответа от ОФД


@dataclass
class ReceiptItem:
    """Item in the receipt"""
    name: str  # Наименование товара/услуги (max 128 chars)
    quantity: Decimal  # Количество
    price: int  # Цена в копейках
    amount: int  # Сумма в копейках (quantity * price)
    payment_method: PaymentMethod = PaymentMethod.FULL_PAYMENT
    payment_object: PaymentObject = PaymentObject.SERVICE
    vat: VatType = VatType.NONE
    # Agent tags for 54-ФЗ compliance
    agent_data: Optional["AgentData"] = None
    supplier_info: Optional["SupplierInfo"] = None


@dataclass
class ReceiptClient:
    """Client info for receipt"""
    email: Optional[str] = None  # Email для отправки чека
    phone: Optional[str] = None  # Телефон для отправки чека (format: +7XXXXXXXXXX)


@dataclass
class AgentData:
    """Данные агента для чека (тег 1057)"""
    agent_sign: AgentSign
    operation: Optional[str] = None  # Наименование операции
    phones: Optional[List[str]] = None  # Телефоны агента


@dataclass
class SupplierInfo:
    """Данные поставщика для чека (теги 1225, 1226, 1171)"""
    inn: str  # ИНН поставщика (обязательно)
    name: Optional[str] = None  # Наименование поставщика
    phones: Optional[List[str]] = None  # Телефоны поставщика


@dataclass
class CreateReceiptRequest:
    """Request to create a receipt"""
    receipt_type: ReceiptType
    items: List[ReceiptItem]
    client: ReceiptClient
    tax_system: TaxSystem = TaxSystem.USN_INCOME
    order_id: Optional[str] = None  # External order ID (our deal ID)
    payment_id: Optional[str] = None  # T-Bank payment ID if available


@dataclass
class ReceiptResponse:
    """Response from T-Bank Checks API"""
    receipt_id: str  # T-Bank receipt ID
    status: TBankChecksReceiptStatus
    receipt_url: Optional[str] = None  # URL to view/download receipt
    fiscal_data: Optional[Dict[str, Any]] = None  # ФД, ФП, ФН номера
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None


class TBankChecksError(Exception):
    """Exception for T-Bank Checks API errors"""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        retryable: bool = False,
    ):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.retryable = retryable


class TBankChecksClient:
    """Client for T-Bank Checks (fiscal receipts) API.

    Usage:
        client = TBankChecksClient()

        # Create receipt
        receipt = await client.create_receipt(
            CreateReceiptRequest(
                receipt_type=ReceiptType.INCOME,
                items=[ReceiptItem(name="Agency fee", quantity=1, price=10000_00, amount=10000_00)],
                client=ReceiptClient(email="client@example.com"),
            )
        )

        # Check status
        status = await client.get_receipt_status(receipt.receipt_id)

        # Cancel if needed
        await client.cancel_receipt(receipt.receipt_id, reason="Client refund")
    """

    # Retry configuration
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = 1.0
    RETRY_BACKOFF_MULTIPLIER = 2.0

    # Timeout configuration
    CONNECT_TIMEOUT = 10.0
    READ_TIMEOUT = 30.0

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        mock_mode: Optional[bool] = None,
        terminal_key: Optional[str] = None,
    ):
        """Initialize T-Bank Checks client.

        Args:
            api_url: API base URL (default from settings)
            api_key: API key for authentication (default from settings)
            mock_mode: Enable mock mode for testing (default from settings)
            terminal_key: Terminal key for signature (default from settings)
        """
        self.api_url = api_url or getattr(settings, "TBANK_CHECKS_API_URL", "https://securepay.tinkoff.ru/v2")
        self.api_key = api_key or getattr(settings, "TBANK_CHECKS_API_KEY", "")
        self.mock_mode = mock_mode if mock_mode is not None else getattr(settings, "TBANK_CHECKS_MOCK_MODE", settings.TBANK_MODE == "mock")
        self.terminal_key = terminal_key or settings.TBANK_TERMINAL_KEY
        self.secret_key = settings.TBANK_SECRET_KEY

        # Mock state for testing
        self._mock_receipts: Dict[str, ReceiptResponse] = {}
        self._mock_counter = 0

    def _generate_signature(self, data: Dict[str, Any]) -> str:
        """Generate HMAC signature for API request.

        T-Bank uses a specific signature algorithm:
        1. Sort all parameters by key
        2. Concatenate values (except Password)
        3. Add Password value at the beginning
        4. Calculate SHA-256 hash
        """
        if not self.secret_key:
            return ""

        # Filter and sort parameters
        params = {k: v for k, v in data.items() if v is not None and k != "Token"}
        sorted_keys = sorted(params.keys())

        # Build concatenated string with password at the beginning
        values = [self.secret_key]
        for key in sorted_keys:
            value = params[key]
            if isinstance(value, bool):
                values.append("true" if value else "false")
            elif isinstance(value, (dict, list)):
                values.append(json.dumps(value, separators=(",", ":")))
            else:
                values.append(str(value))

        concat_str = "".join(values)

        # Calculate SHA-256
        return hashlib.sha256(concat_str.encode()).hexdigest()

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """Make HTTP request to T-Bank API with retry logic.

        Args:
            method: HTTP method (GET, POST)
            endpoint: API endpoint path
            data: Request payload
            retry_count: Current retry attempt

        Returns:
            API response as dictionary

        Raises:
            TBankChecksError: On API errors
        """
        url = f"{self.api_url}/{endpoint.lstrip('/')}"

        # Add authentication
        payload = data or {}
        if self.terminal_key:
            payload["TerminalKey"] = self.terminal_key

        # Add signature
        if self.secret_key:
            payload["Token"] = self._generate_signature(payload)

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=self.CONNECT_TIMEOUT,
                    read=self.READ_TIMEOUT,
                    write=self.READ_TIMEOUT,
                    pool=self.READ_TIMEOUT,
                )
            ) as client:
                if method.upper() == "GET":
                    response = await client.get(url, params=payload)
                else:
                    response = await client.post(url, json=payload)

                response.raise_for_status()
                result = response.json()

                # Check for API-level errors
                if result.get("Success") is False:
                    error_code = result.get("ErrorCode", "UNKNOWN")
                    error_message = result.get("Message", "Unknown error")

                    # Check if retryable
                    retryable_codes = {"NETWORK_ERROR", "TIMEOUT", "SERVICE_UNAVAILABLE"}
                    is_retryable = error_code in retryable_codes

                    if is_retryable and retry_count < self.MAX_RETRIES:
                        delay = self.RETRY_DELAY_SECONDS * (self.RETRY_BACKOFF_MULTIPLIER ** retry_count)
                        logger.warning(
                            f"Retryable error from T-Bank Checks API: {error_code}. "
                            f"Retrying in {delay}s (attempt {retry_count + 1}/{self.MAX_RETRIES})"
                        )
                        await asyncio.sleep(delay)
                        return await self._request(method, endpoint, data, retry_count + 1)

                    raise TBankChecksError(
                        message=error_message,
                        code=error_code,
                        details=result,
                        retryable=is_retryable,
                    )

                return result

        except httpx.TimeoutException as e:
            if retry_count < self.MAX_RETRIES:
                delay = self.RETRY_DELAY_SECONDS * (self.RETRY_BACKOFF_MULTIPLIER ** retry_count)
                logger.warning(
                    f"Timeout from T-Bank Checks API. "
                    f"Retrying in {delay}s (attempt {retry_count + 1}/{self.MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                return await self._request(method, endpoint, data, retry_count + 1)

            raise TBankChecksError(
                message=f"Request timeout: {e}",
                code="TIMEOUT",
                retryable=True,
            )

        except httpx.HTTPStatusError as e:
            raise TBankChecksError(
                message=f"HTTP error: {e.response.status_code}",
                code=f"HTTP_{e.response.status_code}",
                details={"response": e.response.text},
                retryable=e.response.status_code >= 500,
            )

        except httpx.RequestError as e:
            if retry_count < self.MAX_RETRIES:
                delay = self.RETRY_DELAY_SECONDS * (self.RETRY_BACKOFF_MULTIPLIER ** retry_count)
                logger.warning(
                    f"Request error to T-Bank Checks API: {e}. "
                    f"Retrying in {delay}s (attempt {retry_count + 1}/{self.MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                return await self._request(method, endpoint, data, retry_count + 1)

            raise TBankChecksError(
                message=f"Request error: {e}",
                code="NETWORK_ERROR",
                retryable=True,
            )

    async def create_receipt(
        self,
        request: CreateReceiptRequest,
    ) -> ReceiptResponse:
        """Create a fiscal receipt.

        Args:
            request: Receipt creation request with items, client info, etc.

        Returns:
            ReceiptResponse with receipt ID and initial status

        Raises:
            TBankChecksError: On API errors
        """
        if self.mock_mode:
            return await self._mock_create_receipt(request)

        # Build items array
        items = []
        total_amount = 0
        for item in request.items:
            item_dict = {
                "Name": item.name[:128],  # Max 128 chars
                "Quantity": float(item.quantity),
                "Price": item.price,
                "Amount": item.amount,
                "PaymentMethod": item.payment_method.value,
                "PaymentObject": item.payment_object.value,
                "Tax": item.vat.value,
            }

            # Add agent data (tag 1057)
            if item.agent_data:
                item_dict["AgentData"] = {
                    "AgentSign": item.agent_data.agent_sign.value,
                }
                if item.agent_data.operation:
                    item_dict["AgentData"]["OperatorName"] = item.agent_data.operation
                if item.agent_data.phones:
                    item_dict["AgentData"]["Phones"] = item.agent_data.phones

            # Add supplier info (tags 1225, 1226, 1171)
            if item.supplier_info:
                item_dict["SupplierInfo"] = {
                    "Inn": item.supplier_info.inn,
                }
                if item.supplier_info.name:
                    item_dict["SupplierInfo"]["Name"] = item.supplier_info.name
                if item.supplier_info.phones:
                    item_dict["SupplierInfo"]["Phones"] = item.supplier_info.phones

            items.append(item_dict)
            total_amount += item.amount

        # Build receipt data
        receipt_data = {
            "Items": items,
            "Taxation": request.tax_system.value,
        }

        # Add client info
        if request.client.email:
            receipt_data["Email"] = request.client.email
        if request.client.phone:
            receipt_data["Phone"] = request.client.phone

        # Build request payload
        payload = {
            "Amount": total_amount,
            "Receipt": receipt_data,
        }

        # Add external IDs if provided
        if request.order_id:
            payload["OrderId"] = str(request.order_id)
        if request.payment_id:
            payload["PaymentId"] = request.payment_id

        # Determine endpoint based on receipt type
        if request.receipt_type == ReceiptType.INCOME:
            endpoint = "Send"
        else:  # income_return
            endpoint = "SendClosingReceipt"

        logger.info(
            f"Creating {request.receipt_type.value} receipt for order {request.order_id}, "
            f"amount: {total_amount/100:.2f} RUB"
        )

        try:
            result = await self._request("POST", endpoint, payload)

            receipt_id = result.get("PaymentId") or result.get("ReceiptId") or str(self._mock_counter)

            return ReceiptResponse(
                receipt_id=receipt_id,
                status=TBankChecksReceiptStatus.NEW,
                receipt_url=None,  # Will be available after processing
                created_at=datetime.utcnow(),
            )

        except TBankChecksError:
            raise
        except Exception as e:
            logger.error(f"Failed to create receipt: {e}")
            raise TBankChecksError(
                message=f"Failed to create receipt: {e}",
                code="CREATE_FAILED",
            )

    async def get_receipt_status(
        self,
        receipt_id: str,
    ) -> ReceiptResponse:
        """Get receipt status and details.

        Args:
            receipt_id: T-Bank receipt ID

        Returns:
            ReceiptResponse with current status and receipt URL if ready

        Raises:
            TBankChecksError: On API errors
        """
        if self.mock_mode:
            return await self._mock_get_receipt_status(receipt_id)

        payload = {
            "PaymentId": receipt_id,
        }

        logger.info(f"Getting receipt status: {receipt_id}")

        try:
            result = await self._request("POST", "GetState", payload)

            # Map T-Bank status to our status
            status_map = {
                "NEW": TBankChecksReceiptStatus.NEW,
                "PENDING": TBankChecksReceiptStatus.PENDING,
                "CONFIRMED": TBankChecksReceiptStatus.DONE,
                "AUTHORIZED": TBankChecksReceiptStatus.PENDING,
                "PARTIAL_REFUNDED": TBankChecksReceiptStatus.DONE,
                "REFUNDED": TBankChecksReceiptStatus.DONE,
                "REJECTED": TBankChecksReceiptStatus.FAIL,
                "REVERSED": TBankChecksReceiptStatus.FAIL,
            }

            raw_status = result.get("Status", "NEW")
            status = status_map.get(raw_status, TBankChecksReceiptStatus.PENDING)

            # Extract fiscal data if available
            fiscal_data = None
            if "FiscalNumber" in result or "Fp" in result:
                fiscal_data = {
                    "fiscal_number": result.get("FiscalNumber"),
                    "fiscal_sign": result.get("Fp"),
                    "fiscal_document": result.get("Fd"),
                    "fn_number": result.get("FnNumber"),
                }

            return ReceiptResponse(
                receipt_id=receipt_id,
                status=status,
                receipt_url=result.get("ReceiptUrl"),
                fiscal_data=fiscal_data,
                error_code=result.get("ErrorCode"),
                error_message=result.get("Message"),
            )

        except TBankChecksError:
            raise
        except Exception as e:
            logger.error(f"Failed to get receipt status: {e}")
            raise TBankChecksError(
                message=f"Failed to get receipt status: {e}",
                code="STATUS_FAILED",
            )

    async def cancel_receipt(
        self,
        receipt_id: str,
        reason: Optional[str] = None,
    ) -> ReceiptResponse:
        """Cancel/void a receipt.

        Creates an income_return receipt to void the original receipt.

        Args:
            receipt_id: T-Bank receipt ID to cancel
            reason: Optional cancellation reason

        Returns:
            ReceiptResponse for the cancellation receipt

        Raises:
            TBankChecksError: On API errors
        """
        if self.mock_mode:
            return await self._mock_cancel_receipt(receipt_id, reason)

        # First get the original receipt to get its details
        original = await self.get_receipt_status(receipt_id)

        if original.status != TBankChecksReceiptStatus.DONE:
            raise TBankChecksError(
                message=f"Cannot cancel receipt in status: {original.status.value}",
                code="INVALID_STATUS",
            )

        payload = {
            "PaymentId": receipt_id,
        }

        if reason:
            payload["Description"] = reason[:256]

        logger.info(f"Cancelling receipt: {receipt_id}, reason: {reason}")

        try:
            result = await self._request("POST", "Cancel", payload)

            return ReceiptResponse(
                receipt_id=result.get("PaymentId", receipt_id),
                status=TBankChecksReceiptStatus.NEW,  # Cancellation receipt created
                created_at=datetime.utcnow(),
            )

        except TBankChecksError:
            raise
        except Exception as e:
            logger.error(f"Failed to cancel receipt: {e}")
            raise TBankChecksError(
                message=f"Failed to cancel receipt: {e}",
                code="CANCEL_FAILED",
            )

    # ========================================
    # Mock methods for testing
    # ========================================

    async def _mock_create_receipt(
        self,
        request: CreateReceiptRequest,
    ) -> ReceiptResponse:
        """Mock implementation of create_receipt"""
        self._mock_counter += 1
        receipt_id = f"mock_receipt_{self._mock_counter}"

        total_amount = sum(item.amount for item in request.items)

        logger.info(
            f"[MOCK] Creating {request.receipt_type.value} receipt: {receipt_id}, "
            f"amount: {total_amount/100:.2f} RUB"
        )

        receipt = ReceiptResponse(
            receipt_id=receipt_id,
            status=TBankChecksReceiptStatus.DONE,  # Mock receipts are instantly done
            receipt_url=f"https://mock.tbank.ru/receipts/{receipt_id}",
            fiscal_data={
                "fiscal_number": f"FN{self._mock_counter:010d}",
                "fiscal_sign": f"FP{self._mock_counter:010d}",
                "fiscal_document": f"FD{self._mock_counter:06d}",
                "fn_number": f"9999{self._mock_counter:012d}",
            },
            created_at=datetime.utcnow(),
        )

        self._mock_receipts[receipt_id] = receipt
        return receipt

    async def _mock_get_receipt_status(
        self,
        receipt_id: str,
    ) -> ReceiptResponse:
        """Mock implementation of get_receipt_status"""
        if receipt_id in self._mock_receipts:
            logger.info(f"[MOCK] Getting receipt status: {receipt_id}")
            return self._mock_receipts[receipt_id]

        # Return a generic pending receipt for unknown IDs
        return ReceiptResponse(
            receipt_id=receipt_id,
            status=TBankChecksReceiptStatus.PENDING,
            created_at=datetime.utcnow(),
        )

    async def _mock_cancel_receipt(
        self,
        receipt_id: str,
        reason: Optional[str] = None,
    ) -> ReceiptResponse:
        """Mock implementation of cancel_receipt"""
        logger.info(f"[MOCK] Cancelling receipt: {receipt_id}, reason: {reason}")

        self._mock_counter += 1
        cancel_receipt_id = f"mock_cancel_{self._mock_counter}"

        receipt = ReceiptResponse(
            receipt_id=cancel_receipt_id,
            status=TBankChecksReceiptStatus.DONE,
            receipt_url=f"https://mock.tbank.ru/receipts/{cancel_receipt_id}",
            fiscal_data={
                "fiscal_number": f"FN{self._mock_counter:010d}",
                "fiscal_sign": f"FP{self._mock_counter:010d}",
                "fiscal_document": f"FD{self._mock_counter:06d}",
                "fn_number": f"9999{self._mock_counter:012d}",
            },
            created_at=datetime.utcnow(),
        )

        # Mark original as cancelled
        if receipt_id in self._mock_receipts:
            original = self._mock_receipts[receipt_id]
            original.status = TBankChecksReceiptStatus.FAIL

        self._mock_receipts[cancel_receipt_id] = receipt
        return receipt


# Factory function to get client instance
_client_instance: Optional[TBankChecksClient] = None


def get_tbank_checks_client() -> TBankChecksClient:
    """Get T-Bank Checks client singleton.

    Returns:
        TBankChecksClient instance configured from settings
    """
    global _client_instance

    if _client_instance is None:
        _client_instance = TBankChecksClient()

    return _client_instance
