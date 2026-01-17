# Миграция: MoR -> Instant Split

**Дата:** 2026-01-16
**Версия:** 1.1
**Статус:** DRAFT

**Модель:** Договор → Подпись → Счет → Оплата → Авто-сплит (макс 1 час холда)

---

## 1. Сравнение БЫЛО / БУДЕТ

### 1.1. Бизнес-модель

| Аспект | БЫЛО (MoR) | БУДЕТ (Instant Split) |
|--------|------------|------------------------|
| **Получатель платежа** | Housler (MoR) | Т-Банк (номинальный счет) |
| **Деньги клиента** | На счете Housler | Сразу распределяются (макс 1 час холда) |
| **Распределение** | Housler сам делит | Банк автоматически по сплиту |
| **Комиссия Housler** | Удержание из суммы | Revshare от банка (не участник сплита) |
| **Фискализация (54-ФЗ)** | На Housler | На получателях (СЗ/ИП/ООО) |
| **Риски 115-ФЗ** | Полностью на Housler | Распределены (банк + площадка) |
| **Роль Housler** | Merchant of Record | Витрина + арбитр условий |
| **Модель расчетов** | Escrow с долгим холдом | Instant split (договор → счет → авто-выплата) |

### 1.2. Участники расчетов

| Роль | БЫЛО | БУДЕТ |
|------|------|-------|
| **Клиент** | Платит Housler | Платит в контур банка |
| **Агент** | Получает от Housler | Получает от банка напрямую |
| **Агентство** | Получает от Housler | Получает от банка напрямую |
| **Housler** | Принимает все деньги | Revshare от банка (НЕ участник сплита) |
| **Банк** | Эквайринг | Прием + авто-сплит + выплаты |

### 1.3. State Machine сделки

**БЫЛО (MoR):**
```
DRAFT -> AWAITING_SIGNATURES -> SIGNED -> PAYMENT_PENDING -> IN_PROGRESS -> CLOSED
                                                                        \-> DISPUTE
                                                                        \-> CANCELLED
```

**БУДЕТ (Instant Split):**

Модель: Договор → Подпись → Счет → Оплата → Автосплит (макс 1 час холда)

```
                                    ┌─> CANCELLED
                                    │
DRAFT ─> SIGNING ─> SIGNED ────────┼─> INVOICED ─> PAYMENT_PENDING
                                    │                     │
                                    │                     ├─> PAYMENT_FAILED
                                    │                     │
                                    │                     └─> PAID ─> HOLD_PERIOD ─> COMPLETED
                                    │                                      │
                                    │                                      v
                                    │                               DISPUTED (edge case)
                                    │                                      │
                                    │                                      v
                                    └──────────────────────────────> REFUNDED
```

**Ключевые отличия от escrow:**
- НЕТ статуса `WAITING_FOR_CONFIRM` — деньги сразу уходят
- НЕТ ручного release — автоматически после 1 часа холда
- `DISPUTED` — редкий кейс, оспаривание в течение холда

### 1.4. Интеграции

| Интеграция | БЫЛО | БУДЕТ |
|------------|------|-------|
| **Платежи** | Абстрактный provider (mock) | Т-Банк Номинальные счета |
| **Самозанятые** | Ручная проверка чеков | Т-Банк Self-Employed API |
| **Чеки НПД** | Загрузка вручную | Автополучение через API |
| **Выплаты** | Внутренний ledger | Банковский API payments |

---

## 2. Изменения в БД

### 2.1. Таблицы: сохраняются без изменений

| Таблица | Причина |
|---------|---------|
| `users` | Shared с agent.housler.ru |
| `organizations` | Структура подходит |
| `organization_members` | Структура подходит |
| `contract_templates` | Структура подходит |
| `documents` | Структура подходит |
| `signatures` | Структура подходит |
| `signing_tokens` | Структура подходит |
| `audit_logs` | Структура подходит |

### 2.2. Таблицы: требуют изменений

#### `lk_deals` - добавить поля

```sql
-- Новые поля для интеграции с банком
ALTER TABLE lk_deals ADD COLUMN payment_model VARCHAR(20) DEFAULT 'BANK_HOLD_SPLIT';
-- 'MOR' для legacy, 'BANK_HOLD_SPLIT' для новых

ALTER TABLE lk_deals ADD COLUMN external_provider VARCHAR(50) DEFAULT 'tbank';
ALTER TABLE lk_deals ADD COLUMN external_deal_id VARCHAR(255);
ALTER TABLE lk_deals ADD COLUMN external_account_number VARCHAR(22);

ALTER TABLE lk_deals ADD COLUMN payment_link_url VARCHAR(500);
ALTER TABLE lk_deals ADD COLUMN payment_qr_payload TEXT;

ALTER TABLE lk_deals ADD COLUMN expires_at TIMESTAMP;
ALTER TABLE lk_deals ADD COLUMN confirm_sla_at TIMESTAMP;

ALTER TABLE lk_deals ADD COLUMN payer_email VARCHAR(255);
ALTER TABLE lk_deals ADD COLUMN description TEXT;

-- Индекс для поиска по external_deal_id
CREATE INDEX idx_lk_deals_external_deal_id ON lk_deals(external_deal_id);
```

#### `payment_intents` - добавить поля банка

```sql
ALTER TABLE payment_intents ADD COLUMN external_payment_id VARCHAR(255);
ALTER TABLE payment_intents ADD COLUMN bank_status VARCHAR(50);
ALTER TABLE payment_intents ADD COLUMN bank_status_updated_at TIMESTAMP;
```

### 2.3. Новые таблицы

#### `deal_split_recipients` - участники сплита

```sql
CREATE TABLE deal_split_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    deal_id UUID NOT NULL REFERENCES lk_deals(id),

    -- Роль в сплите
    role VARCHAR(30) NOT NULL, -- 'agent', 'agency', 'lead', 'platform_fee'

    -- Тип получателя
    legal_type VARCHAR(20) NOT NULL, -- 'IP', 'OOO', 'SE' (self-employed)

    -- Реквизиты
    inn VARCHAR(12) NOT NULL,
    kpp VARCHAR(9),

    -- Связь с внутренними сущностями
    user_id INTEGER REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),

    -- Банковские реквизиты
    payout_account_id UUID REFERENCES payout_accounts(id),

    -- ID в системе банка
    external_beneficiary_id VARCHAR(255),
    external_recipient_id VARCHAR(255), -- для самозанятых

    -- Сумма/доля
    split_type VARCHAR(10) NOT NULL DEFAULT 'percent', -- 'percent' или 'fixed'
    split_value NUMERIC(15, 2) NOT NULL, -- процент (0-100) или фикс сумма
    calculated_amount NUMERIC(15, 2), -- рассчитанная сумма после оплаты

    -- Статус выплаты
    payout_status VARCHAR(30) DEFAULT 'pending',
    -- 'pending', 'bank_hold', 'released', 'paid_out', 'failed'

    paid_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_split_recipients_deal_id ON deal_split_recipients(deal_id);
CREATE INDEX idx_deal_split_recipients_user_id ON deal_split_recipients(user_id);
CREATE INDEX idx_deal_split_recipients_inn ON deal_split_recipients(inn);
```

#### `split_rule_templates` - шаблоны правил сплита

```sql
CREATE TABLE split_rule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID REFERENCES organizations(id), -- NULL = системный

    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,

    -- Применимость
    applies_to_deal_types JSONB, -- ["secondary_buy", "newbuild_booking"]

    -- Правила распределения
    rules JSONB NOT NULL,
    -- Пример:
    -- {
    --   "recipients": [
    --     {"role": "agent", "type": "percent", "value": 60},
    --     {"role": "agency", "type": "percent", "value": 35},
    --     {"role": "platform_fee", "type": "percent", "value": 5}
    --   ],
    --   "min_platform_fee": 500,
    --   "rounding": "floor"
    -- }

    -- Версионирование
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,

    -- Аудит
    created_by_user_id INTEGER REFERENCES users(id),
    approved_by_user_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_split_rules_org_code ON split_rule_templates(organization_id, code)
    WHERE is_active = true;
```

#### `bank_events` - события от банка (immutable log)

```sql
CREATE TABLE bank_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    deal_id UUID REFERENCES lk_deals(id),
    payment_intent_id UUID REFERENCES payment_intents(id),

    -- Идентификаторы банка
    provider VARCHAR(50) NOT NULL DEFAULT 'tbank',
    external_event_id VARCHAR(255),

    -- Тип события
    event_type VARCHAR(50) NOT NULL,
    -- 'deal.created', 'deal.accepted', 'deal.cancelled',
    -- 'payment.pending', 'payment.completed', 'payment.failed',
    -- 'payout.initiated', 'payout.completed', 'payout.failed',
    -- 'receipt.ready', 'receipt.cancelled'

    -- Payload от банка (as-is)
    payload JSONB NOT NULL,

    -- Валидация
    signature_valid BOOLEAN,

    -- Обработка
    processed_at TIMESTAMP,
    processing_error TEXT,

    received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_events_deal_id ON bank_events(deal_id);
CREATE INDEX idx_bank_events_event_type ON bank_events(event_type);
CREATE INDEX idx_bank_events_external_event_id ON bank_events(external_event_id);
```

#### `self_employed_registry` - реестр самозанятых

```sql
CREATE TABLE self_employed_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Привязка к агентству
    organization_id UUID REFERENCES organizations(id),

    -- Пользователь
    user_id INTEGER REFERENCES users(id) NOT NULL,

    -- Данные самозанятого
    inn VARCHAR(12) NOT NULL,
    full_name VARCHAR(255) NOT NULL,

    -- Статус в банке
    external_recipient_id VARCHAR(255),
    bank_status VARCHAR(30) DEFAULT 'DRAFT',
    -- 'DRAFT' - создан, ждет подтверждения в ЛК банка
    -- 'ACTIVE' - подтвержден, можно делать выплаты
    -- 'BLOCKED' - заблокирован
    -- 'INACTIVE' - деактивирован

    -- Проверка статуса НПД
    npd_status VARCHAR(30),
    npd_checked_at TIMESTAMP,

    -- Риски
    receipt_cancel_count INTEGER DEFAULT 0,
    last_receipt_cancel_at TIMESTAMP,
    risk_flag BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_se_registry_org_user ON self_employed_registry(organization_id, user_id);
CREATE INDEX idx_se_registry_inn ON self_employed_registry(inn);
CREATE INDEX idx_se_registry_bank_status ON self_employed_registry(bank_status);
```

#### `evidence_files` - доказательная база

```sql
CREATE TABLE evidence_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    deal_id UUID NOT NULL REFERENCES lk_deals(id),

    -- Тип файла
    kind VARCHAR(30) NOT NULL,
    -- 'contract', 'act', 'registration_certificate',
    -- 'screenshot', 'correspondence', 'other'

    -- Файл
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),

    -- Верификация
    file_hash VARCHAR(64) NOT NULL, -- SHA-256

    -- Кто загрузил
    uploaded_by_user_id INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW(),

    -- Метаданные загрузки (для аудита)
    upload_ip VARCHAR(45),
    upload_user_agent TEXT,

    -- Статус
    status VARCHAR(20) DEFAULT 'active',
    -- 'active', 'replaced', 'deleted'

    notes TEXT
);

CREATE INDEX idx_evidence_files_deal_id ON evidence_files(deal_id);
CREATE INDEX idx_evidence_files_kind ON evidence_files(kind);
```

#### `deal_milestones` - этапы сделки (для частичной оплаты)

```sql
CREATE TABLE deal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    deal_id UUID NOT NULL REFERENCES lk_deals(id),

    step_no INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Сумма этапа
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',

    -- Условие разблокировки
    trigger_type VARCHAR(30) NOT NULL,
    -- 'immediate', 'date', 'document_signed', 'manual_confirm'
    trigger_config JSONB,
    -- {"date": "2026-02-01"} или {"document_type": "act"} или {}

    -- ID в банке (если создан step)
    external_step_id VARCHAR(255),

    -- Статусы
    status VARCHAR(30) DEFAULT 'pending',
    -- 'pending', 'ready_to_pay', 'paid', 'confirmed', 'released', 'cancelled'

    -- Оплата
    payment_link_url VARCHAR(500),
    paid_at TIMESTAMP,

    -- Подтверждение
    confirmed_by_user_id INTEGER REFERENCES users(id),
    confirmed_at TIMESTAMP,

    -- Release
    released_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(deal_id, step_no)
);

CREATE INDEX idx_deal_milestones_deal_id ON deal_milestones(deal_id);
CREATE INDEX idx_deal_milestones_status ON deal_milestones(status);
```

---

## 3. Маппинг статусов (миграция данных)

### 3.1. Сделки

| Старый статус (MoR) | Новый статус | Действие |
|---------------------|--------------|----------|
| `draft` | `draft` | Добавить `payment_model='MOR'` |
| `awaiting_signatures` | `draft` | Документы ждут подписи |
| `signed` | `ready_to_pay` | Можно оплачивать |
| `payment_pending` | `waiting_for_confirm` | Уже оплачено, ждем release |
| `in_progress` | `waiting_for_confirm` | В работе |
| `closed` | `released_paid_out` | Завершено |
| `dispute` | `confirm_blocked` | Спор |
| `cancelled` | `cancelled_before_pay` / `cancelled_refunded` | По контексту |

### 3.2. Платежи

| Старый статус | Новый статус | Комментарий |
|---------------|--------------|-------------|
| `created` | `created` | Без изменений |
| `pending` | `pending` | Без изменений |
| `paid` | `paid` + `bank_status='completed'` | Добавить bank_status |
| `failed` | `failed` | Без изменений |
| `expired` | `expired` | Без изменений |

### 3.3. Скрипт миграции

```sql
-- 1. Добавить payment_model для существующих сделок
UPDATE lk_deals
SET payment_model = 'MOR'
WHERE payment_model IS NULL;

-- 2. Маппинг статусов (для legacy сделок оставляем как есть)
-- Новые сделки будут создаваться с новыми статусами

-- 3. Создать записи split_recipients из существующих deal_terms.split_rule
-- Это делается в коде при первом обращении к legacy сделке
```

---

## 4. API Т-Банка (Номинальные счета)

### 4.1. Endpoints

| Операция | Method | Endpoint |
|----------|--------|----------|
| Создать сделку | POST | `/api/v1/nominal-accounts/deals` |
| Подтвердить сделку | POST | `/api/v1/nominal-accounts/deals/{dealId}/accept` |
| Создать этап | POST | `/api/v1/nominal-accounts/deals/{dealId}/steps` |
| Отменить сделку | POST | `/api/v1/nominal-accounts/deals/{dealId}/cancel` |
| Выплата бенефициару | POST | `/api/v1/nominal-accounts/payments` |
| Список самозанятых | POST | `/api/v1/self-employed/recipients/list` |
| Добавить СЗ | POST | `/api/v1/self-employed/recipients` |
| Получить чеки | POST | `/api/v1/self-employed/receipts` |

### 4.2. Авторизация

```
Authorization: Bearer {API_TOKEN}
```
или mTLS сертификат

### 4.3. Статусы сделки в банке

| Статус банка | Описание | Маппинг в Housler |
|--------------|----------|-------------------|
| `DRAFT` | Черновик | `draft` |
| `ACCEPTED` | Подтверждена | `ready_to_pay` |
| `FUNDED` | Оплачена | `paid_to_bank` |
| `COMPLETED` | Завершена | `released_paid_out` |
| `CANCELLED` | Отменена | `cancelled_*` |

### 4.4. Статусы самозанятого

| Статус | Описание | Можно платить? |
|--------|----------|----------------|
| `DRAFT` | Заявка создана | Нет |
| `ACTIVE` | Подтвержден в ЛК банка | Да |
| `BLOCKED` | Заблокирован | Нет |
| `INACTIVE` | Деактивирован | Нет |

### 4.5. Rate Limits

| Endpoint | Лимит |
|----------|-------|
| Большинство | 10 req/sec |
| Список СЗ | 1 req/10 min |

---

## 5. Изменения в коде

### 5.1. Новые сервисы

| Сервис | Ответственность |
|--------|-----------------|
| `TBankDealService` | Создание/управление сделками в банке |
| `TBankPaymentService` | Инициация платежей, выплаты |
| `TBankSelfEmployedService` | Работа с реестром СЗ |
| `TBankWebhookHandler` | Обработка событий от банка |
| `SplitCalculator` | Расчет сумм по правилам сплита |
| `ReconciliationJob` | Сверка статусов с банком |

### 5.2. Изменения в существующих

| Модуль | Изменения |
|--------|-----------|
| `DealService` | Добавить ветку для `BANK_HOLD_SPLIT` |
| `PaymentService` | Интеграция с TBankPaymentService |
| `DocumentService` | Без изменений |
| `NotificationService` | Новые типы уведомлений |

### 5.3. Новые эндпоинты API

```
POST   /api/v1/deals/{id}/create-bank-deal     # Создать сделку в банке
POST   /api/v1/deals/{id}/accept               # Подтвердить условия
GET    /api/v1/deals/{id}/payment-link         # Получить ссылку на оплату
POST   /api/v1/deals/{id}/confirm-delivery     # Подтвердить оказание услуги
POST   /api/v1/deals/{id}/milestones           # Добавить этап
POST   /api/v1/deals/{id}/milestones/{n}/pay   # Ссылка на оплату этапа

POST   /api/v1/webhooks/tbank                  # Вебхук от банка

GET    /api/v1/self-employed                   # Список СЗ агентства
POST   /api/v1/self-employed                   # Добавить СЗ
GET    /api/v1/self-employed/{id}/status       # Проверить статус
```

---

## 6. Миграция данных (план)

### 6.1. Фаза 0: Подготовка

1. Добавить новые колонки в существующие таблицы
2. Создать новые таблицы
3. Задеплоить код с поддержкой обеих моделей
4. Все новые сделки помечать `payment_model='MOR'` (пока)

### 6.2. Фаза 1: Параллельный контур

1. Включить `BANK_HOLD_SPLIT` для тестового агентства
2. Проверить полный цикл сделки
3. Мониторинг ошибок

### 6.3. Фаза 2: Cutover

1. Новые сделки только `BANK_HOLD_SPLIT`
2. Legacy сделки живут до закрытия
3. UI показывает модель сделки

### 6.4. Фаза 3: Deprecate MoR

1. Запретить создание MoR сделок
2. Архивировать MoR код
3. Удалить MoR из UI (кроме истории)

---

## 7. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| API банка недоступен | Средняя | Высокое | Circuit breaker, retry, fallback UI |
| Рассинхрон статусов | Высокая | Среднее | Reconciliation job каждые 5 мин |
| СЗ не подтвержден в банке | Высокая | Среднее | UI-предупреждение, блокировка выплаты |
| Аннулирование чека СЗ | Низкая | Высокое | Событие риска, блокировка после N раз |
| Chargeback | Низкая | Высокое | Evidence pack, dispute flow |

---

## 8. Чеклист готовности

### Бизнес-решения (BLOCKER)

- [ ] Модель монетизации (inside/on-top/revshare)
- [ ] Договор с Т-Банком подписан
- [ ] API credentials получены
- [ ] White-label условия согласованы
- [ ] SLA подтверждения услуги определен
- [ ] Политика корректировок после оплаты

### Разработка

- [ ] Миграции БД созданы
- [ ] TBank* сервисы реализованы
- [ ] Webhook handler реализован
- [ ] Reconciliation job реализован
- [ ] Новые API endpoints
- [ ] UI для новой модели
- [ ] Тесты (unit + integration)

### Инфраструктура

- [ ] Секреты в vault (API token, mTLS cert)
- [ ] Webhook endpoint доступен извне
- [ ] Мониторинг/алерты настроены
- [ ] Логирование bank_events

---

*Документ создан: 2026-01-16*
