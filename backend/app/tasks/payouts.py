"""Payout processing tasks"""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.ledger import Payout, SplitStatus, PayoutStatus

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def process_pending_payouts(self):
    """
    Process payouts that have passed their hold period.

    This task should be scheduled to run periodically (e.g., every hour).
    """
    logger.info("Starting payout processing")

    with SessionLocal() as db:
        try:
            # Find payouts ready for processing
            now = datetime.utcnow()
            stmt = (
                select(Payout)
                .where(
                    Payout.status == PayoutStatus.INITIATED,
                    Payout.hold_until <= now
                )
                .options(selectinload(Payout.split))
                .limit(100)  # Process in batches
            )
            result = db.execute(stmt)
            payouts = list(result.scalars().all())

            if not payouts:
                logger.info("No payouts ready for processing")
                return {"processed": 0, "failed": 0}

            processed = 0
            failed = 0

            for payout in payouts:
                try:
                    # Update split status
                    payout.split.status = SplitStatus.PAID

                    # Mark payout as succeeded
                    # In production, this would call the actual payment provider
                    payout.status = PayoutStatus.SUCCEEDED

                    processed += 1
                    logger.info(f"Processed payout {payout.id} for split {payout.split_id}")

                except Exception as e:
                    failed += 1
                    payout.status = PayoutStatus.FAILED
                    payout.error_code = str(e)[:100]
                    logger.error(f"Failed to process payout {payout.id}: {e}")

            db.commit()

            result = {"processed": processed, "failed": failed}
            logger.info(f"Payout processing complete: {result}")
            return result

        except Exception as e:
            logger.error(f"Payout processing error: {e}", exc_info=True)
            db.rollback()
            raise self.retry(exc=e, countdown=60)  # Retry in 1 minute


@celery_app.task
def process_single_payout(payout_id: str):
    """Process a single payout by ID"""
    from uuid import UUID

    logger.info(f"Processing single payout: {payout_id}")

    with SessionLocal() as db:
        try:
            stmt = (
                select(Payout)
                .where(Payout.id == UUID(payout_id))
                .options(selectinload(Payout.split))
            )
            result = db.execute(stmt)
            payout = result.scalar_one_or_none()

            if not payout:
                logger.warning(f"Payout not found: {payout_id}")
                return {"success": False, "error": "Payout not found"}

            if payout.status != PayoutStatus.INITIATED:
                logger.warning(f"Payout {payout_id} not in INITIATED status")
                return {"success": False, "error": "Invalid payout status"}

            # Process payout
            payout.split.status = SplitStatus.PAID
            payout.status = PayoutStatus.SUCCEEDED

            db.commit()

            logger.info(f"Successfully processed payout {payout_id}")
            return {"success": True}

        except Exception as e:
            logger.error(f"Failed to process payout {payout_id}: {e}", exc_info=True)
            db.rollback()
            return {"success": False, "error": str(e)}
