"""Security audit logging"""

import logging
from datetime import datetime
from typing import Optional, Any, Dict
from enum import Enum


class AuditEvent(str, Enum):
    """Security audit event types"""

    # Authentication
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    TOKEN_REFRESHED = "token_refreshed"
    USER_REGISTERED = "user_registered"
    OTP_SENT = "otp_sent"
    OTP_VERIFIED = "otp_verified"
    OTP_FAILED = "otp_failed"
    OTP_BLOCKED = "otp_blocked"

    # Authorization
    ACCESS_DENIED = "access_denied"
    RATE_LIMITED = "rate_limited"

    # User actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    PASSWORD_CHANGED = "password_changed"

    # Deal/Document actions
    DEAL_CREATED = "deal_created"
    DEAL_CANCELLED = "deal_cancelled"
    DOCUMENT_GENERATED = "document_generated"
    DOCUMENT_GENERATION_FAILED = "document_generation_failed"
    DOCUMENT_SIGNED = "document_signed"
    PAYMENT_CREATED = "payment_created"
    PAYMENT_COMPLETED = "payment_completed"
    PAYOUT_PROCESSED = "payout_processed"
    PAYOUT_FAILED = "payout_failed"


# Separate audit logger for security events
audit_logger = logging.getLogger("security.audit")


def log_audit_event(
    event: AuditEvent,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    resource: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    success: bool = True,
) -> None:
    """
    Log a security audit event.

    Args:
        event: Type of security event
        user_id: User ID if authenticated
        ip_address: Client IP address
        user_agent: Client user agent
        resource: Resource being accessed (e.g., "deal:123")
        details: Additional event details
        success: Whether the action was successful
    """
    audit_record = {
        "timestamp": datetime.utcnow().isoformat(),
        "event": event.value,
        "success": success,
        "user_id": user_id,
        "ip_address": ip_address,
        "user_agent": user_agent[:200] if user_agent else None,
        "resource": resource,
        "details": details or {},
    }

    # Log at appropriate level
    if success:
        audit_logger.info(f"AUDIT: {audit_record}")
    else:
        audit_logger.warning(f"AUDIT: {audit_record}")
