"""Bank Split API endpoints"""

import logging
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.feature_flags import is_instant_split_enabled
from app.db.session import get_db
from app.models.user import User
from app.schemas.bank_split import (
    BankSplitDealCreate,
    BankSplitDealResponse,
    BankSplitDealList,
    SplitRecipientResponse,
    CreateInvoiceRequest,
    CreateInvoiceResponse,
    RegeneratePaymentLinkResponse,
    TBankWebhookPayload,
    WebhookResponse,
    DealStatusTransition,
    DealStatusResponse,
    SendPaymentLinkRequest,
    SendPaymentLinkResponse,
    ConsentCreate,
    ConsentResponse,
    ConsentCheckResponse,
    # Partial invoice schemas
    CreatePartialInvoiceRequest,
    PartialInvoiceResponse,
    InvoiceListResponse,
    InvoiceListItem,
    PaymentSummaryResponse,
)
from app.services.bank_split import (
    BankSplitDealService,
    SplitService,
    InvoiceService,
)
from app.services.bank_split.deal_invoice_service import DealInvoiceService
from app.services.bank_split.deal_service import CreateBankSplitDealInput
from app.integrations.tbank.webhooks import TBankWebhookHandler
from app.models.bank_split import BankEvent, PayoutStatus

logger = logging.getLogger(__name__)
router = APIRouter()


def compute_platform_fee(commission_agent: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """
    Compute platform fee values.

    Returns:
        tuple: (platform_fee_percent, platform_fee_amount, total_client_payment)
    """
    fee_percent = Decimal(str(settings.PLATFORM_FEE_PERCENT))
    fee_amount = (commission_agent * fee_percent / Decimal("100")).quantize(Decimal("0.01"))
    total_payment = commission_agent + fee_amount
    return fee_percent, fee_amount, total_payment


# ============================================
# Deal endpoints
# ============================================


@router.post("", response_model=BankSplitDealResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_split_deal(
    deal_in: BankSplitDealCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new bank-split deal.

    This creates a deal using the T-Bank instant split payment model.
    """
    # Проверка feature flag для организации
    if not is_instant_split_enabled(deal_in.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bank split is not enabled for this organization"
        )

    service = BankSplitDealService(db)

    input_data = CreateBankSplitDealInput(
        deal_type=deal_in.type,
        property_address=deal_in.property_address,
        price=deal_in.price,
        commission_total=deal_in.commission_total,
        description=deal_in.description or f"Deal for {deal_in.property_address}",
        client_name=deal_in.client_name,
        client_phone=deal_in.client_phone,
        client_email=deal_in.client_email,
        organization_id=deal_in.organization_id,
        agent_split_percent=deal_in.agent_split_percent,
    )

    try:
        result = await service.create_deal(input_data, current_user)
        await db.commit()

        # Build response with recipients
        recipients = [
            SplitRecipientResponse(
                id=r.id,
                deal_id=r.deal_id,
                role=r.role,
                split_type=r.split_type,
                split_value=r.split_value,
                user_id=r.user_id,
                organization_id=r.organization_id,
                calculated_amount=r.calculated_amount,
                payout_status=r.payout_status,
                paid_at=r.paid_at,
                created_at=r.created_at,
            )
            for r in result.recipients
        ]

        # Compute platform fee
        fee_percent, fee_amount, total_payment = compute_platform_fee(result.deal.commission_agent)

        return BankSplitDealResponse(
            id=result.deal.id,
            type=result.deal.type,
            status=result.deal.status,
            payment_model=result.deal.payment_model,
            property_address=result.deal.property_address,
            price=result.deal.price,
            commission_agent=result.deal.commission_agent,
            platform_fee_percent=fee_percent,
            platform_fee_amount=fee_amount,
            total_client_payment=total_payment,
            client_name=result.deal.client_name,
            client_phone=result.deal.client_phone,
            payer_email=result.deal.payer_email,
            external_provider=result.deal.external_provider,
            external_deal_id=result.deal.external_deal_id,
            payment_link_url=result.deal.payment_link_url,
            payment_qr_payload=result.deal.payment_qr_payload,
            expires_at=result.deal.expires_at,
            hold_expires_at=result.deal.hold_expires_at,
            created_at=result.deal.created_at,
            updated_at=result.deal.updated_at,
            recipients=recipients,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{deal_id}", response_model=BankSplitDealResponse)
async def get_bank_split_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get bank-split deal by ID"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    if deal.created_by_user_id != current_user.id and deal.agent_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get recipients
    split_service = SplitService(db)
    recipients_db = await split_service.get_deal_recipients(deal_id)

    recipients = [
        SplitRecipientResponse(
            id=r.id,
            deal_id=r.deal_id,
            role=r.role,
            split_type=r.split_type,
            split_value=r.split_value,
            user_id=r.user_id,
            organization_id=r.organization_id,
            calculated_amount=r.calculated_amount,
            payout_status=r.payout_status,
            paid_at=r.paid_at,
            created_at=r.created_at,
        )
        for r in recipients_db
    ]

    # Compute platform fee
    fee_percent, fee_amount, total_payment = compute_platform_fee(deal.commission_agent)

    return BankSplitDealResponse(
        id=deal.id,
        type=deal.type,
        status=deal.status,
        payment_model=deal.payment_model,
        property_address=deal.property_address,
        price=deal.price,
        commission_agent=deal.commission_agent,
        platform_fee_percent=fee_percent,
        platform_fee_amount=fee_amount,
        total_client_payment=total_payment,
        client_name=deal.client_name,
        client_phone=deal.client_phone,
        payer_email=deal.payer_email,
        external_provider=deal.external_provider,
        external_deal_id=deal.external_deal_id,
        payment_link_url=deal.payment_link_url,
        payment_qr_payload=deal.payment_qr_payload,
        expires_at=deal.expires_at,
        hold_expires_at=deal.hold_expires_at,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
        recipients=recipients,
    )


# ============================================
# Status transitions
# ============================================


@router.post("/{deal_id}/submit-for-signing", response_model=DealStatusResponse)
async def submit_for_signing(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit deal for client signature"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can submit")

    old_status = deal.status

    try:
        deal = await service.submit_for_signing(deal)
        await db.commit()

        return DealStatusResponse(
            deal_id=deal.id,
            old_status=old_status,
            new_status=deal.status,
            timestamp=deal.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/mark-signed", response_model=DealStatusResponse)
async def mark_signed(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark deal as signed (all signatures collected)"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    old_status = deal.status

    try:
        deal = await service.mark_signed(deal)
        await db.commit()

        return DealStatusResponse(
            deal_id=deal.id,
            old_status=old_status,
            new_status=deal.status,
            timestamp=deal.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/create-invoice", response_model=CreateInvoiceResponse)
async def create_invoice(
    deal_id: UUID,
    request: CreateInvoiceRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create invoice in T-Bank and get payment link.

    This creates a nominal account deal in T-Bank with the split recipients.
    """
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can create invoice")

    return_url = request.return_url if request else None

    try:
        result = await service.create_invoice(deal, return_url=return_url)
        await db.commit()

        return CreateInvoiceResponse(
            deal_id=result.deal.id,
            external_deal_id=result.deal.external_deal_id,
            payment_url=result.deal.payment_link_url,
            qr_code=result.deal.payment_qr_payload,
            expires_at=result.deal.expires_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/regenerate-payment-link", response_model=RegeneratePaymentLinkResponse)
async def regenerate_payment_link(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate payment link for existing deal"""
    service = BankSplitDealService(db)
    invoice_service = InvoiceService(db)

    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if not deal.external_deal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deal has no invoice yet")

    try:
        new_url = await invoice_service.regenerate_payment_link(deal)
        await db.commit()

        return RegeneratePaymentLinkResponse(
            payment_url=new_url,
            expires_at=deal.expires_at,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================
# Partial Invoices (multiple invoices per deal)
# ============================================


@router.post("/{deal_id}/invoices", response_model=PartialInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_partial_invoice(
    deal_id: UUID,
    request: CreatePartialInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create invoice for specific amount.

    Allows agent to create multiple invoices:
    - Advance (e.g., 30% of commission before service)
    - Remainder (e.g., 70% after service)
    - Or full amount at once

    Validation:
    - Amount must be <= remaining commission (total - already invoiced)
    - Deal must be in signed status or partially paid
    """
    deal_service = BankSplitDealService(db)
    invoice_service = DealInvoiceService(db)

    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can create invoices")

    try:
        invoice, summary = await invoice_service.create_invoice(
            deal=deal,
            amount=request.amount,
            user=current_user,
            description=request.description,
            return_url=request.return_url,
            milestone_id=request.milestone_id,
        )
        await db.commit()

        return PartialInvoiceResponse(
            invoice_id=invoice.id,
            deal_id=deal.id,
            amount=invoice.amount,
            description=invoice.description,
            status=invoice.status,
            payment_url=invoice.payment_link_url,
            qr_code=invoice.payment_qr_payload,
            expires_at=invoice.expires_at,
            total_commission=summary.total_commission,
            total_invoiced=summary.total_invoiced,
            total_paid=summary.total_paid,
            remaining_amount=summary.remaining_amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{deal_id}/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get list of all invoices for a deal.

    Returns invoices sorted by creation date (newest first)
    and summary of total/paid/remaining amounts.
    """
    deal_service = BankSplitDealService(db)
    invoice_service = DealInvoiceService(db)

    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    invoices = await invoice_service.get_deal_invoices(deal_id)
    summary = await invoice_service.get_invoice_summary(deal)

    invoice_items = [
        InvoiceListItem(
            id=inv.id,
            invoice_number=inv.invoice_number,
            amount=inv.amount,
            description=inv.description,
            status=inv.status,
            payment_url=inv.payment_link_url,
            expires_at=inv.expires_at,
            paid_at=inv.paid_at,
            created_at=inv.created_at,
        )
        for inv in invoices
    ]

    return InvoiceListResponse(
        deal_id=deal_id,
        invoices=invoice_items,
        total_commission=summary.total_commission,
        total_invoiced=summary.total_invoiced,
        total_paid=summary.total_paid,
        remaining_amount=summary.remaining_amount,
    )


@router.get("/{deal_id}/payment-summary", response_model=PaymentSummaryResponse)
async def get_payment_summary(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get payment summary for a deal.

    Returns:
    - Commission configuration (type, percent, fixed)
    - Payment scheme (prepayment/advance/postpayment)
    - Advance configuration (if applicable)
    - Invoice summary (total/paid/remaining)
    """
    deal_service = BankSplitDealService(db)
    invoice_service = DealInvoiceService(db)

    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    summary = await invoice_service.get_invoice_summary(deal)

    # Calculate advance amount if applicable
    calculated_advance = invoice_service.calculate_advance_amount(deal)

    return PaymentSummaryResponse(
        deal_id=deal_id,
        payment_scheme=deal.payment_scheme or "prepayment_full",
        total_commission=summary.total_commission,
        commission_type=deal.payment_type or "percent",
        commission_percent=deal.commission_percent,
        commission_fixed=deal.commission_fixed,
        advance_type=deal.advance_type,
        advance_amount=deal.advance_amount,
        advance_percent=deal.advance_percent,
        calculated_advance=calculated_advance,
        total_invoiced=summary.total_invoiced,
        total_paid=summary.total_paid,
        remaining_amount=summary.remaining_amount,
        invoices_count=summary.invoices_count,
        paid_invoices_count=summary.paid_invoices_count,
    )


@router.post("/{deal_id}/invoices/{invoice_id}/regenerate-link", response_model=PartialInvoiceResponse)
async def regenerate_invoice_payment_link(
    deal_id: UUID,
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate payment link for specific invoice"""
    deal_service = BankSplitDealService(db)
    invoice_service = DealInvoiceService(db)

    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can regenerate links")

    try:
        new_url = await invoice_service.regenerate_payment_link(invoice_id)
        await db.commit()

        invoice = await invoice_service.get_invoice(invoice_id)
        summary = await invoice_service.get_invoice_summary(deal)

        return PartialInvoiceResponse(
            invoice_id=invoice.id,
            deal_id=deal.id,
            amount=invoice.amount,
            description=invoice.description,
            status=invoice.status,
            payment_url=new_url,
            qr_code=invoice.payment_qr_payload,
            expires_at=invoice.expires_at,
            total_commission=summary.total_commission,
            total_invoiced=summary.total_invoiced,
            total_paid=summary.total_paid,
            remaining_amount=summary.remaining_amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{deal_id}/invoices/{invoice_id}")
async def cancel_invoice(
    deal_id: UUID,
    invoice_id: UUID,
    reason: Optional[str] = Query(None, description="Cancellation reason"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an unpaid invoice"""
    deal_service = BankSplitDealService(db)
    invoice_service = DealInvoiceService(db)

    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can cancel invoices")

    try:
        await invoice_service.cancel_invoice(invoice_id, reason)
        await db.commit()

        return {"status": "cancelled", "invoice_id": str(invoice_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/send-payment-link", response_model=SendPaymentLinkResponse)
async def send_payment_link(
    deal_id: UUID,
    request: SendPaymentLinkRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send payment link to client via SMS or Email.

    This sends the payment URL to the client's phone or email.
    """
    from app.services.sms.provider import get_sms_provider

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can send payment link")

    if not deal.payment_link_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deal has no payment link. Create invoice first."
        )

    method = request.method if request else "sms"

    if method == "sms":
        if not deal.client_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client phone not set"
            )

        # Format message
        payment_page_url = f"{settings.FRONTEND_URL}/pay/{deal.id}"
        message = f"Housler: ссылка для оплаты комиссии по сделке {deal.property_address[:30]}... - {payment_page_url}"

        # Send SMS
        sms_provider = get_sms_provider()
        success = await sms_provider.send(deal.client_phone, message)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send SMS"
            )

        # Mask phone for response
        phone = deal.client_phone
        masked = f"+7 (***) ***-**-{phone[-2:]}" if len(phone) >= 2 else "***"

        return SendPaymentLinkResponse(
            success=True,
            method="sms",
            recipient=masked,
            message="SMS со ссылкой на оплату отправлено клиенту"
        )

    elif method == "email":
        # Email sending not implemented yet
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Email delivery not implemented yet"
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown delivery method: {method}"
        )


@router.post("/{deal_id}/cancel", response_model=DealStatusResponse)
async def cancel_deal(
    deal_id: UUID,
    transition: DealStatusTransition = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel bank-split deal"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can cancel")

    old_status = deal.status
    reason = transition.reason if transition else None

    try:
        deal = await service.cancel_deal(deal, reason=reason)
        await db.commit()

        return DealStatusResponse(
            deal_id=deal.id,
            old_status=old_status,
            new_status=deal.status,
            timestamp=deal.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/release", response_model=DealStatusResponse)
async def release_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually release deal from hold period.

    This ends the hold period early and releases funds to recipients.
    """
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.status != "hold_period":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deal is not in hold period")

    old_status = deal.status

    try:
        deal = await service.release_from_hold(deal)
        await db.commit()

        return DealStatusResponse(
            deal_id=deal.id,
            old_status=old_status,
            new_status=deal.status,
            timestamp=deal.updated_at,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================
# Consent endpoints
# ============================================


@router.post("/{deal_id}/consent", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
async def give_consent(
    deal_id: UUID,
    consent_in: ConsentCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record user consent for a deal (T-Bank nominal account model).

    Required consents:
    - platform_fee_deduction: Agree to platform fee deduction from payment
    - data_processing: Personal data processing (152-FZ)
    - terms_of_service: Platform terms

    Additional consents for bank-split:
    - bank_payment_processing: Consent for T-Bank nominal account processing
    - service_confirmation_required: Agree that service must be confirmed before payout
    - hold_period_acceptance: Accept hold period before payout
    """
    from datetime import datetime
    from app.models.consent import DealConsent, ConsentType

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Validate consent type
    valid_types = [t.value for t in ConsentType]
    if consent_in.consent_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid consent type. Must be one of: {valid_types}"
        )

    # Check if user is involved in deal
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Check if consent already exists
    from sqlalchemy import select
    existing = await db.execute(
        select(DealConsent).where(
            DealConsent.deal_id == deal_id,
            DealConsent.user_id == current_user.id,
            DealConsent.consent_type == consent_in.consent_type,
            DealConsent.revoked_at.is_(None)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Consent already given for this type"
        )

    # Get client info from request
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Create consent record
    consent = DealConsent(
        deal_id=deal_id,
        user_id=current_user.id,
        consent_type=consent_in.consent_type,
        consent_version=consent_in.consent_version,
        agreed_at=datetime.utcnow(),
        ip_address=client_ip,
        user_agent=user_agent,
        document_url=consent_in.document_url,
    )

    db.add(consent)
    await db.commit()
    await db.refresh(consent)

    return ConsentResponse(
        id=consent.id,
        deal_id=consent.deal_id,
        user_id=consent.user_id,
        consent_type=consent.consent_type,
        consent_version=consent.consent_version,
        agreed_at=consent.agreed_at,
        document_url=consent.document_url,
        revoked_at=consent.revoked_at,
    )


@router.get("/{deal_id}/consents", response_model=ConsentCheckResponse)
async def check_consents(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check which consents are required and which have been given.
    """
    from sqlalchemy import select
    from app.models.consent import DealConsent, ConsentType

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Required consents for bank-split deals (T-Bank nominal account model)
    required = [
        ConsentType.PLATFORM_FEE_DEDUCTION.value,
        ConsentType.DATA_PROCESSING.value,
        ConsentType.TERMS_OF_SERVICE.value,
        ConsentType.BANK_PAYMENT_PROCESSING.value,
        ConsentType.SERVICE_CONFIRMATION_REQUIRED.value,
        ConsentType.HOLD_PERIOD_ACCEPTANCE.value,
    ]

    # Get user's consents
    result = await db.execute(
        select(DealConsent).where(
            DealConsent.deal_id == deal_id,
            DealConsent.user_id == current_user.id,
            DealConsent.revoked_at.is_(None)
        )
    )
    user_consents = result.scalars().all()
    given = [c.consent_type for c in user_consents]

    missing = [r for r in required if r not in given]

    return ConsentCheckResponse(
        deal_id=deal_id,
        required_consents=required,
        given_consents=given,
        missing_consents=missing,
        all_consents_given=len(missing) == 0,
    )


@router.get("/consent-texts")
async def get_consent_texts():
    """
    Get all consent texts for bank-split deals.

    Returns consent titles and texts in Russian for displaying to users.
    Uses T-Bank nominal account terminology (no escrow/MoR).

    This is a PUBLIC endpoint - no authentication required.
    """
    from app.models.consent import CONSENT_TEXTS, ConsentType

    # Return all non-deprecated consents
    result = {}
    for consent_type, data in CONSENT_TEXTS.items():
        if not data.get("deprecated", False):
            result[consent_type] = {
                "title": data["title"],
                "text": data["text"],
                "version": data["version"],
            }

    # Also return list of required consents for bank-split
    required_types = [
        ConsentType.PLATFORM_FEE_DEDUCTION.value,
        ConsentType.DATA_PROCESSING.value,
        ConsentType.TERMS_OF_SERVICE.value,
        ConsentType.BANK_PAYMENT_PROCESSING.value,
        ConsentType.SERVICE_CONFIRMATION_REQUIRED.value,
        ConsentType.HOLD_PERIOD_ACCEPTANCE.value,
    ]

    return {
        "consents": result,
        "required_for_bank_split": required_types,
    }


# ============================================
# Service completion endpoints
# ============================================


@router.post("/{deal_id}/confirm-completion", status_code=status.HTTP_201_CREATED)
async def confirm_completion(
    deal_id: UUID,
    notes: str = None,
    trigger_release: bool = True,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm that service was completed satisfactorily.

    When all parties confirm, the deal can be released from hold
    (immediately if hold period has passed, or scheduled if still in hold).

    RBAC:
    - Agent of the deal
    - Creator of the deal
    - Agency admin/signer (if executor is org)

    Blocks:
    - Cannot confirm if open dispute exists
    - Cannot confirm if already confirmed by this user
    """
    from app.services.bank_split.completion_service import ServiceCompletionService
    from app.services.notification.service import notification_service

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Get client info
    client_ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    # Use completion service for RBAC and release logic
    completion_service = ServiceCompletionService(db)

    try:
        result = await completion_service.confirm_service_completion(
            deal=deal,
            user=current_user,
            notes=notes,
            trigger_release=trigger_release,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        # Send notifications
        try:
            # Notify agent about confirmation (if someone else confirmed)
            if current_user.id != deal.agent_user_id:
                agent = await service._get_user(deal.agent_user_id)
                if agent and agent.phone:
                    await notification_service.send_service_confirmed(
                        phone=agent.phone,
                        address=deal.property_address,
                        confirmed_by=current_user.display_name,
                    )

            # Notify client about confirmation
            if deal.client_phone and current_user.id == deal.agent_user_id:
                await notification_service.send_service_confirmed(
                    phone=deal.client_phone,
                    address=deal.property_address,
                    confirmed_by="Исполнитель",
                )

            # If release was triggered, notify about payout
            if result.release_triggered:
                agent = await service._get_user(deal.agent_user_id)
                if agent:
                    await notification_service.notify_hold_released(
                        phone=agent.phone,
                        email=agent.email,
                        agent_name=agent.display_name,
                        address=deal.property_address or "",
                        amount=float(deal.commission_agent) if deal.commission_agent else 0,
                    )
        except Exception as e:
            logger.warning(f"Failed to send notification for completion: {e}")

        # UC-3.2: Client confirmation flow
        if result.awaiting_client_confirmation:
            return {
                "message": "Все агенты подтвердили. Ожидается подтверждение клиента.",
                "deal_status": deal.status,
                "all_confirmed": result.all_confirmed,
                "awaiting_client_confirmation": True,
                "act_document_id": str(result.act_document.id) if result.act_document else None,
                "signing_url": result.signing_url,
                "client_confirmation_deadline": deal.client_confirmation_deadline.isoformat() if deal.client_confirmation_deadline else None,
            }

        if result.release_triggered:
            return {
                "message": "Service confirmed. All parties confirmed - funds released.",
                "deal_status": deal.status,
                "all_confirmed": result.all_confirmed,
                "release_triggered": True,
            }

        if result.all_confirmed:
            return {
                "message": "Service confirmed. All parties confirmed - release scheduled.",
                "deal_status": deal.status,
                "all_confirmed": True,
                "release_triggered": False,
                "auto_release_at": deal.auto_release_at.isoformat() if deal.auto_release_at else None,
            }

        return {
            "message": "Service completion confirmed",
            "deal_status": deal.status,
            "all_confirmed": False,
            "confirmations": result.confirmations_count,
            "required": result.required_count,
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{deal_id}/completion-status")
async def get_completion_status(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get service completion status for a deal"""
    from app.services.bank_split.completion_service import ServiceCompletionService

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access using completion service RBAC
    completion_service = ServiceCompletionService(db)
    can_view, _ = await completion_service.can_confirm_completion(current_user, deal)

    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get required confirmers and existing confirmations
    required = await completion_service.get_required_confirmers(deal)
    completions = await completion_service.get_existing_confirmations(deal_id)

    confirmed_user_ids = {c.confirmed_by_user_id for c in completions}
    pending_user_ids = required - confirmed_user_ids

    # Check for open disputes
    open_dispute = await completion_service.check_open_disputes(deal_id)

    return {
        "deal_id": str(deal_id),
        "deal_status": deal.status,
        "required_count": len(required),
        "confirmed_count": len(confirmed_user_ids),
        "pending_count": len(pending_user_ids),
        "all_confirmed": len(pending_user_ids) == 0,
        "current_user_confirmed": current_user.id in confirmed_user_ids,
        "current_user_can_confirm": can_view and current_user.id not in confirmed_user_ids,
        "has_open_dispute": open_dispute is not None,
        "auto_release_at": deal.auto_release_at.isoformat() if deal.auto_release_at else None,
        "confirmations": [
            {
                "user_id": c.confirmed_by_user_id,
                "confirmed_at": c.confirmed_at.isoformat(),
                "notes": c.notes,
                "triggers_release": c.triggers_release,
                "release_triggered_at": c.release_triggered_at.isoformat() if c.release_triggered_at else None,
            }
            for c in completions
        ]
    }


# ============================================
# Split adjustment endpoints
# ============================================


@router.post("/{deal_id}/adjust-split", status_code=status.HTTP_201_CREATED)
async def request_split_adjustment(
    deal_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request a split adjustment for a deal.

    All other recipients must approve before the adjustment takes effect.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import select
    from app.models.split_adjustment import SplitAdjustment
    from app.schemas.split_adjustment import SplitAdjustmentCreate

    body = await request.json()
    adjustment_in = SplitAdjustmentCreate(**body)

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check if user is participant
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal participants can request adjustments")

    # Check deal status - adjustments only in certain states
    if deal.status not in ("draft", "awaiting_signatures", "signed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Split adjustments can only be requested before payment"
        )

    # Check for pending adjustments
    existing = await db.execute(
        select(SplitAdjustment).where(
            SplitAdjustment.deal_id == deal_id,
            SplitAdjustment.status == "pending"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is already a pending adjustment for this deal"
        )

    # Get current split
    split_service = SplitService(db)
    recipients = await split_service.get_deal_recipients(deal_id)

    old_split = {str(r.user_id): float(r.split_percent) for r in recipients if r.user_id}

    # Required approvers = all recipients except the requester
    required_approvers = [
        r.user_id for r in recipients
        if r.user_id and r.user_id != current_user.id
    ]

    if not required_approvers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No other recipients to approve the adjustment"
        )

    # Convert new_split keys to strings for JSON storage
    new_split = {str(k): float(v) for k, v in adjustment_in.new_split.items()}

    adjustment = SplitAdjustment(
        deal_id=deal_id,
        requested_by_user_id=current_user.id,
        old_split=old_split,
        new_split=new_split,
        reason=adjustment_in.reason,
        status="pending",
        required_approvers=required_approvers,
        approvals=[],
        rejections=[],
        expires_at=datetime.utcnow() + timedelta(days=7),
    )

    db.add(adjustment)
    await db.commit()
    await db.refresh(adjustment)

    return {
        "id": str(adjustment.id),
        "deal_id": str(deal_id),
        "status": "pending",
        "required_approvers": required_approvers,
        "expires_at": adjustment.expires_at.isoformat()
    }


@router.get("/{deal_id}/adjustments")
async def list_split_adjustments(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all split adjustments for a deal"""
    from sqlalchemy import select
    from app.models.split_adjustment import SplitAdjustment

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(SplitAdjustment)
        .where(SplitAdjustment.deal_id == deal_id)
        .order_by(SplitAdjustment.created_at.desc())
    )
    adjustments = result.scalars().all()

    return {
        "items": [
            {
                "id": str(a.id),
                "requested_by_user_id": a.requested_by_user_id,
                "old_split": a.old_split,
                "new_split": a.new_split,
                "reason": a.reason,
                "status": a.status,
                "required_approvers": a.required_approvers,
                "approvals": a.approvals,
                "rejections": a.rejections,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                "created_at": a.created_at.isoformat(),
            }
            for a in adjustments
        ],
        "total": len(adjustments)
    }


@router.post("/adjustments/{adjustment_id}/approve", status_code=status.HTTP_200_OK)
async def approve_split_adjustment(
    adjustment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a split adjustment request"""
    from datetime import datetime
    from sqlalchemy import select
    from app.models.split_adjustment import SplitAdjustment

    result = await db.execute(
        select(SplitAdjustment).where(SplitAdjustment.id == adjustment_id)
    )
    adjustment = result.scalar_one_or_none()

    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adjustment not found")

    if adjustment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment is already {adjustment.status}"
        )

    # Check expiry
    if adjustment.expires_at and datetime.utcnow() > adjustment.expires_at:
        adjustment.status = "expired"
        adjustment.resolved_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adjustment has expired"
        )

    # Check if user is a required approver
    if current_user.id not in adjustment.required_approvers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a required approver for this adjustment"
        )

    # Check if already approved/rejected by this user
    existing_approval_ids = [a.get("user_id") for a in (adjustment.approvals or [])]
    existing_rejection_ids = [r.get("user_id") for r in (adjustment.rejections or [])]

    if current_user.id in existing_approval_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already approved this adjustment"
        )

    if current_user.id in existing_rejection_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already rejected this adjustment"
        )

    # Add approval
    approvals = list(adjustment.approvals or [])
    approvals.append({
        "user_id": current_user.id,
        "approved_at": datetime.utcnow().isoformat()
    })
    adjustment.approvals = approvals

    # Check if all required approvers have approved
    approved_ids = {a.get("user_id") for a in approvals}
    all_approved = set(adjustment.required_approvers).issubset(approved_ids)

    if all_approved:
        # Apply the adjustment
        adjustment.status = "approved"
        adjustment.resolved_at = datetime.utcnow()

        # Update the actual split recipients
        split_service = SplitService(db)
        await split_service.apply_split_adjustment(adjustment.deal_id, adjustment.new_split)

    await db.commit()

    return {
        "adjustment_id": str(adjustment_id),
        "status": adjustment.status,
        "all_approved": all_approved,
        "approvals_count": len(approvals),
        "required_count": len(adjustment.required_approvers)
    }


@router.post("/adjustments/{adjustment_id}/reject", status_code=status.HTTP_200_OK)
async def reject_split_adjustment(
    adjustment_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a split adjustment request"""
    from datetime import datetime
    from sqlalchemy import select
    from app.models.split_adjustment import SplitAdjustment
    from app.schemas.split_adjustment import SplitAdjustmentReject

    body = await request.json()
    rejection = SplitAdjustmentReject(**body)

    result = await db.execute(
        select(SplitAdjustment).where(SplitAdjustment.id == adjustment_id)
    )
    adjustment = result.scalar_one_or_none()

    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adjustment not found")

    if adjustment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment is already {adjustment.status}"
        )

    # Check if user is a required approver
    if current_user.id not in adjustment.required_approvers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a required approver for this adjustment"
        )

    # Check if already voted
    existing_approval_ids = [a.get("user_id") for a in (adjustment.approvals or [])]
    existing_rejection_ids = [r.get("user_id") for r in (adjustment.rejections or [])]

    if current_user.id in existing_approval_ids or current_user.id in existing_rejection_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already voted on this adjustment"
        )

    # Add rejection - any rejection immediately rejects the adjustment
    rejections = list(adjustment.rejections or [])
    rejections.append({
        "user_id": current_user.id,
        "rejected_at": datetime.utcnow().isoformat(),
        "reason": rejection.reason
    })
    adjustment.rejections = rejections
    adjustment.status = "rejected"
    adjustment.resolved_at = datetime.utcnow()

    await db.commit()

    return {
        "adjustment_id": str(adjustment_id),
        "status": "rejected",
        "rejected_by": current_user.id,
        "reason": rejection.reason
    }


# ============================================
# Contract endpoints
# ============================================


@router.post("/{deal_id}/contracts/generate", status_code=status.HTTP_201_CREATED)
async def generate_contract(
    deal_id: UUID,
    contract_type: str = "bank_split_agent_agreement",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a contract for the deal.

    Contract types:
    - bank_split_agent_agreement: Agent service agreement
    - bank_split_client_agreement: Client consent
    - bank_split_agency_agreement: Agency split agreement
    """
    from app.services.contract import ContractGenerationService
    from app.models.document import TemplateType

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Map contract type
    try:
        template_type = TemplateType(contract_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid contract type: {contract_type}"
        )

    contract_service = ContractGenerationService(db)
    contract = await contract_service.generate_contract(
        deal=deal,
        template_type=template_type,
        agent_user=current_user,
    )

    await db.commit()

    return {
        "id": str(contract.id),
        "contract_number": contract.contract_number,
        "contract_type": contract.contract_type,
        "status": contract.status,
        "generated_at": contract.generated_at.isoformat(),
        "expires_at": contract.expires_at.isoformat() if contract.expires_at else None,
        "required_signers": contract.required_signers,
    }


@router.get("/{deal_id}/contracts")
async def list_deal_contracts(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all contracts for a deal"""
    from app.services.contract import ContractGenerationService

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    contract_service = ContractGenerationService(db)
    contracts = await contract_service.get_deal_contracts(deal_id)

    return {
        "items": [
            {
                "id": str(c.id),
                "contract_number": c.contract_number,
                "contract_type": c.contract_type,
                "status": c.status,
                "generated_at": c.generated_at.isoformat() if c.generated_at else None,
                "signed_at": c.signed_at.isoformat() if c.signed_at else None,
                "expires_at": c.expires_at.isoformat() if c.expires_at else None,
                "required_signers": c.required_signers,
            }
            for c in contracts
        ],
        "total": len(contracts)
    }


@router.get("/contracts/{contract_id}")
async def get_contract(
    contract_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get contract details including HTML content"""
    from app.services.contract import ContractGenerationService

    contract_service = ContractGenerationService(db)
    contract = await contract_service.get_contract(contract_id)

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # Check access through deal
    service = BankSplitDealService(db)
    deal = await service.get_deal(contract.deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {
        "id": str(contract.id),
        "contract_number": contract.contract_number,
        "contract_type": contract.contract_type,
        "status": contract.status,
        "html_content": contract.html_content,
        "document_hash": contract.document_hash,
        "contract_data": contract.contract_data,
        "commission_amount": float(contract.commission_amount) if contract.commission_amount else None,
        "generated_at": contract.generated_at.isoformat() if contract.generated_at else None,
        "signed_at": contract.signed_at.isoformat() if contract.signed_at else None,
        "expires_at": contract.expires_at.isoformat() if contract.expires_at else None,
        "required_signers": contract.required_signers,
    }


@router.post("/contracts/{contract_id}/sign", status_code=status.HTTP_200_OK)
async def sign_contract(
    contract_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sign a contract"""
    from app.services.contract import ContractGenerationService

    # Get client info
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    contract_service = ContractGenerationService(db)

    try:
        signature = await contract_service.sign_contract(
            contract_id=contract_id,
            user=current_user,
            ip_address=client_ip,
            user_agent=user_agent,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()

    # Get updated contract status
    contract = await contract_service.get_contract(contract_id)

    return {
        "message": "Contract signed successfully",
        "signed_at": signature.signed_at.isoformat(),
        "contract_status": contract.status,
        "all_signed": contract.status == "fully_signed",
    }


# ============================================
# Public payment page endpoint
# ============================================


@router.get("/{deal_id}/payment-info")
async def get_payment_info(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get public payment info for payment page.

    This is a PUBLIC endpoint - no authentication required.
    Used by the public payment page to display payment information.
    """
    from app.schemas.bank_split import PaymentInfoResponse
    from datetime import datetime

    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Map deal status to payment status
    if deal.status in ('closed', 'payout_ready', 'payout_in_progress'):
        payment_status = 'paid'
    elif deal.status in ('cancelled', 'refunded'):
        payment_status = 'cancelled'
    elif deal.expires_at:
        # Handle timezone-aware/naive comparison
        expires_at = deal.expires_at.replace(tzinfo=None) if deal.expires_at.tzinfo else deal.expires_at
        if datetime.utcnow() > expires_at:
            payment_status = 'expired'
        else:
            payment_status = 'pending'
    else:
        payment_status = 'pending'

    return PaymentInfoResponse(
        deal_id=deal.id,
        property_address=deal.property_address or "Адрес не указан",
        amount=deal.commission_agent or 0,
        payment_url=deal.payment_link_url,
        qr_code=deal.payment_qr_payload,
        expires_at=deal.expires_at,
        status=payment_status,
        client_name=deal.client_name,
    )


# ============================================
# INN Validation endpoint
# ============================================


@router.post("/validate-inn")
async def validate_inn(
    inn: str,
    role: str = "agent",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate INN with comprehensive checks.

    Validates:
    - INN checksum (format)
    - Blacklist status
    - NPD (self-employed) status for individuals

    Args:
        inn: The INN to validate (10 or 12 digits)
        role: Recipient role for context-specific validation (agent, agency, client)

    Returns:
        Validation result with detailed information
    """
    from app.services.inn import INNValidationService

    service = INNValidationService(db)
    result = await service.validate_recipient_inn(inn=inn, role=role)

    return {
        "inn": result.inn,
        "is_valid": result.is_valid,
        "status": result.status.value,
        "inn_type": result.inn_type,
        "npd_status": result.npd_status.value if result.npd_status else None,
        "npd_registration_date": result.npd_registration_date.isoformat() if result.npd_registration_date else None,
        "is_blacklisted": result.is_blacklisted,
        "errors": result.errors,
        "warnings": result.warnings,
    }


# ============================================
# Webhook endpoint
# ============================================


@router.post("/webhooks/tbank", response_model=WebhookResponse)
async def tbank_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle T-Bank webhook notifications.

    This endpoint receives payment status updates from T-Bank.

    Security features:
    - Signature validation (HMAC-SHA256)
    - Idempotent processing (duplicate webhooks are no-op)
    - Dead Letter Queue for failed events
    """
    from datetime import datetime
    from app.services.bank_split.webhook_service import (
        verify_webhook_signature,
        WebhookService,
    )

    # Get raw body for signature verification
    body = await request.body()

    # Verify signature from header
    signature = request.headers.get("X-TBank-Signature", "")
    signature_valid = verify_webhook_signature(
        body,
        signature,
        settings.TBANK_WEBHOOK_SECRET,
    )

    # If signature invalid and secret is configured, return 401
    if not signature_valid and settings.TBANK_WEBHOOK_SECRET:
        logger.warning(
            f"Invalid webhook signature. "
            f"IP: {request.client.host if request.client else 'unknown'}, "
            f"Signature: {signature[:16] if signature else 'none'}..."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )

    # Parse payload
    try:
        payload_dict = await request.json()
        payload = TBankWebhookPayload(**payload_dict)
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload"
        )

    # Initialize services
    handler = TBankWebhookHandler()
    webhook_service = WebhookService(db)

    # Generate idempotency key from payload
    # Use EventId if available, otherwise PaymentId + Status
    idempotency_key = (
        payload_dict.get("EventId") or
        f"{payload.PaymentId}:{payload_dict.get('Status', 'unknown')}"
    )

    # Check idempotency - if already processed, return success immediately
    existing_event = await webhook_service.check_idempotency(idempotency_key)
    if existing_event:
        logger.info(f"Webhook already processed: {idempotency_key}")
        return WebhookResponse(Success=True)

    # Parse event
    event = handler.parse_event(payload_dict)

    # Create bank event record
    bank_event = BankEvent(
        deal_id=None,
        provider="tbank",
        external_event_id=event.event_id or payload.PaymentId,
        event_type=event.event_type.value,
        payload=payload_dict,
        idempotency_key=idempotency_key,
        status="pending",
        signature_valid=signature_valid,
        received_at=datetime.utcnow(),
    )

    deal_id = None

    # Find deal by OrderId (which is our deal UUID)
    if payload.OrderId:
        try:
            deal_id = UUID(payload.OrderId)
            service = BankSplitDealService(db)
            deal = await service.get_deal(deal_id)

            if deal:
                bank_event.deal_id = deal.id

                # Process based on event type
                if event.event_type.value in ("deal.paid", "payment.confirmed"):
                    await service.handle_payment_received(deal)
                    logger.info(f"Payment received for deal {deal_id}")

                elif event.event_type.value == "deal.released":
                    if deal.status == "hold_period":
                        await service.release_from_hold(deal)
                    logger.info(f"Deal {deal_id} released")

                elif event.event_type.value in ("deal.cancelled", "payment.refunded"):
                    await service.cancel_deal(deal, reason="Cancelled by bank")
                    logger.info(f"Deal {deal_id} cancelled")

                # Mark as processed
                await webhook_service.mark_processed(bank_event)

            else:
                # Deal not found - save to DLQ
                bank_event.status = "failed"
                bank_event.processing_error = f"Deal not found: {deal_id}"
                await webhook_service.save_to_dlq(
                    event_type=event.event_type.value,
                    payload=payload_dict,
                    error_message=f"Deal not found: {deal_id}",
                    deal_id=None,
                )

        except ValueError as e:
            # Invalid UUID format
            logger.error(f"Invalid OrderId format: {payload.OrderId}")
            bank_event.processing_error = f"Invalid OrderId: {e}"
            bank_event.status = "failed"
            await webhook_service.save_to_dlq(
                event_type=event.event_type.value,
                payload=payload_dict,
                error_message=f"Invalid OrderId format: {payload.OrderId}",
            )

        except Exception as e:
            # General processing error - save to DLQ
            logger.error(f"Error processing webhook: {e}")
            bank_event.processing_error = str(e)
            bank_event.status = "failed"
            await webhook_service.save_to_dlq(
                event_type=event.event_type.value,
                payload=payload_dict,
                error_message=str(e),
                deal_id=deal_id,
            )

    else:
        # No OrderId - save to DLQ for manual review
        bank_event.status = "failed"
        bank_event.processing_error = "No OrderId in webhook payload"
        await webhook_service.save_to_dlq(
            event_type=event.event_type.value,
            payload=payload_dict,
            error_message="No OrderId in webhook payload",
        )

    db.add(bank_event)
    await db.commit()

    # Always return success to prevent T-Bank retries
    # (failed events are stored in DLQ for manual handling)
    return WebhookResponse(Success=True)


# ============================================
# T-Bank Checks (Fiscal Receipts) Webhook
# ============================================


@router.post("/webhooks/tbank-checks", response_model=WebhookResponse)
async def tbank_checks_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle T-Bank Checks (fiscal receipts) webhook notifications.

    TASK-3.2: T-Bank Checks Integration

    This endpoint receives receipt status updates from T-Bank Checks API.
    Notifications are sent when:
    - Receipt is successfully created (fiscal data ready)
    - Receipt failed to create
    - Receipt was cancelled
    """
    from datetime import datetime
    from uuid import UUID as PyUUID
    from app.services.fiscalization import FiscalReceiptService
    from app.models.fiscalization import FiscalReceipt, FiscalReceiptStatus

    # Parse payload
    try:
        payload_dict = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse T-Bank Checks webhook payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload"
        )

    logger.info(f"Received T-Bank Checks webhook: {payload_dict}")

    # Extract receipt info from payload
    # T-Bank Checks webhook format may vary, handle both formats
    receipt_id = payload_dict.get("ReceiptId") or payload_dict.get("PaymentId")
    receipt_status = payload_dict.get("Status", "").lower()
    order_id = payload_dict.get("OrderId")

    if not receipt_id:
        logger.warning("T-Bank Checks webhook missing ReceiptId/PaymentId")
        return WebhookResponse(Success=True)

    # Find the fiscal receipt by external_id
    from sqlalchemy import select

    stmt = select(FiscalReceipt).where(FiscalReceipt.external_id == receipt_id)
    result = await db.execute(stmt)
    fiscal_receipt = result.scalar_one_or_none()

    if not fiscal_receipt and order_id:
        # Try finding by deal_id (order_id is our deal UUID)
        try:
            deal_uuid = PyUUID(order_id)
            stmt = select(FiscalReceipt).where(
                FiscalReceipt.deal_id == deal_uuid,
                FiscalReceipt.status == FiscalReceiptStatus.PENDING.value,
            ).order_by(FiscalReceipt.created_at.desc())
            result = await db.execute(stmt)
            fiscal_receipt = result.scalar_one_or_none()
        except ValueError:
            pass

    if not fiscal_receipt:
        logger.warning(f"Fiscal receipt not found for external_id: {receipt_id}")
        return WebhookResponse(Success=True)

    # Update receipt status
    old_status = fiscal_receipt.status

    if receipt_status in ("done", "confirmed", "success"):
        fiscal_receipt.status = FiscalReceiptStatus.CREATED.value
        fiscal_receipt.confirmed_at = datetime.utcnow()

        # Extract fiscal data if available
        if "FiscalNumber" in payload_dict or "Fp" in payload_dict:
            fiscal_receipt.fiscal_data = {
                "fiscal_number": payload_dict.get("FiscalNumber"),
                "fiscal_sign": payload_dict.get("Fp"),
                "fiscal_document": payload_dict.get("Fd"),
                "fn_number": payload_dict.get("FnNumber"),
            }

        # Get receipt URL if available
        if payload_dict.get("ReceiptUrl"):
            fiscal_receipt.receipt_url = payload_dict["ReceiptUrl"]

    elif receipt_status in ("fail", "failed", "error"):
        fiscal_receipt.status = FiscalReceiptStatus.FAILED.value
        fiscal_receipt.error_code = payload_dict.get("ErrorCode")
        fiscal_receipt.error_message = payload_dict.get("Message") or payload_dict.get("ErrorMessage")

    elif receipt_status in ("cancelled", "canceled"):
        fiscal_receipt.status = FiscalReceiptStatus.CANCELLED.value

    await db.commit()

    if old_status != fiscal_receipt.status:
        logger.info(
            f"Fiscal receipt {fiscal_receipt.id} status updated: "
            f"{old_status} -> {fiscal_receipt.status}"
        )

    return WebhookResponse(Success=True)


# ============================================
# TASK-2.4: Milestone endpoints
# ============================================


@router.get("/{deal_id}/milestones")
async def get_deal_milestones(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all milestones for a deal.

    Returns list of payment milestones with their status and release information.
    """
    from app.services.bank_split.milestone_service import MilestoneService
    from app.schemas.bank_split import MilestoneResponse, MilestoneListResponse
    from decimal import Decimal

    # Check deal access
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get milestones
    milestone_service = MilestoneService(db)
    milestones = await milestone_service.get_deal_milestones(deal_id)

    # Calculate totals
    total_amount = Decimal("0")
    released_amount = Decimal("0")
    pending_amount = Decimal("0")

    items = []
    for m in milestones:
        total_amount += m.amount
        if m.status == "released":
            released_amount += m.amount
        elif m.status != "cancelled":
            pending_amount += m.amount

        items.append(MilestoneResponse(
            id=m.id,
            deal_id=m.deal_id,
            step_no=m.step_no,
            name=m.name,
            description=m.description,
            amount=m.amount,
            percent=m.percent,
            currency=m.currency,
            status=m.status,
            release_trigger=m.release_trigger,
            release_delay_hours=m.release_delay_hours,
            release_date=m.release_date,
            release_scheduled_at=m.release_scheduled_at,
            paid_at=m.paid_at,
            confirmed_at=m.confirmed_at,
            released_at=m.released_at,
            confirmed_by_user_id=m.confirmed_by_user_id,
            external_step_id=m.external_step_id,
            created_at=m.created_at,
            updated_at=m.updated_at,
        ))

    return MilestoneListResponse(
        items=items,
        total=len(items),
        total_amount=total_amount,
        released_amount=released_amount,
        pending_amount=pending_amount,
    )


@router.post("/{deal_id}/milestones", status_code=status.HTTP_201_CREATED)
async def create_milestones(
    deal_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create milestones for a deal.

    Milestones define how the payment is split into stages with different release triggers:
    - IMMEDIATE: Release after minimal hold (e.g., 1 hour)
    - SHORT_HOLD: Release after specified hours
    - CONFIRMATION: Release after manual confirmation
    - DATE: Release on specific date

    Example:
    ```json
    {
        "milestones": [
            {"name": "Advance", "percent": 30, "trigger": "immediate"},
            {"name": "Remainder", "percent": 70, "trigger": "confirmation"}
        ]
    }
    ```
    """
    from app.services.bank_split.milestone_service import MilestoneService, MilestoneConfig
    from app.schemas.bank_split import CreateMilestonesRequest, MilestoneResponse
    from app.models.bank_split import ReleaseTrigger

    # Parse request
    body = await request.json()
    milestones_request = CreateMilestonesRequest(**body)

    # Check deal access
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only deal creator can create milestones"
        )

    # Check deal status - milestones can only be created in draft/awaiting_signatures
    if deal.status not in ("draft", "awaiting_signatures"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create milestones: deal is in {deal.status} status"
        )

    # Check if milestones already exist
    milestone_service = MilestoneService(db)
    existing = await milestone_service.get_deal_milestones(deal_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Milestones already exist for this deal"
        )

    # Convert to MilestoneConfig
    configs = []
    for m in milestones_request.milestones:
        configs.append(MilestoneConfig(
            name=m.name,
            percent=m.percent,
            trigger=ReleaseTrigger(m.trigger.value),
            description=m.description,
            release_delay_hours=m.release_delay_hours,
            release_date=m.release_date,
        ))

    try:
        milestones = await milestone_service.create_milestones_for_deal(
            deal_id=deal_id,
            config=configs,
            total_amount=deal.commission_agent,
        )
        await db.commit()

        return {
            "message": f"Created {len(milestones)} milestones",
            "milestones": [
                MilestoneResponse(
                    id=m.id,
                    deal_id=m.deal_id,
                    step_no=m.step_no,
                    name=m.name,
                    description=m.description,
                    amount=m.amount,
                    percent=m.percent,
                    currency=m.currency,
                    status=m.status,
                    release_trigger=m.release_trigger,
                    release_delay_hours=m.release_delay_hours,
                    release_date=m.release_date,
                    release_scheduled_at=m.release_scheduled_at,
                    paid_at=m.paid_at,
                    confirmed_at=m.confirmed_at,
                    released_at=m.released_at,
                    confirmed_by_user_id=m.confirmed_by_user_id,
                    external_step_id=m.external_step_id,
                    created_at=m.created_at,
                    updated_at=m.updated_at,
                )
                for m in milestones
            ]
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/milestones/{milestone_id}/release")
async def release_milestone(
    deal_id: UUID,
    milestone_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually release a milestone.

    For milestones with CONFIRMATION trigger, this releases the funds immediately.
    For other triggers, use force=true to release before scheduled time.
    """
    from app.services.bank_split.milestone_service import MilestoneService
    from app.schemas.bank_split import MilestoneReleaseRequest, MilestoneReleaseResponse

    # Parse request
    body = await request.json() if await request.body() else {}
    release_request = MilestoneReleaseRequest(**body)

    # Check deal access
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id and deal.agent_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get milestone
    milestone_service = MilestoneService(db)
    milestone = await milestone_service.get_milestone(milestone_id)

    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    if milestone.deal_id != deal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Milestone does not belong to this deal")

    # Process release
    result = await milestone_service.process_milestone_release(
        milestone_id=milestone_id,
        force=release_request.force,
    )
    await db.commit()

    return MilestoneReleaseResponse(
        milestone_id=milestone_id,
        success=result.success,
        released_amount=result.released_amount,
        error_message=result.error_message,
        new_status=result.milestone.status if result.milestone else "unknown",
    )


@router.post("/{deal_id}/milestones/{milestone_id}/confirm")
async def confirm_milestone(
    deal_id: UUID,
    milestone_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm a milestone for release.

    This is used for milestones with CONFIRMATION trigger.
    After confirmation, the milestone moves to HOLD status and is released immediately.
    """
    from app.services.bank_split.milestone_service import MilestoneService
    from app.schemas.bank_split import MilestoneConfirmRequest, MilestoneConfirmResponse

    # Parse request
    body = await request.json() if await request.body() else {}
    confirm_request = MilestoneConfirmRequest(**body)

    # Check deal access
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get milestone
    milestone_service = MilestoneService(db)
    milestone = await milestone_service.get_milestone(milestone_id)

    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    if milestone.deal_id != deal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Milestone does not belong to this deal")

    try:
        milestone = await milestone_service.confirm_milestone(
            milestone_id=milestone_id,
            user=current_user,
            notes=confirm_request.notes,
        )
        await db.commit()

        return MilestoneConfirmResponse(
            milestone_id=milestone_id,
            confirmed_at=milestone.confirmed_at,
            confirmed_by_user_id=milestone.confirmed_by_user_id,
            new_status=milestone.status,
            release_scheduled_at=milestone.release_scheduled_at,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{deal_id}/milestones/summary")
async def get_milestones_summary(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get summary of milestones for a deal.

    Returns total amounts, released amounts, and milestone details.
    """
    from app.services.bank_split.milestone_service import MilestoneService

    # Check deal access
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    milestone_service = MilestoneService(db)
    summary = await milestone_service.get_milestones_summary(deal_id)

    return summary


@router.get("/milestones/configs")
async def get_milestone_configs(
    current_user: User = Depends(get_current_user),
):
    """
    Get available predefined milestone configurations.

    Returns list of available configs that can be used when creating milestones.
    """
    from app.services.bank_split.milestone_service import DEFAULT_MILESTONE_CONFIGS

    configs = {}
    for name, config_list in DEFAULT_MILESTONE_CONFIGS.items():
        configs[name] = [
            {
                "name": c.name,
                "percent": float(c.percent),
                "trigger": c.trigger.value,
                "description": c.description,
                "release_delay_hours": c.release_delay_hours,
            }
            for c in config_list
        ]

    return {
        "configs": configs,
        "available": list(DEFAULT_MILESTONE_CONFIGS.keys()),
    }


# ============================================
# Client Passport endpoints (152-FZ compliant)
# ============================================


@router.put("/{deal_id}/client-passport", status_code=status.HTTP_200_OK)
async def update_client_passport(
    deal_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update client passport data for a deal.

    152-FZ Compliance:
    - All passport data is encrypted before storage
    - A hash is stored for duplicate detection
    - Only masked data is returned in responses

    Required for contract generation.
    """
    from app.schemas.bank_split import ClientPassportUpdate, ClientPassportResponse
    from app.core.encryption import (
        encrypt_passport,
        encrypt_passport_issued_by,
        encrypt_name,
    )

    # Parse request
    body = await request.json()
    passport_data = ClientPassportUpdate(**body)

    # Get deal
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access - only deal creator can update passport
    if deal.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only deal creator can update client passport"
        )

    # Check deal status - can't update passport after payment
    if deal.status in ("hold_period", "closed", "payout_ready", "payout_in_progress"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update passport data after payment"
        )

    # Encrypt passport data
    series_enc, number_enc, passport_hash = encrypt_passport(
        passport_data.passport_series,
        passport_data.passport_number
    )
    issued_by_enc = encrypt_passport_issued_by(passport_data.passport_issued_by)
    birth_place_enc = encrypt_name(passport_data.birth_place)
    registration_enc = encrypt_name(passport_data.registration_address)

    # Update deal
    deal.client_passport_series_encrypted = series_enc
    deal.client_passport_number_encrypted = number_enc
    deal.client_passport_hash = passport_hash
    deal.client_passport_issued_by_encrypted = issued_by_enc
    deal.client_passport_issued_date = passport_data.passport_issued_date
    deal.client_passport_issued_code = passport_data.passport_issued_code
    deal.client_birth_date = passport_data.birth_date
    deal.client_birth_place_encrypted = birth_place_enc
    deal.client_registration_address_encrypted = registration_enc

    await db.commit()

    # Return masked response
    series = passport_data.passport_series
    number = passport_data.passport_number

    return ClientPassportResponse(
        has_passport_data=True,
        passport_series_masked=f"{series[:2]} {series[2:]}",
        passport_number_masked=f"{number[:3]} {number[3:]}",
        passport_issued_date=passport_data.passport_issued_date,
        passport_issued_code=passport_data.passport_issued_code,
        birth_date=passport_data.birth_date,
    )


@router.get("/{deal_id}/client-passport", response_model=dict)
async def get_client_passport_status(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if client passport data is filled.

    Returns masked passport info (NOT decrypted data).
    Full decrypted data is only used internally for contract generation.
    """
    from app.schemas.bank_split import ClientPassportCheckResponse
    from app.core.encryption import decrypt_passport_series, decrypt_passport_number

    # Get deal
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Check what fields are missing
    missing_fields = []
    if not deal.client_passport_series_encrypted:
        missing_fields.append("passport_series")
    if not deal.client_passport_number_encrypted:
        missing_fields.append("passport_number")
    if not deal.client_passport_issued_by_encrypted:
        missing_fields.append("passport_issued_by")
    if not deal.client_passport_issued_date:
        missing_fields.append("passport_issued_date")
    if not deal.client_passport_issued_code:
        missing_fields.append("passport_issued_code")
    if not deal.client_birth_date:
        missing_fields.append("birth_date")
    if not deal.client_birth_place_encrypted:
        missing_fields.append("birth_place")
    if not deal.client_registration_address_encrypted:
        missing_fields.append("registration_address")

    has_passport = len(missing_fields) == 0

    response = {
        "deal_id": str(deal_id),
        "has_passport_data": has_passport,
        "missing_fields": missing_fields,
    }

    # Add masked data if available
    if deal.client_passport_series_encrypted and deal.client_passport_number_encrypted:
        # Decrypt for masking only
        series = decrypt_passport_series(deal.client_passport_series_encrypted)
        number = decrypt_passport_number(deal.client_passport_number_encrypted)
        if series and number:
            response["passport_series_masked"] = f"{series[:2]} {series[2:]}"
            response["passport_number_masked"] = f"{number[:3]} {number[3:]}"

    if deal.client_passport_issued_date:
        response["passport_issued_date"] = deal.client_passport_issued_date.isoformat()

    if deal.client_passport_issued_code:
        response["passport_issued_code"] = deal.client_passport_issued_code

    if deal.client_birth_date:
        response["birth_date"] = deal.client_birth_date.isoformat()

    return response
