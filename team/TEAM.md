# Команда проекта HOUSLER ECOSYSTEM

## Общие принципы всех разработчиков

Каждый член команды — сеньор-инженер:
- **Безопасность:** 152-ФЗ compliance, шифрование PII, никаких секретов в git
- **Переиспользование:** максимум shared-компонентов между сервисами
- **Чистый код:** SOLID, DRY, KISS
- **Тестирование:** тесты параллельно с кодом
- **Документация:** код самодокументирован

---

## Экосистема Housler

| Проект | Домен | Стек | Статус |
|--------|-------|------|--------|
| agent.housler.ru | CRM агентов | Node.js/TypeScript + Next.js | Production |
| lk.housler.ru | Личный кабинет | Python/FastAPI + Next.js | Production |
| housler-crypto | Криптобиблиотека | Python + TypeScript | v1.0.0 |
| club.housler.ru | Сообщество | Django + Vue.js | Production |
| calendar.housler.ru | AI-календарь | Python/FastAPI + Telegram | Production |
| housler.ru | Аналитика цен | Python/Flask | Production |

### Shared компоненты
- **База данных:** PostgreSQL (agent-postgres) — shared между agent и lk
- **Авторизация:** agent.housler.ru — единый auth provider
- **Шифрование:** housler-crypto — единая библиотека PII encryption
- **Инфраструктура:** reg.ru сервер (95.163.227.26)

---

## Руководство

### TPM: Technical Project Manager
**Роль:** Координатор разработки экосистемы

**Обязанности:**
- Координация между проектами экосистемы
- Приоритизация задач и разрешение блокеров
- Контроль качества документации
- Pre-deploy security checks
- Синхронизация shared-компонентов

**Принципы:**
- Блокеры = приоритет #1
- Security check перед каждым деплоем
- Документация актуальна или не существует

---

### ARCH-01: Архитектор экосистемы
**Роль:** Архитектор / Главный ревьюер

**Обязанности:**
- Валидация архитектурных решений
- Code review критических PR (auth, encryption, shared)
- Контроль соответствия между проектами
- Выявление антипаттернов и технического долга
- Документирование решений

**Принципы:**
- Простота > сложность при равной функциональности
- Shared компоненты вместо дублирования
- Каждое отклонение требует обоснования

---

## Backend Team

### BE-AGENT: Backend Developer — Agent
**Роль:** Backend Developer для agent.housler.ru

**Специализация:**
- Node.js / TypeScript / Express
- PostgreSQL через pg + pgcrypto
- JWT авторизация
- PII encryption (housler-crypto)
- SMS.RU интеграция

**Ключевые файлы:**
- `backend/src/services/auth.service.ts` — авторизация (shared!)
- `backend/src/services/sms.service.ts` — SMS отправка
- `backend/src/services/encryption.service.ts` — шифрование
- `backend/src/api/routes/*.ts` — API endpoints

**Текущий фокус:** Auth endpoints, encryption migration, API для lk

---

### BE-LK: Backend Developer — LK
**Роль:** Backend Developer для lk.housler.ru

**Специализация:**
- Python 3.11+ / FastAPI / async
- SQLAlchemy 2.0 + asyncpg
- Pydantic schemas
- Celery background tasks
- MinIO file storage

**Ключевые файлы:**
- `backend/app/services/auth/` — OTP авторизация
- `backend/app/services/sms/` — SMS провайдеры
- `backend/app/api/v1/endpoints/` — API endpoints
- `backend/alembic/` — миграции

**Текущий фокус:** Agent API интеграция, документы, подписание

---

### BE-CRYPTO: Crypto Library Developer
**Роль:** Разработчик housler-crypto

**Специализация:**
- AES-256-GCM шифрование
- PBKDF2-SHA256 key derivation
- Blind index для поиска
- Python + TypeScript реализации
- 152-ФЗ compliance

**Ключевые файлы:**
- `python/housler_crypto/core.py` — Python реализация
- `typescript/src/index.ts` — TypeScript реализация
- `python/tests/` — Python тесты
- `typescript/__tests__/` — TypeScript тесты

**Текущий фокус:** PyPI/npm публикация, интеграция в agent/lk

---

## Frontend Team

### FE-AGENT: Frontend Developer — Agent
**Роль:** Frontend Developer для agent.housler.ru

**Специализация:**
- Next.js 14 / React / TypeScript
- Tailwind CSS
- Zustand state management
- React Hook Form + Zod validation

**Ключевые файлы:**
- `frontend/src/app/` — Next.js pages
- `frontend/src/components/` — UI компоненты
- `frontend/src/services/` — API клиенты
- `frontend/src/stores/` — Zustand stores

**Текущий фокус:** Wizard flow, auth UI, карточки объектов

---

### FE-LK: Frontend Developer — LK
**Роль:** Frontend Developer для lk.housler.ru

**Специализация:**
- Next.js 14 / React / TypeScript
- Tailwind CSS
- Document viewer/editor
- E-sign UI

**Ключевые файлы:**
- `frontend/src/app/` — Next.js pages
- `frontend/src/components/` — UI компоненты
- `frontend/src/features/` — Feature modules

**Текущий фокус:** Dashboard, документы, подписание

---

## Infrastructure

### INFRA-01: DevOps Engineer
**Роль:** DevOps / Infrastructure Engineer

**Обязанности:**
- Docker и docker-compose конфигурации
- Nginx reverse proxy
- SSL сертификаты (Let's Encrypt)
- CI/CD pipelines (GitHub Actions)
- Мониторинг (Grafana, Prometheus, Loki)
- Backup и recovery

**Инфраструктура:**
```
Сервер: 95.163.227.26 (reg.ru Cloud)
├── nginx (reverse proxy, SSL termination)
├── agent.housler.ru
│   ├── agent-frontend (Next.js)
│   ├── agent-backend (Node.js)
│   ├── agent-postgres (PostgreSQL) — SHARED
│   └── agent-redis
├── lk.housler.ru
│   ├── lk-frontend (Next.js)
│   ├── lk-backend (FastAPI)
│   ├── lk-minio (S3)
│   └── lk-redis
├── Monitoring stack
│   ├── grafana
│   ├── prometheus
│   └── loki
└── Security
    ├── fail2ban
    └── ufw firewall
```

**Ключевые файлы:**
- `docker-compose.prod.yml` — production compose
- `.github/workflows/` — CI/CD pipelines
- `nginx/` — nginx конфигурации

---

## QA Team

### QA-01: QA Engineer
**Роль:** QA Engineer — Backend & Frontend Testing

**Специализация:**
- Jest (TypeScript) / pytest (Python)
- Playwright E2E
- API testing
- Security testing

**Ключевые файлы:**
- `backend/src/__tests__/` — backend тесты (agent)
- `backend/tests/` — backend тесты (lk)
- `e2e/` — E2E тесты

**Текущий фокус:** Auth tests, encryption tests, E2E happy path

---

## Матрица ответственности

| Область | Primary | Backup | Reviewer |
|---------|---------|--------|----------|
| Agent Auth | BE-AGENT | BE-LK | ARCH-01 |
| LK Auth | BE-LK | BE-AGENT | ARCH-01 |
| PII Encryption | BE-CRYPTO | BE-AGENT | ARCH-01 |
| Agent API | BE-AGENT | — | ARCH-01 |
| LK API | BE-LK | — | ARCH-01 |
| Agent UI | FE-AGENT | FE-LK | TPM |
| LK UI | FE-LK | FE-AGENT | TPM |
| Infrastructure | INFRA-01 | — | ARCH-01 |
| CI/CD | INFRA-01 | — | ARCH-01 |
| Backend Tests | QA-01 | BE-* | TPM |
| E2E Tests | QA-01 | FE-* | TPM |

---

## Критические зависимости

```
┌─────────────────────────────────────────────────────────────┐
│                    HOUSLER ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │
│  │   agent     │◄────►│    lk       │      │   club      │ │
│  │ housler.ru  │      │ housler.ru  │      │ housler.ru  │ │
│  └──────┬──────┘      └──────┬──────┘      └─────────────┘ │
│         │                    │                              │
│         │    ┌───────────────┘                              │
│         │    │                                              │
│         ▼    ▼                                              │
│  ┌─────────────────┐    ┌─────────────┐                    │
│  │  agent-postgres │    │housler-crypto│                    │
│  │   (SHARED DB)   │    │  (SHARED LIB)│                    │
│  └─────────────────┘    └─────────────┘                    │
│                                                             │
│  Auth Flow:                                                 │
│  lk.housler.ru ──► agent.housler.ru/api/auth/* ──► JWT     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Правило:** Изменения в auth компонентах agent влияют на lk!
