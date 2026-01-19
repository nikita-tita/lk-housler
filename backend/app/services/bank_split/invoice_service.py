"""Invoice service for T-Bank integration"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.deal import Deal
from app.models.bank_split import DealSplitRecipient, BankEvent, PayoutStatus
from app.integrations.tbank import get_tbank_deals_client, TBankError
from app.integrations.tbank.deals import TBankDeal, TBankDealSplit, DealStatus as TBankDealStatus

logger = logging.getLogger(__name__)


class InvoiceService:
    """
    Service for managing invoices via T-Bank API.

    Handles:
    - Creating payment deals in T-Bank
    - Generating payment links
    - Managing deal lifecycle
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._tbank_client = None

    @property
    def tbank_client(self):
        """Lazy load T-Bank client"""
        if self._tbank_client is None:
            self._tbank_client = get_tbank_deals_client()
        return self._tbank_client

    async def create_invoice(
        self,
        deal: Deal,
        recipients: List[DealSplitRecipient],
        customer_email: str = None,
        customer_phone: str = None,
        return_url: str = None,
    ) -> Deal:
        """
        Create invoice (payment deal) in T-Bank.

        Args:
            deal: Local deal object
            recipients: Split recipients with calculated amounts
            customer_email: Customer email for receipt
            customer_phone: Customer phone
            return_url: URL to redirect after payment

        Returns:
            Updated Deal with payment link
        """
        if deal.external_deal_id:
            logger.warning(f"Deal {deal.id} already has external_deal_id: {deal.external_deal_id}")

        # Calculate total amount in kopecks
        total_kopecks = sum(
            int(r.calculated_amount * 100) for r in recipients
        )

        # Prepare splits for T-Bank
        tbank_splits = []
        for r in recipients:
            if not r.external_recipient_id:
                logger.warning(f"Recipient {r.id} has no external_recipient_id, skipping")
                continue

            tbank_splits.append(TBankDealSplit(
                recipient_id=r.external_recipient_id,
                amount=int(r.calculated_amount * 100),  # Convert to kopecks
                description=f"{r.role}: {r.calculated_amount} RUB",
            ))

        if not tbank_splits:
            raise ValueError("No valid recipients with external IDs")

        # Create description
        description = deal.description or f"Deal {deal.id}"

        try:
            # Create deal in T-Bank
            tbank_deal = await self.tbank_client.create_deal(
                order_id=str(deal.id),
                amount=total_kopecks,
                description=description,
                splits=tbank_splits,
                customer_email=customer_email or deal.payer_email,
                customer_phone=customer_phone,
                return_url=return_url or f"{settings.FRONTEND_URL}/deals/{deal.id}/payment-complete",
                expire_minutes=60,
            )

            # Update local deal
            deal.external_deal_id = tbank_deal.deal_id
            deal.external_account_number = tbank_deal.account_number
            deal.payment_link_url = tbank_deal.payment_url
            deal.payment_qr_payload = tbank_deal.qr_code
            # Strip timezone for DB compatibility (TIMESTAMP WITHOUT TIME ZONE)
            if tbank_deal.expires_at:
                deal.expires_at = tbank_deal.expires_at.replace(tzinfo=None)
            deal.external_provider = "tbank"

            await self.db.flush()

            # Log event
            await self._log_bank_event(
                deal_id=deal.id,
                event_type="deal.created",
                payload={
                    "tbank_deal_id": tbank_deal.deal_id,
                    "account_number": tbank_deal.account_number,
                    "amount": total_kopecks,
                    "payment_url": tbank_deal.payment_url,
                },
            )

            logger.info(f"Created T-Bank deal {tbank_deal.deal_id} for deal {deal.id}")
            return deal

        except TBankError as e:
            logger.error(f"Failed to create T-Bank deal: {e}")
            await self._log_bank_event(
                deal_id=deal.id,
                event_type="deal.creation_failed",
                payload={"error": str(e), "code": e.code},
            )
            raise

    async def get_deal_status(self, deal: Deal) -> Optional[TBankDealStatus]:
        """Get current deal status from T-Bank"""
        if not deal.external_deal_id:
            return None

        try:
            status = await self.tbank_client.get_deal_status(deal.external_deal_id)
            return status
        except TBankError as e:
            logger.error(f"Failed to get T-Bank deal status: {e}")
            return None

    async def sync_deal_status(self, deal: Deal) -> Deal:
        """
        Sync local deal status with T-Bank.

        Returns:
            Updated Deal
        """
        if not deal.external_deal_id:
            return deal

        try:
            tbank_deal = await self.tbank_client.get_deal(deal.external_deal_id)

            # Map T-Bank status to local status
            old_status = deal.status

            if tbank_deal.status == TBankDealStatus.PAID:
                deal.status = "payment_pending"  # Will transition to hold
            elif tbank_deal.status == TBankDealStatus.HOLD:
                # Use timezone-naive datetime for DB compatibility
                deal.hold_expires_at = datetime.utcnow().replace(
                    second=0, microsecond=0
                )
                # Add hold period from settings
                from datetime import timedelta
                deal.hold_expires_at += timedelta(seconds=settings.TBANK_HOLD_PERIOD_SECONDS)
            elif tbank_deal.status == TBankDealStatus.COMPLETED:
                deal.status = "closed"
            elif tbank_deal.status == TBankDealStatus.CANCELLED:
                deal.status = "cancelled"
            elif tbank_deal.status == TBankDealStatus.REFUNDED:
                deal.status = "cancelled"

            if old_status != deal.status:
                logger.info(f"Deal {deal.id} status changed: {old_status} -> {deal.status}")
                await self._log_bank_event(
                    deal_id=deal.id,
                    event_type="deal.status_synced",
                    payload={
                        "old_status": old_status,
                        "new_status": deal.status,
                        "tbank_status": tbank_deal.status.value,
                    },
                )

            await self.db.flush()
            return deal

        except TBankError as e:
            logger.error(f"Failed to sync T-Bank deal status: {e}")
            return deal

    async def regenerate_payment_link(self, deal: Deal) -> str:
        """
        Regenerate payment link for existing deal.

        Returns:
            New payment URL
        """
        if not deal.external_deal_id:
            raise ValueError("Deal has no external_deal_id")

        try:
            new_url = await self.tbank_client.regenerate_payment_link(
                deal_id=deal.external_deal_id,
                expire_minutes=60,
            )

            deal.payment_link_url = new_url
            from datetime import timedelta
            # Use timezone-naive datetime for DB compatibility
            deal.expires_at = datetime.utcnow() + timedelta(minutes=60)

            await self.db.flush()

            logger.info(f"Regenerated payment link for deal {deal.id}")
            return new_url

        except TBankError as e:
            logger.error(f"Failed to regenerate payment link: {e}")
            raise

    async def cancel_deal(self, deal: Deal, reason: str = None) -> Deal:
        """
        Cancel deal in T-Bank and locally.

        Args:
            deal: Deal to cancel
            reason: Cancellation reason

        Returns:
            Updated Deal
        """
        if deal.external_deal_id:
            try:
                await self.tbank_client.cancel_deal(deal.external_deal_id, reason)

                await self._log_bank_event(
                    deal_id=deal.id,
                    event_type="deal.cancelled",
                    payload={"reason": reason},
                )

            except TBankError as e:
                logger.error(f"Failed to cancel T-Bank deal: {e}")
                # Continue with local cancellation even if T-Bank fails

        deal.status = "cancelled"
        await self.db.flush()

        return deal

    async def release_deal(self, deal: Deal) -> Deal:
        """
        Release deal from hold (early release).

        TASK-3.2: Creates fiscal receipt when releasing if fiscalization_method == tbank_checks

        Args:
            deal: Deal to release

        Returns:
            Updated Deal

        Raises:
            ValueError: If deal has no external_deal_id or is locked by dispute
        """
        if not deal.external_deal_id:
            raise ValueError("Deal has no external_deal_id")

        # TASK-2.3: Check dispute lock
        if deal.dispute_locked:
            raise ValueError(
                f"Cannot release: dispute in progress. Reason: {deal.dispute_lock_reason}"
            )

        try:
            await self.tbank_client.release_deal(deal.external_deal_id)

            deal.status = "closed"
            deal.hold_expires_at = None
            deal.bank_released_at = datetime.utcnow()  # TASK-3.2: Track release time

            # Mark recipients as released
            recipients = await self._get_deal_recipients(deal.id)
            for r in recipients:
                r.payout_status = PayoutStatus.RELEASED.value
                r.paid_at = datetime.utcnow()

            await self._log_bank_event(
                deal_id=deal.id,
                event_type="deal.released",
                payload={"manual": True},
            )

            await self.db.flush()
            logger.info(f"Released deal {deal.id}")

            # TASK-3.2: Create fiscal receipt after release
            await self._create_fiscal_receipt(deal)

            return deal

        except TBankError as e:
            logger.error(f"Failed to release T-Bank deal: {e}")
            raise

    async def _create_fiscal_receipt(self, deal: Deal) -> None:
        """Create fiscal receipt for released deal.

        TASK-3.2: T-Bank Checks Integration

        Args:
            deal: The released deal
        """
        try:
            from app.services.fiscalization import FiscalReceiptService

            receipt_service = FiscalReceiptService(self.db)
            receipt = await receipt_service.create_receipt_for_deal(deal)

            if receipt:
                logger.info(
                    f"Created fiscal receipt {receipt.id} for deal {deal.id}, "
                    f"status: {receipt.status}"
                )
            else:
                logger.debug(f"No fiscal receipt needed for deal {deal.id}")

        except Exception as e:
            # Log error but don't fail the release
            # Receipt can be retried later
            logger.error(f"Failed to create fiscal receipt for deal {deal.id}: {e}")

    async def _get_deal_recipients(self, deal_id: UUID) -> List[DealSplitRecipient]:
        """Get split recipients for deal"""
        stmt = select(DealSplitRecipient).where(DealSplitRecipient.deal_id == deal_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _log_bank_event(
        self,
        deal_id: UUID,
        event_type: str,
        payload: dict,
    ) -> BankEvent:
        """Log bank event"""
        now = datetime.utcnow()
        event = BankEvent(
            deal_id=deal_id,
            provider="tbank",
            event_type=event_type,
            payload=payload,
            status="processed",
            received_at=now,
            processed_at=now,
        )
        self.db.add(event)
        await self.db.flush()
        return event
