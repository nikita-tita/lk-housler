# Техническое задание: Единая система авторизации Housler

**Версия:** 2.0
**Дата:** 2025-12-24
**Статус:** Финальное ТЗ

---

## 1. Обзор системы

### 1.1 Цель
Единая система авторизации для всех проектов экосистемы Housler с удобным повторным входом по SMS-коду.

### 1.2 Проекты
| Проект | URL | Назначение |
|--------|-----|------------|
| Agent Housler | agent.housler.ru | Поиск недвижимости, CRM для агентов |
| LK Housler | lk.housler.ru | Личный кабинет, сделки, документы |

### 1.3 Ключевые принципы
- **Единая база** — все пользователи в одной БД `housler_agent`
- **Единый Auth API** — `agent.housler.ru/api/auth/*`
- **Долгоживущий код** — SMS-код действует 30 дней
- **Удобство** — пользователь запоминает код и входит без повторных SMS

---

## 2. Параметры безопасности

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| **Время жизни SMS-кода** | 30 дней | Удобство повторного входа |
| **Время жизни Email-кода** | 10 минут | Email менее безопасен, короткий код |
| **Cooldown между SMS** | 24 часа | Защита от спама, код и так живет месяц |
| **Cooldown между Email** | 1 минута | Стандартный cooldown |
| **Макс. попыток ввода** | 5 | После 5 неудачных — код блокируется |
| **Время жизни JWT** | 7 дней | Баланс безопасности и удобства |
| **Длина кода** | 6 цифр | Стандарт индустрии |

---

## 3. Роли пользователей

| Роль | Код | Метод входа | Описание |
|------|-----|-------------|----------|
| Риелтор | `agent` | Телефон + SMS-код | Частные агенты, самозанятые |
| Клиент | `client` | Email + код | Покупатели недвижимости |
| Админ агентства | `agency_admin` | Email + пароль | Руководители агентств |
| Оператор | `operator` | Email + пароль | Сотрудники агентств |

---

## 4. Пользовательские сценарии

### 4.1 Риелтор — Первый вход (регистрация)

```
УСЛОВИЕ: Пользователя с таким телефоном НЕТ в базе

Шаг 1: Ввод телефона
├── Пользователь вводит +7 (911) 029-55-20
└── Нажимает "Получить код"

Шаг 2: Отправка SMS
├── Backend: пользователь не найден
├── Backend: генерирует код 123456, expires_at = NOW() + 30 дней
├── Backend: отправляет SMS "Ваш код для входа в Housler: 123456"
└── Response: { success: true, data: { message: "Код отправлен", isNewPhone: true } }

Шаг 3: Ввод кода
├── Пользователь вводит код из SMS
└── Нажимает "Продолжить"

Шаг 4: Верификация
├── Backend: код верный, пользователь НЕ найден
└── Response: { success: true, data: { isNewUser: true } }

Шаг 5: Регистрация
├── Форма: ФИО*, Email*, Город, Самозанятый?, ИНН
├── Согласия: обработка ПД*, оферта риелтора*, маркетинг
└── Нажимает "Зарегистрироваться"

Шаг 6: Создание аккаунта
├── Backend: создает пользователя с role='agent'
├── Backend: генерирует JWT токен
└── Response: { success: true, data: { user, token } }

Шаг 7: Готово
├── Токен сохраняется в localStorage
└── Редирект на /agent/dashboard
```

---

### 4.2 Риелтор — Повторный вход (код помнит)

```
УСЛОВИЕ: Пользователь зарегистрирован, помнит свой код

Шаг 1: Ввод телефона
├── Пользователь вводит +7 (911) 029-55-20
└── Нажимает "Получить код"

Шаг 2: Проверка существующего кода
├── Backend: находит активный код (expires_at > NOW(), used_at IS NULL или used недавно)
├── Backend: SMS НЕ отправляется (экономия, защита от спама)
└── Response: {
      success: true,
      data: {
        hasActiveCode: true,
        message: "Введите код, отправленный ранее",
        codeHint: "Код был отправлен 15.12.2024"  // Подсказка когда отправляли
      }
    }

Шаг 3: Ввод кода
├── Пользователь вводит код, который ПОМНИТ с прошлого раза
└── Нажимает "Продолжить"

Шаг 4: Верификация и вход
├── Backend: код верный, пользователь НАЙДЕН
├── Backend: генерирует JWT токен
└── Response: { success: true, data: { isNewUser: false, user, token } }

Шаг 5: Готово
├── Токен сохраняется
└── Редирект на /agent/dashboard

ВАЖНО: SMS не отправляется повторно! Пользователь использует старый код.
```

---

### 4.3 Риелтор — Повторный вход (код забыл)

```
УСЛОВИЕ: Пользователь зарегистрирован, код забыл

Шаг 1-2: Как в сценарии 4.2
└── Response: { hasActiveCode: true, message: "Введите код..." }

Шаг 3: Пользователь не помнит код
├── Показывается ссылка "Забыли код? Получить новый"
└── Пользователь нажимает на ссылку

Шаг 4: Запрос нового кода
├── POST /api/auth/resend-sms { phone, force: true }
├── Backend: проверяет cooldown 24 часа
│   ├── Если < 24ч с последней отправки → ошибка "Подождите до ..."
│   └── Если > 24ч → генерирует НОВЫЙ код, инвалидирует старый
├── Backend: отправляет SMS с новым кодом
└── Response: { success: true, data: { message: "Новый код отправлен" } }

Шаг 5: Ввод нового кода
└── Далее как в сценарии 4.2

ЗАЩИТА: Нельзя спамить SMS — только 1 раз в 24 часа можно запросить новый код.
```

---

### 4.4 Риелтор — Код истек (прошло 30 дней)

```
УСЛОВИЕ: Код создан более 30 дней назад

Шаг 1: Ввод телефона
└── Нажимает "Получить код"

Шаг 2: Автоматическая отправка нового кода
├── Backend: находит код, но expires_at < NOW()
├── Backend: генерирует новый код
├── Backend: отправляет SMS
└── Response: { success: true, data: { message: "Код отправлен" } }

Далее как в сценарии 4.2
```

---

### 4.5 Риелтор — Превышены попытки ввода

```
УСЛОВИЕ: 5 неудачных попыток ввода кода

Шаг 1-3: Пользователь вводит неверный код 5 раз

Шаг 4: Блокировка
├── Backend: attempts >= 5
├── Backend: блокирует код (можно пометить blocked_at)
└── Response: { success: false, error: "Код заблокирован. Запросите новый." }

Шаг 5: Запрос нового кода
├── Показывается кнопка "Получить новый код"
├── При нажатии — отправляется новый код (игнорируя cooldown)
└── Старый код инвалидируется

БЕЗОПАСНОСТЬ: Защита от перебора кода.
```

---

### 4.6 Клиент — Вход по Email

```
Шаг 1: Ввод email
├── client@mail.ru
└── "Получить код"

Шаг 2: Отправка кода на email
├── Код живет 10 минут (email менее безопасен)
├── Cooldown 1 минута
└── Response: { success: true }

Шаг 3: Ввод кода из письма

Шаг 4: Верификация
├── Если пользователь есть → вход
└── Если нет → создается с role='client'

ОТЛИЧИЕ ОТ SMS: Короткое время жизни кода (10 мин вместо 30 дней)
```

---

### 4.7 Агентство — Вход по паролю

```
Шаг 1: Email + пароль
Шаг 2: Проверка bcrypt hash
Шаг 3: JWT токен
Шаг 4: Вход

Дополнительно: "Забыли пароль?" → сброс через email
```

---

## 5. Техническая архитектура

### 5.1 Схема системы

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ЕДИНАЯ АВТОРИЗАЦИЯ HOUSLER                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  lk.housler.ru                         agent.housler.ru              │
│  ┌─────────────┐                       ┌─────────────┐               │
│  │  Frontend   │                       │  Frontend   │               │
│  │  (Next.js)  │                       │  (Next.js)  │               │
│  └──────┬──────┘                       └──────┬──────┘               │
│         │                                     │                      │
│         │ POST /api/auth/*                    │ POST /api/auth/*     │
│         │                                     │                      │
│         └─────────────┬───────────────────────┘                      │
│                       ▼                                              │
│         ┌─────────────────────────────┐                              │
│         │       AUTH API SERVER        │                              │
│         │    agent.housler.ru:3001     │                              │
│         │                              │                              │
│         │  Endpoints:                  │                              │
│         │  • POST /auth/request-sms    │                              │
│         │  • POST /auth/resend-sms     │  ← НОВЫЙ (force=true)       │
│         │  • POST /auth/verify-sms     │                              │
│         │  • POST /auth/request-code   │                              │
│         │  • POST /auth/verify-code    │                              │
│         │  • POST /auth/login-agency   │                              │
│         │  • POST /auth/register-*     │                              │
│         │  • GET  /auth/me             │                              │
│         └─────────────┬────────────────┘                              │
│                       │                                              │
│                       ▼                                              │
│         ┌─────────────────────────────┐                              │
│         │         PostgreSQL          │                              │
│         │        housler_agent        │                              │
│         │                             │                              │
│         │  users          — юзеры     │                              │
│         │  sms_codes      — SMS коды  │                              │
│         │  auth_codes     — Email коды│                              │
│         │  agencies       — агентства │                              │
│         └─────────────────────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Структура таблицы sms_codes

```sql
CREATE TABLE sms_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,

  -- Временные метки
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,        -- created_at + 30 дней
  used_at TIMESTAMP,                    -- Время первого успешного использования
  last_used_at TIMESTAMP,               -- Время последнего использования
  blocked_at TIMESTAMP,                 -- Если заблокирован

  -- Счетчики
  attempts INTEGER DEFAULT 0,           -- Неудачные попытки (макс 5)
  success_count INTEGER DEFAULT 0,      -- Успешные входы по этому коду

  -- Индексы
  CONSTRAINT idx_phone_active UNIQUE (phone)
    WHERE expires_at > NOW() AND blocked_at IS NULL
);

-- Индекс для быстрого поиска активного кода
CREATE INDEX idx_sms_codes_phone_active
  ON sms_codes(phone)
  WHERE expires_at > NOW() AND blocked_at IS NULL;
```

### 5.3 API Endpoints

#### POST /api/auth/request-sms
Запрос кода для входа по телефону.

```typescript
// Request
{ phone: "79110295520" }

// Response — есть активный код
{
  success: true,
  data: {
    hasActiveCode: true,
    message: "Введите код, отправленный ранее",
    codeCreatedAt: "2024-12-15T10:30:00Z",  // Когда был отправлен
    canRequestNewAt: "2024-12-16T10:30:00Z" // Когда можно запросить новый (cooldown)
  }
}

// Response — код отправлен
{
  success: true,
  data: {
    hasActiveCode: false,
    message: "Код отправлен на телефон"
  }
}

// Response — ошибка
{
  success: false,
  error: "Ошибка отправки SMS"
}
```

#### POST /api/auth/resend-sms
Принудительная отправка нового кода (если забыл).

```typescript
// Request
{
  phone: "79110295520",
  force: true  // Принудительно отправить новый
}

// Response — успех
{
  success: true,
  data: {
    message: "Новый код отправлен"
  }
}

// Response — cooldown не прошел
{
  success: false,
  error: "Новый код можно запросить через 23 часа 45 минут",
  data: {
    canRequestNewAt: "2024-12-25T10:30:00Z"
  }
}
```

#### POST /api/auth/verify-sms
Проверка кода и авторизация.

```typescript
// Request
{
  phone: "79110295520",
  code: "123456"
}

// Response — существующий пользователь
{
  success: true,
  data: {
    isNewUser: false,
    user: {
      id: 10,
      phone: "79110295520",
      name: "Иванов Иван",
      email: "ivanov@mail.ru",
      role: "agent",
      agency_id: null
    },
    token: "eyJhbGciOiJIUzI1NiIs..."
  }
}

// Response — новый пользователь (нужна регистрация)
{
  success: true,
  data: {
    isNewUser: true,
    message: "Заполните данные для завершения регистрации"
  }
}

// Response — неверный код
{
  success: false,
  error: "Неверный код",
  data: {
    attemptsLeft: 3  // Осталось попыток
  }
}

// Response — код заблокирован
{
  success: false,
  error: "Код заблокирован после 5 неудачных попыток. Запросите новый."
}
```

### 5.4 Логика Backend (псевдокод)

```typescript
// request-sms
async function requestSms(phone: string) {
  // 1. Ищем активный незаблокированный код
  const existingCode = await db.query(`
    SELECT * FROM sms_codes
    WHERE phone = $1
      AND expires_at > NOW()
      AND blocked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `, [phone]);

  if (existingCode) {
    // Код есть — не отправляем SMS, просим ввести старый
    return {
      success: true,
      data: {
        hasActiveCode: true,
        message: "Введите код, отправленный ранее",
        codeCreatedAt: existingCode.created_at,
        canRequestNewAt: addHours(existingCode.created_at, 24)
      }
    };
  }

  // 2. Кода нет или истек — генерируем новый
  const code = generateCode(); // 6 цифр
  const expiresAt = addDays(new Date(), 30);

  await db.query(`
    INSERT INTO sms_codes (phone, code, expires_at)
    VALUES ($1, $2, $3)
  `, [phone, code, expiresAt]);

  // 3. Отправляем SMS
  await smsService.send(phone, `Ваш код для Housler: ${code}`);

  return {
    success: true,
    data: { hasActiveCode: false, message: "Код отправлен" }
  };
}

// verify-sms
async function verifySms(phone: string, code: string) {
  // 1. Ищем код
  const smsCode = await db.query(`
    SELECT * FROM sms_codes
    WHERE phone = $1
      AND expires_at > NOW()
      AND blocked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `, [phone]);

  if (!smsCode) {
    return { success: false, error: "Код не найден или истек" };
  }

  // 2. Проверяем блокировку
  if (smsCode.attempts >= 5) {
    await db.query(`UPDATE sms_codes SET blocked_at = NOW() WHERE id = $1`, [smsCode.id]);
    return { success: false, error: "Код заблокирован. Запросите новый." };
  }

  // 3. Проверяем код
  if (smsCode.code !== code) {
    await db.query(`UPDATE sms_codes SET attempts = attempts + 1 WHERE id = $1`, [smsCode.id]);
    return {
      success: false,
      error: "Неверный код",
      data: { attemptsLeft: 5 - smsCode.attempts - 1 }
    };
  }

  // 4. Код верный — обновляем статистику
  await db.query(`
    UPDATE sms_codes
    SET used_at = COALESCE(used_at, NOW()),
        last_used_at = NOW(),
        success_count = success_count + 1
    WHERE id = $1
  `, [smsCode.id]);

  // 5. Ищем пользователя
  const user = await db.query(`SELECT * FROM users WHERE phone = $1`, [phone]);

  if (user) {
    // Существующий — генерируем токен
    const token = generateJwt(user);
    return { success: true, data: { isNewUser: false, user, token } };
  } else {
    // Новый — нужна регистрация
    return { success: true, data: { isNewUser: true } };
  }
}
```

### 5.5 JWT токен

```typescript
interface JwtPayload {
  userId: number;
  email: string;
  role: 'client' | 'agent' | 'agency_admin' | 'operator' | 'admin';
  agencyId: number | null;
  iat: number;   // Issued at
  exp: number;   // Expires in 7 days
}

// Конфигурация
const JWT_SECRET = process.env.JWT_SECRET;  // Одинаковый на всех проектах!
const JWT_EXPIRES = '7d';
```

---

## 6. Frontend реализация

### 6.1 Компонент авторизации риелтора

```
┌─────────────────────────────────────────┐
│         Вход для риелторов              │
│    Частные риелторы и самозанятые       │
├─────────────────────────────────────────┤
│                                         │
│  ● Телефон    ○ Код    ○ Данные         │  ← Stepper
│                                         │
│  Номер телефона                         │
│  ┌─────────────────────────────────┐    │
│  │ +7 (911) 029-55-20              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Получить код             │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

          ↓ hasActiveCode: true

┌─────────────────────────────────────────┐
│  ○ Телефон    ● Код    ○ Данные         │
├─────────────────────────────────────────┤
│                                         │
│  Введите код, отправленный 15.12.2024   │
│  на +7 (911) 029-55-20                  │
│                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐   │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │   │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │          Продолжить             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Забыли код? Получить новый             │  ← Ссылка на resend
│                                         │
│  Изменить номер                         │
└─────────────────────────────────────────┘

          ↓ isNewUser: true

┌─────────────────────────────────────────┐
│  ○ Телефон    ○ Код    ● Данные         │
├─────────────────────────────────────────┤
│                                         │
│  ФИО *                                  │
│  ┌─────────────────────────────────┐    │
│  │ Иванов Иван Иванович            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Email *                                │
│  ┌─────────────────────────────────┐    │
│  │ ivanov@mail.ru                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... остальные поля ...                 │
│                                         │
│  ☑ Согласен на обработку ПД *           │
│  ☑ Принимаю оферту риелтора *           │
│  ☐ Согласен на маркетинговые рассылки   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │       Зарегистрироваться        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 6.2 Логика Frontend

```typescript
// Шаг 1: Запрос кода
async function handleRequestCode() {
  const result = await sendSMS(phone);

  if (result.hasActiveCode) {
    // Код уже есть — показываем когда отправлен
    setCodeCreatedAt(result.codeCreatedAt);
    setCanRequestNewAt(result.canRequestNewAt);
    setMessage("Введите код, отправленный " + formatDate(result.codeCreatedAt));
  } else {
    setMessage("Код отправлен на " + phone);
  }

  goToStep('code');
}

// Шаг 2: Забыл код — запрос нового
async function handleResendCode() {
  try {
    const result = await resendSMS(phone, { force: true });
    setMessage("Новый код отправлен");
    setCodeCreatedAt(new Date());
  } catch (error) {
    // Cooldown не прошел
    setError(error.message); // "Новый код можно запросить через..."
  }
}

// Шаг 3: Проверка кода
async function handleVerifyCode() {
  try {
    const result = await verifySMS(phone, code);

    if (result.isNewUser) {
      // Новый — регистрация
      goToStep('registration');
    } else {
      // Существующий — вход
      saveToken(result.token);
      setUser(result.user);
      redirect('/agent/dashboard');
    }
  } catch (error) {
    if (error.attemptsLeft !== undefined) {
      setError(`Неверный код. Осталось попыток: ${error.attemptsLeft}`);
    } else {
      setError(error.message);
    }
  }
}
```

---

## 7. Тестовые данные

| Тип | Идентификатор | Коды |
|-----|---------------|------|
| Телефон | 79999xxxxxx | 111111, 222222, 333333, 444444, 555555, 666666 |
| Email | *@test.housler.ru | 111111, 222222, 333333, 444444, 555555, 666666 |

Тестовые аккаунты:
- Не тратят SMS
- Коды не истекают
- Коды не блокируются

---

## 8. Безопасность

### 8.1 Защита от атак

| Угроза | Защита |
|--------|--------|
| Перебор кода | Макс 5 попыток, потом блокировка |
| Спам SMS | Cooldown 24 часа на повторную отправку |
| Утечка кода | Код действует только для одного телефона |
| Перехват токена | HTTPS, JWT expires 7 дней |
| Подбор телефона | Rate limiting на IP уровне |

### 8.2 Шифрование данных (152-ФЗ)

```
Поле           Хранение
─────────────  ─────────────────────────────
phone          phone_hash (SHA256) + phone_encrypted (AES)
email          email_encrypted (AES)
name           name_encrypted (AES)
passport_*     *_encrypted (AES)
```

---

## 9. CORS конфигурация

```typescript
const allowedOrigins = [
  'https://lk.housler.ru',
  'https://agent.housler.ru',
  'https://www.agent.housler.ru',
];
```

---

## 10. Чеклист реализации

### Backend (agent.housler.ru)

```
[ ] Изменить CODE_EXPIRES_MINUTES с 10 на 43200 (30 дней)
[ ] Добавить поля в sms_codes: last_used_at, blocked_at, success_count
[ ] Добавить endpoint POST /auth/resend-sms с force=true
[ ] Изменить request-sms: возвращать hasActiveCode, codeCreatedAt
[ ] Изменить verify-sms: возвращать attemptsLeft при ошибке
[ ] Добавить логику блокировки после 5 попыток
[ ] Добавить cooldown 24 часа на resend
```

### Frontend (lk.housler.ru)

```
[ ] Обновить UI: показывать дату отправки кода
[ ] Добавить ссылку "Забыли код? Получить новый"
[ ] Добавить обработку hasActiveCode
[ ] Добавить обработку attemptsLeft
[ ] Добавить обработку cooldown при resend
```

### Frontend (agent.housler.ru)

```
[ ] Те же изменения что и для lk.housler.ru
```

---

## 11. Миграция существующих пользователей

При деплое:
1. Существующие коды НЕ меняются
2. Новые коды будут создаваться с expires_at + 30 дней
3. Пользователи с истекшими кодами получат новый при следующем входе

---

## 12. Метрики для мониторинга

```
sms_sent_total          — Всего отправлено SMS
sms_reused_total        — Повторные входы по старому коду (экономия SMS)
auth_success_total      — Успешные авторизации
auth_failed_total       — Неуспешные (неверный код)
codes_blocked_total     — Заблокировано кодов (5 попыток)
```

---

**Документ готов к реализации.**
