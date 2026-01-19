"""Fiscal Receipt Service for automatic receipt generation.

TASK-3.2: T-Bank Checks Integration

This service handles:
- Creating fiscal receipts when deals are released
- Managing receipt status
- Handling refund receipts
- Webhook processing for receipt status updates
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.deal import Deal
from app.models.fiscalization import FiscalReceipt, FiscalReceiptType, FiscalReceiptStatus
from app.models.payment_profile import FiscalizationMethod, PaymentProfile
from app.services.fiscalization.tbank_checks import (
    TBankChecksClient,
    TBankChecksError,
    CreateReceiptRequest,
    ReceiptItem,
    ReceiptClient,
    ReceiptType as TBankReceiptType,
    PaymentMethod,
    PaymentObject,
    TaxSystem,
    VatType,
    TBankChecksReceiptStatus,
    get_tbank_checks_client,
)
from app.services.fiscalization.service import FiscalizationService

logger = logging.getLogger(__name__)


class FiscalReceiptService:
    """Service for managing fiscal receipts.

    Integrates with T-Bank Checks API to create fiscal receipts
    for bank-split deal releases.

    Usage:
        service = FiscalReceiptService(db)

        # Create receipt when releasing a deal
        receipt = await service.create_receipt_for_deal(deal)

        # Check receipt status
        await service.sync_receipt_status(receipt)

        # Create refund receipt
        refund_receipt = await service.create_refund_receipt(original_receipt, reason)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._tbank_client: Optional[TBankChecksClient] = None
        self._fiscalization_service: Optional[FiscalizationService] = None

    @property
    def tbank_client(self) -> TBankChecksClient:
        """Lazy load T-Bank Checks client"""
        if self._tbank_client is None:
            self._tbank_client = get_tbank_checks_client()
        return self._tbank_client

    @property
    def fiscalization_service(self) -> FiscalizationService:
        """Lazy load fiscalization service"""
        if self._fiscalization_service is None:
            self._fiscalization_service = FiscalizationService(self.db)
        return self._fiscalization_service

    async def should_create_receipt(self, deal: Deal) -> bool:
        """Check if a fiscal receipt should be created for this deal.

        Args:
            deal: The deal to check

        Returns:
            True if fiscalization is required and method is tbank_checks
        """
        # Check global feature flag
        if not settings.FISCALIZATION_ENABLED:
            logger.debug("Fiscalization disabled globally")
            return False

        # Only bank-split deals use T-Bank Checks
        if deal.payment_model != "bank_hold_split":
            logger.debug(f"Deal {deal.id} is not bank-split, skipping fiscalization")
            return False

        # Get fiscalization method for this deal
        method = await self.fiscalization_service.get_method_for_deal(deal)

        if method != FiscalizationMethod.TBANK_CHECKS:
            logger.debug(f"Deal {deal.id} fiscalization method is {method.value}, not tbank_checks")
            return False

        # Check amount threshold
        if deal.commission_agent:
            amount_kopeks = int(deal.commission_agent * 100)
            if amount_kopeks < settings.FISCALIZATION_REQUIRED_THRESHOLD:
                logger.debug(f"Deal {deal.id} amount {amount_kopeks} below threshold")
                return False

        return True

    async def create_receipt_for_deal(
        self,
        deal: Deal,
        receipt_type: FiscalReceiptType = FiscalReceiptType.INCOME,
    ) -> Optional[FiscalReceipt]:
        """Create a fiscal receipt for a deal.

        Called when:
        - A deal is released from hold (income receipt)
        - A refund is processed (income_return receipt)

        Args:
            deal: The deal to create receipt for
            receipt_type: Type of receipt to create

        Returns:
            FiscalReceipt if created, None if not required

        Raises:
            TBankChecksError: On API errors
        """
        # Check if we should create a receipt
        if not await self.should_create_receipt(deal):
            return None

        # Check if receipt already exists for this deal
        existing = await self._get_existing_receipt(deal.id, receipt_type)
        if existing and existing.status in (FiscalReceiptStatus.PENDING.value, FiscalReceiptStatus.CREATED.value):
            logger.info(f"Receipt already exists for deal {deal.id}: {existing.id}")
            return existing

        # Calculate amount in kopeks
        amount_kopeks = int(deal.commission_agent * 100) if deal.commission_agent else 0

        if amount_kopeks <= 0:
            logger.warning(f"Deal {deal.id} has zero or negative amount, skipping receipt")
            return None

        # Get client info
        client_email = deal.payer_email
        client_phone = deal.client_phone

        # Create receipt record
        fiscal_receipt = FiscalReceipt(
            deal_id=deal.id,
            type=receipt_type.value,
            amount=amount_kopeks,
            status=FiscalReceiptStatus.PENDING.value,
            client_email=client_email,
            client_phone=client_phone,
            meta={
                "deal_status": deal.status,
                "property_address": deal.property_address,
                "commission_agent": float(deal.commission_agent) if deal.commission_agent else None,
            },
        )

        self.db.add(fiscal_receipt)
        await self.db.flush()

        logger.info(
            f"Created fiscal receipt {fiscal_receipt.id} for deal {deal.id}, "
            f"type: {receipt_type.value}, amount: {amount_kopeks/100:.2f} RUB"
        )

        # Send to T-Bank
        try:
            await self._send_receipt_to_tbank(fiscal_receipt, deal)
        except TBankChecksError as e:
            logger.error(f"Failed to send receipt to T-Bank: {e}")
            fiscal_receipt.status = FiscalReceiptStatus.FAILED.value
            fiscal_receipt.error_code = e.code
            fiscal_receipt.error_message = str(e)

        await self.db.flush()
        return fiscal_receipt

    async def _send_receipt_to_tbank(
        self,
        fiscal_receipt: FiscalReceipt,
        deal: Deal,
    ) -> None:
        """Send receipt to T-Bank Checks API.

        Args:
            fiscal_receipt: The receipt record to send
            deal: The associated deal
        """
        # Build receipt item
        item_name = f"Услуги агента по сделке {deal.property_address or 'Недвижимость'}"
        if len(item_name) > 128:
            item_name = item_name[:125] + "..."

        receipt_item = ReceiptItem(
            name=item_name,
            quantity=Decimal("1"),
            price=fiscal_receipt.amount,
            amount=fiscal_receipt.amount,
            payment_method=PaymentMethod.FULL_PAYMENT,
            payment_object=PaymentObject.AGENT_COMMISSION,
            vat=VatType.NONE,  # Self-employed don't pay VAT
        )

        # Build client info
        client = ReceiptClient(
            email=fiscal_receipt.client_email,
            phone=fiscal_receipt.client_phone,
        )

        # Build request
        tbank_receipt_type = (
            TBankReceiptType.INCOME
            if fiscal_receipt.type == FiscalReceiptType.INCOME.value
            else TBankReceiptType.INCOME_RETURN
        )

        request = CreateReceiptRequest(
            receipt_type=tbank_receipt_type,
            items=[receipt_item],
            client=client,
            tax_system=TaxSystem.USN_INCOME,
            order_id=str(deal.id),
            payment_id=deal.external_deal_id,
        )

        # Send to T-Bank
        fiscal_receipt.sent_at = datetime.utcnow()

        response = await self.tbank_client.create_receipt(request)

        # Update receipt record
        fiscal_receipt.external_id = response.receipt_id
        fiscal_receipt.status = self._map_tbank_status(response.status)
        fiscal_receipt.receipt_url = response.receipt_url

        if response.fiscal_data:
            fiscal_receipt.fiscal_data = response.fiscal_data

        if response.status == TBankChecksReceiptStatus.DONE:
            fiscal_receipt.confirmed_at = datetime.utcnow()

        logger.info(
            f"Receipt {fiscal_receipt.id} sent to T-Bank, "
            f"external_id: {response.receipt_id}, status: {response.status.value}"
        )

    async def sync_receipt_status(self, fiscal_receipt: FiscalReceipt) -> FiscalReceipt:
        """Sync receipt status with T-Bank.

        Args:
            fiscal_receipt: The receipt to sync

        Returns:
            Updated receipt
        """
        if not fiscal_receipt.external_id:
            logger.warning(f"Receipt {fiscal_receipt.id} has no external_id, cannot sync")
            return fiscal_receipt

        try:
            response = await self.tbank_client.get_receipt_status(fiscal_receipt.external_id)

            fiscal_receipt.status = self._map_tbank_status(response.status)
            fiscal_receipt.receipt_url = response.receipt_url or fiscal_receipt.receipt_url

            if response.fiscal_data:
                fiscal_receipt.fiscal_data = response.fiscal_data

            if response.status == TBankChecksReceiptStatus.DONE and not fiscal_receipt.confirmed_at:
                fiscal_receipt.confirmed_at = datetime.utcnow()

            if response.error_code:
                fiscal_receipt.error_code = response.error_code
                fiscal_receipt.error_message = response.error_message

            await self.db.flush()

            logger.info(f"Synced receipt {fiscal_receipt.id} status: {fiscal_receipt.status}")

        except TBankChecksError as e:
            logger.error(f"Failed to sync receipt status: {e}")
            fiscal_receipt.retry_count += 1
            fiscal_receipt.last_retry_at = datetime.utcnow()
            await self.db.flush()

        return fiscal_receipt

    async def create_refund_receipt(
        self,
        original_receipt: FiscalReceipt,
        reason: Optional[str] = None,
    ) -> FiscalReceipt:
        """Create a refund receipt (income_return) for a cancelled deal.

        Args:
            original_receipt: The original income receipt to refund
            reason: Reason for the refund

        Returns:
            New refund receipt

        Raises:
            ValueError: If original receipt is not in CREATED status
            TBankChecksError: On API errors
        """
        if original_receipt.status != FiscalReceiptStatus.CREATED.value:
            raise ValueError(
                f"Cannot create refund for receipt in status: {original_receipt.status}"
            )

        # Get the deal
        stmt = select(Deal).where(Deal.id == original_receipt.deal_id)
        result = await self.db.execute(stmt)
        deal = result.scalar_one_or_none()

        if not deal:
            raise ValueError(f"Deal not found for receipt {original_receipt.id}")

        # Create refund receipt record
        refund_receipt = FiscalReceipt(
            deal_id=deal.id,
            type=FiscalReceiptType.INCOME_RETURN.value,
            amount=original_receipt.amount,
            status=FiscalReceiptStatus.PENDING.value,
            client_email=original_receipt.client_email,
            client_phone=original_receipt.client_phone,
            original_receipt_id=original_receipt.id,
            meta={
                "reason": reason,
                "original_receipt_id": str(original_receipt.id),
            },
        )

        self.db.add(refund_receipt)
        await self.db.flush()

        logger.info(
            f"Created refund receipt {refund_receipt.id} for original {original_receipt.id}"
        )

        # Cancel the original receipt in T-Bank (which creates refund receipt)
        try:
            response = await self.tbank_client.cancel_receipt(
                original_receipt.external_id,
                reason=reason,
            )

            refund_receipt.external_id = response.receipt_id
            refund_receipt.status = self._map_tbank_status(response.status)
            refund_receipt.sent_at = datetime.utcnow()

            if response.status == TBankChecksReceiptStatus.DONE:
                refund_receipt.confirmed_at = datetime.utcnow()
                refund_receipt.receipt_url = response.receipt_url

            # Mark original as cancelled
            original_receipt.status = FiscalReceiptStatus.CANCELLED.value

        except TBankChecksError as e:
            logger.error(f"Failed to create refund receipt: {e}")
            refund_receipt.status = FiscalReceiptStatus.FAILED.value
            refund_receipt.error_code = e.code
            refund_receipt.error_message = str(e)

        await self.db.flush()
        return refund_receipt

    async def get_receipt(self, receipt_id: UUID) -> Optional[FiscalReceipt]:
        """Get fiscal receipt by ID.

        Args:
            receipt_id: Receipt UUID

        Returns:
            FiscalReceipt if found
        """
        stmt = select(FiscalReceipt).where(FiscalReceipt.id == receipt_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_receipts_for_deal(self, deal_id: UUID) -> list[FiscalReceipt]:
        """Get all fiscal receipts for a deal.

        Args:
            deal_id: Deal UUID

        Returns:
            List of FiscalReceipt records
        """
        stmt = (
            select(FiscalReceipt)
            .where(FiscalReceipt.deal_id == deal_id)
            .order_by(FiscalReceipt.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def retry_failed_receipts(self, max_retries: int = 3) -> list[FiscalReceipt]:
        """Retry failed receipts that haven't exceeded max retries.

        Args:
            max_retries: Maximum number of retry attempts

        Returns:
            List of retried receipts
        """
        stmt = select(FiscalReceipt).where(
            FiscalReceipt.status == FiscalReceiptStatus.FAILED.value,
            FiscalReceipt.retry_count < max_retries,
        )
        result = await self.db.execute(stmt)
        failed_receipts = list(result.scalars().all())

        retried = []
        for receipt in failed_receipts:
            # Get the deal
            stmt = select(Deal).where(Deal.id == receipt.deal_id)
            result = await self.db.execute(stmt)
            deal = result.scalar_one_or_none()

            if not deal:
                continue

            try:
                receipt.retry_count += 1
                receipt.last_retry_at = datetime.utcnow()
                receipt.status = FiscalReceiptStatus.PENDING.value

                await self._send_receipt_to_tbank(receipt, deal)
                retried.append(receipt)

                logger.info(f"Retried receipt {receipt.id}, attempt {receipt.retry_count}")

            except TBankChecksError as e:
                logger.error(f"Retry failed for receipt {receipt.id}: {e}")
                receipt.status = FiscalReceiptStatus.FAILED.value
                receipt.error_code = e.code
                receipt.error_message = str(e)

        await self.db.flush()
        return retried

    async def _get_existing_receipt(
        self,
        deal_id: UUID,
        receipt_type: FiscalReceiptType,
    ) -> Optional[FiscalReceipt]:
        """Get existing receipt for deal and type.

        Args:
            deal_id: Deal UUID
            receipt_type: Receipt type

        Returns:
            FiscalReceipt if found
        """
        stmt = select(FiscalReceipt).where(
            FiscalReceipt.deal_id == deal_id,
            FiscalReceipt.type == receipt_type.value,
        ).order_by(FiscalReceipt.created_at.desc())

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _map_tbank_status(self, tbank_status: TBankChecksReceiptStatus) -> str:
        """Map T-Bank receipt status to our status.

        Args:
            tbank_status: T-Bank status

        Returns:
            Our FiscalReceiptStatus value
        """
        status_map = {
            TBankChecksReceiptStatus.NEW: FiscalReceiptStatus.PENDING.value,
            TBankChecksReceiptStatus.PENDING: FiscalReceiptStatus.PENDING.value,
            TBankChecksReceiptStatus.WAIT: FiscalReceiptStatus.PENDING.value,
            TBankChecksReceiptStatus.DONE: FiscalReceiptStatus.CREATED.value,
            TBankChecksReceiptStatus.FAIL: FiscalReceiptStatus.FAILED.value,
        }
        return status_map.get(tbank_status, FiscalReceiptStatus.PENDING.value)
