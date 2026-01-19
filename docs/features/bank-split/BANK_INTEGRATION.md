# T-Bank Integration: Bank-Split (Multiracchety)

**Версия:** 1.0
**Дата:** 2026-01-19
**Автор:** INTEG-LK

---

## Содержание

1. [Обзор](#1-обзор)
2. [Архитектура интеграции](#2-архитектура-интеграции)
3. [Onboarding Flow](#3-onboarding-flow)
4. [Deal Flow](#4-deal-flow)
5. [Webhook Events](#5-webhook-events)
6. [API Reference](#6-api-reference)
7. [Безопасность](#7-безопасность)
8. [Конфигурация](#8-конфигурация)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Обзор

### 1.1. Продукт: T-Bank Multiracchety

T-Bank Multiracchety (Мультирасчеты) — банковский продукт для автоматического split-платежей между несколькими получателями.

**Ключевые возможности:**
- Номинальный счет для безопасного хранения средств
- Автоматический split между получателями
- Configurable hold period (до 30 дней)
- Встроенная фискализация (T-Bank Checks)
- Мгновенные выплаты через СБП

### 1.2. Роль Housler

```
┌─────────────────────────────────────────────────────────────────┐
│                      HOUSLER ROLE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Housler = ТЕХНОЛОГИЧЕСКИЙ ОПЕРАТОР (не участник денежного потока) │
│                                                                 │
│  ✅ Создает сделки                                               │
│  ✅ Управляет workflow                                           │
│  ✅ Хранит данные участников                                     │
│  ✅ Арбитраж споров                                              │
│                                                                 │
│  ❌ НЕ касается основных денег                                   │
│  ❌ НЕ хранит средства на своих счетах                           │
│  ❌ НЕ является платежным агентом (103-ФЗ не применяется)        │
│                                                                 │
│  💰 Комиссия: 4% удерживается T-Bank автоматически               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3. Финансовая модель

```
Клиент платит: 100,000 RUB
          │
          ▼
    T-Bank Nominal Account
          │
          ├─── Housler Fee (4%): 4,000 RUB ──> Housler
          │
          └─── Net Amount (96%): 96,000 RUB
                    │
                    ├─── Agent (60%): 57,600 RUB ──> Agent Account
                    │
                    └─── Agency (40%): 38,400 RUB ──> Agency Account
```

---

## 2. Архитектура интеграции

### 2.1. Компоненты

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOUSLER BACKEND                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   DealService   │    │ OnboardingService│                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                          │
│           ┌──────────┴──────────┐                               │
│           │  TBank Integration  │                               │
│           │      Layer          │                               │
│           └──────────┬──────────┘                               │
│                      │                                          │
│  ┌───────────────────┼───────────────────┐                     │
│  │                   │                   │                     │
│  │  TBankDealsClient TBankOnboardingClient TBankChecksClient   │
│  │                   │                   │                     │
│  └───────────────────┼───────────────────┘                     │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │ HTTPS / mTLS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    T-BANK API                                    │
│           https://secured-openapi.tbank.ru                       │
├─────────────────────────────────────────────────────────────────┤
│  /v1/split/deals     - Создание/управление сделками             │
│  /v1/split/onboarding - Регистрация получателей                 │
│  /v1/split/payouts   - Выплаты                                  │
│  /v1/checks          - Фискализация                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2. Файловая структура

```
backend/app/
├── integrations/
│   └── tbank/
│       ├── __init__.py
│       ├── client.py           # Base HTTP client with retry
│       ├── deals.py            # TBankDealsClient
│       ├── onboarding.py       # TBankOnboardingClient
│       ├── payments.py         # TBankPaymentClient
│       ├── checks.py           # TBankChecksClient (fiscalization)
│       ├── webhooks.py         # TBankWebhookHandler
│       └── models.py           # Pydantic models for T-Bank API
│
├── services/
│   └── bank_split/
│       ├── deal_service.py     # Deal workflow orchestration
│       ├── invoice_service.py  # Invoice creation
│       ├── milestone_service.py # Milestone management
│       ├── onboarding_service.py # Onboarding orchestration
│       └── webhook_service.py  # Webhook processing
```

---

## 3. Onboarding Flow

### 3.1. Типы получателей

| Тип | Код | INN | Требования |
|-----|-----|-----|------------|
| Самозанятый | `se` | 12 цифр | NPD статус активен |
| ИП | `ip` | 12 цифр | Документы ИП |
| ООО | `ooo` | 10 цифр | Документы юрлица, KPP |

### 3.2. Onboarding Sequence

```
Agent                    Housler                   T-Bank
  │                         │                         │
  │ 1. Submit profile       │                         │
  │ ─────────────────────> │                         │
  │ {inn, legal_type, ...}  │                         │
  │                         │                         │
  │                         │ 2. Validate INN         │
  │                         │ ═══════════════════════ │
  │                         │ - Checksum validation   │
  │                         │ - Blacklist check       │
  │                         │ - NPD status (for SE)   │
  │                         │                         │
  │                         │ 3. POST /onboarding     │
  │                         │ ─────────────────────> │
  │                         │                         │
  │                         │ <── {session_id, url} ──│
  │                         │                         │
  │ <── onboarding_url ─── │                         │
  │                         │                         │
  │ 4. Complete KYC         │                         │
  │ ─────────────────────────────────────────────────>│
  │ (T-Bank portal)         │                         │
  │                         │                         │
  │                         │ <── webhook: approved ──│
  │                         │                         │
  │ <── status: approved ── │                         │
  │                         │                         │
```

### 3.3. Onboarding API

**POST /bank-split/onboarding/start**

```json
{
  "legal_type": "se",
  "legal_name": "Иванов Иван Иванович",
  "inn": "123456789012",
  "bank_account": "40817810000000000001",
  "bank_bik": "044525225",
  "bank_name": "Т-Банк",
  "bank_corr_account": "30101810145250000225",
  "phone": "+79991234567",
  "email": "agent@example.com"
}
```

**Response:**
```json
{
  "profile_id": "uuid",
  "session_id": "onb_session_123",
  "onboarding_url": "https://tbank.ru/onboarding/...",
  "status": "documents_required",
  "documents_required": [
    {"type": "passport", "description": "Скан паспорта"}
  ]
}
```

### 3.4. Onboarding Statuses

| Status | Description | Next Action |
|--------|-------------|-------------|
| `not_started` | Не начат | Вызвать /start |
| `documents_required` | Требуются документы | Агент загружает документы |
| `pending_review` | На проверке T-Bank | Ждать webhook |
| `approved` | Одобрен | Можно создавать сделки |
| `rejected` | Отклонён | Исправить данные, повторить |

---

## 4. Deal Flow

### 4.1. Полная последовательность

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           DEAL LIFECYCLE                                    │
└────────────────────────────────────────────────────────────────────────────┘

Phase 1: CREATION
═════════════════
Agent creates deal in Housler
  └─> Deal status: DRAFT
  └─> Recipients configured
  └─> Milestones configured

Phase 2: SIGNING
════════════════
Agent submits for signing
  └─> Deal status: AWAITING_SIGNATURES
  └─> Client receives SMS with sign link
  └─> Client signs on /sign/[token] page
  └─> Deal status: SIGNED

Phase 3: INVOICE
════════════════
Agent creates invoice
  └─> Housler calls T-Bank API: POST /v1/split/deals
  └─> T-Bank returns: deal_id, payment_url, qr_code
  └─> Deal status: INVOICED
  └─> Bank status: CREATED

Phase 4: PAYMENT
════════════════
Client pays via payment link
  └─> Webhook: payment.pending
  └─> Deal status: PAYMENT_PENDING
  └─> Webhook: payment.completed
  └─> Deal status: HOLD_PERIOD
  └─> Bank status: HOLD
  └─> hold_started_at = now()
  └─> auto_release_at = now() + hold_duration

Phase 5: HOLD PERIOD
════════════════════
Funds on hold in T-Bank nominal account
  │
  ├─── No dispute ───────────────────────────────>
  │    │
  │    ├─── Auto-release (after hold_duration) ──>│
  │    │    └─> Webhook: deal.released            │
  │    │    └─> Deal status: PAYOUT_READY         │
  │    │                                          │
  │    └─── Manual release (agent confirms) ─────>│
  │         └─> Webhook: deal.released            │
  │         └─> Deal status: PAYOUT_READY         │
  │                                               │
  └─── Dispute opened ────────────────────────────>
       └─> dispute_locked = true
       └─> All release operations blocked
       │
       ├─── Resolved (release) ──> PAYOUT_READY
       └─── Resolved (refund) ──> REFUNDED

Phase 6: PAYOUT
═══════════════
T-Bank distributes funds to recipients
  └─> Webhook: payout.completed (for each recipient)
  └─> Deal status: PAYOUT_IN_PROGRESS
  └─> All payouts done: Deal status: CLOSED

Phase 7: FISCALIZATION
══════════════════════
Receipts created automatically
  └─> IP/OOO: T-Bank Checks creates receipt
  └─> SE: Agent uploads NPD receipt from "Moy Nalog" app
```

### 4.2. T-Bank Deal API

**Create Deal: POST /v1/split/deals**

```json
{
  "orderId": "deal_uuid",
  "amount": 45000000,
  "currency": "RUB",
  "description": "Комиссия за сделку: Moscow, Tverskaya 1",
  "customerEmail": "client@example.com",
  "returnUrl": "https://lk.housler.ru/pay/success",
  "recipients": [
    {
      "recipientId": "recipient_agent_123",
      "amount": 28800000
    },
    {
      "recipientId": "recipient_agency_456",
      "amount": 19200000
    }
  ],
  "holdDuration": 72,
  "autoRelease": true
}
```

**Response:**
```json
{
  "dealId": "tbank_deal_123",
  "orderId": "deal_uuid",
  "status": "CREATED",
  "paymentUrl": "https://securepay.tinkoff.ru/...",
  "qrPayload": "00020101021...",
  "expiresAt": "2026-01-20T12:00:00Z"
}
```

### 4.3. Deal Statuses Mapping

| Housler Status | Bank Status | Description |
|----------------|-------------|-------------|
| `draft` | `not_created` | Сделка в черновике |
| `awaiting_signatures` | `not_created` | Ожидает подписей |
| `signed` | `not_created` | Подписан, готов к счету |
| `invoiced` | `created` | Счет выставлен в T-Bank |
| `payment_pending` | `payment_pending` | Платеж инициирован |
| `hold_period` | `hold` | Деньги на холде |
| `payout_ready` | `released` | Готов к выплате |
| `payout_in_progress` | `released` | Выплаты в процессе |
| `closed` | `released` | Все выплаты завершены |
| `cancelled` | `cancelled` | Отменена |
| `refunded` | `refunded` | Возврат выполнен |

---

## 5. Webhook Events

### 5.1. Endpoint

```
POST /api/v1/bank-split/webhooks/tbank
```

### 5.2. Event Types

| Event | T-Bank Code | Payload Fields | Housler Action |
|-------|-------------|----------------|----------------|
| Payment pending | `PAYMENT_PENDING` | `orderId`, `paymentId`, `amount` | Deal → `payment_pending` |
| Payment completed | `PAYMENT_CONFIRMED` | `orderId`, `paymentId`, `amount`, `success` | Deal → `hold_period`, start timer |
| Payment failed | `PAYMENT_FAILED` | `orderId`, `errorCode`, `errorMessage` | Deal → `payment_failed`, notify |
| Deal released | `DEAL_RELEASED` | `orderId`, `dealId` | Deal → `payout_ready` |
| Payout completed | `PAYOUT_COMPLETED` | `orderId`, `recipientId`, `amount` | Update recipient status |
| Payout failed | `PAYOUT_FAILED` | `orderId`, `recipientId`, `errorCode` | Alert, save to DLQ |
| Receipt created | `RECEIPT_CREATED` | `orderId`, `receiptUrl`, `fiscalData` | Create FiscalReceipt |
| Onboarding approved | `ONBOARDING_APPROVED` | `sessionId`, `merchantId` | Profile → approved |
| Onboarding rejected | `ONBOARDING_REJECTED` | `sessionId`, `reason` | Profile → rejected |

### 5.3. Webhook Payload Example

```json
{
  "eventId": "evt_123456",
  "eventType": "PAYMENT_CONFIRMED",
  "timestamp": "2026-01-17T12:00:00Z",
  "data": {
    "orderId": "deal_uuid",
    "dealId": "tbank_deal_123",
    "paymentId": "payment_456",
    "amount": 45000000,
    "currency": "RUB",
    "status": "CONFIRMED",
    "success": true
  }
}
```

### 5.4. Webhook Security

**Header:** `X-TBank-Signature`

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.lower())
```

### 5.5. Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5 | 1 hour |

**Важно:** Всегда возвращать `{"Success": true}` даже при ошибках. Ошибки сохранять в DLQ.

---

## 6. API Reference

### 6.1. Deal Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/bank-split` | Создать сделку |
| `GET` | `/bank-split/{id}` | Получить сделку |
| `POST` | `/bank-split/{id}/submit-for-signing` | Отправить на подпись |
| `POST` | `/bank-split/{id}/mark-signed` | Отметить подписанной |
| `POST` | `/bank-split/{id}/create-invoice` | Создать счет в T-Bank |
| `POST` | `/bank-split/{id}/release` | Досрочный release |
| `POST` | `/bank-split/{id}/cancel` | Отменить сделку |

### 6.2. Onboarding Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/bank-split/onboarding/start` | Начать онбординг |
| `GET` | `/bank-split/onboarding/{id}/status` | Проверить статус |
| `POST` | `/bank-split/onboarding/{id}/documents` | Загрузить документы |
| `POST` | `/bank-split/onboarding/{id}/complete` | Завершить онбординг |

### 6.3. Milestone Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bank-split/{id}/milestones` | Список этапов |
| `POST` | `/bank-split/{id}/milestones` | Создать этапы |
| `POST` | `/bank-split/{id}/milestones/{mid}/confirm` | Подтвердить этап |
| `POST` | `/bank-split/{id}/milestones/{mid}/release` | Освободить этап |

### 6.4. Receipt Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bank-split/{id}/receipts` | Список чеков |
| `POST` | `/bank-split/{id}/receipts/{rid}/upload-npd` | Загрузить NPD чек |

### 6.5. INN Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/bank-split/validate-inn` | Валидировать ИНН |

### 6.6. Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/bank-split/webhooks/tbank` | T-Bank payment webhooks |
| `POST` | `/bank-split/webhooks/tbank-checks` | T-Bank Checks webhooks |

---

## 7. Безопасность

### 7.1. Аутентификация

| Компонент | Метод |
|-----------|-------|
| Housler → T-Bank | Bearer token + mTLS |
| T-Bank → Housler (webhooks) | HMAC-SHA256 signature |
| User → Housler | JWT (от agent.housler.ru) |

### 7.2. Secrets

| Secret | Назначение | Хранение |
|--------|------------|----------|
| `TBANK_API_KEY` | API авторизация | 1Password → env |
| `TBANK_TERMINAL_KEY` | Terminal ID | 1Password → env |
| `TBANK_WEBHOOK_SECRET` | Webhook signature | 1Password → env |
| `TBANK_CERT_PATH` | mTLS certificate | 1Password → file |

### 7.3. Data Protection

```python
# Sensitive fields encrypted at rest (152-FZ compliance)
class PaymentProfile(BaseModel):
    inn_encrypted = Column(Text)           # AES-256
    inn_hash = Column(String(64))          # SHA-256 for search
    bank_account_encrypted = Column(Text)  # AES-256
```

### 7.4. IP Whitelist

T-Bank webhooks only from:
- `185.71.76.0/24`
- `185.71.77.0/24`

Configure in nginx:
```nginx
location /api/v1/bank-split/webhooks/tbank {
    allow 185.71.76.0/24;
    allow 185.71.77.0/24;
    deny all;
    proxy_pass http://backend;
}
```

---

## 8. Конфигурация

### 8.1. Environment Variables

```bash
# T-Bank API
TBANK_API_URL=https://secured-openapi.tbank.ru
TBANK_API_KEY=...
TBANK_TERMINAL_KEY=...
TBANK_WEBHOOK_SECRET=...

# Certificates (mTLS)
TBANK_CERT_PATH=/secrets/tbank/client.crt
TBANK_KEY_PATH=/secrets/tbank/client.key

# Feature flags
ENABLE_INSTANT_SPLIT=true
REQUIRE_AGENT_NPD_STATUS=false

# Hold configuration
DEFAULT_HOLD_DURATION_HOURS=72
DEFAULT_AUTO_RELEASE_DAYS=7
MAX_HOLD_DURATION_DAYS=30

# Platform fee
PLATFORM_FEE_PERCENT=4

# INN Validation
INN_VALIDATION_CACHE_TTL=86400
```

### 8.2. Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_INSTANT_SPLIT` | `true` | Enable bank-split functionality |
| `REQUIRE_AGENT_NPD_STATUS` | `false` | Require NPD for self-employed agents |
| `ENABLE_TBANK_CHECKS` | `true` | Enable auto-fiscalization |

---

## 9. Troubleshooting

### 9.1. Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ONBOARDING_NOT_COMPLETE` | Recipient not approved | Check onboarding status |
| `INVALID_RECIPIENT` | Unknown recipientId | Verify T-Bank registration |
| `DEAL_NOT_FOUND` | Wrong orderId in webhook | Check UUID format |
| `SIGNATURE_INVALID` | Wrong secret or payload | Verify TBANK_WEBHOOK_SECRET |
| `INN_VALIDATION_FAILED` | Invalid INN format | Use 10 or 12 digit INN |
| `NPD_NOT_REGISTERED` | Agent not self-employed | Register in "Moy Nalog" |

### 9.2. Debugging Webhooks

```bash
# Check DLQ for failed webhooks
SELECT * FROM webhook_dlq WHERE resolved_at IS NULL ORDER BY created_at DESC;

# Check bank events log
SELECT * FROM bank_events WHERE status = 'failed' ORDER BY received_at DESC;
```

### 9.3. Manual Reconciliation

```bash
# Run reconciliation task
celery -A app.worker call tasks.reconciliation_tbank

# Check discrepancies
SELECT d.id, d.status, d.bank_status, d.external_deal_id
FROM lk_deals d
WHERE d.payment_model = 'bank_hold_split'
  AND d.status != 'closed'
  AND d.created_at < NOW() - INTERVAL '7 days';
```

### 9.4. Logs

```bash
# Webhook processing logs
grep "tbank_webhook" /var/log/housler/backend.log

# T-Bank API calls
grep "TBankClient" /var/log/housler/backend.log
```

---

## Links

- **T-Bank API Docs:** https://www.tbank.ru/kassa/dev/payments/
- **T-Bank Checks:** https://www.tbank.ru/kassa/dev/checks/
- **Housler API Contracts:** [API_CONTRACTS.md](./API_CONTRACTS.md)
- **Housler Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

*Создано: 2026-01-19*
*Версия: 1.0*
*Автор: INTEG-LK*
