#!/usr/bin/env python3
"""Manual email test script"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.services.email.provider import (
    get_email_provider,
    SMTPEmailProvider,
    send_otp_email,
)


async def test_current_provider():
    """Test with current configured provider"""
    print(f"\n{'='*60}")
    print(f"EMAIL_PROVIDER: {getattr(settings, 'EMAIL_PROVIDER', 'mock')}")
    print(f"SMTP_HOST: {settings.SMTP_HOST}")
    print(f"SMTP_PORT: {settings.SMTP_PORT}")
    print(f"SMTP_USER: {settings.SMTP_USER}")
    print(f"SMTP_FROM_EMAIL: {settings.SMTP_FROM_EMAIL}")
    print(f"SMTP_PASSWORD set: {'Yes' if settings.SMTP_PASSWORD else 'No'}")
    print(f"{'='*60}\n")

    provider = get_email_provider()
    print(f"Provider class: {provider.__class__.__name__}")

    # Test email
    to_email = "niktitatitov070@gmail.com"
    result = await send_otp_email(to_email, "123456")
    print(f"\nSend result: {result}")


async def test_smtp_direct():
    """Test SMTP directly with Yandex"""
    print("\n--- Testing SMTP directly ---")

    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD

    if not smtp_password:
        print("ERROR: SMTP_PASSWORD is not set!")
        print("Please set SMTP_PASSWORD in .env to test SMTP")
        return False

    provider = SMTPEmailProvider(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        from_email=settings.SMTP_FROM_EMAIL,
        from_name=settings.SMTP_FROM_NAME,
        use_ssl=settings.SMTP_USE_SSL,
        use_tls=settings.SMTP_USE_TLS,
    )

    to_email = "niktitatitov070@gmail.com"
    subject = "Test from Housler LK"
    body = """
    <h2>Test Email</h2>
    <p>This is a test email from Housler LK backend.</p>
    <p>If you see this, SMTP is working!</p>
    """

    print(f"Sending to: {to_email}")
    print(f"SMTP: {smtp_host}:{smtp_port}")
    print(f"SSL: {settings.SMTP_USE_SSL}, TLS: {settings.SMTP_USE_TLS}")

    try:
        result = await provider.send(to_email, subject, body, html=True)
        print(f"Result: {result}")
        return result
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    print("Testing email functionality...")

    # Run test with current provider
    asyncio.run(test_current_provider())

    # Try SMTP directly
    asyncio.run(test_smtp_direct())
