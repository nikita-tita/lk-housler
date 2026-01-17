# Команда проекта LK.HOUSLER.RU

## Проект: Личный кабинет клиента

**Стек:** Python 3.11+ / FastAPI + Next.js 14
**Домен:** lk.housler.ru
**Статус:** Production

---

## Архитектура проекта

```
┌─────────────────────────────────────────────────────────────┐
│                    LK.HOUSLER.RU                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │  Frontend   │         │  Backend    │                   │
│  │  (Next.js)  │────────►│  (FastAPI)  │                   │
│  │  Port 3000  │         │  Port 8000  │                   │
│  └─────────────┘         └──────┬──────┘                   │
│                                 │                           │
│         ┌───────────────────────┼───────────────┐          │
│         ▼                       ▼               ▼          │
│  ┌─────────────┐         ┌─────────────┐  ┌─────────┐     │
│  │agent-postgres│         │  lk-redis   │  │lk-minio │     │
│  │ (SHARED DB) │         │   (OTP)     │  │  (S3)   │     │
│  └─────────────┘         └─────────────┘  └─────────┘     │
│                                 │                           │
│  Auth: делегируется → agent.housler.ru                     │
│  Payments: Т-Банк API (Instant Split) [95% READY]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Команда проекта

| Роль | Специализация | Промпт | Статус |
|------|---------------|--------|--------|
| **TPM-LK** | Координация, roadmap | `TPM_PROMPT.md` | ACTIVE |
| **ARCH-LK** | Архитектура, ADR | `prompts/ARCH_LK.md` | NEW |
| **BE-LK** | FastAPI, SQLAlchemy | `prompts/BE_LK.md` | ACTIVE |
| **INTEG-LK** | Т-Банк API, webhooks | `prompts/INTEG_LK.md` | NEW |
| **FE-LK** | Next.js, React | `prompts/FE_LK.md` | ACTIVE |
| **QA-LK** | Тестирование | - | ACTIVE |

---

### TPM-LK: Technical Project Manager
**Роль:** Project Coordinator

**Ответственность:**
- Roadmap и приоритизация
- Декомпозиция задач
- Координация команды
- Трекинг зависимостей

**Промпт:** `TPM_PROMPT.md`

---

### ARCH-LK: Solution Architect
**Роль:** Technical Lead / Architect

**Специализация:**
- Проектирование архитектуры
- ADR (Architecture Decision Records)
- Code review критичных компонентов
- Интеграционные паттерны

**Зона ответственности:**
- `docs/features/*/ARCHITECTURE.md`
- `docs/adr/`
- API контракты

**Промпт:** `prompts/ARCH_LK.md`

---

### BE-LK: Backend Developer
**Роль:** Primary backend разработчик

**Специализация:**
- Python 3.11+ / FastAPI / async
- SQLAlchemy 2.0 + asyncpg
- Pydantic v2 schemas
- Celery background tasks
- MinIO (S3) file storage
- Alembic миграции

**Ключевые директории:**
```
backend/
├── app/
│   ├── api/v1/endpoints/    # API endpoints
│   ├── services/            # Бизнес-логика
│   │   ├── auth/            # OTP, интеграция с agent
│   │   ├── sms/             # SMS.RU провайдер
│   │   └── documents/       # Документооборот
│   ├── models/              # SQLAlchemy models
│   └── schemas/             # Pydantic schemas
└── alembic/                 # Миграции
```

**Текущий фокус:** Документооборот, электронная подпись, интеграция с agent

**Промпт:** `prompts/BE_LK.md`

---

### INTEG-LK: Integration Engineer
**Роль:** External API Integration Specialist

**Специализация:**
- Т-Банк API (Номинальные счета, Самозанятые)
- Webhook handlers
- Circuit breaker / Retry логика
- Event sourcing для платежей

**Ключевые директории:**
```
backend/
├── app/
│   ├── integrations/
│   │   └── tbank/           # Т-Банк клиенты
│   │       ├── client.py
│   │       ├── deals.py
│   │       ├── payments.py
│   │       ├── self_employed.py
│   │       └── webhooks.py
│   └── services/
│       └── bank/            # Бизнес-логика банка
```

**Текущий фокус:** Интеграция с Т-Банком для bank-split

**Промпт:** `prompts/INTEG_LK.md`

---

### FE-LK: Frontend Developer
**Роль:** Primary frontend разработчик

**Специализация:**
- Next.js 14 (App Router)
- React 18 / TypeScript
- Tailwind CSS
- React Query / SWR
- PDF viewer

**Ключевые директории:**
```
frontend/
├── src/
│   ├── app/                 # Pages (App Router)
│   │   ├── (auth)/          # Login pages
│   │   ├── (dashboard)/     # Protected area
│   │   │   ├── documents/   # Документы
│   │   │   ├── deals/       # Сделки
│   │   │   └── profile/     # Профиль
│   ├── components/          # UI компоненты
│   └── services/            # API клиенты
```

**Текущий фокус:** Dashboard, просмотр документов, UI подписания

**Промпт:** `prompts/FE_LK.md`

---

### QA-LK: QA Engineer
**Роль:** Тестирование проекта

**Инструменты:**
- pytest + pytest-asyncio (backend)
- Playwright (E2E)
- pytest-cov (coverage)

**Ключевые файлы:**
- `backend/tests/` — backend тесты
- `e2e/` — E2E тесты

---

## Зависимости от экосистемы

| Компонент | Источник | Использование |
|-----------|----------|---------------|
| **Auth API** | agent.housler.ru | `/api/auth/*` — JWT авторизация |
| **PostgreSQL** | agent-postgres | Shared БД (users, etc.) |
| **housler-crypto** | библиотека | PII шифрование |
| **JWT_SECRET** | shared env | Должен совпадать с agent |
| **ENCRYPTION_KEY** | shared env | Должен совпадать с agent |
| **SMS_RU_API_ID** | shared env | SMS отправка |

---

## Критические правила

1. **Auth:** НЕ реализовывать свой — делегировать agent.housler.ru
2. **JWT_SECRET:** ОБЯЗАН совпадать с agent (иначе токены невалидны)
3. **Database:** Shared с agent — координировать миграции через ARCH-01
4. **PII:** Шифровать через housler-crypto / ENCRYPTION_KEY
5. **SMS:** Использовать тот же SMS_RU_API_ID

---

## Definition of Done

- [ ] Код соответствует паттернам FastAPI
- [ ] Pydantic schemas для всех I/O
- [ ] pytest тесты (coverage ≥ 80%)
- [ ] Type hints везде
- [ ] Docstrings для публичных методов
- [ ] Миграции протестированы (up + down)
- [ ] Интеграция с agent.housler.ru проверена
