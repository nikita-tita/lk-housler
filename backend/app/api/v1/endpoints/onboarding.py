"""Onboarding API endpoints (TASK-5.2)

T-Bank onboarding flow endpoints for merchant registration.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingStartRequest,
    OnboardingStartResponse,
    OnboardingStatusResponse,
    OnboardingSubmitDocumentsRequest,
    OnboardingDocumentSubmitResponse,
    OnboardingCompleteResponse,
    OnboardingWebhookPayload,
    OnboardingWebhookResponse,
    PaymentProfileResponse,
    PaymentProfileListResponse,
)
from app.services.bank_split.onboarding_service import (
    OnboardingService,
    StartOnboardingInput,
)
from app.services.bank_split.onboarding_client import (
    OnboardingDocument,
    DocumentType,
    TBankOnboardingError,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Onboarding endpoints
# ============================================


@router.post("/start", response_model=OnboardingStartResponse, status_code=status.HTTP_201_CREATED)
async def start_onboarding(
    request_data: OnboardingStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Start T-Bank onboarding process.

    Creates a PaymentProfile with legal info and initiates
    onboarding session with T-Bank.

    Required for:
    - Self-employed agents (SE)
    - Individual entrepreneurs (IP)
    - Agencies (OOO)
    """
    service = OnboardingService(db)

    input_data = StartOnboardingInput(
        legal_type=request_data.legal_type,
        legal_name=request_data.legal_name,
        inn=request_data.inn,
        kpp=request_data.kpp,
        ogrn=request_data.ogrn,
        bank_account=request_data.bank_account,
        bank_bik=request_data.bank_bik,
        bank_name=request_data.bank_name,
        bank_corr_account=request_data.bank_corr_account,
        phone=request_data.phone,
        email=request_data.email,
    )

    try:
        result = await service.start_onboarding(
            user_id=current_user.id,
            profile_data=input_data,
            organization_id=request_data.organization_id,
        )
        await db.commit()

        return OnboardingStartResponse(
            profile_id=result.profile.id,
            session_id=result.session.session_id,
            status=result.session.status.value,
            onboarding_url=result.onboarding_url,
            required_documents=[d.value for d in result.session.required_documents],
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except TBankOnboardingError as e:
        logger.error(f"T-Bank onboarding error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bank onboarding error: {e.message}",
        )


@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    profile_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current onboarding status.

    Returns the status of the current user's onboarding process.
    If profile_id is provided, returns status for that specific profile.
    """
    service = OnboardingService(db)

    # If no profile_id, find user's profile
    if not profile_id:
        from sqlalchemy import select
        from app.models.payment_profile import PaymentProfile

        stmt = select(PaymentProfile).where(
            PaymentProfile.user_id == current_user.id,
            PaymentProfile.is_active == True,
        ).order_by(PaymentProfile.created_at.desc())

        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No onboarding found. Start onboarding first.",
            )

        profile_id = profile.id

    try:
        result = await service.check_status(
            profile_id=profile_id,
            user_id=current_user.id,
        )

        session_status = result.session_status

        return OnboardingStatusResponse(
            profile_id=result.profile_id,
            profile_status=result.profile_status,
            session_status=session_status.status.value if session_status else None,
            progress_percent=session_status.progress_percent if session_status else None,
            current_step=session_status.current_step if session_status else None,
            required_documents=[d.value for d in session_status.required_documents] if session_status else [],
            submitted_documents=session_status.submitted_documents if session_status else [],
            is_complete=result.is_complete,
            merchant_id=result.merchant_id,
            rejection_reason=session_status.rejection_reason if session_status else None,
            estimated_completion_hours=session_status.estimated_completion_hours if session_status else None,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except TBankOnboardingError as e:
        logger.warning(f"Failed to get T-Bank status: {e}")
        # Return cached status from profile
        from sqlalchemy import select
        from app.models.payment_profile import PaymentProfile

        stmt = select(PaymentProfile).where(PaymentProfile.id == profile_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if profile:
            return OnboardingStatusResponse(
                profile_id=profile_id,
                profile_status=profile.bank_onboarding_status,
                is_complete=profile.bank_onboarding_status == "approved",
                merchant_id=profile.bank_merchant_id,
            )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to get onboarding status from bank",
        )


@router.post("/documents", response_model=OnboardingDocumentSubmitResponse)
async def submit_documents(
    profile_id: UUID,
    request_data: OnboardingSubmitDocumentsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit documents for onboarding.

    Upload required documents for bank verification.
    """
    service = OnboardingService(db)

    # Convert to internal document format
    documents = []
    for doc in request_data.documents:
        try:
            doc_type = DocumentType(doc.document_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid document type: {doc.document_type}",
            )

        documents.append(OnboardingDocument(
            document_type=doc_type,
            file_url=doc.file_url,
            file_name=doc.file_name,
            file_size=doc.file_size,
            mime_type=doc.mime_type,
        ))

    try:
        success = await service.submit_documents(
            profile_id=profile_id,
            documents=documents,
            user_id=current_user.id,
        )
        await db.commit()

        # Get updated status
        status_result = await service.check_status(profile_id)

        remaining = []
        if status_result.session_status:
            required = set(d.value for d in status_result.session_status.required_documents)
            submitted = set(status_result.session_status.submitted_documents)
            remaining = list(required - submitted)

        return OnboardingDocumentSubmitResponse(
            success=success,
            submitted_count=len(documents),
            remaining_documents=remaining,
            status=status_result.profile_status,
            message="Documents submitted successfully" if success else "Document submission failed",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except TBankOnboardingError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bank error: {e.message}",
        )


@router.post("/complete", response_model=OnboardingCompleteResponse)
async def complete_onboarding(
    profile_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Complete onboarding and get merchant credentials.

    Call this after onboarding is approved to receive
    merchant credentials for payment processing.
    """
    service = OnboardingService(db)

    try:
        credentials = await service.complete_onboarding(
            profile_id=profile_id,
            user_id=current_user.id,
        )
        await db.commit()

        return OnboardingCompleteResponse(
            profile_id=profile_id,
            merchant_id=credentials.merchant_id,
            terminal_key=credentials.terminal_key,
            account_id=credentials.account_id,
            split_enabled=credentials.split_enabled,
            activated_at=credentials.activated_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except TBankOnboardingError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bank error: {e.message}",
        )


# ============================================
# Webhook endpoint
# ============================================


@router.post("/webhook", response_model=OnboardingWebhookResponse)
async def onboarding_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle T-Bank onboarding webhooks.

    Receives status updates from T-Bank:
    - onboarding.approved
    - onboarding.rejected
    - onboarding.documents_required
    - onboarding.pending_review
    """
    # Parse payload
    try:
        payload_dict = await request.json()
        payload = OnboardingWebhookPayload(**payload_dict)
    except Exception as e:
        logger.error(f"Failed to parse onboarding webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )

    logger.info(f"Received onboarding webhook: {payload.event_type}")

    # Verify webhook signature (in production)
    # signature = request.headers.get("X-TBank-Signature")
    # if not verify_signature(payload_dict, signature):
    #     raise HTTPException(status_code=401, detail="Invalid signature")

    service = OnboardingService(db)

    try:
        success = await service.handle_webhook(
            event_type=payload.event_type,
            payload=payload_dict,
        )
        await db.commit()

        if not success:
            logger.warning(f"Webhook not handled: {payload.event_type}")

    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Still return success to prevent retries
        # Failed events should be handled via dead letter queue

    return OnboardingWebhookResponse(success=True)


# ============================================
# Profile management endpoints
# ============================================


@router.get("/profiles", response_model=PaymentProfileListResponse)
async def list_payment_profiles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List user's payment profiles.

    Returns all payment profiles owned by the current user.
    """
    from sqlalchemy import select
    from app.models.payment_profile import PaymentProfile
    from app.core.encryption import decrypt_inn

    stmt = select(PaymentProfile).where(
        PaymentProfile.user_id == current_user.id,
        PaymentProfile.is_active == True,
    ).order_by(PaymentProfile.created_at.desc())

    result = await db.execute(stmt)
    profiles = result.scalars().all()

    items = []
    for p in profiles:
        # Mask INN (show only last 4 digits)
        try:
            inn = decrypt_inn(p.inn_encrypted)
            inn_masked = f"{'*' * (len(inn) - 4)}{inn[-4:]}" if inn else "****"
        except Exception:
            inn_masked = "****"

        items.append(PaymentProfileResponse(
            id=p.id,
            user_id=p.user_id,
            organization_id=p.organization_id,
            legal_type=p.legal_type,
            legal_name=p.legal_name,
            inn_masked=inn_masked,
            bank_name=p.bank_name,
            bank_bik=p.bank_bik,
            bank_onboarding_status=p.bank_onboarding_status,
            bank_merchant_id=p.bank_merchant_id,
            bank_onboarded_at=p.bank_onboarded_at,
            kyc_status=p.kyc_status,
            is_active=p.is_active,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))

    return PaymentProfileListResponse(items=items, total=len(items))


@router.get("/profiles/{profile_id}", response_model=PaymentProfileResponse)
async def get_payment_profile(
    profile_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get payment profile details.
    """
    from sqlalchemy import select
    from app.models.payment_profile import PaymentProfile
    from app.core.encryption import decrypt_inn

    stmt = select(PaymentProfile).where(PaymentProfile.id == profile_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    # Access check
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Mask INN
    try:
        inn = decrypt_inn(profile.inn_encrypted)
        inn_masked = f"{'*' * (len(inn) - 4)}{inn[-4:]}" if inn else "****"
    except Exception:
        inn_masked = "****"

    return PaymentProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        organization_id=profile.organization_id,
        legal_type=profile.legal_type,
        legal_name=profile.legal_name,
        inn_masked=inn_masked,
        bank_name=profile.bank_name,
        bank_bik=profile.bank_bik,
        bank_onboarding_status=profile.bank_onboarding_status,
        bank_merchant_id=profile.bank_merchant_id,
        bank_onboarded_at=profile.bank_onboarded_at,
        kyc_status=profile.kyc_status,
        is_active=profile.is_active,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )
