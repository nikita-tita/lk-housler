"""Public signing endpoints (no auth required)"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.document import Document, SigningToken, Signature, SignatureMethod, DocumentStatus
from app.models.deal import Deal, DealParty
from app.schemas.signature import (
    SigningInfoResponse,
    RequestOTPRequest,
    RequestOTPResponse,
    VerifySignatureRequest,
    VerifySignatureResponse,
)
from app.services.auth.otp import OTPService
from app.services.sms.provider import get_sms_provider
from app.core.config import settings

router = APIRouter()


def mask_phone(phone: str) -> str:
    """Mask phone number: +7 (999) ***-**-67"""
    if len(phone) < 10:
        return phone
    digits = phone.lstrip('+')
    if len(digits) == 11:
        return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"
    return f"***{phone[-4:]}"


async def get_signing_token(
    token: str,
    db: AsyncSession
) -> SigningToken:
    """Get and validate signing token"""
    stmt = (
        select(SigningToken)
        .where(SigningToken.token == token)
        .options(
            selectinload(SigningToken.document),
            selectinload(SigningToken.party)
        )
    )
    result = await db.execute(stmt)
    signing_token = result.scalar_one_or_none()

    if not signing_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signing link not found or expired"
        )

    if signing_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Signing link has expired"
        )

    if signing_token.used:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Document has already been signed"
        )

    return signing_token


@router.get("/{token}", response_model=SigningInfoResponse)
async def get_signing_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Get document info for signing (public, no auth)"""
    signing_token = await get_signing_token(token, db)

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
            detail="Document not found"
        )

    deal = document.deal
    party = signing_token.party

    # Check if already signed
    stmt_sig = select(Signature).where(
        Signature.document_id == document.id,
        Signature.signer_party_id == party.id,
        Signature.signed_at.isnot(None)
    )
    result_sig = await db.execute(stmt_sig)
    existing_signature = result_sig.scalar_one_or_none()

    return SigningInfoResponse(
        document_id=document.id,
        document_hash=document.document_hash,
        document_url=document.file_url,
        deal_type=deal.type.value if deal.type else "unknown",
        property_address=deal.property_address or "Не указан",
        commission_total=str(deal.commission_agent) if deal.commission_agent else None,
        party_role=party.party_role.value if party.party_role else "client",
        party_name=party.display_name_snapshot,
        phone_masked=mask_phone(signing_token.phone),
        already_signed=existing_signature is not None,
        expires_at=signing_token.expires_at,
        executor_name=settings.COMPANY_NAME,
        executor_inn=settings.COMPANY_INN,
    )


@router.post("/{token}/request-otp", response_model=RequestOTPResponse)
async def request_otp(
    token: str,
    request: Request,
    body: RequestOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Request OTP for signing"""
    if not body.consent_personal_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent to personal data processing is required"
        )

    if not body.consent_pep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent to use electronic signature is required"
        )

    signing_token = await get_signing_token(token, db)

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Send OTP
    otp_service = OTPService(db, get_sms_provider())

    try:
        await otp_service.send_otp(
            phone=signing_token.phone,
            purpose=f"sign_{signing_token.document_id}",
            ip_address=ip_address,
            user_agent=user_agent
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )

    await db.commit()

    return RequestOTPResponse(
        message="OTP code sent",
        phone_masked=mask_phone(signing_token.phone),
        expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60
    )


@router.post("/{token}/verify", response_model=VerifySignatureResponse)
async def verify_and_sign(
    token: str,
    request: Request,
    body: VerifySignatureRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP and sign document"""
    signing_token = await get_signing_token(token, db)

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Verify OTP
    otp_service = OTPService(db, get_sms_provider())

    try:
        verified = await otp_service.verify_otp(
            phone=signing_token.phone,
            code=body.code,
            purpose=f"sign_{signing_token.document_id}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )

    # Get document
    stmt = select(Document).where(Document.id == signing_token.document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Create signature with evidence
    now = datetime.utcnow()
    evidence = {
        "ip": ip_address,
        "user_agent": user_agent,
        "timestamp": now.isoformat(),
        "document_hash": document.document_hash,
        "signing_token": token,
        "consent_personal_data": True,
        "consent_pep": True,
        "otp_verified": True,
        "phone": signing_token.phone,
    }

    signature = Signature(
        document_id=document.id,
        signer_party_id=signing_token.party_id,
        method=SignatureMethod.PEP_SMS,
        phone=signing_token.phone,
        signed_at=now,
        evidence=evidence
    )
    db.add(signature)

    # Mark token as used
    signing_token.used = True
    signing_token.used_at = now

    # Check if all signatures collected
    await _check_document_fully_signed(db, document)

    await db.commit()

    return VerifySignatureResponse(
        success=True,
        message="Document signed successfully",
        signed_at=now,
        document_url=document.file_url
    )


async def _check_document_fully_signed(db: AsyncSession, document: Document):
    """Check if all required signatures are collected"""
    # Get deal with parties
    stmt = (
        select(Deal)
        .where(Deal.id == document.deal_id)
        .options(selectinload(Deal.parties))
    )
    result = await db.execute(stmt)
    deal = result.scalar_one_or_none()

    if not deal:
        return

    # Count required signatures
    required_parties = [p for p in deal.parties if p.signing_required]

    # Get all signatures for this document
    stmt_sigs = select(Signature).where(
        Signature.document_id == document.id,
        Signature.signed_at.isnot(None)
    )
    result_sigs = await db.execute(stmt_sigs)
    signatures = list(result_sigs.scalars().all())

    # Check if all required parties have signed
    signed_party_ids = {s.signer_party_id for s in signatures}
    required_party_ids = {p.id for p in required_parties}

    if required_party_ids.issubset(signed_party_ids):
        document.status = DocumentStatus.SIGNED
        await db.flush()


# Helper function to create signing token (called from deal creation)
async def create_signing_token(
    db: AsyncSession,
    document_id,
    party_id,
    phone: str,
    expires_days: int = 7
) -> SigningToken:
    """Create signing token for a party"""
    token = secrets.token_urlsafe(16)  # ~22 chars, URL safe

    signing_token = SigningToken(
        token=token,
        document_id=document_id,
        party_id=party_id,
        phone=phone,
        expires_at=datetime.utcnow() + timedelta(days=expires_days)
    )
    db.add(signing_token)
    await db.flush()
    await db.refresh(signing_token)

    return signing_token
