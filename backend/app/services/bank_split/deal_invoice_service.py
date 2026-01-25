"""Deal Invoice Service - Multiple invoices per deal

Allows agents to create invoices for specific amounts:
- Advance payments
- Remainder after service
- Full amount at once

Supports payment schemes:
- prepayment_full: 100% before service
- advance_postpay: Advance + remainder after service
- postpayment_full: 100% after service
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.deal import Deal, DealStatus, PaymentScheme, AdvanceType
from app.models.bank_split import DealInvoice, InvoiceStatus, DealSplitRecipient
from app.models.user import User
from app.integrations.tbank import get_tbank_deals_client, TBankError
from app.integrations.tbank.deals import TBankDealSplit

logger = logging.getLogger(__name__)


@dataclass
class InvoiceSummary:
    """Summary of invoices for a deal"""
    total_commission: Decimal
    total_invoiced: Decimal
    total_paid: Decimal
    remaining_amount: Decimal
    invoices_count: int
    paid_invoices_count: int


class DealInvoiceService:
    """Service for managing multiple invoices per deal"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._tbank_client = None

    @property
    def tbank_client(self):
        """Lazy load T-Bank client"""
        if self._tbank_client is None:
            self._tbank_client = get_tbank_deals_client()
        return self._tbank_client

    async def get_invoice_summary(self, deal: Deal) -> InvoiceSummary:
        """Get summary of all invoices for a deal"""
        # Get total commission
        total_commission = deal.calculated_commission or Decimal("0")

        # Get sum of all invoices (excluding cancelled)
        stmt = select(
            func.coalesce(func.sum(DealInvoice.amount), Decimal("0")).label("total_invoiced"),
            func.count(DealInvoice.id).label("invoices_count")
        ).where(
            DealInvoice.deal_id == deal.id,
            DealInvoice.status != InvoiceStatus.CANCELLED.value
        )
        result = await self.db.execute(stmt)
        row = result.one()
        total_invoiced = Decimal(str(row.total_invoiced))
        invoices_count = row.invoices_count

        # Get sum of paid invoices
        stmt_paid = select(
            func.coalesce(func.sum(DealInvoice.paid_amount), Decimal("0")).label("total_paid"),
            func.count(DealInvoice.id).label("paid_count")
        ).where(
            DealInvoice.deal_id == deal.id,
            DealInvoice.status == InvoiceStatus.PAID.value
        )
        result_paid = await self.db.execute(stmt_paid)
        row_paid = result_paid.one()
        total_paid = Decimal(str(row_paid.total_paid))
        paid_invoices_count = row_paid.paid_count

        # Calculate remaining
        remaining_amount = total_commission - total_invoiced

        return InvoiceSummary(
            total_commission=total_commission,
            total_invoiced=total_invoiced,
            total_paid=total_paid,
            remaining_amount=max(Decimal("0"), remaining_amount),
            invoices_count=invoices_count,
            paid_invoices_count=paid_invoices_count,
        )

    async def create_invoice(
        self,
        deal: Deal,
        amount: Decimal,
        user: User,
        description: Optional[str] = None,
        return_url: Optional[str] = None,
        milestone_id: Optional[UUID] = None,
    ) -> Tuple[DealInvoice, InvoiceSummary]:
        """
        Create a new invoice for specified amount.

        Args:
            deal: Deal to create invoice for
            amount: Invoice amount in rubles
            user: User creating the invoice
            description: Optional description (e.g., "Advance 30%")
            return_url: URL to redirect after payment
            milestone_id: Optional link to milestone

        Returns:
            Tuple of (created invoice, updated summary)

        Raises:
            ValueError: If validation fails
        """
        # 1. Validate deal status
        allowed_statuses = [
            DealStatus.SIGNED.value,
            DealStatus.INVOICED.value,
            DealStatus.PAYMENT_PENDING.value,
        ]
        if deal.status not in allowed_statuses:
            raise ValueError(
                f"Cannot create invoice: deal status is '{deal.status}', "
                f"expected one of: {allowed_statuses}"
            )

        # 2. Get current summary and validate amount
        summary = await self.get_invoice_summary(deal)

        if amount > summary.remaining_amount:
            raise ValueError(
                f"Amount {amount} exceeds remaining commission. "
                f"Total commission: {summary.total_commission}, "
                f"Already invoiced: {summary.total_invoiced}, "
                f"Remaining: {summary.remaining_amount}"
            )

        # 3. Generate invoice number
        invoice_number = await self._generate_invoice_number(deal.id)

        # 4. Create invoice record
        invoice = DealInvoice(
            deal_id=deal.id,
            milestone_id=milestone_id,
            invoice_number=invoice_number,
            description=description or f"Счёт на {amount} ₽",
            amount=amount,
            currency="RUB",
            status=InvoiceStatus.DRAFT.value,
            created_by_user_id=user.id,
        )
        self.db.add(invoice)
        await self.db.flush()

        # 5. Create in T-Bank and get payment link
        try:
            await self._create_tbank_invoice(
                invoice=invoice,
                deal=deal,
                return_url=return_url,
            )
            invoice.status = InvoiceStatus.PENDING.value
        except TBankError as e:
            logger.error(f"Failed to create T-Bank invoice: {e}")
            # Keep invoice in draft status, can retry later
            raise ValueError(f"Failed to create payment link: {e}")

        await self.db.flush()

        # 6. Update deal status if this is first invoice
        if deal.status == DealStatus.SIGNED.value:
            deal.status = DealStatus.INVOICED.value
            await self.db.flush()

        # 7. Get updated summary
        updated_summary = await self.get_invoice_summary(deal)

        logger.info(
            f"Created invoice {invoice.id} for deal {deal.id}, "
            f"amount: {amount}, remaining: {updated_summary.remaining_amount}"
        )

        return invoice, updated_summary

    async def _create_tbank_invoice(
        self,
        invoice: DealInvoice,
        deal: Deal,
        return_url: Optional[str] = None,
    ) -> None:
        """Create invoice in T-Bank and update invoice with payment link"""
        # Get split recipients for this deal
        recipients = await self._get_deal_recipients(deal.id)
        if not recipients:
            raise ValueError("No split recipients found for deal")

        # Calculate proportional splits for this invoice amount
        tbank_splits = self._calculate_proportional_splits(
            invoice.amount,
            recipients,
            deal.calculated_commission,
        )

        if not tbank_splits:
            raise ValueError("No valid recipients for T-Bank")

        # Amount in kopecks
        amount_kopecks = int(invoice.amount * 100)

        # Create T-Bank deal
        tbank_deal = await self.tbank_client.create_deal(
            order_id=f"{deal.id}-{invoice.id}",  # Unique order ID per invoice
            amount=amount_kopecks,
            description=invoice.description or f"Invoice {invoice.invoice_number}",
            splits=tbank_splits,
            customer_email=deal.payer_email,
            return_url=return_url or f"{settings.FRONTEND_URL}/deals/{deal.id}/payment-complete",
            expire_minutes=60,
        )

        # Update invoice with T-Bank data
        invoice.external_deal_id = tbank_deal.deal_id
        invoice.external_account_number = tbank_deal.account_number
        invoice.payment_link_url = tbank_deal.payment_url
        invoice.payment_qr_payload = tbank_deal.qr_code
        if tbank_deal.expires_at:
            invoice.expires_at = tbank_deal.expires_at.replace(tzinfo=None)

    def _calculate_proportional_splits(
        self,
        invoice_amount: Decimal,
        recipients: List[DealSplitRecipient],
        total_commission: Decimal,
    ) -> List[TBankDealSplit]:
        """Calculate proportional splits for invoice amount"""
        tbank_splits = []

        for r in recipients:
            if not r.external_recipient_id:
                logger.warning(f"Recipient {r.id} has no external_recipient_id, skipping")
                continue

            # Calculate proportional amount
            if total_commission > 0:
                proportion = r.calculated_amount / total_commission
                recipient_amount = (invoice_amount * proportion).quantize(Decimal("0.01"))
            else:
                recipient_amount = invoice_amount

            tbank_splits.append(TBankDealSplit(
                recipient_id=r.external_recipient_id,
                amount=int(recipient_amount * 100),  # kopecks
                description=f"{r.role}: {recipient_amount} RUB",
            ))

        return tbank_splits

    async def _get_deal_recipients(self, deal_id: UUID) -> List[DealSplitRecipient]:
        """Get split recipients for deal"""
        stmt = select(DealSplitRecipient).where(DealSplitRecipient.deal_id == deal_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _generate_invoice_number(self, deal_id: UUID) -> str:
        """Generate unique invoice number"""
        # Count existing invoices for this deal
        stmt = select(func.count(DealInvoice.id)).where(DealInvoice.deal_id == deal_id)
        result = await self.db.execute(stmt)
        count = result.scalar() or 0

        # Format: INV-{deal_short_id}-{sequence}
        deal_short = str(deal_id)[:8].upper()
        return f"INV-{deal_short}-{count + 1:03d}"

    async def get_deal_invoices(self, deal_id: UUID) -> List[DealInvoice]:
        """Get all invoices for a deal"""
        stmt = (
            select(DealInvoice)
            .where(DealInvoice.deal_id == deal_id)
            .order_by(DealInvoice.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_invoice(self, invoice_id: UUID) -> Optional[DealInvoice]:
        """Get invoice by ID"""
        stmt = select(DealInvoice).where(DealInvoice.id == invoice_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_invoice_paid(
        self,
        invoice_id: UUID,
        paid_amount: Optional[Decimal] = None,
        paid_at: Optional[datetime] = None,
    ) -> DealInvoice:
        """Mark invoice as paid"""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError(f"Invoice not found: {invoice_id}")

        invoice.status = InvoiceStatus.PAID.value
        invoice.paid_at = paid_at or datetime.utcnow()
        invoice.paid_amount = paid_amount or invoice.amount

        await self.db.flush()

        logger.info(f"Invoice {invoice_id} marked as paid, amount: {invoice.paid_amount}")

        return invoice

    async def cancel_invoice(
        self,
        invoice_id: UUID,
        reason: Optional[str] = None,
    ) -> DealInvoice:
        """Cancel an invoice"""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError(f"Invoice not found: {invoice_id}")

        if invoice.status == InvoiceStatus.PAID.value:
            raise ValueError("Cannot cancel paid invoice")

        invoice.status = InvoiceStatus.CANCELLED.value
        if reason:
            invoice.description = f"{invoice.description} (Cancelled: {reason})"

        await self.db.flush()

        logger.info(f"Invoice {invoice_id} cancelled: {reason}")

        return invoice

    async def regenerate_payment_link(self, invoice_id: UUID) -> str:
        """Regenerate payment link for existing invoice"""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError(f"Invoice not found: {invoice_id}")

        if invoice.status not in [InvoiceStatus.PENDING.value, InvoiceStatus.EXPIRED.value]:
            raise ValueError(f"Cannot regenerate link for invoice in status: {invoice.status}")

        if not invoice.external_deal_id:
            raise ValueError("Invoice has no external deal ID")

        try:
            new_url = await self.tbank_client.regenerate_payment_link(
                deal_id=invoice.external_deal_id,
                expire_minutes=60,
            )

            invoice.payment_link_url = new_url
            invoice.expires_at = datetime.utcnow() + timedelta(minutes=60)
            invoice.status = InvoiceStatus.PENDING.value

            await self.db.flush()

            logger.info(f"Regenerated payment link for invoice {invoice_id}")

            return new_url

        except TBankError as e:
            logger.error(f"Failed to regenerate payment link: {e}")
            raise ValueError(f"Failed to regenerate payment link: {e}")

    def calculate_advance_amount(self, deal: Deal) -> Optional[Decimal]:
        """Calculate advance amount based on deal settings"""
        if deal.payment_scheme != PaymentScheme.ADVANCE_POSTPAY.value:
            return None

        total_commission = deal.calculated_commission or Decimal("0")

        if deal.advance_type == AdvanceType.FIXED.value:
            return deal.advance_amount
        elif deal.advance_type == AdvanceType.PERCENT.value:
            if deal.advance_percent:
                return (total_commission * deal.advance_percent / Decimal("100")).quantize(Decimal("0.01"))

        return None
