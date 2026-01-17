"""
Feature Flags Utility

Утилиты для проверки feature flags при постепенном раскатывании функционала.
"""

from typing import Optional
from uuid import UUID

from app.core.config import settings


def is_instant_split_enabled(org_id: Optional[UUID] = None) -> bool:
    """
    Проверяет, включен ли instant split для организации.

    Логика:
    1. Если INSTANT_SPLIT_ENABLED=True и список org_ids пуст -> включено для всех
    2. Если INSTANT_SPLIT_ENABLED=True и есть список org_ids -> только для указанных организаций
    3. Если INSTANT_SPLIT_ENABLED=False -> выключено для всех

    Args:
        org_id: UUID организации (опционально)

    Returns:
        True если instant split доступен
    """
    # Глобально выключено
    if not settings.INSTANT_SPLIT_ENABLED:
        return False

    # Глобально включено, проверяем whitelist
    allowed_org_ids = settings.instant_split_org_ids_list

    # Пустой whitelist = включено для всех
    if not allowed_org_ids:
        return True

    # Проверяем, есть ли org_id в whitelist
    if org_id is None:
        return False

    return str(org_id) in allowed_org_ids


def get_feature_flags_status() -> dict:
    """
    Возвращает текущий статус всех feature flags.

    Полезно для отладки и мониторинга.

    Returns:
        Словарь с состоянием feature flags
    """
    return {
        "instant_split": {
            "enabled": settings.INSTANT_SPLIT_ENABLED,
            "org_ids_whitelist": settings.instant_split_org_ids_list,
            "mode": "all" if settings.INSTANT_SPLIT_ENABLED and not settings.instant_split_org_ids_list
                    else "whitelist" if settings.INSTANT_SPLIT_ENABLED
                    else "disabled",
        }
    }
