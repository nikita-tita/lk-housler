# API Contracts: Bank Split

**Версия:** 1.1
**Дата:** 2026-01-18
**Base URL:** `/api/v1/bank-split`

---

## Содержание

1. [Аутентификация](#аутентификация)
2. [Deal Endpoints](#deal-endpoints)
3. [Status Transitions](#status-transitions)
4. [Invoice & Payment](#invoice--payment)
5. [Webhooks](#webhooks)
6. [Contract Endpoints](#contract-endpoints)
7. [Schemas](#schemas)
8. [Error Codes](#error-codes)

---

## Аутентификация

Все endpoints (кроме webhook) требуют JWT токен:

```
Authorization: Bearer <token>
```

---

## Deal Endpoints

### POST /bank-split

Создание новой сделки с instant split моделью.

**Request:**
```json
{
  "type": "secondary_buy | secondary_sell | newbuild_booking",
  "property_address": "string (required)",
  "price": "decimal (required, > 0)",
  "commission_total": "decimal (required, > 0)",
  "description": "string (optional, max 500)",
  "client_name": "string (required)",
  "client_phone": "string (required, pattern: ^\\+?[0-9]{10,15}$)",
  "client_email": "string (optional, email format)",
  "organization_id": "uuid (optional)",
  "agent_split_percent": "integer (optional, 0-100)"
}
```

**Response: 201 Created**
```json
{
  "id": "uuid",
  "type": "secondary_buy",
  "status": "draft",
  "payment_model": "instant_split",
  "property_address": "Moscow, Tverskaya 1",
  "price": "15000000.00",
  "commission_agent": "450000.00",
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
    },
    {
      "id": "uuid",
      "deal_id": "uuid",
      "role": "agency",
      "split_type": "percent",
      "split_value": "30.0000",
      "user_id": null,
      "organization_id": "uuid",
      "calculated_amount": "135000.00",
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
  "type": "secondary_buy",
  "status": "invoiced",
  "payment_model": "instant_split",
  "property_address": "Moscow, Tverskaya 1",
  "price": "15000000.00",
  "commission_agent": "450000.00",
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
  "recipients": [...]
}
```

**Errors:**
- `403 Forbidden` - Access denied (not deal creator or agent)
- `404 Not Found` - Deal not found

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

---

### POST /bank-split/{deal_id}/release

Досрочно освободить средства из холда.

**Precondition:** `status == "hold_period"`

**Response: 200 OK**
```json
{
  "deal_id": "uuid",
  "old_status": "hold_period",
  "new_status": "closed",
  "timestamp": "2026-01-17T12:00:00Z"
}
```

---

## Invoice & Payment

### POST /bank-split/{deal_id}/create-invoice

Создать счет в T-Bank и получить ссылку на оплату.

**Precondition:** `status == "signed"`

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
  "expires_at": "2026-01-18T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Deal not in correct status
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

## Webhooks

### POST /bank-split/webhooks/tbank

Обработка вебхуков от T-Bank.

**Note:** Этот endpoint не требует JWT авторизации, но проверяет подпись.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body (T-Bank format):**
```json
{
  "TerminalKey": "terminal_key",
  "OrderId": "deal_uuid",
  "DealId": "tbank_deal_id",
  "PaymentId": "payment_id",
  "Amount": 45000000,
  "Status": "CONFIRMED",
  "Success": true,
  "ErrorCode": "0",
  "Message": "",
  "Token": "signature_token"
}
```

**Response: 200 OK**
```json
{
  "Success": true
}
```

**Supported Events:**
| Status | Action |
|--------|--------|
| `CONFIRMED` | Payment received, start hold period |
| `AUTHORIZED` | Payment authorized (hold funds) |
| `REJECTED` | Payment rejected |
| `REFUNDED` | Payment refunded |

---

## Schemas

### Deal Status Flow

```
draft → awaiting_signatures → signed → invoiced → payment_pending → hold_period → closed
                                 ↓                      ↓              ↓
                            cancelled              cancelled      disputed
```

### DealStatus Enum

| Status | Description |
|--------|-------------|
| `draft` | Черновик, можно редактировать |
| `awaiting_signatures` | Ожидает подписания |
| `signed` | Подписан, можно выставить счет |
| `invoiced` | Счет выставлен |
| `payment_pending` | Ожидает оплаты |
| `hold_period` | Оплачен, период подтверждения (до 1 часа) |
| `closed` | Завершена, средства распределены |
| `cancelled` | Отменена |
| `disputed` | Оспаривается |

### PayoutStatus Enum

| Status | Description |
|--------|-------------|
| `pending` | Ожидает выплаты |
| `processing` | В процессе выплаты |
| `paid` | Выплачено |
| `failed` | Ошибка выплаты |
| `refunded` | Возвращено |

### RecipientRole Enum

| Role | Description |
|------|-------------|
| `agent` | Агент (физлицо или самозанятый) |
| `agency` | Агентство (юрлицо) |
| `lead` | Лид-провайдер |
| `platform_fee` | Комиссия платформы |

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
| `422` | Unprocessable Entity - validation error |
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

**Possible Statuses:**
- `draft` — Черновик
- `pending_signature` — Ожидает подписи
- `partially_signed` — Частично подписан
- `fully_signed` — Полностью подписан
- `cancelled` — Отменён
- `expired` — Истёк срок подписания

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| All endpoints | 100 req/min per user |
| Webhook | 1000 req/min (T-Bank IP only) |

---

## Examples

### Полный flow создания и оплаты сделки

```bash
# 1. Создание сделки
curl -X POST /api/v1/bank-split \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "secondary_buy",
    "property_address": "Moscow, Tverskaya 1",
    "price": "15000000",
    "commission_total": "450000",
    "client_name": "Ivan Ivanov",
    "client_phone": "+79991234567",
    "agent_split_percent": 70
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
  -d '{"return_url": "https://lk.housler.ru/deals/success"}'

# 5. Клиент оплачивает по ссылке...
# 6. T-Bank отправляет webhook с подтверждением
# 7. После истечения hold_period или ручного release - средства распределяются
```

---

*Создано: 2026-01-17*
*Версия API: v1*
