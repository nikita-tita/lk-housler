# Архитектура: Bank-Led Model (T-Bank Мультирасчёты)

**Автор:** ARCH-LK
**Дата:** 2026-01-19
**Версия:** 3.0
**Статус:** APPROVED

---

## 1. Обзор

### 1.1. Модель Bank-Led Split

```
Онбординг → Договор → Подпись → Счёт (T-Bank) → Оплата → Холд → Release → Выплаты
```

### 1.2. Ключевые принципы

1. **Housler НЕ участник денежного потока** — только витрина и арбитр
2. **Bank-Led Split** — T-Bank управляет номинальным счётом и выплатами
3. **Configurable Hold** — настраиваемый период удержания (72h default, до 30 дней)
4. **Milestones** — поэтапное освобождение средств (аванс/остаток)
5. **Dispute Lock** — блокировка операций при открытии спора
6. **Event-driven** — все изменения через webhooks
7. **Idempotency** — все внешние вызовы идемпотентны

---

## 2. Высокоуровневая архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТЫ                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  Web App    │    │ Mobile App  │    │  Agent App  │                     │
│  │  (Next.js)  │    │  (future)   │    │  (future)   │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         └──────────────────┴──────────────────┘                             │
│                            │                                                │
├────────────────────────────┼────────────────────────────────────────────────┤
│                            v                                                │
│                    ┌───────────────┐                                        │
│                    │   API Gateway │                                        │
│                    │   (FastAPI)   │                                        │
│                    └───────┬───────┘                                        │
│                            │                                                │
├────────────────────────────┼────────────────────────────────────────────────┤
│                            v                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      APPLICATION LAYER                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ DealService │  │MilestoneServ│  │OnboardingSrv│  │WebhookSrv  │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         │                │                │                │        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ InvoiceSrv  │  │ FiscalSrv   │  │ DisputeSrv  │  │ContractSrv │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         │                │                │                │        │   │
│  │         └────────────────┴────────────────┴────────────────┘        │   │
│  │                                   │                                  │   │
│  │                                   v                                  │   │
│  │                    ┌──────────────────────────┐                      │   │
│  │                    │    TBank Integration     │                      │   │
│  │                    │    (INTEG-LK zone)       │                      │   │
│  │                    └────────────┬─────────────┘                      │   │
│  │                                 │                                    │   │
│  └─────────────────────────────────┼────────────────────────────────────┘   │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    v                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      INFRASTRUCTURE LAYER                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │ PostgreSQL│  │   Redis   │  │   MinIO   │  │  Celery   │        │   │
│  │  │  (data)   │  │  (cache)  │  │   (S3)    │  │  (jobs)   │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          EXTERNAL SYSTEMS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │   Т-Банк API  │  │ agent.housler │  │    SMS.RU     │  │  FNS API   │  │
│  │ (Multiracchety│  │   (auth)      │  │   (notify)    │  │ (NPD check)│  │
│  └───────────────┘  └───────────────┘  └───────────────┘  └────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Компоненты

### 3.1. Application Services

| Сервис | Файл | Ответственность |
|--------|------|-----------------|
| `DealService` | `services/deal/service.py` | CRUD сделок, state machine |
| `MilestoneService` | `services/bank_split/milestone_service.py` | Этапы оплаты, triggers, release |
| `OnboardingService` | `services/bank_split/onboarding_service.py` | KYC, регистрация в банке |
| `WebhookService` | `services/bank_split/webhook_service.py` | Обработка вебхуков, DLQ |
| `InvoiceService` | `services/bank_split/invoice_service.py` | Создание счетов в T-Bank |
| `FiscalReceiptService` | `services/fiscalization/fiscal_receipt_service.py` | Фискальные чеки |
| `DisputeService` | `services/dispute/service.py` | Споры, блокировка, refunds |
| `ContractService` | `services/contract/generator.py` | Генерация договоров |
| `INNValidationService` | `services/inn/validation.py` | Валидация ИНН |
| `CommissionCalculator` | `services/deal/commission.py` | Расчёт комиссий |

### 3.2. Integration Services (INTEG-LK zone)

| Сервис | Ответственность |
|--------|-----------------|
| `TBankClient` | Base HTTP client, retry, circuit breaker |
| `TBankDealsClient` | Создание сделок, release |
| `TBankPaymentClient` | Инициация платежей, QR коды |
| `TBankOnboardingClient` | KYC, документы, merchant |
| `TBankChecksClient` | Фискализация чеков |
| `TBankWebhookHandler` | Валидация подписи, routing |
| `FNSNPDClient` | Проверка статуса самозанятого |

### 3.3. Models (Data Layer)

| Модель | Файл | Описание |
|--------|------|----------|
| `Deal` | `models/deal.py` | Основная сделка |
| `DealMilestone` | `models/bank_split.py` | Этапы оплаты |
| `DealSplitRecipient` | `models/bank_split.py` | Получатели выплат |
| `PaymentProfile` | `models/payment_profile.py` | Платёжный профиль (KYC) |
| `FiscalReceipt` | `models/fiscalization.py` | Фискальные чеки |
| `FiscalizationSettings` | `models/fiscalization.py` | Настройки фискализации |
| `BankEvent` | `models/bank_split.py` | Лог вебхуков |
| `WebhookDLQ` | `models/webhook_dlq.py` | Dead Letter Queue |
| `Dispute` | `models/dispute.py` | Споры |
| `DealConsent` | `models/consent.py` | Согласия пользователей |

### 3.4. Domain Events

```python
# Внутренние события (EventBus)
DealCreated
DealSigningStarted
DealSigned
InvoiceCreated
PaymentInitiated
PaymentCompleted
PaymentFailed
HoldStarted
HoldExpired
MilestoneReleased
PayoutCompleted
DealCompleted
DealDisputed
DisputeResolved
DealCancelled
DealRefunded

# Внешние события (от T-Bank webhooks)
TBankPaymentReceived
TBankPayoutCompleted
TBankPayoutFailed
TBankReceiptCreated
TBankOnboardingApproved
TBankOnboardingRejected
```

---

## 4. Bank-Led Flow

### 4.1. Полный flow сделки

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           BANK-LED DEAL FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

Phase 1: Onboarding (one-time per agent)
────────────────────────────────────────
Agent                    Housler                   T-Bank
  │                         │                         │
  │ 1. Submit profile       │                         │
  │ ─────────────────────> │                         │
  │                         │ 2. Create merchant      │
  │                         │ ─────────────────────> │
  │                         │                         │
  │                         │ <─── onboarding.url ── │
  │                         │                         │
  │ <── onboarding_url ─── │                         │
  │                         │                         │
  │ 3. Upload documents ────────────────────────────>│
  │                         │                         │
  │                         │ <── webhook: approved ──│
  │                         │                         │
  │ <── profile approved ── │                         │
  │                         │                         │

Phase 2: Deal Creation & Signing
────────────────────────────────
Agent                    Housler                   Client
  │                         │                         │
  │ 1. Create deal          │                         │
  │ ─────────────────────> │                         │
  │                         │                         │
  │ 2. Submit for signing   │                         │
  │ ─────────────────────> │                         │
  │                         │ 3. Send sign link       │
  │                         │ ─────────────────────> │
  │                         │                         │
  │                         │ <─── sign contract ─── │
  │                         │                         │
  │ <── deal signed ─────── │                         │
  │                         │                         │

Phase 3: Invoice & Payment
──────────────────────────
Agent                    Housler                   T-Bank                  Client
  │                         │                         │                         │
  │ 1. Create invoice       │                         │                         │
  │ ─────────────────────> │                         │                         │
  │                         │ 2. Create deal          │                         │
  │                         │ ─────────────────────> │                         │
  │                         │                         │                         │
  │                         │ <── deal_id, pay_url ── │                         │
  │                         │                         │                         │
  │ <── payment_url ─────── │                         │                         │
  │                         │                         │                         │
  │ 3. Send payment link    │                         │                         │
  │ ─────────────────────> │ ─────────────────────────────────────────────────>│
  │                         │                         │                         │
  │                         │                         │ <────── pay ─────────── │
  │                         │                         │                         │
  │                         │ <── webhook: payment.completed ────               │
  │                         │                         │                         │

Phase 4: Hold Period & Release
──────────────────────────────
                         Housler                   T-Bank
                            │                         │
                            │ Hold starts (72h)       │
                            │ ========================│
                            │                         │
  ┌─ No Dispute ────────────│                         │
  │                         │                         │
  │                         │ Hold expires            │
  │                         │ ─────────────────────> │
  │                         │                         │
  │                         │ Release milestones      │
  │                         │ ─────────────────────> │
  │                         │                         │
  │                         │ <── webhook: released ──│
  │                         │                         │
  │                         │ <── webhook: payout ────│
  └─────────────────────────│                         │

  ┌─ Dispute Opened ────────│                         │
  │                         │                         │
  │  dispute_locked = true  │                         │
  │  No release allowed     │                         │
  │                         │                         │
  │  Resolution:            │                         │
  │  ├─ Resolved → Release  │ ─────────────────────> │
  │  └─ Refund → Refund     │ ─────────────────────> │
  └─────────────────────────│                         │

Phase 5: Fiscalization
──────────────────────
                         Housler                   T-Bank / FNS
                            │                         │
                            │ On payout completed     │
                            │ ═══════════════════════ │
                            │                         │
  ┌─ T-Bank Checks (IP/OOO)─│                         │
  │                         │ Create receipt          │
  │                         │ ─────────────────────> │
  │                         │ <── receipt_url ─────── │
  └─────────────────────────│                         │
                            │                         │
  ┌─ NPD (Self-Employed) ───│                         │
  │                         │ Create tracking record  │
  │                         │                         │
  │  Agent uploads receipt  │ Check NPD status        │
  │  from "Moy Nalog" app   │ ─────────────────────> │
  │                         │                         │
  │  Reminder → 3 days      │                         │
  │  Reminder → 5 days      │                         │
  │  Escalate → 7 days      │                         │
  └─────────────────────────│                         │
```

### 4.2. State Machine (Deal)

```
                                        ┌──────────────┐
                                        │   CANCELLED  │
                                        └──────────────┘
                                              ^
                                              │ cancel()
                                              │ (if not dispute_locked)
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
                                                     │ (requires onboarding)
                                                     v
                                                ┌──────────┐
                                                │ INVOICED │
                                                │bank=created
                                                └──────────┘
                                                     │
                                                     │ webhook: payment.pending
                                                     v
                                                ┌──────────┐
                 webhook: payment.failed        │ PAYMENT  │
                ┌───────────────────────────────│ PENDING  │
                │                               │bank=pending
                v                               └──────────┘
           ┌──────────┐                              │
           │ PAYMENT  │                              │ webhook: payment.completed
           │  FAILED  │                              v
           └──────────┘                         ┌──────────┐
                │                               │   HOLD   │ ←── dispute_locked
                │ retry()                       │  PERIOD  │     can be set here
                └─────────────────────────────> │bank=hold │
                                                └──────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                │                │
                                    │ dispute()      │ hold_expired() │ release()
                                    │                │ or auto_release│ (manual)
                                    v                v                v
                               ┌──────────┐    ┌──────────┐    ┌──────────┐
                               │ DISPUTE  │    │  PAYOUT  │    │  PAYOUT  │
                               │dispute_  │    │  READY   │    │  READY   │
                               │locked=T  │    │bank=rel  │    │bank=rel  │
                               └──────────┘    └──────────┘    └──────────┘
                                    │                │                │
                     ┌──────────────┴──────────────┐ │                │
                     │                             │ │                │
                     │ resolve(refund)             │ │                │
                     v                             │ v                v
                ┌──────────┐              resolve  │    ┌──────────────┐
                │ REFUNDED │              (release)│    │   PAYOUT     │
                │bank=refund             ─────────>│───>│ IN_PROGRESS  │
                └──────────┘                            └──────────────┘
                                                             │
                                                             │ all_payouts_done
                                                             v
                                                        ┌──────────┐
                                                        │  CLOSED  │
                                                        └──────────┘
```

### 4.3. Milestone State Machine

```
┌─────────┐  create_invoice()  ┌───────────────┐  payment_pending  ┌─────────────────┐
│ PENDING │ ─────────────────> │ READY_TO_PAY  │ ────────────────> │ PAYMENT_PENDING │
└─────────┘                    └───────────────┘                   └─────────────────┘
                                                                          │
                                                        payment_completed │
                                                                          v
                                                                    ┌──────────┐
                     ┌────────────────────────────────────────────> │   PAID   │
                     │                                              └──────────┘
                     │                                                    │
                     │                                   ┌────────────────┼────────────────┐
                     │                                   │                │                │
                     │                       IMMEDIATE   │  SHORT_HOLD    │ CONFIRMATION   │
                     │                       trigger     │  trigger       │ trigger        │
                     │                                   │                │                │
                     │                                   v                v                v
                     │                              ┌─────────┐     ┌─────────┐     Wait for
                     │                              │  HOLD   │     │  HOLD   │     confirm()
                     │                              │(1h min) │     │(N hours)│           │
                     │                              └─────────┘     └─────────┘           │
                     │                                   │                │                │
                     │                                   │ hold_expired   │ hold_expired   │ confirm()
                     │                                   v                v                v
                     │                              ┌──────────────────────────────────────┐
                     │                              │                HOLD                  │
                     │                              │         (ready for release)          │
                     │                              └──────────────────────────────────────┘
                     │                                              │
                     │ cancel()                                     │ release() or auto
                     │                                              v
                ┌──────────┐                                   ┌──────────┐
                │ CANCELLED│                                   │ RELEASED │
                └──────────┘                                   └──────────┘
```

---

## 5. Webhook Handling

### 5.1. Архитектура обработки вебхуков

```
T-Bank                          Housler
   │                               │
   │ POST /webhooks/tbank          │
   │ ───────────────────────────> │
   │ X-TBank-Signature: <hmac>     │
   │ Body: {...}                   │
   │                               │
   │                    ┌──────────┴──────────┐
   │                    │ WebhookHandler      │
   │                    │ ────────────────────│
   │                    │ 1. Verify signature │
   │                    │ 2. Check idempotency│
   │                    │ 3. Parse event      │
   │                    │ 4. Route to handler │
   │                    └──────────┬──────────┘
   │                               │
   │                    ┌──────────┴──────────┐
   │                    │ Event Router        │
   │                    │ ────────────────────│
   │                    │ payment.* → PaymentH│
   │                    │ deal.* → DealHandler│
   │                    │ payout.* → PayoutH  │
   │                    │ receipt.* → FiscalH │
   │                    │ onboard.* → OnboardH│
   │                    └──────────┬──────────┘
   │                               │
   │                    ┌──────────┴──────────┐
   │                    │ Handler             │
   │                    │ ────────────────────│
   │                    │ 1. Load deal        │
   │                    │ 2. Update state     │
   │                    │ 3. Emit events      │
   │                    │ 4. Send notifs      │
   │                    │ 5. Commit           │
   │                    └──────────┬──────────┘
   │                               │
   │ <── 200 OK {"success": true} │
   │                               │
```

### 5.2. Signature Validation

```python
def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """HMAC-SHA256 signature verification"""
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.lower())
```

### 5.3. Idempotency & DLQ

```
Webhook received
       │
       v
┌──────────────┐
│ Check idemp. │
│ key in DB    │
└──────┬───────┘
       │
       ├─── Key exists & processed ──> Return cached response
       │
       v
┌──────────────┐
│ Process      │
│ webhook      │
└──────┬───────┘
       │
       ├─── Success ──> Mark processed, return 200
       │
       v
┌──────────────┐
│ Error?       │
└──────┬───────┘
       │
       ├─── Retryable ──> Return 5xx (T-Bank will retry)
       │
       v
┌──────────────┐
│ Save to DLQ  │──> Alert admins
└──────────────┘
```

### 5.5. Webhook Event Types

| Event Type | T-Bank Code | Housler Action |
|------------|-------------|----------------|
| `payment.pending` | `PAYMENT_PENDING` | Deal → `payment_pending`, update bank_status |
| `payment.completed` | `PAYMENT_CONFIRMED` | Deal → `hold_period`, start hold timer |
| `payment.failed` | `PAYMENT_FAILED` | Deal → `payment_failed`, notify agent |
| `deal.released` | `DEAL_RELEASED` | Deal → `payout_ready`, update bank_status |
| `payout.completed` | `PAYOUT_COMPLETED` | Update recipient `payout_status` → `released` |
| `payout.failed` | `PAYOUT_FAILED` | Alert admin, save to DLQ |
| `receipt.created` | `RECEIPT_CREATED` | Create `FiscalReceipt` record |
| `onboarding.approved` | `ONBOARDING_APPROVED` | PaymentProfile → `approved` |
| `onboarding.rejected` | `ONBOARDING_REJECTED` | PaymentProfile → `rejected`, notify |

### 5.6. Webhook Security

```python
# Signature validation example
import hmac
import hashlib

def verify_tbank_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    T-Bank uses HMAC-SHA256 signature.
    Header: X-TBank-Signature
    """
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.lower())
```

### 5.7. Webhook Retry Policy (T-Bank)

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | Immediate | 0 |
| 2 | 1 minute | 1 min |
| 3 | 5 minutes | 6 min |
| 4 | 15 minutes | 21 min |
| 5 | 1 hour | 1h 21min |
| Failed | — | Save to T-Bank DLQ |

**Важно:** Всегда возвращать 200 OK, даже при ошибках обработки. Ошибки сохраняем в свой DLQ для ручной обработки.

### 5.4. Dead Letter Queue (DLQ)

```python
class WebhookDLQ(BaseModel):
    """Failed webhook storage for manual investigation"""
    event_type: str           # payment.completed, etc.
    payload: dict             # Original webhook body
    error_message: str        # Why it failed
    deal_id: Optional[UUID]   # Related deal if known
    retry_count: int          # Number of retries
    last_retry_at: datetime
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]
```

---

## 6. Dispute Lock Mechanism

### 6.1. Концепция

Dispute Lock предотвращает release средств при открытом споре:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISPUTE LOCK FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Deal in HOLD_PERIOD                                           │
│       │                                                         │
│       │ User opens dispute                                      │
│       v                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ dispute_locked = True                                    │   │
│  │ dispute_locked_at = now()                                │   │
│  │ dispute_lock_reason = "Dispute #123 opened"             │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       │ All operations blocked:                                 │
│       │ ├── release() → 423 Locked                             │
│       │ ├── cancel() → 423 Locked                              │
│       │ └── adjust_split() → 423 Locked                        │
│       │                                                         │
│       │ Resolution:                                             │
│       │                                                         │
│       ├─── Resolved (release) ────────────────────────────────>│
│       │    dispute_locked = False                               │
│       │    proceed with release()                               │
│       │                                                         │
│       └─── Resolved (refund) ─────────────────────────────────>│
│            initiate refund via T-Bank                           │
│            Deal → REFUNDED                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2. Реализация

```python
# Check dispute lock before any financial operation
async def release_deal(deal_id: UUID) -> DealReleaseResult:
    deal = await get_deal(deal_id)

    if deal.dispute_locked:
        raise HTTPException(
            status_code=423,  # Locked
            detail=f"Deal is locked due to dispute: {deal.dispute_lock_reason}"
        )

    # Proceed with release...

# Set dispute lock when dispute is opened
async def open_dispute(deal_id: UUID, reason: str) -> Dispute:
    deal = await get_deal(deal_id)

    # Lock the deal
    deal.dispute_locked = True
    deal.dispute_locked_at = datetime.utcnow()
    deal.dispute_lock_reason = f"Dispute opened: {reason}"

    # Create dispute record...
```

### 6.3. Состояния блокировки

| Операция | dispute_locked=True | dispute_locked=False |
|----------|---------------------|---------------------|
| `release()` | 423 Locked | OK |
| `cancel()` | 423 Locked | OK |
| `adjust_split()` | 423 Locked | OK |
| `view_deal()` | OK | OK |
| `add_evidence()` | OK | OK |
| `resolve_dispute()` | OK (unlocks) | N/A |

---

## 7. Fiscalization Flow

### 7.1. Методы фискализации

```
┌─────────────────────────────────────────────────────────────────┐
│                    FISCALIZATION METHODS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. T-Bank Checks (IP/OOO)                                     │
│     ├── Automatic via T-Bank API                                │
│     ├── Receipt created on payout                               │
│     └── PDF stored in FiscalReceipt.receipt_url                │
│                                                                 │
│  2. NPD Receipt (Self-Employed)                                │
│     ├── User uploads from "Moy Nalog" app                      │
│     ├── Reminder system (3, 5, 7 days)                         │
│     └── Escalation to admin if overdue                         │
│                                                                 │
│  3. External (future)                                           │
│     └── Third-party fiscalization service                       │
│                                                                 │
│  4. Not Required                                                │
│     └── Platform fee (Housler handles own fiscalization)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2. T-Bank Checks Flow

```
Payout completed
       │
       v
┌──────────────┐
│ FiscalService│
│ create_receipt
└──────┬───────┘
       │
       v
┌──────────────┐
│ TBankChecks  │
│ API call     │
└──────┬───────┘
       │
       ├─── Success ──> FiscalReceipt(status="created")
       │                receipt_url = <PDF link>
       │
       └─── Failure ──> FiscalReceipt(status="failed")
                        Schedule retry (3 attempts)
```

### 7.3. NPD Receipt Tracking

```
Deal released to self-employed
       │
       v
┌──────────────────────────────────────────────────────────────┐
│ FiscalReceipt created                                        │
│ ├── status = "awaiting_upload"                               │
│ ├── fiscalization_method = "npd_receipt"                     │
│ ├── receipt_deadline = now + 7 days                          │
│ └── next_reminder_at = now + 3 days                          │
└──────────────────────────────────────────────────────────────┘
       │
       │ Day 0: Notification sent
       │
       │ Day 3: Reminder #1
       │
       │ Day 5: Reminder #2
       │
       │ Day 7: Deadline
       │ ├── If uploaded → status = "uploaded" ✓
       │ └── If not → status = "overdue", escalate to admin
       v
┌──────────────┐
│ Admin review │
│ manual action│
└──────────────┘
```

### 7.4. FiscalizationSettings Configuration

```python
# Example settings per legal type
[
    FiscalizationSettings(
        legal_type="se",  # Self-employed
        deal_type=None,   # All deal types
        method="npd_receipt",
        is_required=True,
        max_amount_threshold=240000000,  # 2.4M RUB NPD limit
    ),
    FiscalizationSettings(
        legal_type="ip",  # Individual entrepreneur
        deal_type=None,
        method="tbank_checks",
        is_required=True,
    ),
    FiscalizationSettings(
        legal_type="ooo",  # LLC
        deal_type=None,
        method="tbank_checks",
        is_required=True,
    ),
    FiscalizationSettings(
        legal_type="platform",  # Housler fee
        deal_type=None,
        method="not_required",  # Platform handles own fiscalization
        is_required=False,
    ),
]
```

---

## 8. Configurable Hold Period

### 8.1. Параметры холда

```python
class Deal(BaseModel):
    # Configurable hold parameters
    hold_duration_hours: int = 72      # Dispute window (default 72h)
    auto_release_days: int = 7         # Auto-release if no disputes

    # Runtime tracking
    hold_started_at: datetime          # When payment was confirmed
    auto_release_at: datetime          # Computed: hold_started_at + auto_release_days

    # Dispute lock
    dispute_locked: bool = False
    dispute_locked_at: datetime
    dispute_lock_reason: str
```

### 8.2. Hold Timeline

```
Payment confirmed (T=0)
       │
       │ hold_started_at = now
       │ auto_release_at = now + 7 days
       │
       ├─────────────────────────────────────────────────────────>
       │                                                         │
       │ T=0                T=72h              T=7d              │
       │ ├──────────────────┤                  │                 │
       │ │ Dispute window   │                  │                 │
       │ │ (hold_duration)  │                  │                 │
       │ └──────────────────┘                  │                 │
       │                     │                 │                 │
       │                     │ Manual release  │ Auto-release    │
       │                     │ possible here   │ (if no dispute) │
       │                     v                 v                 │
       │              ┌────────────────────────────────┐         │
       │              │ RELEASE                        │         │
       │              │ (if not dispute_locked)        │         │
       │              └────────────────────────────────┘         │
       │                                                         │
```

### 8.3. Background Jobs

```python
# Celery beat schedule
CELERYBEAT_SCHEDULE = {
    "check_auto_release": {
        "task": "tasks.check_auto_release",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    "check_milestone_triggers": {
        "task": "tasks.check_milestone_triggers",
        "schedule": crontab(minute="*/5"),
    },
    "reconciliation_tbank": {
        "task": "tasks.reconciliation",
        "schedule": crontab(minute="*/10"),
    },
    "npd_receipt_reminders": {
        "task": "tasks.npd_reminders",
        "schedule": crontab(hour="10", minute="0"),  # Daily 10:00
    },
}
```

---

## 9. Финансовая модель "Мультирасчёты"

### 9.1. Housler как технологический оператор

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ФИНАНСОВЫЙ ПОТОК                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Клиент платит: 100,000 RUB                                                 │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  Т-Банк (номинальный счёт)                          │   │
│  │                                                                      │   │
│  │  1. Принимает платёж от клиента                                     │   │
│  │  2. Холдирует на номинальном счёте (до 30 дней)                     │   │
│  │  3. После release автоматически:                                    │   │
│  │     - Удерживает комиссию сервиса (4%) → Housler                    │   │
│  │     - Перечисляет остаток получателям напрямую                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│         ┌─────────┴─────────┬──────────────────┐                           │
│         ▼                   ▼                  ▼                            │
│  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐                    │
│  │   Housler   │     │   Агент     │    │  Агентство  │                    │
│  │  (4% fee)   │     │ (60% от 96%)│    │ (40% от 96%)│                    │
│  │   4,000 RUB │     │  57,600 RUB │    │  38,400 RUB │                    │
│  └─────────────┘     └─────────────┘    └─────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2. Ключевые принципы

| Принцип | Описание | Выгода |
|---------|----------|--------|
| **Housler НЕ касается основных денег** | Все платежи идут через T-Bank | Нет рисков 103-ФЗ |
| **Комиссия удерживается банком** | Настраивается в ЛК T-Bank | Налог только с комиссии |
| **Прямые выплаты получателям** | Банк → Агент напрямую | Мгновенные переводы, СБП |
| **Номинальный счёт** | Деньги на счёте банка | Защита от claims |

### 9.3. Комиссия платформы

```python
# backend/app/core/config.py
PLATFORM_FEE_PERCENT: Decimal = Decimal("4")  # 4% комиссия Housler

# Комиссия удерживается T-Bank автоматически, настраивается в терминале банка
# В splits указываются ТОЛЬКО агенты, без Housler
splits = [
    TBankDealSplit(recipient_id="agent_123", amount=57600_00),     # 57,600 RUB
    TBankDealSplit(recipient_id="agency_456", amount=38400_00),    # 38,400 RUB
]
# Total: 96,000 RUB (100% - 4% комиссия)
# Комиссия 4,000 RUB удерживается банком автоматически
```

---

## 10. Безопасность

### 10.1. Аутентификация

| Компонент | Метод |
|-----------|-------|
| User → API | JWT (от agent.housler.ru) |
| API → TBank | Bearer token + mTLS |
| TBank → Webhook | HMAC-SHA256 signature |
| Idempotency | UUID v4 ключи, TTL 24h |

### 10.2. Авторизация (RBAC)

```python
class DealPermissions:
    CREATE = ["agent", "agency_admin"]
    VIEW = ["agent", "agency_admin", "agency_accountant", "client"]
    CANCEL = ["agent", "agency_admin"]  # только до оплаты, not locked
    RELEASE = ["agent", "agency_admin", "admin"]  # not locked
    DISPUTE = ["client", "agent"]  # только в hold period
    RESOLVE_DISPUTE = ["admin"]
```

### 10.3. Data Protection (152-FZ)

```python
# Шифрование sensitive fields
class PaymentProfile(BaseModel):
    inn_encrypted = Column(Text)           # AES-256 encrypted
    inn_hash = Column(String(64))          # SHA-256 for search
    bank_account_encrypted = Column(Text)  # AES-256 encrypted
    kpp_encrypted = Column(Text)           # AES-256 encrypted
```

---

## 11. Инфраструктура

### 11.1. Deployment

```yaml
# docker-compose.prod.yml
services:
  backend:
    image: lk-backend
    environment:
      - TBANK_API_URL=https://secured-openapi.tbank.ru
      - TBANK_WEBHOOK_SECRET=${TBANK_WEBHOOK_SECRET}

  celery-worker:
    image: lk-backend
    command: celery -A app.worker worker -l info -Q default,webhooks,notifications

  celery-beat:
    image: lk-backend
    command: celery -A app.worker beat -l info
```

### 11.2. Мониторинг

```yaml
# Prometheus metrics
deals_created_total
deals_completed_total
deals_disputed_total
payment_duration_seconds
tbank_api_latency_seconds
tbank_api_errors_total
webhook_processing_duration_seconds
webhook_dlq_size
milestone_release_latency_seconds
fiscal_receipt_success_rate
```

### 11.3. Алерты

| Метрика | Порог | Действие |
|---------|-------|----------|
| `tbank_api_errors_total` | > 10/min | PagerDuty |
| `webhook_dlq_size` | > 5 | Slack + investigate |
| `payment_duration_seconds` | > 300s | Slack |
| `dispute_opened` | any | Slack |
| `npd_receipt_overdue` | any | Admin notification |

---

## 12. Definition of Done (Architecture)

- [x] Bank-Led flow описан
- [x] Webhook handling задокументирован
- [x] Dispute lock mechanism описан
- [x] Fiscalization flow задокументирован
- [x] State machines детализированы
- [x] Configurable hold описан
- [x] API контракты обновлены (см. API_CONTRACTS.md)
- [x] Безопасность продумана
- [x] Инфраструктура описана

---

*Создано: 2026-01-16*
*Обновлено: 2026-01-19 (v3.1 — Enhanced Webhook Documentation)*
*Автор: ARCH-LK*
