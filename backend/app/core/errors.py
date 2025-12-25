"""Error handling utilities"""

import logging
from typing import Optional

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def safe_error_response(
    error: Exception,
    public_message: str = "An unexpected error occurred",
    log_context: Optional[str] = None,
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
) -> HTTPException:
    """
    Create a safe HTTP exception that doesn't leak internal details.
    Logs the actual error for debugging but returns a generic message to users.
    """
    context = f"[{log_context}] " if log_context else ""
    logger.error(f"{context}{type(error).__name__}: {str(error)}", exc_info=True)

    return HTTPException(
        status_code=status_code,
        detail=public_message
    )


class SafeValueError(ValueError):
    """
    A ValueError that is safe to show to users.
    Used for validation errors that should be displayed.
    """
    pass
