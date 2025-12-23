"""Email service for Housler LK

Supports:
- Yandex 360 SMTP (smtp.yandex.ru)
- Any SMTP server

Usage:
    from app.services.email import send_otp_email, send_welcome_email

    await send_otp_email("user@example.com", "123456")
    await send_welcome_email("user@example.com", "John Doe")
"""

from app.services.email.provider import (
    EmailProvider,
    MockEmailProvider,
    SMTPEmailProvider,
    get_email_provider,
    send_otp_email,
    send_welcome_email,
    send_deal_status_email,
    send_document_ready_email,
    send_payment_received_email,
    send_password_reset_email,
)

__all__ = [
    "EmailProvider",
    "MockEmailProvider",
    "SMTPEmailProvider",
    "get_email_provider",
    "send_otp_email",
    "send_welcome_email",
    "send_deal_status_email",
    "send_document_ready_email",
    "send_payment_received_email",
    "send_password_reset_email",
]
