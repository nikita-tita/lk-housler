# LLM Council Review: lk.housler.ru

**Дата:** 2026-01-25
**Метод:** 4 параллельных агента с независимым анализом + синтез "судьи"
**Скоуп:** Весь проект (code review + функциональное тестирование)

---

## Сводка

| Severity | Кол-во |
|----------|--------|
| CRITICAL | 8 |
| HIGH | 16 |
| MEDIUM | 14 |
| LOW | 6 |

---

## CRITICAL Issues

### 1. `is_superuser` не существует в модели User
**Консенсус:** 2/4 агентов
**Файл:** `backend/app/api/v1/endpoints/admin.py:29`

```python
# Текущий код (ошибка)
if not user.is_superuser:

# Fix
if not user.is_admin:
```

**Проблема:** `require_admin()` проверяет `user.is_superuser`, но в User модели есть только `is_admin` property
**Результат:** AttributeError при любом запросе к admin endpoints

---

### 2. Secrets закоммичены в git history
**Консенсус:** 1/4 агентов
**Файл:** `.env` содержит JWT_SECRET, ENCRYPTION_KEY, SMS_RU_API_ID, SMTP_PASSWORD

**Fix:**
```bash
git rm --cached .env
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```
Затем ротировать все токены в 1Password.

---

### 3. HOUSLER_CRYPTO_KEY не синхронизирован
**Консенсус:** 1/4 агентов
**Файлы:**
- `backend/.env` — тестовый ключ (0123...)
- `.env` и `.env.local` — ключ отсутствует

**Проблема:** PII шифрование несовместимо с agent.housler.ru
**Fix:** Синхронизировать ключ из 1Password (`Housler Encryption`)

---

### 4. Token type не валидируется
**Консенсус:** 2/4 агентов
**Файл:** `backend/app/core/security.py:51-57`

```python
# Fix: добавить проверку типа токена
def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") not in ("access", "refresh"):
            return None
        return payload
    except JWTError:
        return None
```

**Проблема:** Refresh token можно использовать вместо access token

---

### 5. Отсутствует endpoint /auth/refresh
**Консенсус:** 2/4 агентов
**Файл:** `backend/app/api/v1/endpoints/auth.py`

**Проблема:** Access token истекает → пользователь должен перелогиниться
**Fix:** Добавить POST `/auth/refresh` endpoint

---

### 6. Admin dashboard не защищён
**Консенсус:** 2/4 агентов
**Файл:** `backend/app/api/v1/endpoints/admin.py:41-48`

```python
# Текущий код (уязвимость)
async def get_agent_dashboard(
    current_user: User = Depends(get_current_user),  # Любой авторизованный!

# Fix
async def get_agent_dashboard(
    current_user: User = Depends(require_admin),  # Только админы
```

---

### 7. Employee redirect на недоступный dashboard
**Консенсус:** 1/4 агентов
**Файл:** `apps/lk/app/(auth)/register/employee/page.tsx:114`

**Проблема:** После регистрации `agency_employee` → redirect на `/agency/dashboard` → 403 (требует `agency_admin`)
**Fix:** Создать employee dashboard или изменить route guard в `app/agency/layout.tsx:19`:

```typescript
// Текущий
useRequireAuth('agency_admin')

// Fix
useRequireAuth(['agency_admin', 'agency_employee'])
```

---

### 8. Deprecated auth endpoints раскрывают архитектуру
**Консенсус:** 2/4 агентов
**Файл:** `backend/app/api/v1/endpoints/auth.py:251-280`

**Проблема:** `/otp/send` и `/otp/verify` возвращают 400 с "Use agent.housler.ru"
**Fix:** Полностью удалить endpoints

---

## HIGH Issues

| # | Issue | Файл | Fix |
|---|-------|------|-----|
| 1 | OTP token reuse (60 сек window) | `services/auth/otp.py:183` | `await redis.delete(key)` после верификации |
| 2 | Invitation token в SMS | `endpoints/invitations.py:355` | Двухфакторная верификация |
| 3 | Нет logout invalidation | `endpoints/auth.py` | Token blacklist в Redis |
| 4 | CORS включает localhost в prod | `docker-compose.prod.yml:75` | Убрать localhost |
| 5 | Нет retry/timeout в axios | `packages/lib/src/api/client.ts` | axios-retry + timeout: 30000 |
| 6 | Double submit race condition | `login/agency/page.tsx` | isSubmitting flag + debounce |
| 7 | Phone validation regex inconsistency | `schemas/invitation.py:13` | `r"^\+7\d{10}$"` везде |
| 8 | ValueError вместо HTTPException | `services/auth/service_extended.py` | Exception handler |
| 9 | Employee role нет доступа | `app/agency/layout.tsx:19` | Добавить agency_employee |
| 10 | Health check раскрывает детали | `backend/app/main.py:208` | IP whitelist или generic response |
| 11 | Token refresh отсутствует на frontend | `packages/lib/src/store/authStore.ts` | axios interceptor + refresh |
| 12 | Нет rate limit на /invitations/{token} | `endpoints/invitations.py:162` | IP-based rate limit |
| 13 | Missing response_model в deals | `endpoints/deals.py:116` | `response_model=DealListSimple` |
| 14 | Body() не указан в POST | `endpoints/invitations.py:262` | `Body(...)` explicit |
| 15 | Split percent не валидируется | `endpoints/invitations.py:38` | Проверка суммы <= 100% |
| 16 | CSP отсутствует в frontend | `next.config.js` | Добавить headers |

---

## MEDIUM Issues

| # | Issue | Файл |
|---|-------|------|
| 1 | Audit logging отсутствует в invitations | `endpoints/invitations.py` |
| 2 | Race condition при accept invitation | `endpoints/invitations.py:207` |
| 3 | Нет лимита invitations per deal | `endpoints/invitations.py:38` |
| 4 | Database pool deadlock риск | `backend/app/db/session.py:19` |
| 5 | No graceful shutdown | `backend/app/main.py` |
| 6 | SMS_TEST_MODE может включиться в prod | `docker-compose.prod.yml:78` |
| 7 | No connection validation on startup | `backend/app/main.py:198` |
| 8 | X-Request-ID не пробрасывается | `packages/lib/src/api/client.ts` |
| 9 | JWT_SECRET sync не проверяется | CI отсутствует |
| 10 | Brute force protection слабая | `backend/app/core/rate_limit.py` |
| 11 | Modal закрывается случайно | `app/agency/agents/page.tsx:240` |
| 12 | Native alert() вместо UI | `app/agency/agents/page.tsx:158` |
| 13 | Email validation на frontend | `app/(auth)/realtor/page.tsx` |
| 14 | Countdown timer memory leak риск | `app/(auth)/login/client/page.tsx:69` |

---

## LOW Issues

| # | Issue | Файл |
|---|-------|------|
| 1 | OTP код не ротируется при resend | `services/auth/otp.py:89` |
| 2 | SMS_TEST_MODE hardcoded код | `services/auth/otp.py:117` |
| 3 | Invitation token length не валидируется | `models/invitation.py:66` |
| 4 | User search раскрывает последние 2 цифры | `endpoints/users.py:36` |
| 5 | Terms URL одинаковый для всех ролей | `login/agency/page.tsx:415` |
| 6 | Legacy ENCRYPTION_KEY в конфиге | `backend/app/core/config.py:52` |

---

## Недостающие сценарии

### Must Have
1. Token refresh flow (frontend + backend)
2. Logout invalidation (token blacklist)
3. Employee dashboard
4. Connection validation on startup
5. Rate limit для /users/search

### Should Have
6. Retry логика на frontend
7. Toast notifications вместо alert()
8. Audit logging для invitations
9. Split percent validation
10. CAPTCHA после 3 неудачных OTP

### Nice to Have
11. E2E тесты авторизации
12. Load testing
13. Secrets rotation playbook
14. OpenTelemetry tracing

---

## Рекомендуемый приоритет исправления

```
Week 1 (блокеры):
1. [CRITICAL] is_superuser → is_admin
2. [CRITICAL] Ротация secrets + git cleanup
3. [CRITICAL] Token type validation
4. [CRITICAL] Admin dashboard protection
5. [CRITICAL] Employee route guards

Week 2 (security):
6. [HIGH] Token refresh endpoint
7. [HIGH] Logout invalidation
8. [HIGH] OTP reuse prevention
9. [HIGH] CORS localhost removal
10. [HIGH] Health check protection

Week 3 (stability):
11. [HIGH] Retry + timeout на frontend
12. [MEDIUM] Graceful shutdown
13. [MEDIUM] Connection validation
14. [MEDIUM] Audit logging
```

---

## Self-Critique агентов

| Область | Что не проверили |
|---------|-----------------|
| Auth & Security | housler_crypto реализация, frontend token storage |
| API & Backend | Migration constraints, Celery tasks |
| Frontend & UX | Backend integration, performance, accessibility |
| Edge Cases | Payment flow (T-Bank), Celery idempotency |

---

*Отчёт сгенерирован методом LLM Council (4 независимых агента + судья)*
