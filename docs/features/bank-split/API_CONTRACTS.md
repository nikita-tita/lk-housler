# API Contracts: Bank Split (Bank-Led Model)

**Версия:** 2.0
**Дата:** 2026-01-19
**Base URL:** `/api/v1/bank-split`

---

## Содержание

1. [Аутентификация](#аутентификация)
2. [Idempotency](#idempotency)
3. [Deal Endpoints](#deal-endpoints)
4. [Status Transitions](#status-transitions)
5. [Invoice & Payment](#invoice--payment)
6. [Milestones](#milestones)
7. [Onboarding](#onboarding)
8. [Receipts & Fiscalization](#receipts--fiscalization)
9. [INN Validation](#inn-validation)
10. [Webhooks](#webhooks)
11. [Contract Endpoints](#contract-endpoints)
12. [Schemas](#schemas)
13. [Error Codes](#error-codes)

---

## Аутентификация

Все endpoints (кроме webhook) требуют JWT токен:

```
Authorization: Bearer <token>
```

---

## Idempotency

Для защиты от дублирования операций используйте заголовок `X-Idempotency-Key`:

```
X-Idempotency-Key: <unique-uuid>
```

### Требования:

| Endpoint | Idempotency Key |
|----------|-----------------|
| `POST /bank-split` | **Обязательно** |
| `POST /{id}/create-invoice` | **Обязательно** |
| `POST /{id}/release` | **Обязательно** |
| `POST /onboarding/start` | **Обязательно** |
| `POST /{id}/milestones/{mid}/release` | **Обязательно** |
| `POST /{id}/consent` | Рекомендуется |
| `POST /{id}/confirm-completion` | Рекомендуется |
| `POST /{id}/adjust-split` | Рекомендуется |
| `POST /{id}/contracts/generate` | Рекомендуется |

### Правила:
- Формат: UUID v4
- TTL: 24 часа (повторные запросы с тем же ключом вернут cached response)
- Ключ должен быть уникальным для каждой логической операции
- При смене параметров запроса используйте новый ключ

### Поведение:

| Сценарий | HTTP Response | Результат |
|----------|---------------|-----------|
| Первый запрос | 2xx | Операция выполнена |
| Повторный запрос (тот же ключ) | 2xx | Cached response (операция НЕ повторяется) |
| Отсутствует ключ (обязательный endpoint) | 400 Bad Request | Ошибка валидации |
| Истекший ключ (>24h) | 2xx | Операция выполнена как новая |

### Пример:
```bash
curl -X POST /api/v1/bank-split \
  -H "Authorization: Bearer <token>" \
  -H "X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"type": "sale_buy", ...}'
```

### Генерация ключа (frontend):
```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
const response = await fetch('/api/v1/bank-split', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify(dealData),
});
```

---

## Deal Endpoints

### POST /bank-split

Создание новой сделки с bank-led моделью.

**Request:**
```json
{
  "type": "sale_buy | sale_sell | rent_tenant | rent_landlord",
  "property_type": "apartment | room | house | townhouse | land | commercial | parking",
  "property_address": "string (required)",
  "price": "decimal (required, > 0)",

  "payment_type": "percent | fixed | mixed",
  "commission_percent": "decimal (optional, for percent/mixed)",
  "commission_fixed": "decimal (optional, for fixed/mixed)",

  "advance_type": "none | advance_fixed | advance_percent",
  "advance_amount": "decimal (optional, for advance_fixed)",
  "advance_percent": "decimal (optional, for advance_percent)",

  "is_exclusive": "boolean (optional, default: false)",
  "exclusive_until": "datetime (optional, for exclusive)",

  "description": "string (optional, max 500)",
  "client_name": "string (required)",
  "client_phone": "string (required, pattern: ^\\+?[0-9]{10,15}$)",
  "client_email": "string (optional, email format)",
  "organization_id": "uuid (optional)",

  "agent_split_percent": "integer (optional, 0-100)",
  "hold_duration_hours": "integer (optional, default: 72)",
  "auto_release_days": "integer (optional, default: 7)"
}
```

**Response: 201 Created**
```json
{
  "id": "uuid",
  "type": "sale_buy",
  "property_type": "apartment",
  "status": "draft",
  "bank_status": "not_created",
  "payment_model": "bank_hold_split",
  "property_address": "Moscow, Tverskaya 1",
  "price": "15000000.00",
  "payment_type": "percent",
  "commission_percent": "3.00",
  "commission_agent": "450000.00",
  "advance_type": "none",
  "is_exclusive": false,
  "hold_duration_hours": 72,
  "auto_release_days": 7,
  "client_name": "Test Client",
  "client_phone": "+79991234567",
  "payer_email": "client@example.com",
  "external_provider": null,
  "external_deal_id": null,
  "payment_link_url": null,
  "payment_qr_payload": null,
  "expires_at": null,
  "hold_expires_at": null,
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:00:00Z",
  "recipients": [
    {
      "id": "uuid",
      "deal_id": "uuid",
      "role": "agent",
      "split_type": "percent",
      "split_value": "70.0000",
      "user_id": 1,
      "organization_id": null,
      "calculated_amount": "315000.00",
      "payout_status": "pending",
      "paid_at": null,
      "created_at": "2026-01-17T12:00:00Z"
    }
  ]
}
```

**Errors:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `409 Conflict` - Idempotency key already used
- `422 Unprocessable Entity` - Validation error

---

### GET /bank-split/{deal_id}

Получение информации о сделке.

**Path Parameters:**
- `deal_id` (uuid, required) - ID сделки

**Response: 200 OK**
```json
{
  "id": "uuid",
  "type": "sale_buy",
  "status": "invoiced",
  "bank_status": "created",
  "payment_model": "bank_hold_split",
  "property_address": "Moscow, Tverskaya 1",
  "price": "15000000.00",
  "commission_agent": "450000.00",
  "hold_duration_hours": 72,
  "auto_release_days": 7,
  "hold_started_at": null,
  "auto_release_at": null,
  "dispute_locked": false,
  "client_name": "Test Client",
  "client_phone": "+79991234567",
  "payer_email": "client@example.com",
  "external_provider": "tbank",
  "external_deal_id": "TBANK-12345",
  "payment_link_url": "https://securepay.tinkoff.ru/...",
  "payment_qr_payload": "data:image/png;base64,...",
  "expires_at": "2026-01-18T12:00:00Z",
  "hold_expires_at": null,
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:30:00Z",
  "recipients": [...],
  "milestones": [...]
}
```

**Errors:**
- `403 Forbidden` - Access denied (not deal creator or agent)
- `404 Not Found` - Deal not found

---

### POST /deals/calculate

Предварительный расчёт комиссии для сделки.

**Request:**
```json
{
  "price": 15000000,
  "payment_type": "percent",
  "commission_percent": 3.0,
  "commission_fixed": null,
  "advance_type": "advance_percent",
  "advance_percent": 30,
  "advance_amount": null,
  "agent_split_percent": 60
}
```

**Response: 200 OK**
```json
{
  "price": 15000000.00,
  "commission_total": 450000.00,
  "platform_fee": 18000.00,
  "platform_fee_percent": 4.0,
  "net_commission": 432000.00,
  "agent_amount": 259200.00,
  "agency_amount": 172800.00,
  "advance_amount": 135000.00,
  "remainder_amount": 315000.00,
  "payment_plan": [
    {
      "step": 1,
      "name": "Аванс",
      "amount": 135000.00,
      "trigger": "immediate"
    },
    {
      "step": 2,
      "name": "Остаток",
      "amount": 315000.00,
      "trigger": "confirmation"
    }
  ]
}
```

---

## Status Transitions

### POST /bank-split/{deal_id}/submit-for-signing

Отправить сделку на подписание клиенту.

**Precondition:** `status == "draft"`

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "old_status": "draft",
  "new_status": "awaiting_signatures",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid status transition
- `403 Forbidden` - Only deal creator can submit

---

### POST /bank-split/{deal_id}/mark-signed

Отметить сделку как подписанную (все подписи собраны).

**Precondition:** `status == "awaiting_signatures"`

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "old_status": "awaiting_signatures",
  "new_status": "signed",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

---

### POST /bank-split/{deal_id}/cancel

Отменить сделку.

**Request (optional):**
```json
{
  "reason": "string (optional, max 500)"
}
```

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "old_status": "signed",
  "new_status": "cancelled",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Cannot cancel deal in current status
- `403 Forbidden` - Only deal creator can cancel
- `423 Locked` - Deal has active dispute (dispute_locked = true)

---

### POST /bank-split/{deal_id}/release

Досрочно освободить средства из холда.

**Precondition:** `status == "hold_period"`, `dispute_locked == false`

**Headers:**
```
X-Idempotency-Key: <uuid>  (required)
```

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "old_status": "hold_period",
  "new_status": "payout_ready",
  "bank_status": "released",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

**Errors:**
- `423 Locked` - Deal is dispute locked

---

## Invoice & Payment

### POST /bank-split/{deal_id}/create-invoice

Создать счет в T-Bank и получить ссылку на оплату.

**Precondition:** `status == "signed"`, recipient has approved onboarding

**Headers:**
```
X-Idempotency-Key: <uuid>  (required)
```

**Request (optional):**
```json
{
  "return_url": "https://lk.housler.ru/deals/{id}/success"
}
```

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "external_deal_id": "TBANK-12345",
  "payment_url": "https://securepay.tinkoff.ru/...",
  "qr_code": "data:image/png;base64,...",
  "expires_at": "2026-01-18T12:00:00Z",
  "bank_status": "created"
}
```

**Errors:**
- `400 Bad Request` - Deal not in correct status
- `412 Precondition Failed` - Recipient onboarding not complete
- `500 Internal Server Error` - T-Bank API error

---

### POST /bank-split/{deal_id}/regenerate-payment-link

Перегенерировать ссылку на оплату (если истекла).

**Precondition:** `external_deal_id` exists

**Response: 200 OK**
```json
{
  "payment_url": "https://securepay.tinkoff.ru/...",
  "expires_at": "2026-01-19T12:00:00Z"
}
```

---

### POST /bank-split/{deal_id}/send-payment-link

Отправить ссылку на оплату клиенту по SMS.

**Response: 200 OK**
```json
{
  "sent": true,
  "phone": "+79991234567",
  "message_id": "sms_123456"
}
```

---

## Milestones

### GET /bank-split/{deal_id}/milestones

Получить список этапов оплаты для сделки.

**Response: 200 OK**
```json
{
  "total_amount": 450000.00,
  "released_amount": 135000.00,
  "pending_amount": 315000.00,
  "milestones_count": 2,
  "released_count": 1,
  "milestones": [
    {
      "id": "uuid",
      "step_no": 1,
      "name": "Аванс",
      "amount": 135000.00,
      "percent": 30.00,
      "status": "released",
      "release_trigger": "immediate",
      "release_scheduled_at": "2026-01-17T13:00:00Z",
      "released_at": "2026-01-17T13:05:00Z",
      "paid_at": "2026-01-17T12:00:00Z"
    },
    {
      "id": "uuid",
      "step_no": 2,
      "name": "Остаток",
      "amount": 315000.00,
      "percent": 70.00,
      "status": "paid",
      "release_trigger": "confirmation",
      "release_scheduled_at": null,
      "released_at": null,
      "paid_at": "2026-01-17T12:00:00Z"
    }
  ]
}
```

---

### POST /bank-split/{deal_id}/milestones/{milestone_id}/confirm

Подтвердить выполнение услуги для этапа (CONFIRMATION trigger).

**Precondition:** `milestone.status == "paid"`, `milestone.release_trigger == "confirmation"`

**Response: 200 OK**
```json
{
  "milestone_id": "uuid",
  "old_status": "paid",
  "new_status": "hold",
  "confirmed_at": "2026-01-17T14:00:00Z",
  "release_scheduled_at": "2026-01-17T14:00:00Z"
}
```

---

### POST /bank-split/{deal_id}/milestones/{milestone_id}/release

Досрочный release этапа (для admin или по таймеру).

**Response: 200 OK**
```json
{
  "milestone_id": "uuid",
  "old_status": "hold",
  "new_status": "released",
  "released_at": "2026-01-17T15:00:00Z",
  "released_amount": 315000.00
}
```

---

## Onboarding

### POST /bank-split/onboarding/start

Начать процесс онбординга в T-Bank.

**Request:**
```json
{
  "legal_type": "se | ip | ooo",
  "legal_name": "ИП Иванов И.И.",
  "inn": "123456789012",
  "kpp": "123456789 (only for ooo)",
  "ogrn": "1234567890123 (optional)",
  "bank_account": "40817810000000000001",
  "bank_bik": "044525225",
  "bank_name": "Т-Банк",
  "bank_corr_account": "30101810145250000225",
  "phone": "+79991234567",
  "email": "agent@example.com (optional)"
}
```

**Response: 201 Created**
```json
{
  "profile_id": "uuid",
  "session_id": "onb_session_123",
  "onboarding_url": "https://tbank.ru/onboarding/...",
  "status": "documents_required",
  "documents_required": [
    {"type": "passport", "description": "Скан паспорта"},
    {"type": "inn_certificate", "description": "Свидетельство ИНН"}
  ]
}
```

---

### GET /bank-split/onboarding/{profile_id}/status

Проверить статус онбординга.

**Response: 200 OK**
```json
{
  "profile_id": "uuid",
  "profile_status": "pending_review",
  "session_status": {
    "status": "documents_submitted",
    "documents_received": ["passport", "inn_certificate"],
    "documents_pending": []
  },
  "is_complete": false,
  "merchant_id": null
}
```

---

### POST /bank-split/onboarding/{profile_id}/documents

Загрузить документы для онбординга.

**Request:** `multipart/form-data`
- `document_type`: string (passport, inn_certificate, etc.)
- `file`: binary

**Response: 200 OK**
```json
{
  "document_id": "doc_123",
  "document_type": "passport",
  "status": "uploaded",
  "uploaded_at": "2026-01-17T12:00:00Z"
}
```

---

### POST /bank-split/onboarding/{profile_id}/complete

Завершить онбординг и получить merchant credentials.

**Precondition:** `onboarding_status == "approved"`

**Response: 200 OK**
```json
{
  "profile_id": "uuid",
  "merchant_id": "merchant_123",
  "is_active": true,
  "activated_at": "2026-01-17T15:00:00Z"
}
```

---

## Receipts & Fiscalization

### GET /bank-split/{deal_id}/receipts

Получить список фискальных чеков для сделки.

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "income",
      "amount": 450000,
      "status": "created",
      "fiscalization_method": "tbank_checks",
      "external_id": "tbank_receipt_123",
      "receipt_url": "https://receipts.tbank.ru/...",
      "fiscal_data": {
        "fiscal_number": "FN123",
        "fiscal_sign": "FS456",
        "fiscal_document": "FD789"
      },
      "confirmed_at": "2026-01-17T12:00:00Z"
    }
  ],
  "total": 1
}
```

---

### POST /bank-split/{deal_id}/receipts/{receipt_id}/upload-npd

Загрузить NPD чек от самозанятого.

**Request:**
```json
{
  "npd_receipt_number": "1234567890",
  "source": "my_nalog_app"
}
```

**Response: 200 OK**
```json
{
  "receipt_id": "uuid",
  "status": "uploaded",
  "npd_receipt_number": "1234567890",
  "npd_uploaded_at": "2026-01-17T12:00:00Z"
}
```

---

## INN Validation

### POST /bank-split/validate-inn

Валидация ИНН получателя.

**Request:**
```json
{
  "inn": "123456789012",
  "role": "agent | agency",
  "validation_level": "checksum_only | basic | full"
}
```

**Response: 200 OK**
```json
{
  "valid": true,
  "inn": "123456789012",
  "validation_level": "full",
  "checks": {
    "checksum_valid": true,
    "format_valid": true,
    "blacklist_check": "passed",
    "npd_status": "active"
  },
  "npd_details": {
    "is_registered": true,
    "registration_date": "2024-01-15",
    "last_checked": "2026-01-17T12:00:00Z"
  }
}
```

**Validation Levels:**
| Level | Checks |
|-------|--------|
| `checksum_only` | Контрольная сумма ИНН |
| `basic` | + проверка по blacklist |
| `full` | + проверка NPD статуса через ФНС |

---

## Webhooks

### POST /bank-split/webhooks/tbank

Обработка вебхуков от T-Bank.

**Note:** Этот endpoint не требует JWT авторизации, но проверяет HMAC-SHA256 подпись.

**Request Headers:**
```
Content-Type: application/json
X-TBank-Signature: <hmac-sha256-signature>
```

**Request Body (T-Bank format):**
```json
{
  "eventId": "evt_123456",
  "eventType": "payment.completed",
  "timestamp": "2026-01-17T12:00:00Z",
  "data": {
    "orderId": "deal_uuid",
    "dealId": "tbank_deal_id",
    "paymentId": "payment_id",
    "amount": 45000000,
    "status": "CONFIRMED",
    "success": true
  }
}
```

**Response: 200 OK**
```json
{
  "success": true
}
```

### Webhook Events

| Event Type | Описание | Действие в Housler |
|------------|----------|-------------------|
| `payment.pending` | Платёж инициирован | Deal → `payment_pending` |
| `payment.completed` | Платёж получен | Deal → `hold_period`, start hold timer |
| `payment.failed` | Платёж отклонён | Deal → `payment_failed`, notify |
| `deal.hold_started` | Холд начался | Update `hold_started_at` |
| `deal.released` | Средства освобождены | Deal → `payout_ready` |
| `payout.completed` | Выплата выполнена | Update recipient `payout_status` |
| `payout.failed` | Выплата не удалась | Alert, manual intervention |
| `receipt.created` | Чек создан | Create `FiscalReceipt` record |
| `onboarding.approved` | Онбординг одобрен | Profile → `approved` |
| `onboarding.rejected` | Онбординг отклонён | Profile → `rejected` |

### Webhook Retry Policy

- Первая попытка: немедленно
- Retry 1: через 1 минуту
- Retry 2: через 5 минут
- Retry 3: через 15 минут
- Retry 4: через 1 час
- После 5 неудачных попыток: запись в DLQ (Dead Letter Queue)

---

## Contract Endpoints

### POST /{deal_id}/contracts/generate

Генерация нового договора для сделки.

**Query Parameters:**
- `contract_type` (string, optional): Тип договора
  - `bank_split_agent_agreement` (default) — Договор с агентом
  - `bank_split_client_agreement` — Договор с клиентом
  - `bank_split_agency_agreement` — Договор с агентством

**Response: 201 Created**
```json
{
  "id": "uuid",
  "contract_number": "BSA-2026-000001",
  "contract_type": "bank_split_agent_agreement",
  "status": "pending_signature",
  "generated_at": "2026-01-18T12:00:00Z",
  "expires_at": "2026-01-25T12:00:00Z",
  "required_signers": [
    {"user_id": 1, "role": "agent", "signed_at": null},
    {"user_id": 2, "role": "client", "signed_at": null}
  ]
}
```

---

### GET /{deal_id}/contracts

Список всех договоров для сделки.

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "uuid",
      "contract_number": "BSA-2026-000001",
      "contract_type": "bank_split_agent_agreement",
      "status": "pending_signature",
      "generated_at": "2026-01-18T12:00:00Z",
      "signed_at": null,
      "expires_at": "2026-01-25T12:00:00Z",
      "required_signers": [
        {"user_id": 1, "role": "agent", "signed_at": null}
      ]
    }
  ],
  "total": 1
}
```

---

### GET /contracts/{contract_id}

Получение детальной информации о договоре.

**Response: 200 OK**
```json
{
  "id": "uuid",
  "contract_number": "BSA-2026-000001",
  "contract_type": "bank_split_agent_agreement",
  "status": "pending_signature",
  "html_content": "<html>...</html>",
  "document_hash": "sha256:abc123...",
  "contract_data": {"agent_name": "...", "client_name": "..."},
  "commission_amount": 450000.00,
  "generated_at": "2026-01-18T12:00:00Z",
  "signed_at": null,
  "expires_at": "2026-01-25T12:00:00Z",
  "required_signers": [...]
}
```

---

### POST /contracts/{contract_id}/sign

Подписание договора текущим пользователем (ПЭП).

**Response: 200 OK**
```json
{
  "message": "Contract signed successfully",
  "signed_at": "2026-01-18T14:30:00Z",
  "contract_status": "fully_signed",
  "all_signed": true
}
```

**Possible Contract Statuses:**
- `draft` — Черновик
- `pending_signature` — Ожидает подписи
- `partially_signed` — Частично подписан
- `fully_signed` — Полностью подписан
- `cancelled` — Отменён
- `expired` — Истёк срок подписания

---

## Schemas

### Deal Status Flow (Bank-Led Model)

```
                                        ┌──────────────┐
                                        │   CANCELLED  │
                                        └──────────────┘
                                              ^
                                              │ cancel()
                                              │
┌──────────┐  create()  ┌──────────┐  submit()  ┌──────────┐
│  DRAFT   │ ─────────> │  DRAFT   │ ─────────> │ AWAITING │
└──────────┘            └──────────┘            │SIGNATURES│
                                                └──────────┘
                                                     │
                                                     │ mark_signed()
                                                     v
                                                ┌──────────┐
                                                │  SIGNED  │
                                                └──────────┘
                                                     │
                                                     │ create_invoice()
                                                     v
                                                ┌──────────┐
                                                │ INVOICED │
                                                └──────────┘
                                                     │
                                                     │ webhook: payment.pending
                                                     v
                                                ┌──────────┐
                 webhook: payment.failed        │ PAYMENT  │
                ┌───────────────────────────────│ PENDING  │
                │                               └──────────┘
                v                                    │
           ┌──────────┐                              │ webhook: payment.completed
           │ PAYMENT  │                              v
           │  FAILED  │                         ┌──────────┐
           └──────────┘                         │   HOLD   │ <── dispute_locked
                │                               │  PERIOD  │     can be set here
                │ retry_payment()               └──────────┘
                └─────────────────────────────>      │
                                                     │ hold_expired() or release()
                                          dispute()  │
                                        ┌────────────┤
                                        v            v
                                   ┌──────────┐ ┌──────────┐
                                   │ DISPUTE  │ │  PAYOUT  │
                                   └──────────┘ │  READY   │
                                        │       └──────────┘
                                        │ resolve()  │
                                        v            │ payouts_processing
                                   ┌──────────┐      v
                                   │ REFUNDED │ ┌──────────┐
                                   └──────────┘ │  PAYOUT  │
                                                │IN_PROGRESS│
                                                └──────────┘
                                                     │
                                                     │ all_payouts_completed()
                                                     v
                                                ┌──────────┐
                                                │  CLOSED  │
                                                └──────────┘
```

### DealStatus Enum

| Status | Description |
|--------|-------------|
| `draft` | Черновик, можно редактировать |
| `awaiting_signatures` | Ожидает подписания |
| `signed` | Подписан, можно выставить счет |
| `invoiced` | Счет выставлен в банке |
| `payment_pending` | Ожидает оплаты |
| `hold_period` | Оплачен, период подтверждения |
| `payment_failed` | Ошибка оплаты |
| `payout_ready` | Готов к выплате |
| `payout_in_progress` | Выплаты в процессе |
| `closed` | Завершена, средства распределены |
| `cancelled` | Отменена |
| `dispute` | Оспаривается |
| `refunded` | Возврат средств выполнен |

### BankDealStatus Enum (T-Bank side)

| Status | Description |
|--------|-------------|
| `not_created` | Сделка не создана в банке |
| `created` | Сделка создана, ожидает оплаты |
| `payment_pending` | Платёж инициирован |
| `hold` | Средства на холде |
| `released` | Средства освобождены |
| `cancelled` | Сделка отменена в банке |
| `refunded` | Средства возвращены |

### PayoutStatus Enum

| Status | Description |
|--------|-------------|
| `pending` | Ожидает выплаты |
| `hold` | На холде |
| `released` | Освобождено к выплате |
| `failed` | Ошибка выплаты |

### RecipientRole Enum

| Role | Description |
|------|-------------|
| `agent` | Агент (физлицо или самозанятый) |
| `agency` | Агентство (юрлицо) |
| `lead` | Лид-провайдер |
| `platform_fee` | Комиссия платформы |

### MilestoneStatus Enum

| Status | Description |
|--------|-------------|
| `pending` | Ожидает оплаты |
| `ready_to_pay` | Готов к оплате |
| `payment_pending` | Платёж в процессе |
| `paid` | Оплачен |
| `hold` | На холде, ожидает release |
| `released` | Средства освобождены |
| `cancelled` | Отменён |

### ReleaseTrigger Enum

| Trigger | Description |
|---------|-------------|
| `immediate` | Освобождение сразу после минимального холда |
| `short_hold` | Освобождение через N часов |
| `confirmation` | Освобождение после подтверждения услуги |
| `date` | Освобождение в указанную дату |

### ConsentType Enum (Bank-Led Model)

| Type | Description |
|------|-------------|
| `platform_fee_deduction` | Согласие на удержание комиссии платформы |
| `data_processing` | Обработка персональных данных (152-ФЗ) |
| `terms_of_service` | Условия использования платформы |
| `split_agreement` | Согласие с распределением средств |
| `bank_payment_processing` | Согласие на обработку через T-Bank |
| `service_confirmation_required` | Согласие с требованием подтверждения услуги |
| `hold_period_acceptance` | Принятие периода удержания |

### OnboardingStatus Enum

| Status | Description |
|--------|-------------|
| `not_started` | Онбординг не начат |
| `documents_required` | Требуются документы |
| `pending_review` | На проверке |
| `approved` | Одобрен |
| `rejected` | Отклонён |

### FiscalReceiptStatus Enum

| Status | Description |
|--------|-------------|
| `pending` | Создан, ожидает отправки |
| `created` | Успешно создан в T-Bank |
| `failed` | Ошибка создания |
| `cancelled` | Отменён |
| `awaiting_upload` | NPD: ожидает загрузки |
| `uploaded` | NPD: чек загружен |
| `overdue` | NPD: просрочен |

---

## Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - invalid input or state |
| `401` | Unauthorized - missing or invalid token |
| `403` | Forbidden - access denied |
| `404` | Not Found - resource doesn't exist |
| `409` | Conflict - idempotency key already used |
| `412` | Precondition Failed - requirement not met |
| `422` | Unprocessable Entity - validation error |
| `423` | Locked - resource is locked (dispute) |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "detail": "Error description"
}
```

### Validation Error Format

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### Business Error Codes

| Code | Description |
|------|-------------|
| `DEAL_NOT_FOUND` | Сделка не найдена |
| `INVALID_STATUS_TRANSITION` | Недопустимый переход статуса |
| `DISPUTE_LOCKED` | Сделка заблокирована спором |
| `ONBOARDING_NOT_COMPLETE` | Онбординг получателя не завершён |
| `HOLD_PERIOD_NOT_EXPIRED` | Период холда не истёк |
| `RECIPIENT_NOT_REGISTERED` | Получатель не зарегистрирован в банке |
| `INN_VALIDATION_FAILED` | ИНН не прошёл валидацию |
| `MILESTONE_NOT_READY` | Этап не готов к операции |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| All endpoints | 100 req/min per user |
| Webhook | 1000 req/min (T-Bank IP only) |
| Onboarding | 10 req/min per user |
| INN validation | 30 req/min per user |

---

## Examples

### Полный flow создания и оплаты сделки

```bash
# 1. Создание сделки
curl -X POST /api/v1/bank-split \
  -H "Authorization: Bearer <token>" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{
    "type": "sale_buy",
    "property_type": "apartment",
    "property_address": "Moscow, Tverskaya 1",
    "price": "15000000",
    "payment_type": "percent",
    "commission_percent": "3",
    "advance_type": "advance_percent",
    "advance_percent": "30",
    "client_name": "Ivan Ivanov",
    "client_phone": "+79991234567",
    "agent_split_percent": 60,
    "hold_duration_hours": 72
  }'

# 2. Отправить на подписание
curl -X POST /api/v1/bank-split/{deal_id}/submit-for-signing \
  -H "Authorization: Bearer <token>"

# 3. Отметить как подписанное
curl -X POST /api/v1/bank-split/{deal_id}/mark-signed \
  -H "Authorization: Bearer <token>"

# 4. Создать счет и получить ссылку на оплату
curl -X POST /api/v1/bank-split/{deal_id}/create-invoice \
  -H "Authorization: Bearer <token>" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{"return_url": "https://lk.housler.ru/deals/success"}'

# 5. Отправить SMS клиенту
curl -X POST /api/v1/bank-split/{deal_id}/send-payment-link \
  -H "Authorization: Bearer <token>"

# 6. Клиент оплачивает по ссылке...
# 7. T-Bank отправляет webhook: payment.completed
# 8. Сделка переходит в hold_period
# 9. После hold или подтверждения - release milestones
# 10. Средства распределяются получателям
```

---

*Создано: 2026-01-17*
*Обновлено: 2026-01-19 (v2.1 — Enhanced Idempotency Requirements)*
*Версия API: v1*
