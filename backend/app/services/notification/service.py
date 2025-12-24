"""Notification service for sending SMS/email to clients"""

from typing import Optional
from app.services.sms.provider import get_sms_provider
from app.core.config import settings


class NotificationService:
    """Service for sending notifications to clients"""

    def __init__(self):
        self.sms = get_sms_provider()

    async def send_signing_link(
        self,
        phone: str,
        signing_url: str,
        client_name: Optional[str] = None
    ) -> bool:
        """Send SMS with signing link to client"""
        # Truncate URL for SMS
        short_name = client_name.split()[0] if client_name else "клиент"

        message = (
            f"{short_name}, подпишите договор с {settings.COMPANY_NAME}: "
            f"{signing_url}"
        )

        try:
            await self.sms.send(phone, message)
            return True
        except Exception as e:
            print(f"[Notification] Failed to send SMS to {phone}: {e}")
            return False

    async def send_deal_created(
        self,
        phone: str,
        client_name: Optional[str] = None,
        deal_address: Optional[str] = None
    ) -> bool:
        """Notify client about new deal"""
        short_name = client_name.split()[0] if client_name else "клиент"

        message = (
            f"{short_name}, создана сделка по адресу {deal_address}. "
            f"Ожидайте ссылку для подписания договора."
        )

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_document_signed(
        self,
        phone: str,
        client_name: Optional[str] = None
    ) -> bool:
        """Notify client that document was signed"""
        short_name = client_name.split()[0] if client_name else "клиент"

        message = (
            f"{short_name}, договор успешно подписан. "
            f"Спасибо за доверие! {settings.COMPANY_NAME}"
        )

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False
