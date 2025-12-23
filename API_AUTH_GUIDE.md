# API Auth Guide - Housler lk.housler.ru

## 🎯 3 типа авторизации

### 1️⃣ SMS Auth (Agents) - Риелторы

**Пользователи:** Физ. лица риелторы, самозанятые

**Флоу:**
1. Отправка SMS кода → `POST /api/v1/auth/agent/sms/send`
2. Проверка кода → `POST /api/v1/auth/agent/sms/verify`

```bash
# Шаг 1: Отправить SMS
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567"
  }'

# Ответ: {"message": "SMS code sent"}

# Шаг 2: Проверить код (авто-регистрация если нет)
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567",
    "code": "123456"
  }'

# Ответ:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

---

### 2️⃣ Email Auth (Clients) - Клиенты

**Пользователи:** Клиенты (покупатели/продавцы недвижимости)

**Флоу:**
1. Отправка Email кода → `POST /api/v1/auth/client/email/send`
2. Проверка кода → `POST /api/v1/auth/client/email/verify`

```bash
# Шаг 1: Отправить Email
curl -X POST http://localhost:8000/api/v1/auth/client/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com"
  }'

# Ответ: {"message": "Email code sent"}

# Шаг 2: Проверить код (авто-регистрация если нет)
curl -X POST http://localhost:8000/api/v1/auth/client/email/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "code": "123456"
  }'

# Ответ:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

---

### 3️⃣ Agency Auth (Email + Password) - Агентства

**Пользователи:** Сотрудники агентств (юр. лица)

**Флоу:**
1. Вход с Email + пароль → `POST /api/v1/auth/agency/login`

```bash
# Логин
curl -X POST http://localhost:8000/api/v1/auth/agency/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@agency.ru",
    "password": "SecurePassword123"
  }'

# Ответ:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

---

## 📝 Регистрация с согласиями

### Регистрация Агента (Риелтора)

```bash
curl -X POST http://localhost:8000/api/v1/auth/register/agent \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567",
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "city": "Москва",
    "is_self_employed": true,
    "personal_inn": "123456789012",
    "consents": {
      "personal_data": true,
      "terms": true,
      "marketing": false,
      "realtor_offer": true,
      "agency_offer": false
    }
  }'

# Ответ:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Agent registered successfully. Please verify phone to activate."
}
```

### Регистрация Агентства

```bash
curl -X POST http://localhost:8000/api/v1/auth/register/agency \
  -H "Content-Type: application/json" \
  -d '{
    "inn": "5190237491",
    "name": "ООО \"Недвижимость Плюс\"",
    "legal_address": "г. Москва, ул. Ленина, д. 1",
    "contact_name": "Петр Петров",
    "contact_phone": "+79991234567",
    "contact_email": "contact@agency.ru",
    "password": "SecurePassword123",
    "consents": {
      "personal_data": true,
      "terms": true,
      "marketing": false,
      "realtor_offer": false,
      "agency_offer": true
    }
  }'

# Ответ:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Agency registered successfully. Awaiting verification."
}
```

---

## 🔐 Использование токенов

После получения `access_token` используйте его в заголовке:

```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."
```

**Срок действия токенов:**
- Access token: 7 дней
- Refresh token: 30 дней

---

## 🧪 Тестовые аккаунты

### SMS Test Mode (если SMS_TEST_MODE=true)

**Телефоны:** `+79999000000` - `+79999999999`  
**Коды:** `111111` - `666666`

```bash
# Тестовый агент
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \
  -d '{"phone": "+79999123456"}'

curl -X POST http://localhost:8000/api/v1/auth/agent/sms/verify \
  -d '{"phone": "+79999123456", "code": "111111"}'
```

### Email Test Mode (если EMAIL_PROVIDER=mock)

Все Email будут логироваться в консоль, но не отправляться.

---

## 📊 Роли пользователей (UserRole)

- `client` - Клиенты
- `agent` - Риелторы
- `agency_admin` - Администраторы агентств
- `operator` - Операторы системы
- `admin` - Системные администраторы

---

## ✅ Типы согласий (ConsentType)

- `personal_data` - Согласие на обработку персональных данных (обязательно)
- `terms` - Согласие с условиями использования (обязательно)
- `marketing` - Согласие на маркетинговые рассылки (опционально)
- `realtor_offer` - Оферта для риелторов (для агентов)
- `agency_offer` - Оферта для агентств (для агентств)

---

## 🔒 Безопасность

### PII Encryption (152-ФЗ)

Все персональные данные шифруются AES-256:
- Email (encrypted + hash для поиска)
- Телефон (encrypted + hash для поиска)
- ФИО (encrypted)
- ИНН (encrypted + hash для поиска)

### IP и User-Agent

При регистрации сохраняются:
- IP адрес
- User-Agent браузера

Используются для подтверждения согласий (юридическая значимость).

---

## 🎯 Best Practices

1. **Всегда используйте HTTPS** в production
2. **Храните токены безопасно** (HttpOnly cookies или secure storage)
3. **Обновляйте токены** перед истечением через refresh token
4. **Валидируйте input** на фронтенде перед отправкой
5. **Логируйте попытки входа** для безопасности

