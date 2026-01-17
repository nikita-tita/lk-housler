"""Celery application configuration"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings


celery_app = Celery(
    "lk_housler",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    worker_prefetch_multiplier=1,  # Fair distribution
    # Beat schedule for periodic tasks
    beat_schedule={
        # Bank Split: check hold expiry every minute
        "bank-split-check-hold-expiry": {
            "task": "app.tasks.bank_split.check_hold_expiry",
            "schedule": 60.0,  # every 1 minute
            "options": {"queue": "bank_split"},
        },
        # Bank Split: reconciliation with T-Bank every 5 minutes
        "bank-split-reconciliation": {
            "task": "app.tasks.bank_split.reconcile_with_bank",
            "schedule": 300.0,  # every 5 minutes
            "options": {"queue": "bank_split"},
        },
        # Bank Split: check pending webhooks every 2 minutes
        "bank-split-check-pending-webhooks": {
            "task": "app.tasks.bank_split.check_pending_webhooks",
            "schedule": 120.0,  # every 2 minutes
            "options": {"queue": "bank_split"},
        },
        # Cleanup: remove old OTP codes daily at 3 AM
        "cleanup-expired-otps": {
            "task": "app.tasks.cleanup.remove_expired_otps",
            "schedule": crontab(hour=3, minute=0),
            "options": {"queue": "default"},
        },
    },
    task_routes={
        "app.tasks.bank_split.*": {"queue": "bank_split"},
        "app.tasks.payouts.*": {"queue": "payouts"},
        "app.tasks.*": {"queue": "default"},
    },
)

# Auto-discover tasks in the tasks package
celery_app.autodiscover_tasks(["app.tasks"])
