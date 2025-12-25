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
            payment_url=intent.payment_url or "",
            amount=intent.amount,
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
        payment = await payment_service.get_payment(payment_id)
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        return {
            "id": str(payment.id),
            "deal_id": str(payment.deal_id),
            "amount": payment.amount,
            "status": payment.status.value,
            "payment_method": payment.payment_method.value if payment.payment_method else None,
            "created_at": payment.created_at.isoformat(),
            "completed_at": payment.completed_at.isoformat() if payment.completed_at else None
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
    
    This endpoint receives payment status updates from the payment provider (СБП).
    Should validate webhook signature in production.
    """
    try:
        # Validate webhook secret
        webhook_secret = request.headers.get("X-Webhook-Secret")
        if settings.PAYMENT_WEBHOOK_SECRET:
            if not webhook_secret or webhook_secret != settings.PAYMENT_WEBHOOK_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook secret"
                )

        # Get webhook data
        data = await request.json()

        payment_service = PaymentService(db)
        
        # Process webhook
        payment_id = data.get("payment_id")
        status_value = data.get("status")
        provider_payment_id = data.get("provider_payment_id")
        
        if not payment_id or not status_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing payment_id or status"
            )
        
        # Update payment status
        await payment_service.update_payment_status(
            payment_id=payment_id,
            status=status_value,
            provider_payment_id=provider_payment_id
        )
        
        return {"status": "ok"}
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error but return 200 to avoid webhook retry storms
        logger.error(f"Payment webhook error: {e}", exc_info=True)
        return {"status": "error", "message": "Webhook processing failed"}

