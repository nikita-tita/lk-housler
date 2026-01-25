# Единая авторизация Housler

## Обзор

Проекты `lk.housler.ru` и `agent.housler.ru` используют **единую систему авторизации**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ЕДИНАЯ АВТОРИЗАЦИЯ                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   lk.housler.ru                    agent.housler.ru             │
│   ┌───────────┐                    ┌───────────────┐            │
│   │ Frontend  │ ──── Auth API ───> │   Backend     │            │
│   │ (Next.js) │                    │   (Node.js)   │            │
│   └───────────┘                    └───────┬───────┘            │
│         │                                  │                    │
│         │                                  │                    │
│         │        ┌─────────────────────────┘                    │
│         │        │                                              │
│         │        ▼                                              │
│         │   ┌─────────────┐                                     │
│         │   │  PostgreSQL │  housler_agent                      │
│         │   │  (общая БД) │                                     │
│         │   └─────────────┘                                     │
│         │        ▲                                              │
│         │        │                                              │
│   ┌─────┴─────┐  │                                              │
│   │  Backend  │──┘  (подключен к agent-network)                 │
│   │ (FastAPI) │                                                 │
│   └───────────┘                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Типы авторизации

| Тип пользователя | Метод входа | API | Страница |
|------------------|-------------|-----|----------|
| Клиент | SMS код | agent.housler.ru | `/login/client` |
| Агент (риелтор) | SMS код | agent.housler.ru | `/realtor` |
| Сотрудник агентства | SMS код | agent.housler.ru | `/login/employee` |
| Администратор агентства | Email + пароль | lk.housler.ru | `/login/agency` |

## Критические зависимости

| Компонент | Расположение | Влияние |
|-----------|--------------|---------|
| Auth API | `agent.housler.ru/api/auth/*` | Изменения ломают авторизацию на ОБОИХ сайтах |
| JWT_SECRET | `.env` обоих проектов | Должен быть ОДИНАКОВЫМ |
| ENCRYPTION_KEY | `.env` обоих проектов | Должен быть ОДИНАКОВЫМ |
| База данных | `housler_agent` | Общая для обоих проектов |
| Таблица users | `agent-postgres` | Общая для обоих проектов |

---

## API Эндпоинты

### 1. SMS авторизация (клиенты, агенты, сотрудники)

Все SMS авторизации проходят через `agent.housler.ru`:

```bash
# Запросить SMS код
POST https://agent.housler.ru/api/auth/request-sms
Content-Type: application/json
{"phone": "79991234567"}

# Ответ
{"success": true, "data": {"message": "Код отправлен", "codeSentAt": "..."}}
```

```bash
# Подтвердить код
POST https://agent.housler.ru/api/auth/verify-sms
Content-Type: application/json
{"phone": "79991234567", "code": "123456"}

# Ответ (существующий пользователь)
{"success": true, "data": {"token": "...", "user": {...}}}

# Ответ (новый пользователь)
{"success": true, "data": {"isNewUser": true, "message": "Заполните профиль"}}
```

### 2. Email + Пароль (администраторы агентств)

```bash
POST https://lk.housler.ru/api/v1/auth/agency/login
Content-Type: application/json
{"email": "admin@agency.ru", "password": "..."}

# Ответ
{"access_token": "...", "refresh_token": "...", "token_type": "bearer"}
```

### 3. Приглашения сотрудников

Приглашения сотрудников обрабатываются на `lk.housler.ru`:

```bash
# Создать приглашение (требует токен админа агентства)
POST https://lk.housler.ru/api/v1/organizations/{org_id}/employee-invitations
Authorization: Bearer <admin_token>
Content-Type: application/json
{"phone": "79991234567", "name": "Иван Петров", "position": "Риелтор"}

# Ответ
{
  "id": "uuid",
  "phone": "79991234567",
  "inviteToken": "abc123...",
  "expiresAt": "2026-02-01T00:00:00"
}
```

```bash
# Получить информацию о приглашении (публичный эндпоинт)
GET https://lk.housler.ru/api/v1/auth/employee-invite/{token}

# Ответ
{
  "token": "abc123...",
  "agencyName": "ООО Агентство",
  "phone": "79991234567",
  "position": "Риелтор",
  "isExpired": false
}
```

```bash
# Завершить регистрацию сотрудника
POST https://lk.housler.ru/api/v1/auth/register-employee
Content-Type: application/json
{
  "token": "abc123...",
  "name": "Иван Петров",
  "email": "ivan@mail.ru",
  "consents": {"personal_data": true, "terms": true, "agency_offer": true}
}

# Ответ
{"access_token": "...", "refresh_token": "...", "token_type": "bearer"}
```

---

## Тестовые данные

| Тип | Идентификатор | Коды |
|-----|---------------|------|
| SMS (все роли) | `79999xxxxxx` | `111111`, `222222`, `333333`, `444444`, `555555`, `666666` |
| Email | `*@test.housler.ru` | `111111`, `222222`, `333333`, `444444`, `555555`, `666666` |

### Примеры тестовых аккаунтов:

| Телефон | Роль | Код |
|---------|------|-----|
| `79999000001` | Агент | любой из 6 |
| `79999000002` | Агент | любой из 6 |
| `79999100001` | Клиент | любой из 6 |
| `79999100002` | Клиент | любой из 6 |

### Тестовое агентство:

| Поле | Значение |
|------|----------|
| ID | `b2d15739-919b-4ec9-bac6-b1112913d831` |
| Название | Test Agency |
| Админ email | `admin@test.housler.ru` |
| Админ пароль | `test1234` |

---

## Flow авторизации

### Клиент / Агент / Сотрудник (SMS)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Frontend  │────>│ agent.housler.ru│────>│  PostgreSQL │
│ lk.housler  │     │   /auth/...     │     │ housler_agent│
└─────────────┘     └─────────────────┘     └─────────────┘
      │                                            │
      │  1. request-sms (phone)                    │
      │  2. verify-sms (phone, code)               │
      │  3. Получить token + user                  │
      └────────────────────────────────────────────┘
```

### Администратор агентства (пароль)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Frontend  │────>│  lk.housler.ru  │────>│  PostgreSQL │
│ lk.housler  │     │ /auth/agency/.. │     │ housler_agent│
└─────────────┘     └─────────────────┘     └─────────────┘
      │                                            │
      │  1. agency/login (email, password)         │
      │  2. Получить access_token + refresh_token  │
      └────────────────────────────────────────────┘
```

### Регистрация сотрудника (приглашение)

```
┌────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Админ    │────>│  lk.housler.ru  │────>│  PostgreSQL │
│ агентства  │     │ POST /invite    │     │   pending_  │
└────────────┘     └─────────────────┘     │  employees  │
                                           └─────────────┘
      │
      │  1. Создать приглашение
      │  2. Отправить ссылку сотруднику
      │
      ▼
┌────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Сотрудник  │────>│  lk.housler.ru  │────>│  PostgreSQL │
│            │     │ /register-emp.  │     │   users +   │
└────────────┘     └─────────────────┘     │   org_memb  │
                                           └─────────────┘
      │
      │  1. GET /employee-invite/{token}
      │  2. POST /register-employee
      │  3. Получить токены
```

---

## Проверка ролей

При входе проверяется роль пользователя:

| Страница входа | Разрешённые роли |
|----------------|------------------|
| `/login/client` | `client` |
| `/realtor` | `agent` |
| `/login/employee` | `agent` (с членством в организации) |
| `/login/agency` | `agency_admin` |

---

## Правила изменений

### НЕЛЬЗЯ менять без согласования:

1. **Эндпоинты auth API** в `agent.housler.ru`
   - `/api/auth/request-sms`
   - `/api/auth/verify-sms`

2. **Эндпоинты auth API** в `lk.housler.ru`
   - `/api/v1/auth/agency/login`
   - `/api/v1/auth/employee-invite/{token}`
   - `/api/v1/auth/register-employee`

3. **Формат ответа** auth endpoints

4. **Структуру таблиц**:
   - `users`
   - `organizations`
   - `organization_members`
   - `pending_employees`

5. **JWT_SECRET** и **ENCRYPTION_KEY**

### При изменении auth:

1. Проверить совместимость с обоими проектами
2. Обновить оба проекта одновременно
3. Задеплоить оба проекта

---

## Конфигурация

### agent.housler.ru (.env)

```env
DB_HOST=postgres
DB_NAME=housler_agent
JWT_SECRET=<из 1Password: "Housler JWT Secret">
ENCRYPTION_KEY=<из 1Password: "Housler Encryption Key">
ENABLE_TEST_ACCOUNTS=true  # для staging/demo
```

### lk.housler.ru (.env)

```env
# Подключение к БД agent.housler.ru
DB_HOST=agent-postgres
DB_NAME=housler_agent
DB_USER=housler
DB_PASSWORD=<из 1Password: "Housler PostgreSQL">

# ВАЖНО: Должны совпадать с agent.housler.ru
JWT_SECRET=<из 1Password: "Housler JWT Secret">
ENCRYPTION_KEY=<из 1Password: "Housler Encryption Key">
```

> **Security:** Никогда не коммитьте реальные секреты. Все credentials хранятся в 1Password.

---

## Диагностика

### Проверить авторизацию SMS:

```bash
# Отправить SMS (тестовый номер)
curl -X POST https://agent.housler.ru/api/auth/request-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "79999222222"}'

# Проверить код
curl -X POST https://agent.housler.ru/api/auth/verify-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "79999222222", "code": "111111"}'
```

### Проверить авторизацию агентства:

```bash
curl -X POST https://lk.housler.ru/api/v1/auth/agency/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.housler.ru", "password": "test1234"}'
```

### Проверить приглашение сотрудника:

```bash
# Получить токен админа
TOKEN=$(curl -s -X POST https://lk.housler.ru/api/v1/auth/agency/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.housler.ru","password":"test1234"}' | jq -r '.access_token')

# Создать приглашение
curl -X POST "https://lk.housler.ru/api/v1/organizations/b2d15739-919b-4ec9-bac6-b1112913d831/employee-invitations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"79999333444","name":"Тест","position":"Агент"}'
```

---

## Docker сети

```
agenthouslerru_agent-network
    ├── agent-frontend
    ├── agent-backend
    ├── agent-postgres  ◄── Общая БД
    ├── agent-redis
    ├── agent-nginx
    └── lk-backend      ◄── Подключен к обеим сетям

lkhouslerru_lk-network
    ├── lk-frontend
    ├── lk-backend
    ├── lk-redis
    ├── lk-minio
    └── lk-nginx
```

---

## Связанные документы

- [AUTH_SPECIFICATION.md](./AUTH_SPECIFICATION.md) — Спецификация авторизации
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) — Руководство по тестированию
