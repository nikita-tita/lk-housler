"""Public Act signing endpoints for UC-3.2 client confirmation (no auth required)"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.document import Document, SigningToken, Signature
from app.models.deal import Deal, DealStatus
from app.services.signature.service import SignatureService
from app.services.bank_split.deal_service import BankSplitDealService
from app.core.config import settings
from app.core.audit import log_audit_event, AuditEvent

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================


class GeoLocation(BaseModel):
    """Client geolocation for evidence"""
    lat: float
    lon: float
    accuracy: Optional[float] = None


class ActInfoResponse(BaseModel):
    """Response for GET /act/{token}"""
    document_id: str
    document_hash: str
    document_url: Optional[str] = None

    # Deal info
    deal_id: str
    property_address: str
    deal_type: str

    # Financial
    commission_total: Optional[str] = None

    # Client info (masked)
    client_name: str
    phone_masked: str

    # Status
    already_signed: bool
    expires_at: datetime
    deadline: Optional[datetime] = None
    days_until_auto_release: Optional[int] = None

    # Executor info (for Act header)
    executor_name: str
    executor_inn: str

    # Can open dispute
    can_open_dispute: bool


class ActRequestOTPRequest(BaseModel):
    """Request for POST /act/{token}/request-otp"""
    consent_personal_data: bool = Field(..., description="Consent to personal data processing")
    consent_pep: bool = Field(..., description="Consent to PEP (Simple Electronic Signature)")


class ActRequestOTPResponse(BaseModel):
    """Response for POST /act/{token}/request-otp"""
    message: str
    phone_masked: str
    expires_in_seconds: int


class ActSignRequest(BaseModel):
    """Request for POST /act/{token}/sign"""
    code: str = Field(..., min_length=4, max_length=6, description="OTP code from SMS")
    geolocation: Optional[GeoLocation] = None


class ActSignResponse(BaseModel):
    """Response for POST /act/{token}/sign"""
    success: bool
    message: str
    signed_at: datetime
    document_url: Optional[str] = None
    deal_status: str


# =============================================================================
# Helpers
# =============================================================================


def mask_phone(phone: str) -> str:
    """Mask phone number: +7 (999) ***-**-67"""
    if not phone or len(phone) < 10:
        return phone or "***"
    digits = phone.lstrip("+")
    if len(digits) == 11:
        return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"
    return f"***{phone[-4:]}"


async def get_act_signing_token(token: str, db: AsyncSession) -> SigningToken:
    """Get and validate signing token for Act"""
    try:
        stmt = (
            select(SigningToken)
            .where(SigningToken.token == token)
            .options(
                selectinload(SigningToken.document),
                selectinload(SigningToken.party),
            )
        )
        result = await db.execute(stmt)
        signing_token = result.scalar_one_or_none()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ссылка для подписания не найдена",
        )

    if not signing_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ссылка для подписания не найдена или истекла",
        )

    if signing_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Срок действия ссылки истёк",
        )

    if signing_token.used:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Акт уже подписан",
        )

    return signing_token


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/{token}", response_model=ActInfoResponse)
async def get_act_info(token: str, db: AsyncSession = Depends(get_db)):
    """
    Get Act document info for signing (public, no auth required).

    UC-3.2: Client receives this link to view and sign the Act of Completed Services.
    """
    signing_token = await get_act_signing_token(token, db)

    # Get document with deal
    stmt = (
        select(Document)
        .where(Document.id == signing_token.document_id)
        .options(selectinload(Document.deal))
    )
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )

    deal = document.deal

    # Check if Act already signed
    stmt_sig = select(Signature).where(
        Signature.document_id == document.id,
        Signature.signer_party_id == signing_token.party_id,
        Signature.signed_at.isnot(None),
    )
    result_sig = await db.execute(stmt_sig)
    existing_signature = result_sig.scalar_one_or_none()

    # Calculate days until auto-release
    days_until_auto_release = None
    if deal.client_confirmation_deadline:
        delta = deal.client_confirmation_deadline - datetime.utcnow()
        days_until_auto_release = max(0, delta.days)

    # Deal type as string
    deal_type_str = (
        deal.type.value if hasattr(deal.type, "value") else str(deal.type)
    ) if deal.type else "unknown"

    # Client name from deal or party
    client_name = deal.client_name or "Заказчик"
    party = signing_token.party
    if party and party.display_name_snapshot:
        client_name = party.display_name_snapshot

    # Commission
    commission_total = None
    if deal.commission_agent:
        commission_total = f"{int(deal.commission_agent):,}".replace(",", " ")
    elif deal.terms and deal.terms.commission_total:
        commission_total = f"{int(deal.terms.commission_total):,}".replace(",", " ")

    # Can open dispute (only if not already in dispute and deal is awaiting confirmation)
    can_open_dispute = (
        deal.status == DealStatus.AWAITING_CLIENT_CONFIRMATION.value
        and not deal.dispute_locked
    )

    return ActInfoResponse(
        document_id=str(document.id),
        document_hash=document.document_hash,
        document_url=document.file_url,
        deal_id=str(deal.id),
        property_address=deal.property_address or "Не указан",
        deal_type=deal_type_str,
        commission_total=commission_total,
        client_name=client_name,
        phone_masked=mask_phone(signing_token.phone),
        already_signed=existing_signature is not None,
        expires_at=signing_token.expires_at,
        deadline=deal.client_confirmation_deadline,
        days_until_auto_release=days_until_auto_release,
        executor_name=getattr(settings, "COMPANY_NAME", "Исполнитель"),
        executor_inn=getattr(settings, "COMPANY_INN", "не указан") or "не указан",
        can_open_dispute=can_open_dispute,
    )


@router.post("/{token}/request-otp", response_model=ActRequestOTPResponse)
async def request_act_otp(
    token: str,
    request: Request,
    body: ActRequestOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request OTP for Act signing.

    UC-3.2: Client must consent to PD processing and PEP before receiving OTP.
    """
    if not body.consent_personal_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо согласие на обработку персональных данных",
        )

    if not body.consent_pep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо согласие на использование электронной подписи (ПЭП)",
        )

    signing_token = await get_act_signing_token(token, db)

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Send OTP via SignatureService
    signature_service = SignatureService(db)

    try:
        await signature_service.request_otp_for_signing(
            document_id=signing_token.document_id,
            phone=signing_token.phone,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )

    await db.commit()

    logger.info(f"OTP requested for Act signing, token={token[:8]}...")

    return ActRequestOTPResponse(
        message="Код подтверждения отправлен",
        phone_masked=mask_phone(signing_token.phone),
        expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60,
    )


@router.post("/{token}/sign", response_model=ActSignResponse)
async def sign_act(
    token: str,
    request: Request,
    body: ActSignRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Sign Act document with OTP code.

    UC-3.2: After successful signature:
    1. Mark SigningToken as used
    2. Update deal.act_signed_at
    3. Transition deal to PAYOUT_READY
    4. Trigger fund release
    """
    signing_token = await get_act_signing_token(token, db)

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Get document
    stmt = (
        select(Document)
        .where(Document.id == signing_token.document_id)
        .options(selectinload(Document.deal))
    )
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )

    deal = document.deal

    # Verify deal is in correct state
    if deal.status != DealStatus.AWAITING_CLIENT_CONFIRMATION.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Сделка не ожидает подтверждения клиента (текущий статус: {deal.status})",
        )

    # Check for dispute
    if deal.dispute_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="По сделке открыт спор. Подписание акта невозможно.",
        )

    # Extract geolocation if provided
    geolocation = None
    if body.geolocation:
        geolocation = {
            "lat": body.geolocation.lat,
            "lon": body.geolocation.lon,
            "accuracy": body.geolocation.accuracy,
        }

    # Verify OTP and create signature via SignatureService
    signature_service = SignatureService(db)

    try:
        signature = await signature_service.verify_and_sign(
            document=document,
            party_id=signing_token.party_id,
            phone=signing_token.phone,
            otp_code=body.code,
            ip_address=ip_address,
            user_agent=user_agent,
            signing_token=token,
            consent_personal_data=True,
            consent_pep=True,
            geolocation=geolocation,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Mark token as used
    signing_token.used = True
    signing_token.used_at = signature.signed_at

    # UC-3.2: Update deal and transition to PAYOUT_READY
    deal_service = BankSplitDealService(db)
    await deal_service.handle_act_signed(deal)

    # Audit log
    log_audit_event(
        event=AuditEvent.DOCUMENT_SIGNED,
        resource=f"deal:{deal.id}",
        details={
            "document_id": str(document.id),
            "document_type": "act",
            "signed_by": "client",
            "signature_id": str(signature.id),
        },
        ip_address=ip_address,
        user_agent=user_agent,
        success=True,
    )

    await db.commit()

    logger.info(
        f"Act signed for deal {deal.id}, transitioning to PAYOUT_READY"
    )

    # Send notification to agents
    try:
        from app.tasks.bank_split import notify_deal_status_change_task

        notify_deal_status_change_task.delay(
            deal_id=str(deal.id),
            old_status=DealStatus.AWAITING_CLIENT_CONFIRMATION.value,
            new_status=deal.status,
            phone=deal.client_phone,
            address=deal.property_address or "",
        )
    except Exception as e:
        logger.warning(f"Failed to queue notification for deal {deal.id}: {e}")

    return ActSignResponse(
        success=True,
        message="Акт успешно подписан. Выплата будет произведена в ближайшее время.",
        signed_at=signature.signed_at,
        document_url=document.file_url,
        deal_status=deal.status,
    )


# =============================================================================
# Public Dispute Endpoint (UC-3.2)
# =============================================================================


class PublicDisputeRequest(BaseModel):
    """Request for POST /act/{token}/dispute"""
    reason: str = Field(..., description="Reason for dispute")
    description: Optional[str] = Field(None, description="Additional details")


class PublicDisputeResponse(BaseModel):
    """Response for POST /act/{token}/dispute"""
    success: bool
    message: str
    dispute_id: str
    deal_status: str


@router.post("/{token}/dispute", response_model=PublicDisputeResponse)
async def create_public_dispute(
    token: str,
    request: Request,
    body: PublicDisputeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create dispute from client's act signing page (public, no auth required).

    UC-3.2: Client can open a dispute instead of signing the Act.
    This will lock the deal and prevent fund release until dispute is resolved.

    Valid reasons:
    - service_not_provided: Услуга не оказана
    - service_quality: Качество услуги не соответствует
    - incorrect_amount: Неверная сумма
    - other: Другое
    """
    signing_token = await get_act_signing_token(token, db)

    # Get document with deal
    stmt = (
        select(Document)
        .where(Document.id == signing_token.document_id)
        .options(selectinload(Document.deal))
    )
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )

    deal = document.deal

    # Verify deal is in correct state
    if deal.status != DealStatus.AWAITING_CLIENT_CONFIRMATION.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Сделка не ожидает подтверждения клиента (текущий статус: {deal.status})",
        )

    # Check if dispute already exists
    if deal.dispute_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="По сделке уже открыт спор",
        )

    # Validate reason
    valid_reasons = [
        "service_not_provided",
        "service_quality",
        "incorrect_amount",
        "other",
    ]
    if body.reason not in valid_reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимая причина. Выберите одну из: {valid_reasons}",
        )

    # Get IP and user agent for audit
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Create dispute using DisputeService
    from app.services.dispute import DisputeService

    dispute_service = DisputeService(db)

    # Use a special user_id for public disputes (client)
    # We'll use 0 to indicate public/client-initiated dispute
    try:
        dispute = await dispute_service.create_dispute(
            deal_id=deal.id,
            user_id=0,  # Public client dispute
            reason=body.reason,
            description=body.description or "",
            refund_requested=False,
            refund_amount=None,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Mark signing token as used (dispute opened instead of signing)
    signing_token.used = True
    signing_token.used_at = datetime.utcnow()

    # Audit log
    log_audit_event(
        event=AuditEvent.DOCUMENT_SIGNED,  # Using same event, can create specific one later
        resource=f"deal:{deal.id}",
        details={
            "action": "dispute_opened",
            "document_id": str(document.id),
            "dispute_id": str(dispute.id),
            "reason": body.reason,
        },
        ip_address=ip_address,
        user_agent=user_agent,
        success=True,
    )

    await db.commit()

    logger.info(f"Public dispute created for deal {deal.id}, dispute_id: {dispute.id}")

    # Send notification to agents
    try:
        from app.tasks.bank_split import notify_deal_status_change_task

        notify_deal_status_change_task.delay(
            deal_id=str(deal.id),
            old_status=DealStatus.AWAITING_CLIENT_CONFIRMATION.value,
            new_status=deal.status,
            phone=deal.client_phone,
            address=deal.property_address or "",
        )
    except Exception as e:
        logger.warning(f"Failed to queue notification for dispute {dispute.id}: {e}")

    return PublicDisputeResponse(
        success=True,
        message="Спор успешно открыт. Мы свяжемся с вами для уточнения деталей.",
        dispute_id=str(dispute.id),
        deal_status=deal.status,
    )
