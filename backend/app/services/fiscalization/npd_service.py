"""NPD Receipt Tracking Service for self-employed (samozanyatye).

TASK-3.3: NPD Receipt Tracking

This service handles:
- Creating pending NPD receipts when deals are released to self-employed
- Tracking receipt upload status
- Sending reminders to upload receipts
- Escalating overdue receipts to admin

NPD (Nalog na Professionalnyj Dohod) receipts are created by self-employed
persons through the "Moy Nalog" app. This service tracks whether they have
uploaded the receipt information after receiving payment.

Reminder Schedule:
- First reminder: 24 hours after release
- Second reminder: 72 hours after release
- Admin escalation: 7 days after release (overdue)
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.deal import Deal
from app.models.fiscalization import (
    FiscalReceipt,
    FiscalReceiptType,
    FiscalReceiptStatus,
    NPDReceiptSource,
)
from app.models.payment_profile import FiscalizationMethod, LegalType
from app.services.notification.service import notification_service

logger = logging.getLogger(__name__)


# Reminder schedule (hours after release)
FIRST_REMINDER_HOURS = 24
SECOND_REMINDER_HOURS = 72
ESCALATION_DAYS = 7
RECEIPT_DEADLINE_DAYS = 7


class NPDReceiptService:
    """Service for tracking NPD receipts from self-employed persons.

    Usage:
        service = NPDReceiptService(db)

        # Create pending receipt after release
        receipt = await service.create_pending_receipt(deal_id, recipient_id, amount)

        # User uploads receipt data
        await service.mark_receipt_uploaded(receipt_id, receipt_number, receipt_url)

        # Get pending receipts for user
        pending = await service.get_pending_receipts(user_id)

        # Background task: check and send reminders
        await service.check_overdue_receipts()
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_pending_receipt(
        self,
        deal_id: UUID,
        recipient_id: int,
        amount: int,  # Amount in kopeks
        recipient_name: Optional[str] = None,
        deal_address: Optional[str] = None,
    ) -> FiscalReceipt:
        """Create a pending NPD receipt for a self-employed recipient.

        Called when a bank-split deal releases funds to a self-employed person.
        The receipt will be in AWAITING_UPLOAD status until the user uploads
        receipt data from the "Moy Nalog" app.

        Args:
            deal_id: UUID of the deal
            recipient_id: User ID of the self-employed recipient
            amount: Payment amount in kopeks
            recipient_name: Optional name for notifications
            deal_address: Optional address for notifications

        Returns:
            Created FiscalReceipt instance
        """
        now = datetime.utcnow()
        deadline = now + timedelta(days=RECEIPT_DEADLINE_DAYS)
        first_reminder = now + timedelta(hours=FIRST_REMINDER_HOURS)

        # Check if receipt already exists
        existing = await self._get_existing_npd_receipt(deal_id, recipient_id)
        if existing:
            logger.info(f"NPD receipt already exists for deal {deal_id}, recipient {recipient_id}")
            return existing

        receipt = FiscalReceipt(
            deal_id=deal_id,
            recipient_id=recipient_id,
            type=FiscalReceiptType.INCOME.value,
            amount=amount,
            status=FiscalReceiptStatus.AWAITING_UPLOAD.value,
            fiscalization_method=FiscalizationMethod.NPD_RECEIPT.value,
            receipt_deadline=deadline,
            next_reminder_at=first_reminder,
            reminder_count=0,
            meta={
                "recipient_name": recipient_name,
                "deal_address": deal_address,
                "created_reason": "bank_split_release",
            },
        )

        self.db.add(receipt)
        await self.db.flush()

        logger.info(
            f"Created NPD receipt {receipt.id} for deal {deal_id}, "
            f"recipient {recipient_id}, amount {amount/100:.2f} RUB, "
            f"deadline: {deadline.isoformat()}"
        )

        return receipt

    async def mark_receipt_uploaded(
        self,
        receipt_id: UUID,
        receipt_number: str,
        receipt_url: Optional[str] = None,
        source: NPDReceiptSource = NPDReceiptSource.MY_NALOG_APP,
    ) -> FiscalReceipt:
        """Mark NPD receipt as uploaded by the user.

        Called when the self-employed person uploads their receipt data
        from the "Moy Nalog" app.

        Args:
            receipt_id: Receipt UUID
            receipt_number: Receipt number from "Moy Nalog" (format varies)
            receipt_url: Optional URL to view receipt
            source: How the receipt was uploaded

        Returns:
            Updated FiscalReceipt

        Raises:
            ValueError: If receipt not found or wrong status
        """
        receipt = await self.get_receipt(receipt_id)
        if not receipt:
            raise ValueError(f"Receipt not found: {receipt_id}")

        if receipt.status not in (
            FiscalReceiptStatus.AWAITING_UPLOAD.value,
            FiscalReceiptStatus.OVERDUE.value,
        ):
            raise ValueError(f"Cannot upload to receipt in status: {receipt.status}")

        now = datetime.utcnow()

        receipt.status = FiscalReceiptStatus.UPLOADED.value
        receipt.npd_receipt_number = receipt_number
        receipt.receipt_url = receipt_url
        receipt.npd_source = source.value
        receipt.npd_uploaded_at = now
        receipt.confirmed_at = now
        receipt.next_reminder_at = None  # No more reminders needed

        await self.db.flush()

        logger.info(
            f"NPD receipt {receipt_id} marked as uploaded, "
            f"number: {receipt_number}, source: {source.value}"
        )

        return receipt

    async def get_pending_receipts(self, user_id: int) -> List[FiscalReceipt]:
        """Get all pending NPD receipts for a user.

        Returns receipts that need the user to upload receipt data.

        Args:
            user_id: User ID (recipient)

        Returns:
            List of pending FiscalReceipt instances
        """
        stmt = (
            select(FiscalReceipt)
            .options(joinedload(FiscalReceipt.deal))
            .where(
                FiscalReceipt.recipient_id == user_id,
                FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
                FiscalReceipt.status.in_([
                    FiscalReceiptStatus.AWAITING_UPLOAD.value,
                    FiscalReceiptStatus.OVERDUE.value,
                ]),
            )
            .order_by(FiscalReceipt.created_at.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_overdue_receipts(self) -> List[FiscalReceipt]:
        """Get all overdue NPD receipts (for admin view).

        Returns receipts where the deadline has passed but no receipt uploaded.

        Returns:
            List of overdue FiscalReceipt instances
        """
        now = datetime.utcnow()

        stmt = (
            select(FiscalReceipt)
            .options(
                joinedload(FiscalReceipt.deal),
                joinedload(FiscalReceipt.recipient),
            )
            .where(
                FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
                FiscalReceipt.status.in_([
                    FiscalReceiptStatus.AWAITING_UPLOAD.value,
                    FiscalReceiptStatus.OVERDUE.value,
                ]),
                FiscalReceipt.receipt_deadline < now,
            )
            .order_by(FiscalReceipt.receipt_deadline.asc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def send_reminder(self, receipt_id: UUID) -> bool:
        """Send a reminder notification for an NPD receipt.

        Args:
            receipt_id: Receipt UUID

        Returns:
            True if reminder was sent
        """
        receipt = await self.get_receipt(receipt_id)
        if not receipt:
            logger.warning(f"Receipt not found for reminder: {receipt_id}")
            return False

        if receipt.status not in (
            FiscalReceiptStatus.AWAITING_UPLOAD.value,
            FiscalReceiptStatus.OVERDUE.value,
        ):
            logger.debug(f"Receipt {receipt_id} not in reminder-eligible status")
            return False

        # Get recipient info
        recipient = receipt.recipient
        if not recipient:
            logger.warning(f"Recipient not found for receipt {receipt_id}")
            return False

        # Prepare notification data
        meta = receipt.meta or {}
        deal_address = meta.get("deal_address", "")
        amount_rub = receipt.amount / 100

        now = datetime.utcnow()
        receipt.reminder_count += 1

        if receipt.first_reminder_at is None:
            receipt.first_reminder_at = now

        receipt.last_reminder_at = now

        # Calculate next reminder
        if receipt.reminder_count == 1:
            # After first reminder, schedule second
            receipt.next_reminder_at = now + timedelta(hours=SECOND_REMINDER_HOURS - FIRST_REMINDER_HOURS)
        elif receipt.reminder_count == 2:
            # After second reminder, escalation at deadline
            receipt.next_reminder_at = receipt.receipt_deadline
        else:
            # No more scheduled reminders
            receipt.next_reminder_at = None

        await self.db.flush()

        # Send notification
        phone = getattr(recipient, "phone", None)
        email = getattr(recipient, "email", None)
        recipient_name = getattr(recipient, "name", None) or "Исполнитель"

        result = await notification_service.notify_npd_receipt_reminder(
            phone=phone,
            email=email,
            recipient_name=recipient_name,
            deal_address=deal_address,
            amount=amount_rub,
            receipt_id=str(receipt_id),
            reminder_number=receipt.reminder_count,
        )

        logger.info(
            f"Sent NPD reminder #{receipt.reminder_count} for receipt {receipt_id}, "
            f"SMS: {result.get('sms')}, Email: {result.get('email')}"
        )

        return True

    async def check_overdue_receipts(self) -> dict:
        """Background task: check for overdue receipts and send reminders.

        This should be called periodically (e.g., every hour) to:
        1. Mark receipts as overdue if deadline passed
        2. Send scheduled reminders
        3. Escalate to admin after deadline

        Returns:
            Dict with counts: reminders_sent, marked_overdue, escalated
        """
        now = datetime.utcnow()
        stats = {
            "reminders_sent": 0,
            "marked_overdue": 0,
            "escalated": 0,
        }

        # 1. Find receipts due for reminder
        stmt = select(FiscalReceipt).where(
            FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
            FiscalReceipt.status == FiscalReceiptStatus.AWAITING_UPLOAD.value,
            FiscalReceipt.next_reminder_at <= now,
            FiscalReceipt.next_reminder_at.isnot(None),
        )

        result = await self.db.execute(stmt)
        due_for_reminder = list(result.scalars().all())

        for receipt in due_for_reminder:
            try:
                if await self.send_reminder(receipt.id):
                    stats["reminders_sent"] += 1
            except Exception as e:
                logger.error(f"Failed to send reminder for {receipt.id}: {e}")

        # 2. Mark overdue receipts
        stmt = select(FiscalReceipt).where(
            FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
            FiscalReceipt.status == FiscalReceiptStatus.AWAITING_UPLOAD.value,
            FiscalReceipt.receipt_deadline <= now,
        )

        result = await self.db.execute(stmt)
        past_deadline = list(result.scalars().all())

        for receipt in past_deadline:
            receipt.status = FiscalReceiptStatus.OVERDUE.value
            stats["marked_overdue"] += 1

            # Escalate to admin if not already escalated
            if not receipt.escalated_at:
                receipt.escalated_at = now
                stats["escalated"] += 1

                # Send admin notification
                await self._notify_admin_escalation(receipt)

        await self.db.flush()

        if any(stats.values()):
            logger.info(
                f"NPD receipt check complete: "
                f"reminders={stats['reminders_sent']}, "
                f"overdue={stats['marked_overdue']}, "
                f"escalated={stats['escalated']}"
            )

        return stats

    async def get_receipt(self, receipt_id: UUID) -> Optional[FiscalReceipt]:
        """Get receipt by ID with relationships loaded.

        Args:
            receipt_id: Receipt UUID

        Returns:
            FiscalReceipt if found
        """
        stmt = (
            select(FiscalReceipt)
            .options(
                joinedload(FiscalReceipt.deal),
                joinedload(FiscalReceipt.recipient),
            )
            .where(FiscalReceipt.id == receipt_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_receipts_for_deal(
        self,
        deal_id: UUID,
        method: Optional[str] = None,
    ) -> List[FiscalReceipt]:
        """Get all fiscal receipts for a deal.

        Args:
            deal_id: Deal UUID
            method: Optional filter by fiscalization method

        Returns:
            List of FiscalReceipt instances
        """
        stmt = select(FiscalReceipt).where(FiscalReceipt.deal_id == deal_id)

        if method:
            stmt = stmt.where(FiscalReceipt.fiscalization_method == method)

        stmt = stmt.order_by(FiscalReceipt.created_at.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_user_receipt_stats(self, user_id: int) -> dict:
        """Get receipt statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Dict with counts by status
        """
        from sqlalchemy import func

        stmt = (
            select(
                FiscalReceipt.status,
                func.count(FiscalReceipt.id).label("count"),
            )
            .where(
                FiscalReceipt.recipient_id == user_id,
                FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
            )
            .group_by(FiscalReceipt.status)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        return {
            "pending": sum(r.count for r in rows if r.status in (
                FiscalReceiptStatus.AWAITING_UPLOAD.value,
                FiscalReceiptStatus.OVERDUE.value,
            )),
            "uploaded": sum(r.count for r in rows if r.status == FiscalReceiptStatus.UPLOADED.value),
            "total": sum(r.count for r in rows),
        }

    async def _get_existing_npd_receipt(
        self,
        deal_id: UUID,
        recipient_id: int,
    ) -> Optional[FiscalReceipt]:
        """Check if NPD receipt already exists for deal and recipient.

        Args:
            deal_id: Deal UUID
            recipient_id: User ID

        Returns:
            FiscalReceipt if exists
        """
        stmt = select(FiscalReceipt).where(
            FiscalReceipt.deal_id == deal_id,
            FiscalReceipt.recipient_id == recipient_id,
            FiscalReceipt.fiscalization_method == FiscalizationMethod.NPD_RECEIPT.value,
            FiscalReceipt.type == FiscalReceiptType.INCOME.value,
        )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _notify_admin_escalation(self, receipt: FiscalReceipt) -> None:
        """Send escalation notification to admin.

        Args:
            receipt: The overdue receipt
        """
        meta = receipt.meta or {}
        deal_address = meta.get("deal_address", "N/A")
        recipient_name = meta.get("recipient_name", "N/A")
        amount_rub = receipt.amount / 100

        logger.warning(
            f"NPD receipt escalation: receipt={receipt.id}, "
            f"deal={receipt.deal_id}, recipient={receipt.recipient_id}, "
            f"amount={amount_rub} RUB, deadline={receipt.receipt_deadline}"
        )

        # TODO: Send admin notification via email/Slack
        # For now, just log the escalation
