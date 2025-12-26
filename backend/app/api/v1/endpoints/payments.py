"""Payment endpoints"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.payment.service import PaymentService
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class CreatePaymentIntentRequest(BaseModel):
    """Create payment intent request"""
    deal_id: str
    amount: int  # in kopeks
    description: Optional[str] = None


class PaymentIntentResponse(BaseModel):
    """Payment intent response"""
    payment_intent_id: str
    payment_url: str
    amount: int
    status: str


@router.post("/intents", response_model=PaymentIntentResponse)
async def create_payment_intent(
    request: CreatePaymentIntentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create payment intent for deal"""
    try:
        payment_service = PaymentService(db)
        
        # Create payment intent
        intent = await payment_service.create_intent(
            deal_id=request.deal_id,
            amount=request.amount,
            description=request.description
        )
        
        return PaymentIntentResponse(
            payment_intent_id=str(intent.id),
            payment_url=intent.sbp_link or "",
            amount=int(intent.amount),
            status=intent.status.value
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create payment intent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment. Please try again later."
        )


@router.get("/{payment_id}")
async def get_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get payment status"""
    try:
        payment_service = PaymentService(db)
        payment = await payment_service.get_payment_with_details(payment_id)

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        # Get deal_id through relationships: payment -> intent -> schedule -> deal_id
        deal_id = None
        if payment.intent and payment.intent.schedule:
            deal_id = str(payment.intent.schedule.deal_id)

        return {
            "id": str(payment.id),
            "deal_id": deal_id,
            "amount": int(payment.gross_amount),
            "status": payment.status.value,
            "created_at": payment.created_at.isoformat(),
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get payment {payment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment information."
        )


@router.post("/webhooks")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Payment provider webhook

    This endpoint receives payment status updates from the payment provider.
    Expects: provider_intent_id, provider_tx_id, status, metadata (optional)
    """
    try:
        # Validate webhook secret (required in production)
        webhook_secret = request.headers.get("X-Webhook-Secret")
        if settings.APP_ENV == "production":
            if not settings.PAYMENT_WEBHOOK_SECRET:
                logger.error("PAYMENT_WEBHOOK_SECRET not configured in production")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Server configuration error"
                )
            if not webhook_secret or webhook_secret != settings.PAYMENT_WEBHOOK_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook secret"
                )
        elif settings.PAYMENT_WEBHOOK_SECRET:
            if not webhook_secret or webhook_secret != settings.PAYMENT_WEBHOOK_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook secret"
                )

        # Get webhook data
        data = await request.json()

        payment_service = PaymentService(db)

        # Extract required fields
        provider_intent_id = data.get("provider_intent_id")
        provider_tx_id = data.get("provider_tx_id")
        status_value = data.get("status")
        metadata = data.get("metadata")

        if not provider_intent_id or not status_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing provider_intent_id or status"
            )

        if status_value == "paid" and not provider_tx_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing provider_tx_id for paid status"
            )

        # Check for duplicate webhook (idempotency)
        if provider_tx_id:
            existing = await payment_service.get_payment_by_provider_tx_id(provider_tx_id)
            if existing:
                logger.info(f"Duplicate webhook for provider_tx_id={provider_tx_id}, skipping")
                return {"status": "ok", "message": "Already processed"}

        # Process webhook
        await payment_service.process_payment_webhook(
            provider_intent_id=provider_intent_id,
            provider_tx_id=provider_tx_id or "",
            status=status_value,
            metadata=metadata
        )

        await db.commit()
        return {"status": "ok"}

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Payment webhook validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log error but return 200 to avoid webhook retry storms
        logger.error(f"Payment webhook error: {e}", exc_info=True)
        return {"status": "error", "message": "Webhook processing failed"}

