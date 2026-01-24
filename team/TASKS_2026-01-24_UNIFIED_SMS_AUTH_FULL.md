# Унификация авторизации: SMS для всех ролей

**Версия:** 1.0 FINAL
**Дата:** 2026-01-24
**Статус:** APPROVED

---

## 1. ОБЗОР

### 1.1 Цель
Унифицировать авторизацию всех пользователей через SMS, убрать email-авторизацию для клиентов, добавить дату рождения при регистрации.

### 1.2 Текущее состояние

| Роль | Вход | Регистрация | Проблемы |
|------|------|-------------|----------|
| agent | SMS `/request-sms` → `/verify-sms` | `/register-realtor` | Работает |
| client | Email `/request-code` → `/verify-code` | Автосоздание при verify | Email ненадёжен |
| agency_admin | Email+пароль `/login-agency` | `/register-agency` | Нет SMS подтверждения |
| agency_employee | — | — | Нет механизма |

### 1.3 Целевое состояние

| Роль | Вход | Регистрация |
|------|------|-------------|
| agent | SMS | Телефон → SMS → форма (ФИО, email, ДР) |
| client | SMS | Телефон → SMS → форма (ФИО, email, ДР) |
| agency_admin | SMS | Форма организации → SMS подтверждение |
| agency_employee | SMS | Только через приглашение от admin |

### 1.4 Ключевые правила
1. **Один телефон = одна роль** (уникальность phone+role)
2. **Дата рождения обязательна** при регистрации
3. **Сотрудник АН** не может зарегистрироваться сам
4. **Email-авторизация** удаляется для клиентов

---

## 2. АРХИТЕКТУРА

### 2.1 Flow авторизации

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED AUTH FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ Выбор роли   │  /login → client | agent | agency                        │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐     ┌──────────────┐                                      │
│  │ Ввод телефона│────►│ POST         │                                      │
│  │              │     │ /auth/sms/send│                                      │
│  └──────────────┘     └──────┬───────┘                                      │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────┐     ┌──────────────┐                                      │
│  │ Ввод SMS кода│────►│ POST         │                                      │
│  │              │     │/auth/sms/verify                                      │
│  └──────────────┘     └──────┬───────┘                                      │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐              │
│  │ USER EXISTS │     │ NEW USER    │     │ EMPLOYEE NOT     │              │
│  │ → Login OK  │     │ → Register  │     │ FOUND → Error    │              │
│  │ → Dashboard │     │ → Form      │     │ → Options        │              │
│  └─────────────┘     └─────────────┘     └──────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Регистрация по ролям

```
AGENT / CLIENT (свободная регистрация):
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    ┌──────────┐
│ Телефон     │───►│ SMS код     │───►│ Форма регистрации   │───►│ Dashboard│
│             │    │             │    │ • ФИО *             │    │          │
└─────────────┘    └─────────────┘    │ • Email *           │    └──────────┘
                                      │ • Дата рождения *   │
                                      │ • Согласия          │
                                      └─────────────────────┘

AGENCY_ADMIN (регистрация организации):
┌─────────────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│ Форма организации   │───►│ Телефон     │───►│ SMS код     │───►│ Dashboard│
│ • ИНН *             │    │ контакт.лица│    │             │    │          │
│ • Название *        │    │             │    │             │    │          │
│ • Юр.адрес *        │    └─────────────┘    └─────────────┘    └──────────┘
│ • Контактное лицо * │
│ • ФИО, Email, ДР    │
│ • Пароль (опц.)     │
└─────────────────────┘

AGENCY_EMPLOYEE (только приглашение):
┌─────────────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│ Admin добавляет     │───►│ Invite link │───►│ SMS код     │───►│ Dashboard│
│ сотрудника в ЛК     │    │ или SMS     │    │             │    │          │
│ (телефон, ФИО)      │    │             │    │             │    │          │
└─────────────────────┘    └─────────────┘    └─────────────┘    └──────────┘
```

### 2.3 Сценарий "Сотрудник не найден"

```
Пользователь выбирает "Вход как сотрудник АН" → вводит телефон → SMS →
телефона нет в БД как agency_employee →

┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Ваш номер не зарегистрирован как сотрудник агентства                  │
│                                                                          │
│   Если вы работаете в агентстве недвижимости, попросите                 │
│   руководителя добавить вас через личный кабинет.                       │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Телефон или email руководителя: [________________]              │   │
│   │                                                                  │   │
│   │ [Отправить запрос на добавление]                                │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────     │
│                                                                          │
│   Или зарегистрируйтесь самостоятельно:                                 │
│                                                                          │
│   [Как частный риелтор]   [Как агентство]   [Как клиент]               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ИЗМЕНЕНИЯ В БД

### 3.1 Миграция: birth_date

```sql
-- Migration: add_birth_date_to_users
-- Up
ALTER TABLE users ADD COLUMN birth_date DATE NULL;
CREATE INDEX idx_users_birth_date ON users(birth_date);
COMMENT ON COLUMN users.birth_date IS 'Дата рождения пользователя';

-- Down
DROP INDEX IF EXISTS idx_users_birth_date;
ALTER TABLE users DROP COLUMN IF EXISTS birth_date;
```

### 3.2 Таблица employee_invites (новая)

```sql
-- Migration: create_employee_invites
CREATE TABLE employee_invites (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  invited_by INTEGER NOT NULL REFERENCES users(id),
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired, cancelled
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_pending_invite UNIQUE (agency_id, phone, status)
);

CREATE INDEX idx_employee_invites_token ON employee_invites(token);
CREATE INDEX idx_employee_invites_agency ON employee_invites(agency_id);
CREATE INDEX idx_employee_invites_phone ON employee_invites(phone);
```

### 3.3 Таблица invite_requests (новая)

```sql
-- Migration: create_invite_requests
-- Запросы от потенциальных сотрудников к руководителям
CREATE TABLE invite_requests (
  id SERIAL PRIMARY KEY,
  requester_phone VARCHAR(20) NOT NULL,
  requester_name VARCHAR(255),
  target_contact VARCHAR(255) NOT NULL, -- phone или email руководителя
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, ignored
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API КОНТРАКТЫ

### 4.1 Существующие endpoints (без изменений)

| Endpoint | Описание | Изменения |
|----------|----------|-----------|
| `POST /auth/request-sms` | Отправить SMS | Нет |
| `POST /auth/verify-sms` | Проверить SMS | Добавить `targetRole` в ответ |
| `POST /auth/register-realtor` | Регистрация агента | Добавить `birthDate` |
| `POST /auth/register-agency` | Регистрация АН | Добавить `birthDate`, SMS verify |
| `POST /auth/login-agency` | Вход АН | Заменить на SMS |

### 4.2 Изменения в существующих endpoints

#### POST /auth/verify-sms (изменение response)

```typescript
// Request (без изменений)
{
  phone: string,
  code: string
}

// Response (изменение)
{
  success: true,
  data: {
    // Существующий пользователь
    isNewUser: false,
    user: User,
    token: string
  } | {
    // Новый пользователь - нужна регистрация
    isNewUser: true,
    phone: string,
    availableRoles: ('agent' | 'client')[]  // NEW: какие роли доступны
  } | {
    // Телефон есть как employee invite
    isNewUser: true,
    isPendingEmployee: true,  // NEW
    agencyName: string,       // NEW
    inviteToken: string       // NEW: для завершения регистрации
  }
}
```

#### POST /auth/register-realtor (изменение request)

```typescript
// Request (добавить birthDate)
{
  phone: string,
  name: string,
  email: string,
  birthDate: string,        // NEW: YYYY-MM-DD, обязательно
  city?: string,
  isSelfEmployed?: boolean,
  personalInn?: string,
  consents: {
    personalData: boolean,
    terms: boolean,
    realtorOffer: boolean,
    marketing?: boolean
  }
}
```

### 4.3 Новые endpoints

#### POST /auth/register-client (новый)

```typescript
// Request
{
  phone: string,
  name: string,
  email: string,
  birthDate: string,  // YYYY-MM-DD
  consents: {
    personalData: boolean,
    terms: boolean,
    marketing?: boolean
  }
}

// Response
{
  success: true,
  data: {
    user: User,
    token: string
  }
}
```

#### POST /auth/agency/invite-employee (новый)

```typescript
// Request (требует auth agency_admin)
{
  phone: string,
  name: string,
  email?: string,
  sendSms?: boolean  // отправить SMS с приглашением
}

// Response
{
  success: true,
  data: {
    inviteId: number,
    inviteToken: string,
    inviteUrl: string,
    expiresAt: string
  }
}
```

#### POST /auth/accept-employee-invite (новый)

```typescript
// Request
{
  inviteToken: string,
  phone: string,
  code: string,  // SMS код
  birthDate: string,
  consents: { ... }
}

// Response
{
  success: true,
  data: {
    user: User,
    token: string
  }
}
```

#### POST /auth/request-invite (новый)

```typescript
// Request (от потенциального сотрудника)
{
  requesterPhone: string,
  requesterName?: string,
  targetContact: string,  // phone или email руководителя
  message?: string
}

// Response
{
  success: true,
  message: "Запрос отправлен"
}
```

---

## 5. FRONTEND ИЗМЕНЕНИЯ

### 5.1 Структура страниц

```
apps/lk/app/
├── (auth)/
│   ├── login/
│   │   ├── page.tsx              # Выбор роли (без изменений)
│   │   ├── client/
│   │   │   └── page.tsx          # ПЕРЕПИСАТЬ: SMS вместо email
│   │   ├── agency/
│   │   │   └── page.tsx          # ИЗМЕНИТЬ: SMS подтверждение
│   │   └── employee/
│   │       └── page.tsx          # НОВАЯ: вход сотрудника АН
│   ├── realtor/
│   │   └── page.tsx              # ИЗМЕНИТЬ: добавить birthDate
│   ├── register/
│   │   ├── client/
│   │   │   └── page.tsx          # НОВАЯ: форма регистрации клиента
│   │   └── employee/
│   │       └── page.tsx          # НОВАЯ: завершение инвайта
│   ├── not-found/
│   │   └── page.tsx              # НОВАЯ: "сотрудник не найден"
│   └── invite/
│       └── [token]/
│           └── page.tsx          # НОВАЯ: принятие инвайта
```

### 5.2 Компоненты

```
apps/lk/components/
├── auth/
│   ├── PhoneInput.tsx            # Есть
│   ├── SmsCodeInput.tsx          # Есть
│   ├── DateInput.tsx             # НОВЫЙ: ввод даты рождения
│   ├── RegistrationForm.tsx      # НОВЫЙ: общая форма (ФИО, email, ДР)
│   ├── ConsentCheckbox.tsx       # Есть
│   └── RoleSelector.tsx          # Есть
```

### 5.3 API функции (packages/lib)

```typescript
// packages/lib/src/api/auth.ts - ИЗМЕНЕНИЯ

// Существующие (без изменений)
export async function sendSMS(phone: string): Promise<SendSmsResult>
export async function verifySMS(phone: string, code: string): Promise<VerifySmsResponse>
export async function registerAgent(data: AgentRegisterData): Promise<AuthResponse>

// Изменить signature
export interface AgentRegisterData {
  // ... existing
  birthDate: string  // NEW
}

// Новые функции
export async function registerClient(data: ClientRegisterData): Promise<AuthResponse>
export async function inviteEmployee(data: InviteEmployeeData): Promise<InviteResult>
export async function acceptEmployeeInvite(data: AcceptInviteData): Promise<AuthResponse>
export async function requestInvite(data: RequestInviteData): Promise<void>

// Удалить (deprecated)
export async function sendEmail(email: string): Promise<...>  // REMOVE
export async function verifyEmail(email: string, code: string): Promise<...>  // REMOVE
```

---

## 6. ДЕКОМПОЗИЦИЯ ЗАДАЧ

### PHASE 1: MVP — Client SMS Auth (P0)

#### BE-001: Миграция birth_date
```
Описание: Добавить поле birth_date в таблицу users
Файлы: agent-housler/migrations/xxx_add_birth_date.sql
Acceptance:
  - [ ] Миграция создана и применена
  - [ ] Индекс создан
  - [ ] Down миграция работает
Часы: 0.5
```

#### BE-002: Endpoint /auth/register-client
```
Описание: Создать endpoint регистрации клиента
Файлы:
  - backend/src/api/controllers/auth.controller.ts
  - backend/src/api/routes/auth.routes.ts
  - backend/src/validation/schemas.ts
  - backend/src/services/auth.service.ts
Acceptance:
  - [ ] POST /auth/register-client работает
  - [ ] Валидация: phone, name, email, birthDate обязательны
  - [ ] Создаётся user с role=client
  - [ ] Возвращается JWT token
  - [ ] birthDate сохраняется в БД
Часы: 2
```

#### BE-003: Обновить /auth/verify-sms response
```
Описание: Добавить availableRoles в response для новых пользователей
Файлы:
  - backend/src/api/controllers/auth.controller.ts
Acceptance:
  - [ ] isNewUser=true возвращает availableRoles
  - [ ] Для agent/client возвращает оба варианта
Часы: 1
```

#### BE-004: birthDate в /auth/register-realtor
```
Описание: Добавить обязательное поле birthDate
Файлы:
  - backend/src/validation/schemas.ts
  - backend/src/services/auth.service.ts
Acceptance:
  - [ ] birthDate обязателен
  - [ ] Валидация формата YYYY-MM-DD
  - [ ] Сохраняется в БД
Часы: 1
```

#### FE-001: Компонент DateInput
```
Описание: Создать компонент ввода даты рождения
Файлы: apps/lk/components/auth/DateInput.tsx
Acceptance:
  - [ ] Маска ввода DD.MM.YYYY
  - [ ] Валидация возраста (18+)
  - [ ] Конвертация в YYYY-MM-DD для API
Часы: 1.5
```

#### FE-002: Компонент RegistrationForm
```
Описание: Общая форма регистрации (ФИО, email, ДР)
Файлы: apps/lk/components/auth/RegistrationForm.tsx
Acceptance:
  - [ ] Поля: name, email, birthDate
  - [ ] Валидация всех полей
  - [ ] Переиспользуется для client и agent
Часы: 2
```

#### FE-003: Страница /login/client переписать на SMS
```
Описание: Заменить email на SMS авторизацию
Файлы: apps/lk/app/(auth)/login/client/page.tsx
Acceptance:
  - [ ] Ввод телефона вместо email
  - [ ] SMS код вместо email кода
  - [ ] При isNewUser → переход на /register/client
  - [ ] Тестовые номера работают
Часы: 2
```

#### FE-004: Страница /register/client
```
Описание: Форма регистрации клиента
Файлы: apps/lk/app/(auth)/register/client/page.tsx
Acceptance:
  - [ ] ФИО, Email, Дата рождения
  - [ ] Согласия (personalData, terms)
  - [ ] Вызов /auth/register-client
  - [ ] Редирект на dashboard
Часы: 2
```

#### FE-005: Обновить /realtor с birthDate
```
Описание: Добавить дату рождения в форму регистрации агента
Файлы: apps/lk/app/(auth)/realtor/page.tsx
Acceptance:
  - [ ] DateInput в форме регистрации
  - [ ] Обязательное поле
  - [ ] Передаётся в API
Часы: 1
```

#### FE-006: API функции в lib
```
Описание: Добавить registerClient, обновить типы
Файлы: packages/lib/src/api/auth.ts
Acceptance:
  - [ ] registerClient функция
  - [ ] birthDate в AgentRegisterData
  - [ ] Удалить sendEmail, verifyEmail (или deprecated)
Часы: 1
```

#### QA-001: Тестирование MVP
```
Описание: E2E тесты для client и agent SMS auth
Acceptance:
  - [ ] Новый клиент: телефон → SMS → регистрация → dashboard
  - [ ] Новый агент: телефон → SMS → регистрация → dashboard
  - [ ] Существующий user: телефон → SMS → dashboard
  - [ ] Тестовые номера 79999xxxxxx работают
Часы: 2
```

**MVP ИТОГО: 16 часов**

---

### PHASE 2: Agency SMS + Employee Flow (P1)

#### BE-005: Миграция employee_invites
```
Описание: Создать таблицу приглашений сотрудников
Файлы: migrations/xxx_create_employee_invites.sql
Acceptance:
  - [ ] Таблица создана
  - [ ] Индексы созданы
  - [ ] Constraint на уникальность pending invite
Часы: 0.5
```

#### BE-006: Endpoint /auth/agency/invite-employee
```
Описание: API для приглашения сотрудника
Файлы:
  - backend/src/api/controllers/auth.controller.ts
  - backend/src/api/routes/auth.routes.ts
Acceptance:
  - [ ] Требует auth agency_admin
  - [ ] Создаёт invite с токеном
  - [ ] Опционально отправляет SMS
  - [ ] Возвращает invite URL
Часы: 3
```

#### BE-007: Endpoint /auth/accept-employee-invite
```
Описание: Принятие приглашения сотрудником
Файлы:
  - backend/src/api/controllers/auth.controller.ts
Acceptance:
  - [ ] Валидация токена
  - [ ] Проверка SMS кода
  - [ ] Создание user с role=agency_employee
  - [ ] Привязка к agency
Часы: 3
```

#### BE-008: Обновить /auth/verify-sms для employee
```
Описание: Определять pending employee invites
Файлы:
  - backend/src/services/auth.service.ts
Acceptance:
  - [ ] Если телефон есть в employee_invites (pending) → isPendingEmployee
  - [ ] Возвращать agencyName и inviteToken
Часы: 2
```

#### BE-009: SMS подтверждение для agency registration
```
Описание: Добавить SMS verify в регистрацию АН
Файлы:
  - backend/src/services/auth.service.ts
  - backend/src/api/controllers/auth.controller.ts
Acceptance:
  - [ ] После заполнения формы → SMS на телефон контактного лица
  - [ ] Верификация SMS → создание agency + user
Часы: 3
```

#### FE-007: Страница /login/employee
```
Описание: Вход для сотрудников АН
Файлы: apps/lk/app/(auth)/login/employee/page.tsx
Acceptance:
  - [ ] Ввод телефона
  - [ ] SMS верификация
  - [ ] При isPendingEmployee → переход на /register/employee
  - [ ] При user not found → /not-found
Часы: 2
```

#### FE-008: Страница /register/employee
```
Описание: Завершение регистрации сотрудника по инвайту
Файлы: apps/lk/app/(auth)/register/employee/page.tsx
Acceptance:
  - [ ] Показ названия агентства
  - [ ] Форма: ФИО, Email, ДР (если не заполнены)
  - [ ] Согласия
  - [ ] Вызов /auth/accept-employee-invite
Часы: 2
```

#### FE-009: Страница /not-found (employee not found)
```
Описание: "Ваш номер не найден"
Файлы: apps/lk/app/(auth)/not-found/page.tsx
Acceptance:
  - [ ] Сообщение о ненайденном номере
  - [ ] Форма "отправить запрос руководителю"
  - [ ] Кнопки перехода на другие регистрации
Часы: 2
```

#### FE-010: UI добавления сотрудника в ЛК АН
```
Описание: Интерфейс для agency_admin
Файлы: apps/lk/app/agency/employees/page.tsx (или settings)
Acceptance:
  - [ ] Список сотрудников
  - [ ] Кнопка "Добавить сотрудника"
  - [ ] Форма: телефон, ФИО, email
  - [ ] Показ статуса приглашения
Часы: 4
```

#### FE-011: Обновить /login/agency на SMS
```
Описание: Заменить email+password на SMS
Файлы: apps/lk/app/(auth)/login/agency/page.tsx
Acceptance:
  - [ ] Вход по телефону + SMS
  - [ ] Убрать поле пароля
  - [ ] При регистрации → SMS подтверждение
Часы: 2
```

#### QA-002: Тестирование Phase 2
```
Acceptance:
  - [ ] Agency admin приглашает сотрудника
  - [ ] Сотрудник получает SMS, переходит по ссылке
  - [ ] Сотрудник завершает регистрацию
  - [ ] Сотрудник АН без инвайта видит сообщение
  - [ ] Agency регистрация с SMS работает
Часы: 3
```

**PHASE 2 ИТОГО: 26.5 часов**

---

### PHASE 3: Invite Requests + Profile (P2)

#### BE-010: Миграция invite_requests
```
Файлы: migrations/xxx_create_invite_requests.sql
Часы: 0.5
```

#### BE-011: Endpoint /auth/request-invite
```
Описание: Запрос на добавление от потенциального сотрудника
Acceptance:
  - [ ] Сохранение запроса в БД
  - [ ] Отправка уведомления руководителю (email/SMS)
Часы: 2
```

#### FE-012: Профиль: отображение birthDate
```
Файлы: apps/lk/app/*/profile/page.tsx
Acceptance:
  - [ ] Показ даты рождения
  - [ ] Редактирование (если разрешено)
Часы: 2
```

#### FE-013: Уведомления о запросах на добавление
```
Описание: UI для agency_admin о входящих запросах
Acceptance:
  - [ ] Список запросов
  - [ ] Кнопка "Добавить" → создаёт invite
  - [ ] Кнопка "Игнорировать"
Часы: 3
```

**PHASE 3 ИТОГО: 7.5 часов**

---

## 7. СВОДКА

### Трудозатраты по фазам

| Фаза | Задач | Часы | Приоритет |
|------|-------|------|-----------|
| Phase 1: MVP | 11 | 16 | P0 |
| Phase 2: Agency + Employee | 11 | 26.5 | P1 |
| Phase 3: Requests + Profile | 4 | 7.5 | P2 |
| **ИТОГО** | **26** | **50** | |

### Зависимости

```
Phase 1 (MVP)
├── BE-001 (migration) ──────────────────────┐
├── BE-002 (register-client) ◄───────────────┤
├── BE-003 (verify-sms update) ◄─────────────┤
├── BE-004 (birthDate in realtor) ◄──────────┘
│       │
│       ▼
├── FE-001 (DateInput) ──────────────────────┐
├── FE-002 (RegistrationForm) ◄──────────────┤
├── FE-003 (client login) ◄──────────────────┤
├── FE-004 (client register) ◄───────────────┤
├── FE-005 (realtor update) ◄────────────────┤
├── FE-006 (lib functions) ◄─────────────────┘
│       │
│       ▼
└── QA-001 (testing)

Phase 2 (Agency)
├── BE-005 (migration) ──────────────────────┐
├── BE-006 (invite-employee) ◄───────────────┤
├── BE-007 (accept-invite) ◄─────────────────┤
├── BE-008 (verify-sms for employee) ◄───────┤
├── BE-009 (agency SMS) ◄────────────────────┘
│       │
│       ▼
├── FE-007 (employee login)
├── FE-008 (employee register)
├── FE-009 (not-found page)
├── FE-010 (admin UI)
├── FE-011 (agency login update)
│       │
│       ▼
└── QA-002 (testing)

Phase 3 (Polish)
├── BE-010, BE-011
└── FE-012, FE-013
```

### Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| SMS лимиты | Low | Мониторинг баланса SMS.RU |
| Сложность employee flow | Medium | Разбить на подзадачи, ревью |
| Миграция данных | Low | Нет существующих клиентов |
| Regression в auth | Medium | E2E тесты перед деплоем |

---

## 8. DEPLOYMENT PLAN

### Phase 1 Deploy
1. Deploy BE-001..BE-004 на agent.housler.ru
2. Deploy FE-001..FE-006 на lk.housler.ru
3. Smoke test: новый клиент, новый агент
4. Monitor errors 24h

### Phase 2 Deploy
1. Deploy BE-005..BE-009
2. Deploy FE-007..FE-011
3. Smoke test: employee flow
4. Monitor 24h

### Rollback Plan
- Откат миграций: down migrations готовы
- Откат кода: git revert + redeploy
- Feature flag: можно добавить для постепенного раскатывания

---

*Документ версия 1.0*
*Создан: 2026-01-24*
*Автор: TPM*
