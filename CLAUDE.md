# CLAUDE.md - Инструкции для Claude Code

## Проект

**lk.housler.ru** — Личный кабинет экосистемы Housler (monorepo)

---

## ARCHITECTURE DECISIONS (ADR)

Решения, которые выглядят странно, но имеют причины:

| Решение | Причина | НЕ МЕНЯТЬ |
|---------|---------|-----------|
| `ENCRYPTION_KEY` + `ENCRYPTION_SALT` в config.py | Нужны для миграции с Fernet через `housler_crypto/migration.py` | Пока не завершена миграция |
| Terms URL общий на всех login страницах | By design: общее ПС на входе, role-specific оферты в регистрации через `ConsentCheckbox` | - |
| OTP код генерируется заново при resend | Безопасность: старый код инвалидируется, новый отправляется | - |
| `SMS_TEST_MODE` защита только в config validator | Достаточно: validator бросает exception в production | - |
| Token blacklist в Redis без TTL cleanup | TTL = refresh token lifetime, Redis сам чистит | - |

---

## SECURITY (КРИТИЧЕСКИ ВАЖНО)

**Никогда не коммитьте секреты в git!**

| Правило | Описание |
|---------|----------|
| Секреты | Только в .env (в .gitignore) и 1Password |
| SSH | Только через SSH-ключи, НЕ пароли |
| Документация | Никаких реальных паролей в README/docs |

### Реализованные security features:

- [x] **Token Blacklist** — logout инвалидирует токены (Redis)
- [x] **Rate Limiting** — IP + account based (`core/rate_limit.py`)
- [x] **Audit Logging** — security events в структурированный лог (`core/audit.py`)
- [x] **OTP Brute Force Protection** — 5 попыток/час, блокировка 10 мин
- [x] **Invitation Token Validation** — длина 40-50 символов до rate limit check
- [x] **Phone Masking** — только 2 последние цифры в user search
- [x] **PII Encryption** — `housler-crypto` (AES-256-GCM)
- [x] **Graceful Shutdown** — connection pool disposal в lifespan handler

---

## ЕДИНАЯ АВТОРИЗАЦИЯ

**Авторизация использует API agent.housler.ru!**

```
lk.housler.ru (frontend) ──> agent.housler.ru/api/auth/* ──> housler_agent (БД)
```

### Shared с agent.housler.ru:

| Ресурс | Где хранится | Синхронизация |
|--------|--------------|---------------|
| `JWT_SECRET` | 1Password | Должен совпадать |
| `HOUSLER_CRYPTO_KEY` | 1Password | Должен совпадать |
| База данных | `housler_agent` на `agent-postgres` | Общая |
| Redis | `agent-redis` | Общий для rate limit |

### Тестовые данные:
- SMS: `79999xxxxxx`, код `123456` (настраивается через `SMS_TEST_PHONE_PREFIX`, `SMS_TEST_CODE`)
- Email: `*@test.housler.ru`, коды `111111-666666`

### НЕ МЕНЯТЬ без согласования:
- Формат ответа auth API
- JWT_SECRET / HOUSLER_CRYPTO_KEY
- Структуру таблицы users

---

## Структура проекта (Monorepo)

```
/Users/fatbookpro/Desktop/lk/
├── apps/
│   ├── lk/                    # Next.js frontend для lk.housler.ru
│   │   ├── app/               # App Router pages
│   │   │   ├── (auth)/        # Login pages (realtor, agency, client, employee)
│   │   │   ├── agency/        # Agency dashboard, agents, deals
│   │   │   └── ...
│   │   └── components/        # UI components
│   └── agent/                 # Копия agent frontend (для dev)
├── packages/
│   ├── lib/                   # Shared library (@housler/lib)
│   │   └── src/
│   │       ├── api/           # API client, auth functions
│   │       └── stores/        # Zustand stores (auth, etc.)
│   └── ui/                    # Shared UI components (@housler/ui)
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # FastAPI endpoints
│   │   ├── core/              # Config, security, rate_limit, audit
│   │   ├── models/            # SQLAlchemy models
│   │   ├── services/          # Business logic (auth, sms, bank_split)
│   │   └── main.py            # FastAPI app with lifespan
│   ├── housler_crypto/        # PII encryption library
│   └── alembic/               # DB migrations
├── docs/                      # Documentation
├── docker-compose.yml         # Development
└── docker-compose.prod.yml    # Production
```

---

## Технологический стек

### Backend (Python)
- **Framework:** FastAPI + async
- **ORM:** SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL 15
- **Cache:** Redis 7 (rate limit, token blacklist, OTP)
- **Storage:** MinIO (S3-compatible)
- **Auth:** JWT + SMS OTP (SMS.RU)

### Frontend (Next.js)
- **Framework:** Next.js 14+ (App Router)
- **State:** Zustand (@housler/lib)
- **Styling:** Tailwind CSS
- **Font:** Inter (Google Fonts)

---

## KNOWN ISSUES / TECH DEBT

| Issue | Файл | Статус |
|-------|------|--------|
| Legacy Fernet миграция не завершена | `housler_crypto/migration.py` | В процессе |
| Email notifications не реализованы | - | TODO |
| Fiscalization (чеки) mock mode | `services/fiscalization/` | TODO для prod |
| T-Bank integration mock mode | `services/tbank/` | TODO для prod |

---

## Правила разработки

### Design System (строго соблюдать!)

1. **Только черно-белая палитра** — никаких цветных акцентов
2. **Без эмоджи** — ни в коде, ни в UI, ни в комментариях
3. **Шрифт Inter** — единственный шрифт
4. **Минимализм** — меньше элементов, больше пространства

### Code Patterns

```python
# Rate limiting - использовать декораторы из core/rate_limit.py
@rate_limit_otp_send  # 3 req/min per phone
@rate_limit_otp_verify  # 5 req/hour per phone

# Audit logging - для security events
from app.core.audit import log_audit_event, AuditEvent
log_audit_event(AuditEvent.LOGIN_SUCCESS, user_id=str(user.id), ip_address=ip)

# PII encryption
from housler_crypto import HouslerCrypto
crypto = HouslerCrypto(settings.HOUSLER_CRYPTO_KEY)
encrypted = crypto.encrypt(phone, "phone")
```

### Типы согласий

```python
class ConsentType(str, Enum):
    PERSONAL_DATA = "personal_data"
    TERMS = "terms"
    MARKETING = "marketing"
    REALTOR_OFFER = "realtor_offer"
    AGENCY_OFFER = "agency_offer"
```

---

## Команды

### Development

```bash
# Запуск всего
docker-compose up -d
cd apps/lk && npm run dev

# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Миграции
cd backend && alembic upgrade head
```

### Production

```bash
ssh -i ~/.ssh/id_housler root@95.163.227.26
cd /root/lk-housler
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Сервер

- **IP:** 95.163.227.26
- **SSH:** `ssh -i ~/.ssh/id_housler root@95.163.227.26`
- **Путь:** `/root/lk-housler`
- **Порт lk.housler.ru:** 3090

---

## Переменные окружения

Критичные (все в 1Password):

| Переменная | 1Password | Примечание |
|------------|-----------|------------|
| `JWT_SECRET` | Housler LK JWT | Shared с agent |
| `HOUSLER_CRYPTO_KEY` | Housler Crypto | 64 hex chars, shared |
| `ENCRYPTION_KEY` | Housler Encryption | Legacy, для миграции |
| `ENCRYPTION_SALT` | Housler Encryption | Legacy, для миграции |
| `SMS_RU_API_ID` | SMS.RU | - |

### Test mode settings:
```env
SMS_TEST_MODE=true
SMS_TEST_PHONE_PREFIX=79999
SMS_TEST_CODE=123456
```

---

## Чеклист нового функционала

```
[ ] Проверил аналог в housler_pervichka
[ ] Использовал Design System (ч/б, без эмоджи)
[ ] Rate limiting если нужно
[ ] Audit logging для security events
[ ] Шифрование PII через housler-crypto
[ ] Миграция создана
[ ] Тесты написаны
```

---

## Связанные проекты

| Проект | Путь | Назначение |
|--------|------|------------|
| Agent Housler | `/Users/fatbookpro/Desktop/housler_pervichka` | Основной backend auth |
| Shared docs | `housler_pervichka/docs/SHARED/` | Общая документация |
