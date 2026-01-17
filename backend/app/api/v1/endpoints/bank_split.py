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
    Record user consent for a deal.

    Required consents: platform_commission, data_processing, terms_of_service
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

    # Required consents for bank-split deals
    required = [
        ConsentType.PLATFORM_COMMISSION.value,
        ConsentType.DATA_PROCESSING.value,
        ConsentType.TERMS_OF_SERVICE.value,
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


# ============================================
# Service completion endpoints
# ============================================


@router.post("/{deal_id}/confirm-completion", status_code=status.HTTP_201_CREATED)
async def confirm_completion(
    deal_id: UUID,
    notes: str = None,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm that service was completed satisfactorily.

    When all parties confirm, the deal can be released from hold immediately.
    """
    from datetime import datetime
    from sqlalchemy import select
    from app.models.service_completion import ServiceCompletion

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal participants can confirm")

    # Check if deal is in hold period
    if deal.status != "hold_period":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service confirmation is only available during hold period"
        )

    # Check if user already confirmed
    existing = await db.execute(
        select(ServiceCompletion).where(
            ServiceCompletion.deal_id == deal_id,
            ServiceCompletion.confirmed_by_user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already confirmed completion"
        )

    # Get client info
    client_ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    # Create confirmation
    completion = ServiceCompletion(
        deal_id=deal_id,
        confirmed_by_user_id=current_user.id,
        confirmed_at=datetime.utcnow(),
        notes=notes,
        client_ip=client_ip,
        client_user_agent=user_agent,
    )

    db.add(completion)
    await db.commit()

    # Check if all parties confirmed - if so, release immediately
    split_service = SplitService(db)
    recipients = await split_service.get_deal_recipients(deal_id)

    # Get all user IDs that need to confirm
    required_confirmations = {deal.created_by_user_id, deal.agent_user_id}
    for r in recipients:
        if r.user_id:
            required_confirmations.add(r.user_id)

    # Get existing confirmations
    result = await db.execute(
        select(ServiceCompletion.confirmed_by_user_id).where(
            ServiceCompletion.deal_id == deal_id
        )
    )
    confirmed_user_ids = set(result.scalars().all())

    # Check if all confirmed
    all_confirmed = required_confirmations.issubset(confirmed_user_ids)

    if all_confirmed:
        # Release immediately
        await service.release_from_hold(deal)
        await db.commit()
        return {
            "message": "Service confirmed. All parties confirmed - funds released.",
            "deal_status": deal.status,
            "all_confirmed": True
        }

    return {
        "message": "Service completion confirmed",
        "deal_status": deal.status,
        "all_confirmed": False,
        "confirmations": len(confirmed_user_ids),
        "required": len(required_confirmations)
    }


@router.get("/{deal_id}/completion-status")
async def get_completion_status(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get service completion status for a deal"""
    from sqlalchemy import select
    from app.models.service_completion import ServiceCompletion

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

    # Get all user IDs that need to confirm
    split_service = SplitService(db)
    recipients = await split_service.get_deal_recipients(deal_id)

    required_confirmations = {deal.created_by_user_id, deal.agent_user_id}
    for r in recipients:
        if r.user_id:
            required_confirmations.add(r.user_id)

    # Get confirmations
    result = await db.execute(
        select(ServiceCompletion).where(ServiceCompletion.deal_id == deal_id)
    )
    completions = result.scalars().all()

    confirmed_user_ids = {c.confirmed_by_user_id for c in completions}
    pending_user_ids = required_confirmations - confirmed_user_ids

    return {
        "deal_id": str(deal_id),
        "deal_status": deal.status,
        "required_count": len(required_confirmations),
        "confirmed_count": len(confirmed_user_ids),
        "pending_count": len(pending_user_ids),
        "all_confirmed": len(pending_user_ids) == 0,
        "current_user_confirmed": current_user.id in confirmed_user_ids,
        "confirmations": [
            {
                "user_id": c.confirmed_by_user_id,
                "confirmed_at": c.confirmed_at.isoformat(),
                "notes": c.notes
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
