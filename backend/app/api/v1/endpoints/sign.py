"""Public signing endpoints (no auth required)"""

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.document import Document, SigningToken, Signature
from app.schemas.signature import (
    SigningInfoResponse,
    RequestOTPRequest,
    RequestOTPResponse,
    VerifySignatureRequest,
    VerifySignatureResponse,
)
from app.services.signature.service import SignatureService
from app.core.config import settings

router = APIRouter()


def mask_phone(phone: str) -> str:
    """Mask phone number: +7 (999) ***-**-67"""
    if len(phone) < 10:
        return phone
    digits = phone.lstrip("+")
    if len(digits) == 11:
        return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"
    return f"***{phone[-4:]}"


async def get_signing_token(token: str, db: AsyncSession) -> SigningToken:
    """Get and validate signing token"""
    try:
        stmt = (
            select(SigningToken)
            .where(SigningToken.token == token)
            .options(selectinload(SigningToken.document), selectinload(SigningToken.party))
        )
        result = await db.execute(stmt)
        signing_token = result.scalar_one_or_none()
    except Exception:
        # Database error or invalid token format
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ссылка для подписания не найдена")

    if not signing_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ссылка для подписания не найдена или истекла")

    if signing_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Срок действия ссылки истёк")

    if signing_token.used:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Документ уже подписан")

    return signing_token


@router.get("/{token}", response_model=SigningInfoResponse)
async def get_signing_info(token: str, db: AsyncSession = Depends(get_db)):
    """Get document info for signing (public, no auth)"""
    signing_token = await get_signing_token(token, db)

    # Get document with deal
    stmt = select(Document).where(Document.id == signing_token.document_id).options(selectinload(Document.deal))
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")

    deal = document.deal
    party = signing_token.party

    # Check if already signed
    stmt_sig = select(Signature).where(
        Signature.document_id == document.id, Signature.signer_party_id == party.id, Signature.signed_at.isnot(None)
    )
    result_sig = await db.execute(stmt_sig)
    existing_signature = result_sig.scalar_one_or_none()

    # Handle deal.type and party.party_role as string or enum
    deal_type_str = deal.type.value if hasattr(deal.type, 'value') else str(deal.type) if deal.type else "unknown"
    party_role_str = party.party_role.value if hasattr(party.party_role, 'value') else str(party.party_role) if party.party_role else "client"

    return SigningInfoResponse(
        document_id=document.id,
        document_hash=document.document_hash,
        document_url=document.file_url,
        deal_type=deal_type_str,
        property_address=deal.property_address or "Не указан",
        commission_total=str(deal.commission_agent) if deal.commission_agent else None,
        party_role=party_role_str,
        party_name=party.display_name_snapshot,
        phone_masked=mask_phone(signing_token.phone),
        already_signed=existing_signature is not None,
        expires_at=signing_token.expires_at,
        executor_name=settings.COMPANY_NAME,
        executor_inn=settings.COMPANY_INN,
    )


@router.post("/{token}/request-otp", response_model=RequestOTPResponse)
async def request_otp(token: str, request: Request, body: RequestOTPRequest, db: AsyncSession = Depends(get_db)):
    """Request OTP for signing"""
    if not body.consent_personal_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Необходимо согласие на обработку персональных данных"
        )

    if not body.consent_pep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Необходимо согласие на использование электронной подписи"
        )

    signing_token = await get_signing_token(token, db)

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
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))

    await db.commit()

    return RequestOTPResponse(
        message="OTP code sent",
        phone_masked=mask_phone(signing_token.phone),
        expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60,
    )


@router.post("/{token}/verify", response_model=VerifySignatureResponse)
async def verify_and_sign(
    token: str, request: Request, body: VerifySignatureRequest, db: AsyncSession = Depends(get_db)
):
    """Verify OTP and sign document"""
    signing_token = await get_signing_token(token, db)

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Get document
    stmt = select(Document).where(Document.id == signing_token.document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")

    # Verify OTP and create signature via SignatureService
    signature_service = SignatureService(db)

    # Extract geolocation if provided
    geolocation = None
    if body.geolocation:
        geolocation = {
            "lat": body.geolocation.lat,
            "lon": body.geolocation.lon,
            "accuracy": body.geolocation.accuracy,
        }

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Mark token as used
    signing_token.used = True
    signing_token.used_at = signature.signed_at

    await db.commit()

    return VerifySignatureResponse(
        success=True,
        message="Document signed successfully",
        signed_at=signature.signed_at,
        document_url=document.file_url,
    )


# Helper function to create signing token (called from deal creation)
async def create_signing_token(
    db: AsyncSession, document_id, party_id, phone: str, expires_days: int = 7
) -> SigningToken:
    """Create signing token for a party"""
    token = secrets.token_urlsafe(16)  # ~22 chars, URL safe

    signing_token = SigningToken(
        token=token,
        document_id=document_id,
        party_id=party_id,
        phone=phone,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
    )
    db.add(signing_token)
    await db.flush()
    await db.refresh(signing_token)

    return signing_token
