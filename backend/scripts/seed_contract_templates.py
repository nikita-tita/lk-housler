#!/usr/bin/env python3
"""Скрипт для загрузки шаблонов договоров в БД"""

import asyncio
import sys
from pathlib import Path

# Добавляем путь к backend в PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.models.document import ContractTemplate
from app.db.seeds.contract_templates import get_contract_templates


async def seed_templates(db: AsyncSession) -> None:
    """Загружает шаблоны договоров в БД"""
    templates_data = get_contract_templates()

    created = 0
    updated = 0
    skipped = 0

    for data in templates_data:
        # Проверяем, существует ли шаблон с таким кодом
        stmt = select(ContractTemplate).where(ContractTemplate.code == data["code"])
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Обновляем версию если она выше
            if data["version"] > existing.version:
                for key, value in data.items():
                    setattr(existing, key, value)
                updated += 1
                print(f"  Обновлён: {data['code']} v{data['version']}")
            else:
                skipped += 1
                print(f"  Пропущен: {data['code']} (версия {existing.version} >= {data['version']})")
        else:
            # Создаём новый шаблон
            template = ContractTemplate(**data)
            db.add(template)
            created += 1
            print(f"  Создан: {data['code']} - {data['name']}")

    await db.commit()

    print(f"\nИтого: создано {created}, обновлено {updated}, пропущено {skipped}")


async def main():
    print("Загрузка шаблонов договоров...\n")

    async with async_session_maker() as session:
        await seed_templates(session)

    print("\nГотово!")


if __name__ == "__main__":
    asyncio.run(main())
