"""Notification service for sending SMS/email to clients

Supports both SMS (via SMS.RU) and Email (via SMTP/SendGrid).
By default, sends both when contact info is available.
"""

import logging
from typing import Optional
from app.services.sms.provider import get_sms_provider
from app.services.email.provider import (
    get_email_provider,
    send_bank_split_payment_link_email,
    send_bank_split_payment_received_email,
    send_bank_split_hold_released_email,
    send_bank_split_deal_cancelled_email,
    send_bank_split_invitation_email,
    send_bank_split_dispute_opened_email,
    send_bank_split_contract_ready_email,
    send_bank_split_contract_signed_email,
    send_npd_receipt_reminder_email,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications to clients via SMS and Email"""

    def __init__(self):
        self.sms = get_sms_provider()
        self.email = get_email_provider()

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

    async def send_service_confirmed(
        self,
        phone: str,
        address: Optional[str] = None,
        confirmed_by: Optional[str] = None,
    ) -> bool:
        """Notify about service completion confirmation"""
        short_address = address[:25] + "..." if address and len(address) > 25 else address
        confirmer = confirmed_by or "Исполнитель"

        message = f"Housler: {confirmer} подтвердил оказание услуги по сделке {short_address}."

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

    # ============================================
    # Combined SMS + Email notifications
    # ============================================

    async def notify_payment_link(
        self,
        phone: Optional[str],
        email: Optional[str],
        client_name: str,
        address: str,
        amount: float,
        payment_url: str,
    ) -> dict:
        """Send payment link via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_payment_link(phone, payment_url, address, amount)

        if email:
            try:
                result["email"] = await send_bank_split_payment_link_email(
                    email=email,
                    client_name=client_name,
                    address=address,
                    amount=amount,
                    payment_url=payment_url,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send payment link: {e}")

        return result

    async def notify_payment_received(
        self,
        phone: Optional[str],
        email: Optional[str],
        agent_name: str,
        client_name: str,
        address: str,
        amount: float,
        deal_id: str,
    ) -> dict:
        """Notify agent about payment received via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_payment_received(phone, client_name, address)

        if email:
            try:
                result["email"] = await send_bank_split_payment_received_email(
                    email=email,
                    agent_name=agent_name,
                    client_name=client_name,
                    address=address,
                    amount=amount,
                    deal_id=deal_id,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send payment received: {e}")

        return result

    async def notify_hold_released(
        self,
        phone: Optional[str],
        email: Optional[str],
        agent_name: str,
        address: str,
        amount: float,
    ) -> dict:
        """Notify agent about funds released via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_hold_released(phone, address, amount)

        if email:
            try:
                result["email"] = await send_bank_split_hold_released_email(
                    email=email,
                    agent_name=agent_name,
                    address=address,
                    amount=amount,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send hold released: {e}")

        return result

    async def notify_deal_cancelled(
        self,
        phone: Optional[str],
        email: Optional[str],
        recipient_name: str,
        address: str,
        reason: Optional[str] = None,
    ) -> dict:
        """Notify about deal cancellation via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_deal_cancelled(phone, address, reason)

        if email:
            try:
                result["email"] = await send_bank_split_deal_cancelled_email(
                    email=email,
                    recipient_name=recipient_name,
                    address=address,
                    reason=reason,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send deal cancelled: {e}")

        return result

    async def notify_invitation(
        self,
        phone: Optional[str],
        email: Optional[str],
        partner_name: str,
        inviter_name: str,
        address: str,
        split_percent: float,
        invite_url: str,
    ) -> dict:
        """Send invitation via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_invitation(phone, inviter_name, address, invite_url)

        if email:
            try:
                result["email"] = await send_bank_split_invitation_email(
                    email=email,
                    partner_name=partner_name,
                    inviter_name=inviter_name,
                    address=address,
                    split_percent=split_percent,
                    invite_url=invite_url,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send invitation: {e}")

        return result

    async def notify_dispute_opened(
        self,
        phone: Optional[str],
        email: Optional[str],
        recipient_name: str,
        address: str,
        dispute_reason: str,
        deal_id: str,
    ) -> dict:
        """Notify about dispute opened via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_dispute_opened(phone, address, recipient_name)

        if email:
            try:
                result["email"] = await send_bank_split_dispute_opened_email(
                    email=email,
                    recipient_name=recipient_name,
                    address=address,
                    dispute_reason=dispute_reason,
                    deal_id=deal_id,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send dispute opened: {e}")

        return result

    async def notify_contract_ready(
        self,
        phone: Optional[str],
        email: Optional[str],
        recipient_name: str,
        address: str,
        contract_number: str,
        deal_id: str,
        sign_url: str,
    ) -> dict:
        """Notify about contract ready for signing via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_bank_split_awaiting_signature(phone, address, sign_url)

        if email:
            try:
                result["email"] = await send_bank_split_contract_ready_email(
                    email=email,
                    recipient_name=recipient_name,
                    contract_number=contract_number,
                    deal_id=deal_id,
                    sign_url=sign_url,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send contract ready: {e}")

        return result

    async def notify_contract_signed(
        self,
        email: Optional[str],
        recipient_name: str,
        contract_number: str,
    ) -> dict:
        """Notify about contract signed via Email only"""
        result = {"email": False}

        if email:
            try:
                result["email"] = await send_bank_split_contract_signed_email(
                    email=email,
                    recipient_name=recipient_name,
                    contract_number=contract_number,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send contract signed: {e}")

        return result

    # ============================================
    # NPD Receipt Notifications (TASK-3.3)
    # ============================================

    async def send_npd_receipt_reminder_sms(
        self,
        phone: str,
        amount: float,
        reminder_number: int = 1,
    ) -> bool:
        """Send NPD receipt reminder via SMS"""
        amount_str = f"{amount:,.0f}".replace(",", " ")

        if reminder_number == 1:
            message = f"Housler: сформируйте чек НПД на сумму {amount_str} руб. в приложении Мой налог. Загрузите данные чека в личном кабинете."
        elif reminder_number == 2:
            message = f"Housler: напоминаем о необходимости сформировать чек НПД на {amount_str} руб. Срок истекает через 4 дня."
        else:
            message = f"Housler: СРОЧНО! Чек НПД на {amount_str} руб. просрочен. Сформируйте чек в приложении Мой налог."

        try:
            await self.sms.send(phone, message)
            return True
        except Exception as e:
            logger.error(f"[SMS] Failed to send NPD reminder: {e}")
            return False

    async def notify_npd_receipt_reminder(
        self,
        phone: Optional[str],
        email: Optional[str],
        recipient_name: str,
        deal_address: str,
        amount: float,
        receipt_id: str,
        reminder_number: int = 1,
    ) -> dict:
        """Send NPD receipt reminder via SMS and Email"""
        result = {"sms": False, "email": False}

        if phone:
            result["sms"] = await self.send_npd_receipt_reminder_sms(
                phone, amount, reminder_number
            )

        if email:
            try:
                result["email"] = await send_npd_receipt_reminder_email(
                    email=email,
                    recipient_name=recipient_name,
                    deal_address=deal_address,
                    amount=amount,
                    receipt_id=receipt_id,
                    reminder_number=reminder_number,
                )
            except Exception as e:
                logger.error(f"[Email] Failed to send NPD reminder: {e}")

        return result


# Singleton instance
notification_service = NotificationService()


async def notify_deal_status_change(
    deal_id: str,
    old_status: str,
    new_status: str,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: str = "",
    **kwargs,
) -> dict:
    """Convenience function to send status change notifications via SMS and Email

    Args:
        deal_id: Deal UUID
        old_status: Previous status
        new_status: New status
        phone: Phone number for SMS (optional)
        email: Email address (optional)
        address: Property address
        **kwargs: Additional data (client_name, agent_name, amount, etc.)

    Returns:
        dict with "sms" and "email" boolean results
    """
    service = notification_service
    result = {"sms": False, "email": False}

    recipient_name = kwargs.get("recipient_name") or kwargs.get("client_name") or "Клиент"
    agent_name = kwargs.get("agent_name", "Агент")
    client_name = kwargs.get("client_name", "Клиент")
    amount = kwargs.get("amount", 0)

    if new_status == "awaiting_signatures":
        sign_url = kwargs.get("sign_url", f"{settings.FRONTEND_URL}/sign/{deal_id}")
        contract_number = kwargs.get("contract_number", f"BS-{deal_id[:8].upper()}")

        if phone:
            result["sms"] = await service.send_bank_split_awaiting_signature(phone, address, sign_url)

        if email:
            combined = await service.notify_contract_ready(
                phone=None,
                email=email,
                recipient_name=recipient_name,
                address=address,
                contract_number=contract_number,
                deal_id=deal_id,
                sign_url=sign_url,
            )
            result["email"] = combined.get("email", False)

    elif new_status == "payment_pending":
        payment_url = kwargs.get("payment_url", f"{settings.FRONTEND_URL}/pay/{deal_id}")
        combined = await service.notify_payment_link(
            phone=phone,
            email=email,
            client_name=client_name,
            address=address,
            amount=amount,
            payment_url=payment_url,
        )
        result = combined

    elif new_status == "hold_period":
        combined = await service.notify_payment_received(
            phone=phone,
            email=email,
            agent_name=agent_name,
            client_name=client_name,
            address=address,
            amount=amount,
            deal_id=deal_id,
        )
        result = combined

    elif new_status == "payout_ready" or new_status == "closed":
        combined = await service.notify_hold_released(
            phone=phone,
            email=email,
            agent_name=agent_name,
            address=address,
            amount=amount,
        )
        result = combined

    elif new_status == "cancelled":
        reason = kwargs.get("reason")
        combined = await service.notify_deal_cancelled(
            phone=phone,
            email=email,
            recipient_name=recipient_name,
            address=address,
            reason=reason,
        )
        result = combined

    elif new_status == "dispute":
        dispute_reason = kwargs.get("dispute_reason", "Не указана")
        combined = await service.notify_dispute_opened(
            phone=phone,
            email=email,
            recipient_name=recipient_name,
            address=address,
            dispute_reason=dispute_reason,
            deal_id=deal_id,
        )
        result = combined

    elif new_status == "refunded":
        if phone:
            result["sms"] = await service.send_refund_completed(phone, address, amount)

    elif new_status == "payment_failed":
        payment_url = kwargs.get("payment_url", f"{settings.FRONTEND_URL}/pay/{deal_id}")
        if phone:
            result["sms"] = await service.send_payment_failed(phone, address, payment_url)

    return result


async def notify_dispute_resolved(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    address: str = "",
    resolution: str = "",
    recipient_name: str = "Участник",
) -> dict:
    """Convenience function for dispute resolution notifications"""
    result = {"sms": False, "email": False}

    if phone:
        result["sms"] = await notification_service.send_dispute_resolved(phone, address, resolution)

    # Email for dispute resolution can be added when template is available

    return result


async def notify_invitation(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    partner_name: str = "Партнёр",
    inviter_name: str = "Агент",
    address: str = "",
    split_percent: float = 0,
    invite_url: str = "",
) -> dict:
    """Send invitation notification via SMS and Email"""
    return await notification_service.notify_invitation(
        phone=phone,
        email=email,
        partner_name=partner_name,
        inviter_name=inviter_name,
        address=address,
        split_percent=split_percent,
        invite_url=invite_url,
    )


# ============================================
# NPD Receipt Notifications (TASK-3.3)
# ============================================


async def notify_npd_receipt_reminder(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    recipient_name: str = "Исполнитель",
    deal_address: str = "",
    amount: float = 0,
    receipt_id: str = "",
    reminder_number: int = 1,
) -> dict:
    """Send NPD receipt reminder notification via SMS and Email"""
    return await notification_service.notify_npd_receipt_reminder(
        phone=phone,
        email=email,
        recipient_name=recipient_name,
        deal_address=deal_address,
        amount=amount,
        receipt_id=receipt_id,
        reminder_number=reminder_number,
    )
