# KANBAN: Phase 6 — Bank-Led Safe Deal Architecture

**Дата начала:** 2026-01-19
**Дата завершения:** 2026-01-19
**Цель:** Устранить регуляторные блокеры (MoR, автовыплата, фискализация)
**Статус:** COMPLETED

---

## DONE

### Week 1 — Модели и инфраструктура (COMPLETED)

| ID | Задача | Исполнитель | Завершено |
|----|--------|-------------|-----------|
| TASK-5.1 | Payment Profile Model | Agent aefdad9 | 2026-01-19 |
| TASK-2.1 | Configurable Hold Period | Agent a7e6cea | 2026-01-19 |
| TASK-1.1 | Bank Status + Idempotency | Agent a7df5cc | 2026-01-19 |

### Week 2 — Events и Webhooks (COMPLETED)

| ID | Задача | Исполнитель | Завершено |
|----|--------|-------------|-----------|
| TASK-1.2 | Webhook Handler Hardening | Agent ad72b72 | 2026-01-19 |
| TASK-2.2 | Release by Confirmation | Agent a26e6e5 | 2026-01-19 |
| TASK-2.3 | Dispute Lock Mechanism | Agent a5a9d9e | 2026-01-19 |

### Week 3 — Фискализация и договоры (COMPLETED)

| ID | Задача | Исполнитель | Завершено |
|----|--------|-------------|-----------|
| TASK-3.1 | Fiscalization Infrastructure | Agent aa0a1df | 2026-01-19 |
| TASK-4.1 | Contract Layer Separation | Agent a9b9650 | 2026-01-19 |
| TASK-6.1 | PRODUCT_OVERVIEW.md Rewrite | Agent a05278a | 2026-01-19 |
| TASK-3.2 | T-Bank Checks Integration | Agent a507185 | 2026-01-19 |
| TASK-6.4 | Contract Templates Update | Agent a97c80e | 2026-01-19 |

---

## МЕТРИКИ

| Метрика | Target | Final |
|---------|--------|-------|
| Задач всего | 11 | 11 |
| Задач Done | 11 | 11 |
| Агентов использовано | — | 11 |
| Миграций создано | — | 9 |

---

## МИГРАЦИИ

| Revision | Описание | Статус |
|----------|----------|--------|
| 017_hold_period_fields | TASK-2.1: Hold period fields | Ready |
| 017_bank_status_idempotency | TASK-1.1: Bank status + idempotency_keys | Ready |
| 018_merge_017_heads | Merge Week 1 | Ready |
| 019_add_payment_profile | TASK-5.1: Payment profiles | Ready |
| 020_add_service_completion_release_fields | TASK-2.2: Release trigger | Ready |
| 020_dispute_lock | TASK-2.3: Dispute lock | Ready |
| 020_add_webhook_hardening | TASK-1.2: Webhook DLQ | Ready |
| 021_merge_020_heads | Merge Week 2 | Ready |
| 022_add_contract_layer | TASK-4.1: Contract layer | Ready |
| 022_add_fiscalization_settings | TASK-3.1: Fiscalization settings | Ready |
| 023_merge_022_heads | Merge Week 3 batch 1 | Ready |
| 024_update_contract_templates_v2 | TASK-6.4: Contract templates v2 | Ready |
| 025_add_fiscal_receipts | TASK-3.2: Fiscal receipts | Ready |

---

## СОЗДАННЫЕ АРТЕФАКТЫ

### Week 1 — Models
- `backend/app/models/payment_profile.py` — PaymentProfile, LegalType, OnboardingStatus, KYCStatus, FiscalizationMethod
- `backend/app/models/idempotency.py` — IdempotencyKey model
- Deal model: bank_status, bank_created_at, bank_released_at, hold_duration_hours, auto_release_days

### Week 2 — Services
- `backend/app/models/webhook_dlq.py` — WebhookDLQ model for Dead Letter Queue
- `backend/app/services/bank_split/webhook_service.py` — Signature validation, idempotent processing
- `backend/app/services/bank_split/completion_service.py` — Release trigger logic
- `backend/app/services/dispute/service.py` — Dispute lock/unlock, escalation timers
- ServiceCompletion model: triggers_release, release_triggered_at
- Dispute model: agency_deadline, platform_deadline, max_deadline
- BankEvent model: idempotency_key

### Week 3 — Fiscalization & Contracts
- `backend/app/models/fiscalization.py` — FiscalizationSettings, FiscalReceipt
- `backend/app/services/fiscalization/service.py` — FiscalizationService
- `backend/app/services/fiscalization/tbank_checks.py` — TBankChecksClient (API integration)
- `backend/app/services/fiscalization/fiscal_receipt_service.py` — High-level receipt management
- ContractTemplate model: layer field (platform/transaction)
- ContractLayer enum: PLATFORM, TRANSACTION
- Updated contract templates (v2.0) with bank-led terminology

### Documentation
- `docs/PRODUCT_OVERVIEW.md` — Rewritten for Bank-Led Safe Deal model (no escrow/MoR)
- Contract templates updated to v2.0 (no escrow terminology)

---

## ЗАВИСИМОСТИ (ALL RESOLVED)

```
TASK-5.1 (PaymentProfile) ←── TASK-3.1 (Fiscalization) [DONE]
                         ←── TASK-3.2 (T-Bank Checks) [DONE]

TASK-2.1 (Hold Period) ←── TASK-2.2 (Release by Event) [DONE]
                       ←── TASK-2.3 (Dispute Lock) [DONE]

TASK-4.1 (Contract Layers) ←── TASK-6.4 (Templates Update) [DONE]

TASK-1.1 (API Refactor) ←── TASK-1.2 (Webhooks) [DONE]

TASK-3.1 (Fiscalization) ←── TASK-3.2 (T-Bank Checks) [DONE]
```

---

## ОТКРЫТЫЕ ВОПРОСЫ (RESOLVED)

1. ~~**Hold period default:** 72 часа или 7 дней?~~ **RESOLVED:** 72h dispute window, 7d auto-release
2. ~~**T-Bank API:** Поддерживает ли partial release для milestones?~~ **DEFERRED:** Phase 8
3. ~~**Фискализация:** Кто платит 1.5% за "Чеки Т-Бизнеса"?~~ **RESOLVED:** Configurable via FiscalizationSettings
4. ~~**DaData:** Есть ли API key для автозаполнения по ИНН?~~ **DEFERRED:** Phase 7

---

## NEXT STEPS

**Phase 7: Operational Excellence** (2 недели)
- TASK-5.2: Bank Onboarding Flow
- TASK-4.2: Consent Flow Updates
- TASK-1.3: Remove MoR References

**Phase 8: Nice to Have**
- TASK-2.4: Milestones with Partial Release
- TASK-3.3: NPD Tracking

---

*Обновлено: 2026-01-19*
*Phase 6 COMPLETED*
