"""FNS NPD (Self-Employed) status checking.

This module provides integration with nalog.ru API to verify
if a taxpayer is registered as self-employed (NPD taxpayer).

API Documentation: https://npd-check.nalog.ru/
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class NPDStatus(str, Enum):
    """NPD registration status"""
    REGISTERED = "registered"  # Currently registered as self-employed
    NOT_REGISTERED = "not_registered"  # Not registered as self-employed
    DEREGISTERED = "deregistered"  # Was registered but deregistered
    UNKNOWN = "unknown"  # Could not determine status
    ERROR = "error"  # API error


@dataclass
class NPDCheckResult:
    """Result of NPD status check"""
    inn: str
    status: NPDStatus
    registration_date: Optional[datetime] = None
    deregistration_date: Optional[datetime] = None
    checked_at: datetime = None
    error_message: Optional[str] = None

    def __post_init__(self):
        if self.checked_at is None:
            self.checked_at = datetime.utcnow()


class NPDStatusChecker:
    """Check NPD (self-employed) status via FNS API"""

    # FNS NPD check endpoint
    NPD_CHECK_URL = "https://statusnpd.nalog.ru:443/api/v1/tracker/taxpayer_status"

    def __init__(self):
        self.timeout = 10.0  # seconds

    async def check_status(
        self,
        inn: str,
        check_date: Optional[datetime] = None
    ) -> NPDCheckResult:
        """
        Check if taxpayer is registered as self-employed.

        Args:
            inn: Taxpayer INN (12 digits for individual)
            check_date: Date to check status for (default: today)

        Returns:
            NPDCheckResult with status information
        """
        # Use mock in development/test mode
        if settings.APP_ENV != "production" or settings.TBANK_MODE == "mock":
            return self._mock_check(inn)

        if check_date is None:
            check_date = datetime.utcnow()

        # Format date as YYYY-MM-DD
        date_str = check_date.strftime("%Y-%m-%d")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.NPD_CHECK_URL,
                    json={
                        "inn": inn,
                        "requestDate": date_str
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return self._parse_response(inn, data)

                elif response.status_code == 400:
                    # Invalid request (bad INN format, etc.)
                    return NPDCheckResult(
                        inn=inn,
                        status=NPDStatus.UNKNOWN,
                        error_message="Invalid request format"
                    )

                else:
                    logger.error(f"NPD check failed: HTTP {response.status_code}")
                    return NPDCheckResult(
                        inn=inn,
                        status=NPDStatus.ERROR,
                        error_message=f"HTTP {response.status_code}"
                    )

        except httpx.TimeoutException:
            logger.error(f"NPD check timeout for INN {inn}")
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.ERROR,
                error_message="Request timeout"
            )

        except Exception as e:
            logger.error(f"NPD check error for INN {inn}: {e}")
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.ERROR,
                error_message=str(e)
            )

    def _parse_response(self, inn: str, data: dict) -> NPDCheckResult:
        """Parse FNS API response"""
        # FNS API returns:
        # {"status": true, "message": "Taxpayer is registered as NPD payer"}
        # {"status": false, "message": "Taxpayer is not registered as NPD payer"}

        status_flag = data.get("status")

        if status_flag is True:
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.REGISTERED
            )
        elif status_flag is False:
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.NOT_REGISTERED
            )
        else:
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.UNKNOWN,
                error_message=data.get("message", "Unknown response format")
            )

    def _mock_check(self, inn: str) -> NPDCheckResult:
        """Mock NPD check for development/testing"""
        # Test INNs for different scenarios
        if inn.startswith("77"):
            # Moscow region - registered
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.REGISTERED,
                registration_date=datetime(2023, 1, 1)
            )
        elif inn.startswith("00"):
            # Test: not registered
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.NOT_REGISTERED
            )
        elif inn.startswith("99"):
            # Test: error
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.ERROR,
                error_message="Mock error for testing"
            )
        else:
            # Default: registered
            return NPDCheckResult(
                inn=inn,
                status=NPDStatus.REGISTERED,
                registration_date=datetime(2023, 6, 15)
            )


# Global instance
npd_checker = NPDStatusChecker()


async def check_npd_status(inn: str) -> NPDCheckResult:
    """Convenience function to check NPD status"""
    return await npd_checker.check_status(inn)
