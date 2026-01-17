"""Cleanup background tasks"""

import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def remove_expired_otps(self):
    """
    Remove expired OTP codes from database.
    Runs daily at 3 AM UTC.
    """
    logger.info("Starting expired OTP cleanup")

    # TODO: Implement when OTP model is available
    # from app.db.session import get_db
    # from app.models.otp import OTP
    # with get_db() as db:
    #     deleted = db.query(OTP).filter(OTP.expires_at < datetime.now(timezone.utc)).delete()
    #     db.commit()
    #     logger.info(f"Deleted {deleted} expired OTP codes")

    return {"status": "ok", "deleted": 0, "cleaned_at": datetime.now(timezone.utc).isoformat()}
