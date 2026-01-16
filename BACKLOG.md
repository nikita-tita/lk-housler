# Бэклог проекта lk.housler.ru

Единый источник правды для задач проекта.

**Последнее обновление:** 2026-01-09
**Источник:** Q1 2026 Ecosystem Review

---

## Статусы задач

| Статус | Описание |
|--------|----------|
| `backlog` | В очереди, не приоритизировано |
| `todo` | Готово к взятию в работу |
| `in_progress` | В работе (указан исполнитель) |
| `blocked` | Заблокировано (указан блокер) |
| `review` | На ревью/тестировании |
| `done` | Выполнено, есть артефакт |

---

## Сводка

| Категория | Всего | Done | In Progress | Blocked | Todo |
|-----------|-------|------|-------------|---------|------|
| Безопасность (SEC) | 3 | 0 | 0 | 0 | 3 |
| Тестирование (TEST) | 4 | 0 | 0 | 0 | 4 |
| Frontend (FE) | 3 | 0 | 0 | 0 | 3 |
| Инфраструктура (INFRA) | 2 | 0 | 0 | 0 | 2 |
| Документация (DOC) | 1 | 0 | 0 | 0 | 1 |
| **Итого** | **13** | **0** | **0** | **0** | **13** |

---

## BLOCKER — Критические задачи

### SEC-001: Синхронизация секретов с agent
- **Статус:** `todo`
- **Приоритет:** BLOCKER
- **Связь:** ECO-SEC-001
- **Описание:** lk использует shared JWT_SECRET и ENCRYPTION_KEY с agent. При ротации в agent нужно обновить здесь.
- **DoD:**
  - [ ] JWT_SECRET обновлён (после ротации в agent)
  - [ ] ENCRYPTION_KEY обновлён (после миграции в agent)
  - [ ] HOUSLER_CRYPTO_KEY добавлен
  - [ ] Сервис перезапущен
  - [ ] API endpoints проверены
- **Зависимости:** agent SEC-001
- **Сложность:** S (30 минут)
- **Ответственный:** DevOps

---

## HIGH — Первый месяц

### TEST-001: Добавить тесты для auth/service.py
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Связь:** ECO-TEST-003
- **Описание:** Auth service не покрыт тестами
- **Файл:** `backend/app/services/auth/service.py`
- **DoD:**
  - [ ] Тест: SMS авторизация агента
  - [ ] Тест: Email авторизация клиента
  - [ ] Тест: Password авторизация агентства
  - [ ] Тест: Неверные credentials
  - [ ] Тест: JWT refresh
  - [ ] Coverage >= 80%
- **Сложность:** M (4-6 часов)
- **Ответственный:** Backend

### TEST-002: Добавить тесты для encryption.py
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Описание:** PII шифрование критично для 152-ФЗ
- **Файл:** `backend/app/core/encryption.py`
- **DoD:**
  - [ ] Тест: encrypt/decrypt roundtrip
  - [ ] Тест: blind index deterministic
  - [ ] Тест: housler-crypto совместимость
  - [ ] Coverage >= 80%
- **Сложность:** S (2-3 часа)

### TEST-003: Добавить тесты для deal/service.py
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Описание:** Бизнес-логика сделок не тестируется
- **Файл:** `backend/app/services/deal/service.py`
- **DoD:**
  - [ ] Тест: создание сделки
  - [ ] Тест: добавление участников
  - [ ] Тест: смена статуса
  - [ ] Тест: валидация суммы
  - [ ] Coverage >= 60%
- **Сложность:** M (4-6 часов)

### TEST-004: Настроить pytest и CI
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Описание:** pytest-cov не настроен, нет CI
- **DoD:**
  - [ ] pytest.ini/pyproject.toml настроен
  - [ ] pytest-cov добавлен
  - [ ] .github/workflows/ci.yml создан
  - [ ] Coverage report генерируется
  - [ ] Минимальный coverage gate (30%)
- **Сложность:** S (1-2 часа)

### SEC-002: Добавить Redis аутентификацию
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Связь:** ECO-SEC-005
- **Описание:** Redis работает без пароля
- **DoD:**
  - [ ] REDIS_PASSWORD в .env.example
  - [ ] docker-compose.prod.yml обновлён
  - [ ] Redis URL с паролем в коде
- **Сложность:** S (30 минут)

### SEC-003: Документировать API contract с agent
- **Статус:** `todo`
- **Приоритет:** HIGH
- **Связь:** ECO-ARCH-001
- **Описание:** lk напрямую подключается к БД agent, нет документации
- **DoD:**
  - [ ] SHARED_DATABASE.md создан
  - [ ] Описаны shared tables (users, auth)
  - [ ] Описаны owned tables (deals, payments)
  - [ ] Правила миграций зафиксированы
- **Сложность:** S (2-3 часа)

---

## MEDIUM — Месяц 2-3

### FE-001: Agent Console MVP
- **Статус:** `todo`
- **Приоритет:** MEDIUM
- **Описание:** Frontend для риелторов (0% готов)
- **Структура:** `frontend/agent-console/`
- **DoD:**
  - [ ] Next.js 14 проект создан
  - [ ] Авторизация (SMS)
  - [ ] Список сделок
  - [ ] Создание сделки
  - [ ] Просмотр сделки
- **Сложность:** XL (2-3 недели)

### FE-002: Client Portal MVP
- **Статус:** `todo`
- **Приоритет:** MEDIUM
- **Описание:** Frontend для клиентов (покупателей/продавцов)
- **Структура:** `frontend/client-portal/`
- **DoD:**
  - [ ] Next.js 14 проект создан
  - [ ] Авторизация (Email)
  - [ ] Просмотр своих сделок
  - [ ] Подписание документов (ПЭП)
  - [ ] Оплата (СБП)
- **Зависимости:** FE-001 (shared components)
- **Сложность:** XL (2-3 недели)

### FE-003: Agency Admin MVP
- **Статус:** `todo`
- **Приоритет:** MEDIUM
- **Описание:** Frontend для администраторов агентств
- **Структура:** `frontend/agency-admin/`
- **DoD:**
  - [ ] Авторизация (Email + Password)
  - [ ] Управление агентами
  - [ ] Статистика сделок
  - [ ] Финансовая отчётность
- **Зависимости:** FE-001
- **Сложность:** XL (2-3 недели)

### INFRA-001: Health check endpoints
- **Статус:** `todo`
- **Приоритет:** MEDIUM
- **Описание:** Нет endpoints для мониторинга
- **DoD:**
  - [ ] GET /health — базовый статус
  - [ ] GET /health/ready — проверка DB/Redis/MinIO
  - [ ] Интеграция с monitoring
- **Сложность:** S (1-2 часа)

### INFRA-002: Structured logging
- **Статус:** `todo`
- **Приоритет:** MEDIUM
- **Описание:** Логи не структурированы
- **DoD:**
  - [ ] structlog настроен
  - [ ] JSON формат в production
  - [ ] Request ID в логах
  - [ ] PII маскируется
- **Сложность:** S (2-3 часа)

---

## LOW — Backlog

### DOC-001: Обновить README.md
- **Статус:** `backlog`
- **Приоритет:** LOW
- **Описание:** README содержит устаревший IP сервера (91.229.8.221)
- **DoD:**
  - [ ] IP обновлён на 95.163.227.26
  - [ ] Инструкции по деплою актуализированы
  - [ ] Ссылки на _archive документы убраны
- **Сложность:** S (30 минут)

---

## Архитектурные особенности

### Shared Database с agent.housler.ru

lk подключается к базе agent через external network:

```yaml
# docker-compose.prod.yml
networks:
  agent-network:
    external: true
    name: housler_pervichka_default
```

**Shared tables:**
- `users` — пользователи (agent owner)
- `auth_codes` — коды авторизации (agent owner)

**lk-owned tables:**
- `deals` — сделки
- `deal_parties` — участники сделок
- `documents` — документы
- `payments` — платежи

### Shared Secrets

| Secret | Источник | Описание |
|--------|----------|----------|
| JWT_SECRET | agent | Подпись JWT токенов |
| ENCRYPTION_KEY | agent | Шифрование PII (legacy) |
| HOUSLER_CRYPTO_KEY | housler-crypto | Новый ключ шифрования |

---

## Связи с другими бэклогами

| Экосистемная задача | Связанная задача |
|---------------------|------------------|
| ECO-SEC-001 | SEC-001 |
| ECO-SEC-005 | SEC-002 |
| ECO-TEST-003 | TEST-001..004 |
| ECO-ARCH-001 | SEC-003 |

---

*Этот файл — источник правды для задач lk.housler.ru*
