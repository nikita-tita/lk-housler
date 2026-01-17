"""T-Bank base HTTP client with circuit breaker and retry logic"""

import hashlib
import hmac
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from circuitbreaker import circuit
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings

logger = logging.getLogger(__name__)


class TBankError(Exception):
    """Base exception for T-Bank errors"""

    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class TBankAPIError(TBankError):
    """API error from T-Bank"""

    def __init__(self, message: str, status_code: int, code: str = None, details: dict = None):
        super().__init__(message, code, details)
        self.status_code = status_code


class TBankTimeoutError(TBankError):
    """Timeout error"""
    pass


class TBankConnectionError(TBankError):
    """Connection error"""
    pass


class TBankClient(ABC):
    """Abstract base class for T-Bank API clients"""

    def __init__(
        self,
        base_url: str = None,
        terminal_key: str = None,
        secret_key: str = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url or settings.TBANK_API_URL
        self.terminal_key = terminal_key or settings.TBANK_TERMINAL_KEY
        self.secret_key = secret_key or settings.TBANK_SECRET_KEY
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                headers=self._get_default_headers(),
            )
        return self._client

    def _get_default_headers(self) -> dict:
        """Get default HTTP headers"""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _generate_signature(self, data: dict) -> str:
        """
        Generate signature for T-Bank API request.
        T-Bank uses SHA-256 HMAC with sorted values concatenation.
        """
        # Sort keys and concatenate values
        sorted_values = []
        for key in sorted(data.keys()):
            if key != "Token" and data[key] is not None:
                sorted_values.append(str(data[key]))

        # Add secret key
        sorted_values.append(self.secret_key)

        # Concatenate and hash
        concat = "".join(sorted_values)
        signature = hashlib.sha256(concat.encode("utf-8")).hexdigest()

        return signature

    def _verify_webhook_signature(self, payload: dict, signature: str) -> bool:
        """Verify webhook signature from T-Bank"""
        expected = self._generate_signature(payload)
        return hmac.compare_digest(expected.lower(), signature.lower())

    @circuit(failure_threshold=5, recovery_timeout=60)
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((TBankTimeoutError, TBankConnectionError)),
    )
    async def _request(
        self,
        method: str,
        path: str,
        data: dict = None,
        params: dict = None,
        sign: bool = True,
    ) -> dict:
        """
        Make HTTP request to T-Bank API with circuit breaker and retry.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API endpoint path
            data: Request body (for POST/PUT)
            params: Query parameters
            sign: Whether to add signature

        Returns:
            Response JSON as dict
        """
        client = await self._get_client()

        # Prepare request data
        request_data = data or {}
        if sign and self.terminal_key:
            request_data["TerminalKey"] = self.terminal_key
            request_data["Token"] = self._generate_signature(request_data)

        try:
            logger.debug(f"T-Bank API request: {method} {path}")

            response = await client.request(
                method=method,
                url=path,
                json=request_data if method in ("POST", "PUT", "PATCH") else None,
                params=params,
            )

            # Log response
            logger.debug(f"T-Bank API response: {response.status_code}")

            # Handle errors
            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise TBankAPIError(
                    message=error_data.get("Message", f"HTTP {response.status_code}"),
                    status_code=response.status_code,
                    code=error_data.get("ErrorCode"),
                    details=error_data,
                )

            return response.json()

        except httpx.TimeoutException as e:
            logger.error(f"T-Bank API timeout: {e}")
            raise TBankTimeoutError(f"Request timeout: {e}")

        except httpx.ConnectError as e:
            logger.error(f"T-Bank API connection error: {e}")
            raise TBankConnectionError(f"Connection error: {e}")

    async def close(self):
        """Close HTTP client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    @abstractmethod
    async def health_check(self) -> bool:
        """Check API availability"""
        pass


class TBankClientMixin:
    """Mixin with common T-Bank response parsing"""

    @staticmethod
    def _parse_datetime(value: str) -> Optional[datetime]:
        """Parse T-Bank datetime string"""
        if not value:
            return None
        try:
            # T-Bank uses ISO format with timezone
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            logger.warning(f"Failed to parse datetime: {value}")
            return None

    @staticmethod
    def _format_amount(kopecks: int) -> float:
        """Convert kopecks to rubles"""
        return kopecks / 100.0

    @staticmethod
    def _to_kopecks(rubles: float) -> int:
        """Convert rubles to kopecks"""
        return int(rubles * 100)
