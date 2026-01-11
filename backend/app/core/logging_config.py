"""Logging configuration"""

import logging
import sys
from app.core.config import settings


def setup_logging() -> None:
    """Configure logging based on environment"""

    # Determine log level based on environment
    if settings.DEBUG:
        level = logging.DEBUG
    elif settings.APP_ENV == "production":
        level = logging.WARNING
    else:
        level = logging.INFO

    # Format: timestamp - name - level - message
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # Configure root logger
    logging.basicConfig(
        level=level, format=log_format, datefmt=date_format, handlers=[logging.StreamHandler(sys.stdout)]
    )

    # Set specific levels for noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO if settings.DEBUG else logging.WARNING)

    # Security audit logger - always INFO level for audit trail
    audit_logger = logging.getLogger("security.audit")
    audit_logger.setLevel(logging.INFO)

    # Log startup info
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured: level={logging.getLevelName(level)}, env={settings.APP_ENV}")
