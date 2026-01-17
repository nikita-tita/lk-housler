"""T-Bank client factory"""

import logging
from typing import Optional

from app.core.config import settings
from app.integrations.tbank.base import TBankClient
from app.integrations.tbank.deals import TBankDealsClient
from app.integrations.tbank.mock import MockTBankDealsClient

logger = logging.getLogger(__name__)

# Singleton instances
_deals_client: Optional[TBankDealsClient] = None


def get_tbank_client() -> TBankClient:
    """
    Get T-Bank base client based on configuration.

    Returns appropriate client based on TBANK_MODE setting:
    - mock: Returns mock client for development
    - sandbox: Returns real client pointing to sandbox
    - production: Returns real client pointing to production

    Returns:
        TBankClient instance
    """
    return get_tbank_deals_client()


def get_tbank_deals_client() -> TBankDealsClient:
    """
    Get T-Bank Deals client (singleton).

    Returns appropriate client based on TBANK_MODE setting.

    Returns:
        TBankDealsClient instance
    """
    global _deals_client

    if _deals_client is not None:
        return _deals_client

    mode = settings.TBANK_MODE.lower()

    if mode == "mock":
        logger.info("Using mock T-Bank deals client")
        _deals_client = MockTBankDealsClient()

    elif mode == "sandbox":
        logger.info("Using sandbox T-Bank deals client")
        _deals_client = TBankDealsClient(
            base_url=settings.TBANK_API_URL,
            terminal_key=settings.TBANK_TERMINAL_KEY,
            secret_key=settings.TBANK_SECRET_KEY,
        )

    elif mode == "production":
        logger.info("Using production T-Bank deals client")
        _deals_client = TBankDealsClient(
            base_url=settings.TBANK_API_URL,
            terminal_key=settings.TBANK_TERMINAL_KEY,
            secret_key=settings.TBANK_SECRET_KEY,
        )

    else:
        logger.warning(f"Unknown TBANK_MODE '{mode}', falling back to mock")
        _deals_client = MockTBankDealsClient()

    return _deals_client


def reset_tbank_client() -> None:
    """
    Reset T-Bank client singleton.

    Useful for testing or configuration changes.
    """
    global _deals_client
    _deals_client = None
    logger.info("T-Bank client reset")


async def close_tbank_client() -> None:
    """
    Close T-Bank client connections.

    Should be called on application shutdown.
    """
    global _deals_client

    if _deals_client is not None:
        await _deals_client.close()
        _deals_client = None
        logger.info("T-Bank client closed")
