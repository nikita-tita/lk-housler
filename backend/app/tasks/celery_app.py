"""Celery application configuration"""

from celery import Celery

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
)

# Auto-discover tasks in the tasks package
celery_app.autodiscover_tasks(["app.tasks"])
