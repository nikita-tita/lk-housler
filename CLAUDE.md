# CLAUDE.md - Инструкции для Claude Code

## Проект

**lk.housler.ru** — Личный кабинет Housler (monorepo)

---

## КРИТИЧНЫЕ ПРАВИЛА

### Auth = agent.housler.ru
```
lk.housler.ru (frontend) → agent.housler.ru/api/auth/* → housler_agent (DB)
```
- JWT_SECRET, HOUSLER_CRYPTO_KEY — должны совпадать с agent
- НЕ реализовывать свой auth
- Тест: `79999xxxxxx` + код `123456`

### Запрещено
- Хардкодить секреты (только .env)
- Менять shared таблицы без координации с agent
- SQL конкатенация (только ORM)
- Логировать PII
- Цветные элементы в UI (только ч/б)

### Security (реализовано)
- Token Blacklist (Redis)
- Rate Limiting (IP + account)
- Audit Logging (`core/audit.py`)
- OTP Brute Force (5 попыток/час)
- PII Encryption (`housler-crypto`)

---

## ARCHITECTURE DECISIONS

| Решение | Причина |
|---------|---------|
| Legacy `ENCRYPTION_KEY` в config | Нужен для миграции с Fernet |
| Terms URL общий на login | By design: role-specific в регистрации |
| OTP ротируется при resend | Безопасность |

---

## СТЕК

**Backend:** FastAPI + SQLAlchemy 2.0 async + PostgreSQL + Redis
**Frontend:** Next.js 14 (App Router) + Tailwind + Zustand

```
apps/lk/          # Next.js frontend
packages/lib/     # Shared API client (@housler/lib)
backend/          # FastAPI backend
```

---

## CODE PATTERNS

```python
# Rate limiting
from app.core.rate_limit import rate_limit_otp_send
@rate_limit_otp_send  # 3/min per phone

# Audit
from app.core.audit import log_audit_event, AuditEvent
log_audit_event(AuditEvent.LOGIN_SUCCESS, user_id=str(id), ip_address=ip)

# PII
from housler_crypto import HouslerCrypto
crypto.encrypt(phone, "phone")
```

---

## DEFINITION OF DONE

Backend:
- [ ] Pydantic schemas для I/O
- [ ] pytest тесты
- [ ] Type hints
- [ ] Миграции работают

Frontend:
- [ ] TypeScript (no `any`)
- [ ] Loading/error states
- [ ] Responsive

---

## КОМАНДЫ

```bash
# Dev
docker-compose up -d
cd apps/lk && npm run dev
cd backend && uvicorn app.main:app --reload

# Deploy
ssh -i ~/.ssh/id_housler root@95.163.227.26
cd /root/lk-housler && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

---

## ПЕРЕМЕННЫЕ

| Var | Примечание |
|-----|------------|
| `JWT_SECRET` | Shared с agent |
| `HOUSLER_CRYPTO_KEY` | 64 hex, shared |
| `SMS_RU_API_ID` | SMS.RU |

---

## TECH DEBT

- Legacy Fernet миграция не завершена
- Email notifications — TODO
- T-Bank/Fiscalization — mock mode

---

## СПРАВКА

Детальные промпты (legacy, читать при необходимости):
- `team/prompts/BE_LK.md` — backend patterns
- `team/prompts/FE_LK.md` — frontend patterns
- `team/prompts/INTEG_LK.md` — интеграции
- `team/TPM_PROMPT.md` — deploy, координация
