# TASK: Унификация авторизации — SMS для всех ролей

**Дата:** 2026-01-24
**Приоритет:** HIGH
**Статус:** IN PROGRESS (Backend + Frontend MVP done)
**Обновлено:** 2026-01-24 (client SMS auth implemented)

---

## РЕШЕНИЕ (утверждено)

### Единая схема авторизации

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ЕДИНАЯ АВТОРИЗАЦИЯ ПО SMS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ВХОД ПО ТЕЛЕФОНУ                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │ Ввод номера │────►│ SMS код     │────►│ Номер есть в БД?        │   │
│  └─────────────┘     └─────────────┘     └───────────┬─────────────┘   │
│                                                       │                  │
│                              ┌────────────────────────┴────────────┐    │
│                              │                                      │    │
│                              ▼                                      ▼    │
│                     ┌─────────────────┐              ┌─────────────────┐│
│                     │ ДА: Авторизация │              │ НЕТ: Регистрация││
│                     │ → Dashboard     │              │ ФИО, Email, ДР  ││
│                     └─────────────────┘              └─────────────────┘│
│                                                                          │
│  РОЛИ:                                                                   │
│  • agent (риелтор)     — регистрация свободная                          │
│  • client (клиент)     — регистрация свободная                          │
│  • agency_admin        — регистрация организации + SMS подтверждение    │
│  • agency_employee     — ТОЛЬКО через приглашение от agency_admin       │
│                                                                          │
│  ПРАВИЛО: Один телефон = одна роль (уникальность)                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Роли и способы регистрации

| Роль | Регистрация | Авторизация |
|------|-------------|-------------|
| **agent** | Свободная: телефон → SMS → форма (ФИО, email, ДР) | SMS |
| **client** | Свободная: телефон → SMS → форма (ФИО, email, ДР) | SMS |
| **agency_admin** | Форма организации → SMS подтверждение | SMS |
| **agency_employee** | ТОЛЬКО приглашение от admin | SMS |

### Сценарий для сотрудника АН (agency_employee)

```
Сотрудник вводит телефон → Номера нет в БД →

┌─────────────────────────────────────────────────────────────────┐
│  "Ваш номер не найден в системе"                                │
│                                                                  │
│  Если вы сотрудник агентства, попросите вашего                  │
│  руководителя добавить вас в личном кабинете.                   │
│                                                                  │
│  [Отправить приглашение руководителю]                           │
│                                                                  │
│  ────────────────────────────────────────────────               │
│                                                                  │
│  Или зарегистрируйтесь:                                         │
│  [Как риелтор]  [Как агентство]  [Как клиент]                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ИЗМЕНЕНИЯ В БД

### Новое поле: birth_date

```sql
-- Миграция: добавить дату рождения
ALTER TABLE users ADD COLUMN birth_date DATE NULL;

-- Комментарий
COMMENT ON COLUMN users.birth_date IS 'Дата рождения пользователя';
```

### Таблица users (обновлённая схема)

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| phone | VARCHAR(15) | Телефон (уникальный) |
| email | VARCHAR(255) | Email |
| name | VARCHAR(255) | ФИО |
| **birth_date** | DATE | **НОВОЕ: Дата рождения** |
| role | ENUM | agent, client, agency_admin, agency_employee |
| agency_id | UUID | FK на organization (для сотрудников) |
| is_active | BOOLEAN | Активен |
| ... | | |

---

## ПЛАН РАБОТ

### ЭТАП 1: База данных

| ID | Задача | Где | Статус |
|----|--------|-----|--------|
| DB-01 | Миграция: добавить `birth_date` в users | agent.housler.ru | [x] DONE 2026-01-24 |
| DB-02 | Индекс на phone (если нет) | agent.housler.ru | [x] Уже есть idx_users_phone_hash |

### ЭТАП 2: Backend (agent.housler.ru)

| ID | Задача | Описание | Статус |
|----|--------|----------|--------|
| BE-01 | Endpoint `/auth/sms/send` | Единый для всех ролей | [x] Уже есть /auth/request-sms |
| BE-02 | Endpoint `/auth/sms/verify` | Возвращает user или флаг NEW_USER | [x] Уже есть /auth/verify-sms |
| BE-03 | Endpoint `/auth/register-client` | Регистрация клиента | [x] DONE 2026-01-24 |
| BE-04 | birthDate в register-realtor | Добавить поле в схему | [x] DONE 2026-01-24 |
| BE-05 | Валидация уникальности phone+role | Один телефон = одна роль | [x] Встроена в register-client/realtor |
| BE-06 | Agency employee invite flow | Приглашение сотрудника | [ ] Phase 2 |

**API контракты (реализовано):**

```typescript
// POST /auth/request-sms (уже было)
Request: { phone: string }
Response: { success: true, message: string }

// POST /auth/verify-sms (уже было)
Request: { phone: string, code: string }
Response: { success: true, user: User, token: string }

// POST /auth/register-client (НОВЫЙ)
Request: {
  phone: string,
  name: string,
  email: string,
  birthDate: string,  // YYYY-MM-DD (обязательно)
  consents: {
    personalData: true,
    terms: true,
    marketing?: boolean
  }
}
Response: { success: true, data: { user: User, token: string, message: string } }

// POST /auth/register-realtor (обновлён)
Request: {
  phone: string,
  name: string,
  email: string,
  birthDate?: string,  // YYYY-MM-DD (опционально)
  city?: string,
  isSelfEmployed?: boolean,
  personalInn?: string,
  consents: {
    personalData: true,
    terms: true,
    realtorOffer: true,
    marketing?: boolean
  }
}
Response: { success: true, data: { user: User, token: string, message: string } }
```

### ЭТАП 3: Frontend — Общие компоненты

| ID | Задача | Файл | Статус |
|----|--------|------|--------|
| FE-01 | DateInput компонент | `components/auth/DateInput.tsx` | [x] DONE 2026-01-24 |
| FE-02 | Убедиться PhoneInput есть | `components/auth/PhoneInput.tsx` | [x] |
| FE-03 | Убедиться SmsCodeInput есть | `components/auth/SmsCodeInput.tsx` | [x] |

### ЭТАП 4: Frontend — Страницы авторизации (lk.housler.ru)

| ID | Задача | Файл | Статус |
|----|--------|------|--------|
| FE-04 | Переписать /login/client | `app/(auth)/login/client/page.tsx` | [x] DONE 2026-01-24 |
| FE-05 | Обновить /realtor (agent) | `app/(auth)/realtor/page.tsx` | [x] Уже SMS, birthDate опц. |
| FE-06 | Обновить /login/agency | `app/(auth)/login/agency/page.tsx` | [ ] Phase 2 |
| FE-07 | Страница "Вас не добавили" | `app/(auth)/not-found-employee/page.tsx` | [ ] Phase 2 |
| FE-08 | Форма регистрации с ДР | Встроена в /login/client | [x] DONE 2026-01-24 |

### ЭТАП 5: Frontend — Профиль и настройки

| ID | Задача | Описание | Статус |
|----|--------|----------|--------|
| FE-09 | Отображение ДР в профиле | Все роли | [ ] |
| FE-10 | Редактирование ДР | Если разрешено | [ ] |

### ЭТАП 6: Приглашение сотрудников АН

| ID | Задача | Описание | Статус |
|----|--------|----------|--------|
| INV-01 | UI добавления сотрудника в ЛК агентства | agency_admin | [ ] |
| INV-02 | Генерация invite link | Backend | [ ] |
| INV-03 | Страница принятия приглашения | Frontend | [ ] |
| INV-04 | Email/SMS с приглашением | Уведомление | [ ] |

### ЭТАП 7: Тестирование

| ID | Задача | Статус |
|----|--------|--------|
| QA-01 | Новый клиент: телефон → SMS → регистрация → dashboard | [ ] |
| QA-02 | Новый агент: телефон → SMS → регистрация → dashboard | [ ] |
| QA-03 | Существующий user: телефон → SMS → dashboard | [ ] |
| QA-04 | Сотрудник АН без приглашения: показ сообщения | [ ] |
| QA-05 | Приглашение сотрудника АН: full flow | [ ] |
| QA-06 | Тестовые номера 79999xxxxxx | [ ] |

### ЭТАП 8: Деплой

| ID | Задача | Статус |
|----|--------|--------|
| DEV-01 | Deploy миграции БД | [ ] |
| DEV-02 | Deploy backend agent.housler.ru | [ ] |
| DEV-03 | Deploy frontend lk.housler.ru | [ ] |
| DEV-04 | Smoke test production | [ ] |

---

## ПРИОРИТИЗАЦИЯ

### MVP (первый релиз)

**Цель:** Базовая SMS авторизация для agent и client

| Приоритет | Задачи |
|-----------|--------|
| P0 | DB-01, BE-01, BE-02, BE-03, BE-04 |
| P0 | FE-04 (client login), FE-05 (agent login) |
| P0 | QA-01, QA-02, QA-03 |

### Phase 2

**Цель:** Agency employee flow

| Приоритет | Задачи |
|-----------|--------|
| P1 | FE-06, FE-07, INV-01..04 |
| P1 | QA-04, QA-05 |

### Phase 3

**Цель:** Профиль, настройки

| Приоритет | Задачи |
|-----------|--------|
| P2 | FE-09, FE-10 |

---

## ОЦЕНКА ТРУДОЗАТРАТ

| Этап | Часы | Сложность |
|------|------|-----------|
| БД миграция | 0.5 | Low |
| Backend endpoints | 4-6 | Medium |
| Frontend client/agent login | 3-4 | Medium |
| Frontend agency employee flow | 4-6 | Medium |
| Приглашения сотрудников | 4-6 | Medium |
| Профиль/настройки | 2 | Low |
| Тестирование | 3-4 | Low |
| Деплой | 1 | Low |
| **ИТОГО MVP** | **8-12 часов** | Medium |
| **ИТОГО ПОЛНЫЙ** | **22-30 часов** | Medium-High |

---

## ЗАВИСИМОСТИ

```
DB-01 ──► BE-01..BE-04 ──► FE-04, FE-05 ──► QA ──► Deploy
                │
                └──► FE-06, FE-07, INV-* (Phase 2)
```

---

## РИСКИ

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| SMS лимиты SMS.RU | Low | Проверить баланс, настроить алерты |
| Конфликт phone уникальности | Medium | Чёткая валидация на backend |
| Сложность agency flow | Medium | Разбить на phases |

---

## ОТКРЫТЫЕ ВОПРОСЫ (РЕШЕНО)

| Вопрос | Решение |
|--------|---------|
| Регистрация клиента | Форма: ФИО, email, дата рождения |
| Существующие клиенты с email | Забить — их нет |
| Один номер = несколько ролей? | Нет, один номер = одна роль |
| Сотрудник АН без приглашения | Показать сообщение + варианты |

---

## СЛЕДУЮЩИЙ ШАГ

**Начать с MVP:**
1. BE: Миграция birth_date
2. BE: Унифицированные SMS endpoints
3. FE: Переписать client и agent login pages

**Кто делает?**
- [ ] BE-LK / BE-AGENT: Backend изменения
- [ ] FE-LK: Frontend изменения

---

*Создано: 2026-01-24*
*Обновлено: 2026-01-24*
*Автор: TPM-LK*
