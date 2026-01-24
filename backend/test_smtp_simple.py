#!/usr/bin/env python3
"""Simple SMTP test without app dependencies"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

# Yandex 360 SMTP settings
SMTP_HOST = "smtp.yandex.ru"
SMTP_PORT = 465  # SSL port
SMTP_USER = "hello@housler.ru"  # Yandex email
SMTP_PASSWORD = ""  # SET THIS - app password from Yandex
FROM_EMAIL = "hello@housler.ru"
FROM_NAME = "Housler"

# Target email
TO_EMAIL = "niktitatitov070@gmail.com"


def send_test_email():
    """Send test email via SMTP"""

    if not SMTP_PASSWORD:
        print("ERROR: SMTP_PASSWORD is not set!")
        print("\nTo test email, you need to:")
        print("1. Go to Yandex 360 mail settings")
        print("2. Create an app password")
        print("3. Set SMTP_PASSWORD in this script")
        print("\nAlternatively, update EMAIL_PROVIDER and SMTP settings in .env")
        return False

    print(f"Connecting to {SMTP_HOST}:{SMTP_PORT}...")
    print(f"User: {SMTP_USER}")
    print(f"To: {TO_EMAIL}")

    # Create message
    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((FROM_NAME, FROM_EMAIL))
    msg["To"] = TO_EMAIL
    msg["Subject"] = "Test from Housler LK"

    html = """
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2>Test Email from Housler LK</h2>
        <p>If you see this message, email delivery is working!</p>
        <p style="color: gray;">This is an automated test.</p>
    </body>
    </html>
    """

    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        # Create SSL context
        context = ssl.create_default_context()

        # Connect with SSL (port 465)
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as server:
            print("Connected!")

            # Login
            print("Logging in...")
            server.login(SMTP_USER, SMTP_PASSWORD)
            print("Logged in!")

            # Send
            print("Sending email...")
            server.send_message(msg)
            print("Email sent successfully!")

        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"Authentication error: {e}")
        print("\nMake sure you are using an APP PASSWORD, not your main password!")
        return False

    except smtplib.SMTPRecipientsRefused as e:
        print(f"Recipient refused: {e}")
        return False

    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    print("="*60)
    print("Simple SMTP Test")
    print("="*60)
    send_test_email()
