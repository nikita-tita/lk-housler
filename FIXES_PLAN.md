# ПЛАН ИСПРАВЛЕНИЙ КРИТИЧЕСКИХ ПРОБЛЕМ

## Анализ кодовой базы

### Обнаруженные паттерны для переиспользования:

1. **deps.py:17-53** - `get_current_user()` - готовая зависимость для аутентификации
2. **deal/service.py:37-73** - `list_deals()` уже фильтрует по `user.id`
3. **organization/service.py:94-108** - `list_user_organizations()` проверяет membership
4. **User model** - имеет `role` (client/agent/agency_admin)
5. **OrganizationMember model** - имеет `role` (admin/agent/accountant/signer)

### Принцип: минимальные изменения, максимальное переиспользование

---

## ИСПРАВЛЕНИЕ 1: Утечка API ключа

**Файл:** `.env.example` (строка 71)
**Действие:** Заменить реальный ключ на placeholder

```diff
- SMS_RU_API_ID=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90
+ SMS_RU_API_ID=YOUR_SMS_RU_API_ID_HERE
```

---

## ИСПРАВЛЕНИЕ 2: Авторизация в API

### 2.1 Создать helper-функции в deps.py

Добавить функции проверки доступа, переиспользуя существующую логику:

```python
# Проверка доступа к сделке (owner или agent)
async def check_deal_access(deal: Deal, user: User) -> bool:
    return deal.created_by_user_id == user.id or deal.agent_user_id == user.id

# Проверка admin роли в организации
async def check_org_admin(org_id: UUID, user: User, db: AsyncSession) -> bool:
    # Переиспользуем паттерн из organization/service.py
```

### 2.2 Исправить deals.py

**Файл:** `backend/app/api/v1/endpoints/deals.py`

Добавить проверки в каждый endpoint после получения deal:

| Endpoint | Строка | Проверка |
|----------|--------|----------|
| GET /{deal_id} | 83 | `check_deal_access(deal, current_user)` |
| PUT /{deal_id} | 105 | `check_deal_access(deal, current_user)` |
| POST /{deal_id}/submit | 133 | `deal.created_by_user_id == current_user.id` |
| POST /{deal_id}/cancel | 161 | `deal.created_by_user_id == current_user.id` |

### 2.3 Исправить organizations.py

**Файл:** `backend/app/api/v1/endpoints/organizations.py`

| Endpoint | Строка | Проверка |
|----------|--------|----------|
| GET /{org_id} | 70 | membership check |
| PUT /{org_id} | 91 | admin role check |
| POST /{org_id}/members | 114 | admin role check |
| POST /{org_id}/payout-accounts | 143 | admin role check |

### 2.4 Исправить documents.py

**Файл:** `backend/app/api/v1/endpoints/documents.py`

| Endpoint | Строка | Проверка |
|----------|--------|----------|
| POST /deals/{deal_id}/generate | 32 | `check_deal_access` |
| GET /{document_id} | 69 | через deal ownership |
| GET /{document_id}/download | 98 | через deal ownership |

---

## ИСПРАВЛЕНИЕ 3: Webhook валидация

**Файл:** `backend/app/api/v1/endpoints/payments.py` (строки 117-120)

Добавить базовую проверку (HMAC когда будет реальный провайдер):

```python
# Временное решение: проверка секретного заголовка
webhook_secret = request.headers.get("X-Webhook-Secret")
if webhook_secret != settings.PAYMENT_WEBHOOK_SECRET:
    raise HTTPException(401, "Invalid webhook secret")
```

---

## ИСПРАВЛЕНИЕ 4: Frontend навигация

### 4.1 Исправить login/page.tsx

**Файл:** `frontend/app/(auth)/login/page.tsx`

```diff
- <Link href="/agent">
+ <Link href="/(auth)/agent">
# или использовать относительные пути: href="agent"
```

### 4.2 Исправить редирект после логина

**Файлы:**
- `frontend/components/auth/SMSAuthForm.tsx` (строка 59)
- `frontend/components/auth/EmailAuthForm.tsx` (строка 51)
- `frontend/components/auth/PasswordAuthForm.tsx` (строка 35)

Создать утилиту для role-based redirect:

```typescript
// lib/utils/redirect.ts
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'agent': return '/agent/dashboard';
    case 'client': return '/client/dashboard';
    case 'agency_admin': return '/agency/dashboard';
    default: return '/';
  }
}
```

Использовать в формах:

```typescript
const user = await getCurrentUser();
setAuth(response.access_token, user);
router.push(getDashboardPath(user.role));
```

### 4.3 Исправить client/layout.tsx

**Файл:** `frontend/app/client/layout.tsx` (строки 27-28)

```diff
- { href: '/dashboard', label: 'Мои сделки' },
- { href: '/documents', label: 'Документы' },
+ { href: '/client/dashboard', label: 'Мои сделки' },
+ { href: '/client/documents', label: 'Документы' },
```

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. **deps.py** - добавить helper-функции (база для остальных исправлений)
2. **.env.example** - удалить реальный API ключ
3. **deals.py** - добавить проверки доступа
4. **organizations.py** - добавить проверки доступа
5. **documents.py** - добавить проверки доступа
6. **payments.py** - добавить проверку webhook
7. **redirect.ts** - создать утилиту для frontend
8. **SMSAuthForm.tsx** - исправить редирект
9. **EmailAuthForm.tsx** - исправить редирект
10. **PasswordAuthForm.tsx** - исправить редирект
11. **login/page.tsx** - исправить ссылки
12. **client/layout.tsx** - исправить пути меню

---

## ОЦЕНКА

- **Затрагиваемые файлы:** 11
- **Новые файлы:** 1 (redirect.ts)
- **Переиспользуемый код:** ~70%
- **Риск регрессии:** Низкий (изменения изолированы)
