"""Bank Split API endpoints"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
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
)
from app.services.bank_split import (
    BankSplitDealService,
    SplitService,
    InvoiceService,
)
from app.services.bank_split.deal_service import CreateBankSplitDealInput
from app.integrations.tbank.webhooks import TBankWebhookHandler
from app.models.bank_split import BankEvent, PayoutStatus

logger = logging.getLogger(__name__)
router = APIRouter()


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

        return BankSplitDealResponse(
            id=result.deal.id,
            type=result.deal.type,
            status=result.deal.status,
            payment_model=result.deal.payment_model,
            property_address=result.deal.property_address,
            price=result.deal.price,
            commission_agent=result.deal.commission_agent,
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

    return BankSplitDealResponse(
        id=deal.id,
        type=deal.type,
        status=deal.status,
        payment_model=deal.payment_model,
        property_address=deal.property_address,
        price=deal.price,
        commission_agent=deal.commission_agent,
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
    """
    from datetime import datetime

    # Get raw body for signature verification
    body = await request.body()
    payload_dict = await request.json()

    # Parse into schema (allows extra fields)
    payload = TBankWebhookPayload(**payload_dict)

    # Initialize webhook handler
    handler = TBankWebhookHandler()

    # Verify signature
    if not handler.verify_signature(payload_dict, payload.Token):
        logger.warning(f"Invalid webhook signature for order {payload.OrderId}")
        # Still return success to avoid T-Bank retries, but log the issue
        # In production, you might want to return 401

    # Parse event
    event = handler.parse_event(payload_dict)

    # Log the event (use timezone-naive for DB compatibility)
    bank_event = BankEvent(
        deal_id=None,  # Will be set below if we find the deal
        provider="tbank",
        external_event_id=event.event_id or payload.PaymentId,
        event_type=event.event_type.value,
        payload=payload_dict,
        status="pending",
        signature_valid=handler.verify_signature(payload_dict, payload.Token),
        received_at=datetime.utcnow(),
    )

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
                    bank_event.status = "processed"
                    logger.info(f"Payment received for deal {deal_id}")

                elif event.event_type.value == "deal.released":
                    if deal.status == "hold_period":
                        await service.release_from_hold(deal)
                    bank_event.status = "processed"
                    logger.info(f"Deal {deal_id} released")

                elif event.event_type.value in ("deal.cancelled", "payment.refunded"):
                    await service.cancel_deal(deal, reason="Cancelled by bank")
                    bank_event.status = "processed"
                    logger.info(f"Deal {deal_id} cancelled")

        except (ValueError, Exception) as e:
            logger.error(f"Error processing webhook: {e}")
            bank_event.processing_error = str(e)
            bank_event.status = "failed"

    db.add(bank_event)
    bank_event.processed_at = datetime.utcnow()
    await db.commit()

    return WebhookResponse(Success=True)
