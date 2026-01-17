# Feature: Bank Hold + Split

**Кодовое имя:** `bank-split`
**Статус:** `IN DEVELOPMENT`
**Приоритет:** HIGH
**Владелец:** TPM-LK
**Обновлено:** 2026-01-17

---

## Описание

Переход с модели Merchant of Record (MoR) на модель Instant Split через Т-Банк:

**Модель:** Договор → Подпись → Счет → Оплата → Авто-сплит (макс 1 час холда)

- Деньги сразу распределяются участникам (не долгий escrow)
- Housler = витрина + арбитр условий
- Housler получает revshare от банка (НЕ участник сплита)
- Договор фиксирует условия, счет привязан к договору

## Документация

| Документ | Описание | Статус |
|----------|----------|--------|
| [SPEC.md](./SPEC.md) | Полная спецификация: БЫЛО/БУДЕТ, миграция, API | READY |
| [DB_SCHEMA.md](./DB_SCHEMA.md) | Схема БД, ERD, индексы | READY |
| [DECISIONS.md](./DECISIONS.md) | Бизнес-решения, политика корректировок | READY |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура решения | READY |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | API контракты (OpenAPI) | READY |
| [TASKS.md](./TASKS.md) | Декомпозиция на задачи | READY |

---

## Roadmap

```
                                                                              WE ARE HERE
                                                                                   |
                                                                                   v
[SPEC] ──> [DECISIONS] ──> [ARCHITECTURE] ──> [DECOMPOSITION] ──> [DEV] ──> [QA] ──> [RELEASE]
  |            |                 |                  |              |        |          |
DONE         DONE              DONE               DONE         IN PROGRESS TODO       TODO
```

### Фазы

| # | Фаза | Статус | Блокеры |
|---|------|--------|---------|
| 0 | Спецификация | DONE | - |
| 0.5 | Бизнес-решения | DONE | - |
| 1 | Архитектура | DONE | - |
| 2 | Декомпозиция | DONE | - |
| 3 | Разработка Backend | **IN PROGRESS** (80%) | - |
| 3.5 | Разработка Frontend | TODO | Backend API |
| 4 | QA | PARTIAL | Frontend |
| 5 | Release | BLOCKED | QA, договор с банком |

### Прогресс разработки (2026-01-17)

| Эпик | Статус | Прогресс |
|------|--------|----------|
| E1: Инфраструктура | **DONE** | 100% |
| E2: База данных | **DONE** | 100% |
| E3: TBank Integration | **DONE** | 100% |
| E4: Backend Services | **DONE** | 100% |
| E5: API Endpoints | **DONE** | 100% |
| E6: Frontend | TODO | 0% |
| E7: Тестирование | PARTIAL | 60% |
| E8: Деплой | TODO | 0% |

---

## Бизнес-решения

Документ: [DECISIONS.md](./DECISIONS.md)

| # | Вопрос | Решение | Статус |
|---|--------|---------|--------|
| 1 | Модель монетизации | **Revshare с Т-Банком** | ПРИНЯТО |
| 2 | Договор с Т-Банком | В процессе | В РАБОТЕ |
| 3 | Модель расчетов | **Instant Split** (не escrow, макс 1 час холда) | ПРИНЯТО |
| 4 | Политика корректировок | Разработана | ПРИНЯТО |
| 5 | White-label | Не делаем в v1 | ПРИНЯТО |

**Все решения приняты.** Можно начинать архитектуру.

---

## Команда (assigned)

| Роль | Ответственность | Статус |
|------|-----------------|--------|
| TPM-LK | Координация, roadmap | ASSIGNED |
| ARCH-LK | Проектирование архитектуры | NEEDED |
| BE-LK | Backend разработка | ASSIGNED |
| FE-LK | Frontend разработка | ASSIGNED |
| INTEG-LK | Интеграция с Т-Банком | NEEDED |
| QA-LK | Тестирование | ASSIGNED |

---

## Зависимости

### Внешние
- Договор с Т-Банком (API credentials)
- Документация T-API (Номинальные счета)
- Sandbox Т-Банка для тестирования

### Внутренние
- agent.housler.ru (shared DB, auth)
- Существующие модели сделок (lk_deals)
- Платежная инфраструктура (payment_intents, payments)

---

## Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Задержка договора с банком | Высокая | Критическое | Параллельная работа над архитектурой |
| API банка не покрывает требования | Средняя | Высокое | Раннее POC на sandbox |
| Сложность миграции legacy | Средняя | Среднее | Параллельный контур |
| Нехватка ресурсов (ARCH, INTEG) | Высокая | Высокое | Нанять/выделить |

---

## Метрики успеха

| Метрика | Цель |
|---------|------|
| Время от оплаты до release | < 24h (авто) |
| Доля успешных выплат | > 99% |
| Инциденты/споры | < 1% сделок |
| Downgrade to MoR | 0 (после cutover) |

---

## История изменений

| Дата | Версия | Изменения | Автор |
|------|--------|-----------|-------|
| 2026-01-16 | 0.1 | Initial spec, DB schema | TPM-LK |
| 2026-01-17 | 0.2 | E1-E5 implementation complete (Backend) | BE-LK |
| 2026-01-17 | 0.3 | API_CONTRACTS.md added, unit tests (35 passed) | BE-LK |

---

## Реализованные компоненты

### Backend (app/*)

| Компонент | Путь | Статус |
|-----------|------|--------|
| **Models** | `app/models/bank_split.py` | DONE |
| **Schemas** | `app/schemas/bank_split.py` | DONE |
| **TBank Client** | `app/integrations/tbank/` | DONE |
| **Services** | `app/services/bank_split/` | DONE |
| **API Endpoints** | `app/api/v1/endpoints/bank_split.py` | DONE |
| **Celery Tasks** | `app/tasks/bank_split.py` | DONE |
| **Migration** | `alembic/versions/006_*.py` | DONE |

### Tests (tests/*)

| Тест | Путь | Статус |
|------|------|--------|
| Split Service | `tests/services/bank_split/` | 9 tests PASSED |
| TBank Mock | `tests/integrations/test_tbank_mock.py` | 10 tests PASSED |
| Webhooks | `tests/integrations/test_tbank_webhooks.py` | 16 tests PASSED |
| API Integration | `tests/api/test_bank_split_api.py` | SKIPPED (needs full app) |

### Scripts

| Скрипт | Путь | Описание |
|--------|------|----------|
| Manual Test | `scripts/test_bank_split_flow.py` | Full flow testing |

---

*Создано: 2026-01-16*
*Обновлено: 2026-01-17*
