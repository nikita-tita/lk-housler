"""Notification service for sending SMS/email to clients"""

from typing import Optional
from app.services.sms.provider import get_sms_provider
from app.core.config import settings


class NotificationService:
    """Service for sending notifications to clients"""

    def __init__(self):
        self.sms = get_sms_provider()

    async def send_signing_link(self, phone: str, signing_url: str, client_name: Optional[str] = None) -> bool:
        """Send SMS with signing link to client"""
        # Truncate URL for SMS
        short_name = client_name.split()[0] if client_name else "клиент"

        message = f"{short_name}, подпишите договор с {settings.COMPANY_NAME}: " f"{signing_url}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception as e:
            print(f"[Notification] Failed to send SMS to {phone}: {e}")
            return False

    async def send_deal_created(
        self, phone: str, client_name: Optional[str] = None, deal_address: Optional[str] = None
    ) -> bool:
        """Notify client about new deal"""
        short_name = client_name.split()[0] if client_name else "клиент"

        message = f"{short_name}, создана сделка по адресу {deal_address}. " f"Ожидайте ссылку для подписания договора."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_document_signed(self, phone: str, client_name: Optional[str] = None) -> bool:
        """Notify client that document was signed"""
        short_name = client_name.split()[0] if client_name else "клиент"

        message = f"{short_name}, договор успешно подписан. " f"Спасибо за доверие! {settings.COMPANY_NAME}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    # ============================================
    # Bank-Split notifications
    # ============================================

    async def send_bank_split_payment_link(
        self,
        phone: str,
        payment_url: str,
        address: str,
        amount: float,
    ) -> bool:
        """Send payment link to client"""
        short_address = address[:30] + "..." if len(address) > 30 else address
        amount_str = f"{amount:,.0f}".replace(",", " ")

        message = f"Housler: оплатите комиссию {amount_str} руб. по сделке {short_address}. Ссылка: {payment_url}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_payment_received(
        self,
        phone: str,
        client_name: Optional[str] = None,
        address: Optional[str] = None,
    ) -> bool:
        """Notify agent about payment received"""
        short_name = client_name.split()[0] if client_name else "Клиент"
        short_address = address[:25] + "..." if address and len(address) > 25 else address

        message = f"Housler: {short_name} оплатил комиссию по сделке {short_address}. Средства на удержании."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_hold_released(
        self,
        phone: str,
        address: Optional[str] = None,
        amount: Optional[float] = None,
    ) -> bool:
        """Notify agent about funds released from hold"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address
        amount_str = f"{amount:,.0f}".replace(",", " ") if amount else ""

        message = f"Housler: средства {amount_str} руб. по сделке {short_address} выплачены на ваш счёт."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_deal_cancelled(
        self,
        phone: str,
        address: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> bool:
        """Notify about deal cancellation"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address

        message = f"Housler: сделка по адресу {short_address} отменена."
        if reason:
            message += f" Причина: {reason[:50]}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_invitation(
        self,
        phone: str,
        inviter_name: str,
        address: str,
        invite_url: str,
    ) -> bool:
        """Send invitation to partner"""
        short_address = address[:25] + "..." if len(address) > 25 else address

        message = f"Housler: {inviter_name} приглашает вас в сделку по адресу {short_address}. Подробности: {invite_url}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_invitation_accepted(
        self,
        phone: str,
        partner_name: str,
        address: str,
    ) -> bool:
        """Notify inviter that invitation was accepted"""
        short_address = address[:25] + "..." if len(address) > 25 else address

        message = f"Housler: {partner_name} принял приглашение в сделку по адресу {short_address}."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_bank_split_awaiting_signature(
        self,
        phone: str,
        address: str,
        sign_url: str,
    ) -> bool:
        """Notify about awaiting signature"""
        short_address = address[:25] + "..." if len(address) > 25 else address

        message = f"Housler: требуется ваша подпись по сделке {short_address}. Ссылка: {sign_url}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    # ============================================
    # Dispute notifications
    # ============================================

    async def send_dispute_opened(
        self,
        phone: str,
        address: Optional[str] = None,
        initiator_name: Optional[str] = None,
    ) -> bool:
        """Notify about dispute opened"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address
        initiator = initiator_name or "Участник"

        message = f"Housler: {initiator} открыл спор по сделке {short_address}. Выплата приостановлена до разрешения."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_dispute_resolved(
        self,
        phone: str,
        address: Optional[str] = None,
        resolution: Optional[str] = None,
    ) -> bool:
        """Notify about dispute resolution"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address

        resolution_text = {
            "full_refund": "полный возврат средств",
            "partial_refund": "частичный возврат",
            "no_refund": "без возврата, сделка продолжается",
            "split_adjustment": "изменение распределения комиссии",
        }.get(resolution, "разрешён")

        message = f"Housler: спор по сделке {short_address} разрешён: {resolution_text}."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_refund_completed(
        self,
        phone: str,
        address: Optional[str] = None,
        amount: Optional[float] = None,
    ) -> bool:
        """Notify about refund completed"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address
        amount_str = f"{amount:,.0f}".replace(",", " ") if amount else ""

        message = f"Housler: возврат {amount_str} руб. по сделке {short_address} выполнен. Средства вернутся в течение 3-5 дней."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False

    async def send_payment_failed(
        self,
        phone: str,
        address: Optional[str] = None,
        payment_url: Optional[str] = None,
    ) -> bool:
        """Notify about payment failure"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address

        message = f"Housler: оплата по сделке {short_address} не прошла."
        if payment_url:
            message += f" Попробуйте ещё раз: {payment_url}"

        try:
            await self.sms.send(phone, message)
            return True
        except Exception:
            return False


# Singleton instance
notification_service = NotificationService()


async def notify_deal_status_change(
    deal_id: str,
    old_status: str,
    new_status: str,
    phone: str,
    address: str,
    **kwargs,
) -> bool:
    """Convenience function to send status change notifications"""
    service = notification_service

    if new_status == "awaiting_signatures":
        sign_url = kwargs.get("sign_url", f"{settings.FRONTEND_URL}/sign/{deal_id}")
        return await service.send_bank_split_awaiting_signature(phone, address, sign_url)

    elif new_status == "payment_pending":
        payment_url = kwargs.get("payment_url", f"{settings.FRONTEND_URL}/pay/{deal_id}")
        amount = kwargs.get("amount", 0)
        return await service.send_bank_split_payment_link(phone, payment_url, address, amount)

    elif new_status == "hold_period":
        client_name = kwargs.get("client_name")
        return await service.send_bank_split_payment_received(phone, client_name, address)

    elif new_status == "payout_ready" or new_status == "closed":
        amount = kwargs.get("amount")
        return await service.send_bank_split_hold_released(phone, address, amount)

    elif new_status == "cancelled":
        reason = kwargs.get("reason")
        return await service.send_bank_split_deal_cancelled(phone, address, reason)

    elif new_status == "dispute":
        initiator_name = kwargs.get("initiator_name")
        return await service.send_dispute_opened(phone, address, initiator_name)

    elif new_status == "refunded":
        amount = kwargs.get("amount")
        return await service.send_refund_completed(phone, address, amount)

    elif new_status == "payment_failed":
        payment_url = kwargs.get("payment_url", f"{settings.FRONTEND_URL}/pay/{deal_id}")
        return await service.send_payment_failed(phone, address, payment_url)

    return False


async def notify_dispute_resolved(
    phone: str,
    address: str,
    resolution: str,
) -> bool:
    """Convenience function for dispute resolution notifications"""
    return await notification_service.send_dispute_resolved(phone, address, resolution)
