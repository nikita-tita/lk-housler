"""Document endpoints"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_deal_access
from app.db.session import get_db
from app.models.user import User
from app.models.document import Document, Signature
from app.models.deal import DealParty
from app.services.document.service import DocumentService
from app.services.deal.service import DealService
from app.services.signature.service import SignatureService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response schemas for signing
class SignRequestOTPRequest(BaseModel):
    """Request OTP for document signing"""
    consent_personal_data: bool = Field(..., description="Consent to personal data processing")
    consent_pep: bool = Field(..., description="Consent to use PEP (simple electronic signature)")


class SignRequestOTPResponse(BaseModel):
    """Response after OTP sent"""
    message: str
    phone_masked: str
    expires_in_seconds: int = 300


class Geolocation(BaseModel):
    """Geolocation data for signature evidence"""
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, ge=0)


class SignVerifyRequest(BaseModel):
    """Verify OTP and sign document"""
    code: str = Field(..., min_length=6, max_length=6)
    geolocation: Optional[Geolocation] = None


class SignVerifyResponse(BaseModel):
    """Response after successful signing"""
    success: bool
    message: str
    signed_at: str
    document_url: Optional[str] = None


def mask_phone(phone: str) -> str:
    """Mask phone number: +7 (999) ***-**-67"""
    if not phone or len(phone) < 10:
        return phone or "***"
    digits = phone.lstrip("+")
    if len(digits) == 11:
        return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"
    return f"***{phone[-4:]}"


async def get_user_party_for_document(
    db: AsyncSession, document: Document, user: User
) -> Optional[DealParty]:
    """Find the party record for current user in the document's deal"""
    stmt = select(DealParty).where(
        DealParty.deal_id == document.deal_id,
        DealParty.party_id == user.id,
        DealParty.signing_required == True
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.post("/deals/{deal_id}/generate")
async def generate_contract(
    deal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Generate contract for deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_access(deal, current_user)

    doc_service = DocumentService(db)

    try:
        document = await doc_service.generate_contract(deal)
        return {
            "id": str(document.id),
            "deal_id": str(deal.id),
            "version": document.version_no,
            "status": document.status,
            "file_url": document.file_url,
            "hash": document.document_hash,
        }
    except Exception as e:
        logger.error(f"Failed to generate document for deal {deal_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document. Please try again later.",
        )


@router.get("/{document_id}")
async def get_document(
    document_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get document metadata"""
    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    return {
        "id": str(document.id),
        "deal_id": str(document.deal_id),
        "version": document.version_no,
        "status": document.status,
        "file_url": document.file_url,
        "hash": document.document_hash,
        "created_at": document.created_at.isoformat(),
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Redirect to document download URL"""
    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    return RedirectResponse(url=document.file_url)


@router.post("/{document_id}/sign/request-otp", response_model=SignRequestOTPResponse)
async def request_sign_otp(
    document_id: str,
    request: Request,
    body: SignRequestOTPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request OTP for document signing (authenticated user)"""
    if not body.consent_personal_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо согласие на обработку персональных данных"
        )

    if not body.consent_pep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо согласие на использование электронной подписи"
        )

    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    # Find user's party in the deal
    party = await get_user_party_for_document(db, document, current_user)
    if not party:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником сделки, требующим подписания"
        )

    # Check if already signed
    stmt = select(Signature).where(
        Signature.document_id == document.id,
        Signature.signer_party_id == party.id,
        Signature.signed_at.isnot(None)
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вы уже подписали этот документ"
        )

    # Get user's phone
    phone = current_user.phone
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Номер телефона не указан в профиле"
        )

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Send OTP via SignatureService
    signature_service = SignatureService(db)

    try:
        await signature_service.request_otp_for_signing(
            document_id=document.id,
            phone=phone,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))

    await db.commit()

    return SignRequestOTPResponse(
        message="Код подтверждения отправлен",
        phone_masked=mask_phone(phone),
        expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60,
    )


@router.post("/{document_id}/sign/verify", response_model=SignVerifyResponse)
async def verify_and_sign_document(
    document_id: str,
    request: Request,
    body: SignVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and sign document (authenticated user)"""
    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    # Find user's party in the deal
    party = await get_user_party_for_document(db, document, current_user)
    if not party:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником сделки, требующим подписания"
        )

    # Get user's phone
    phone = current_user.phone
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Номер телефона не указан в профиле"
        )

    # Get IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

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
            party_id=party.id,
            phone=phone,
            otp_code=body.code,
            ip_address=ip_address,
            user_agent=user_agent,
            consent_personal_data=True,
            consent_pep=True,
            geolocation=geolocation,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()

    return SignVerifyResponse(
        success=True,
        message="Документ успешно подписан",
        signed_at=signature.signed_at.isoformat(),
        document_url=document.file_url,
    )
