# KANBAN: Phase 7 — Operational Excellence

**Дата начала:** 2026-01-19
**Дата завершения:** 2026-01-19
**Цель:** Onboarding + Consent Flow + MoR Cleanup
**Статус:** COMPLETED

---

## DONE

| ID | Задача | Исполнитель | Завершено |
|----|--------|-------------|-----------|
| TASK-5.2 | Bank Onboarding Flow | Agent a2945f8 | 2026-01-19 |
| TASK-4.2 | Consent Flow Update | Agent acfce94 | 2026-01-19 |
| TASK-1.3 | Remove MoR References | Agent aa32b2f | 2026-01-19 |

---

## МЕТРИКИ

| Метрика | Target | Final |
|---------|--------|-------|
| Задач всего | 3 | 3 |
| Задач Done | 3 | 3 |
| MoR упоминаний в коде | 0 | 0 (кроме deprecated) |

---

## МИГРАЦИИ

| Revision | Описание | Статус |
|----------|----------|--------|
| 026_update_consent_types | TASK-4.2: Consent types documentation | Ready |

---

## СОЗДАННЫЕ АРТЕФАКТЫ

### TASK-5.2: Bank Onboarding Flow
- `backend/app/services/bank_split/onboarding_client.py` — TBankOnboardingClient (API client)
- `backend/app/services/bank_split/onboarding_service.py` — OnboardingService (business logic)
- `backend/app/schemas/onboarding.py` — Pydantic schemas
- `backend/app/api/v1/endpoints/onboarding.py` — API endpoints:
  - `POST /onboarding/start`
  - `GET /onboarding/status`
  - `POST /onboarding/documents`
  - `POST /onboarding/complete`
  - `POST /onboarding/webhook`
  - `GET /onboarding/profiles`

### TASK-4.2: Consent Flow Update
- ConsentType enum — новые типы:
  - `PLATFORM_FEE_DEDUCTION`
  - `BANK_PAYMENT_PROCESSING`
  - `SERVICE_CONFIRMATION_REQUIRED`
  - `HOLD_PERIOD_ACCEPTANCE`
- `CONSENT_TEXTS` dictionary — тексты согласий на русском
- `get_consent_text()` — helper function
- `GET /consent-texts` — публичный endpoint

### TASK-1.3: Remove MoR References
- `PaymentModel.MOR` — помечен как @deprecated
- Все комментарии с "MoR" обновлены на "legacy"
- 0 активных упоминаний "escrow" в backend/*.py

---

## NEXT STEPS

**Phase 8: Nice to Have** (опционально)
- TASK-2.4: Milestones with Partial Release
- TASK-3.3: NPD Tracking
- TASK-5.3: INN Auto-fill via DaData

---

*Обновлено: 2026-01-19*
*Phase 7 COMPLETED*
