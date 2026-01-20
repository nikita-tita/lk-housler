# Bugfix Plan: Deal Creation

## Executive Summary

**Critical Issue**: Deal creation fails with `asyncpg.exceptions.DataError` due to type mismatch - `executor_id` column expects `String(36)` but service passes `Integer` (user.id).

**Total Issues**: 12 (1 blocker, 3 critical, 5 major, 3 minor)

**Estimated Total Effort**: ~3-4 days

---

## P0 - Blocker (immediate fix required)

### TASK-001: Fix executor_id type mismatch (INT-001)

- **Problem**: `executor_id` column is `String(36)` but `create_simple()` passes `creator.id` as Integer
- **Root Cause**: Model expects UUID string, service passes integer user ID
- **Error**: `asyncpg.exceptions.DataError: invalid input for query argument $5: 3 (expected str, got int)`
- **Solution**: Convert `creator.id` to string before assignment
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py` (line 195)
- **Code Fix**:
  ```python
  # Before
  executor_id=creator.id,

  # After
  executor_id=str(creator.id),
  ```
- **Effort**: XS (5 min)
- **Assignee**: Backend
- **Test**: Create deal via API, verify no DataError

---

## P1 - Critical (this sprint)

### TASK-002: Persist split fields to database (BE-001)

- **Problem**: `agent_split_percent`, `coagent_split_percent`, `agency_split_percent` from schema are ignored in `create_simple()`
- **Impact**: Commission split configuration lost - payouts will be incorrect
- **Solution**: Add columns to Deal model if missing, save values in service
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/models/deal.py` - add columns
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py` - persist values
  - Migration file needed
- **Effort**: S (1-2 hours)
- **Assignee**: Backend
- **Depends on**: TASK-001

### TASK-003: Process coagent_user_id and coagent_phone (BE-002)

- **Problem**: Schema accepts `coagent_user_id` and `coagent_phone` but service ignores them
- **Impact**: Co-agent cannot be linked to deal, invitation not created
- **Solution**: Store in Deal model or create DealSplitRecipient records
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py`
  - `/Users/fatbookpro/Desktop/lk/backend/app/models/deal.py` (if columns needed)
- **Effort**: M (2-4 hours)
- **Assignee**: Backend
- **Depends on**: TASK-002

### TASK-004: Encrypt client_phone for 152-FZ compliance (BE-012)

- **Problem**: `client_phone` stored in plaintext, violating 152-FZ
- **Impact**: Legal/compliance risk - PII exposure
- **Solution**: Use `encrypt_phone()` from `app/core/encryption.py`, add `client_phone_encrypted` + `client_phone_hash` columns
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/models/deal.py` - add encrypted columns
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py` - use encrypt_phone()
  - Migration file needed
- **Effort**: M (2-3 hours)
- **Assignee**: Backend
- **Depends on**: TASK-001

---

## P2 - Major (next sprint)

### TASK-005: Remove redundant commission field (BE-003)

- **Problem**: Deal has both `commission_agent` (single value) and `commission_percent`/`commission_fixed` (typed)
- **Impact**: Data inconsistency risk, confusing API
- **Solution**: Deprecate `commission_agent`, calculate on read from typed fields
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/models/deal.py`
  - `/Users/fatbookpro/Desktop/lk/backend/app/schemas/deal.py`
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py`
- **Effort**: M (2-3 hours)
- **Assignee**: Backend

### TASK-006: Add passport cross-validation (BE-005)

- **Problem**: `client_passport_series` and `client_passport_number` can be provided separately
- **Impact**: Incomplete passport data stored
- **Solution**: Add Pydantic validator - both must be present or both absent
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/schemas/deal.py`
- **Code Fix**:
  ```python
  @model_validator(mode='after')
  def validate_passport_fields(self) -> 'DealCreateSimple':
      series = self.client_passport_series
      number = self.client_passport_number
      if (series and not number) or (number and not series):
          raise ValueError('Passport series and number must be provided together')
      return self
  ```
- **Effort**: XS (15 min)
- **Assignee**: Backend

### TASK-007: Wrap strptime in try-except (BE-007)

- **Problem**: `datetime.strptime()` calls without error handling can cause 500 on invalid date
- **Impact**: Unhandled exceptions, poor UX
- **Location**: `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py` (lines 229, 235)
- **Solution**: Wrap in try-except, raise `ValueError` with user-friendly message
- **Effort**: XS (15 min)
- **Assignee**: Backend

### TASK-008: Validate exclusive_until is future date (FE-005)

- **Problem**: Frontend allows past dates for `exclusive_until`
- **Impact**: Invalid exclusive period
- **Solution**: Add min attribute to date input, add schema validator on backend
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/frontend/app/agent/deals/new/page.tsx` (line 738)
  - `/Users/fatbookpro/Desktop/lk/backend/app/schemas/deal.py`
- **Effort**: S (30 min)
- **Assignee**: Frontend + Backend

### TASK-009: Add maxLength to client_name input (FE-014)

- **Problem**: Frontend input has no maxLength, backend truncates at 255
- **Impact**: Data loss without user warning
- **Solution**: Add `maxLength={255}` to Input component
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/frontend/app/agent/deals/new/page.tsx` (line 894-903)
- **Effort**: XS (5 min)
- **Assignee**: Frontend

---

## P3 - Minor (backlog)

### TASK-010: Unify phone validation (FE-001)

- **Problem**: Frontend uses `phone.length === 11 && phone.startsWith('7')`, backend uses regex `^\d{10,11}$`
- **Impact**: Inconsistent validation messages
- **Solution**: Align validation rules, prefer stricter format
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/frontend/app/agent/deals/new/page.tsx` (lines 271-273)
  - `/Users/fatbookpro/Desktop/lk/backend/app/schemas/deal.py` (line 118-130)
- **Effort**: S (30 min)
- **Assignee**: Frontend + Backend

### TASK-011: Add client_name encryption for full 152-FZ compliance

- **Problem**: `client_name` stored in plaintext (less critical than phone but still PII)
- **Impact**: Partial 152-FZ compliance
- **Solution**: Use `encrypt_name()`, add `client_name_encrypted` column
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/backend/app/models/deal.py`
  - `/Users/fatbookpro/Desktop/lk/backend/app/services/deal/service.py`
- **Effort**: S (1 hour)
- **Assignee**: Backend
- **Depends on**: TASK-004

### TASK-012: Add input validation feedback for coagent phone

- **Problem**: Coagent phone validation happens only on search, no immediate feedback
- **Impact**: UX inconsistency with client phone
- **Solution**: Show validation state immediately, same pattern as client phone
- **Files**:
  - `/Users/fatbookpro/Desktop/lk/frontend/app/agent/deals/new/page.tsx` (lines 788-829)
- **Effort**: XS (15 min)
- **Assignee**: Frontend

---

## Dependencies Graph

```
TASK-001 (P0: executor_id fix)
    |
    +---> TASK-002 (P1: split fields)
    |         |
    |         +---> TASK-003 (P1: coagent processing)
    |
    +---> TASK-004 (P1: phone encryption)
              |
              +---> TASK-011 (P3: name encryption)

TASK-005 (P2: commission cleanup) - independent
TASK-006 (P2: passport validation) - independent
TASK-007 (P2: strptime safety) - independent
TASK-008 (P2: exclusive_until validation) - independent
TASK-009 (P2: maxLength) - independent
TASK-010 (P3: phone validation) - independent
TASK-012 (P3: coagent UX) - independent
```

---

## Migration Checklist

Required migrations:
- [ ] Add `agent_split_percent`, `coagent_split_percent`, `agency_split_percent` to `lk_deals`
- [ ] Add `coagent_user_id`, `coagent_phone` to `lk_deals` (or use DealSplitRecipient)
- [ ] Add `client_phone_encrypted`, `client_phone_hash` columns
- [ ] (Optional) Add `client_name_encrypted` column

---

## Testing Checklist

### P0 Tests
- [ ] Create deal via API - no DataError
- [ ] executor_id stored as string in DB
- [ ] Deal appears in list after creation

### P1 Tests
- [ ] Split percentages saved correctly (100% agent, 70/30 split, 50/30/20 split)
- [ ] Co-agent linked via coagent_user_id
- [ ] Co-agent invited via coagent_phone when not found
- [ ] client_phone encrypted in DB
- [ ] client_phone searchable via hash

### P2 Tests
- [ ] Passport validation rejects series-only or number-only
- [ ] Invalid date format returns 400 with clear message
- [ ] Past exclusive_until rejected
- [ ] Long client_name (>255) shows error before submit

### Regression Tests
- [ ] Existing deals still load
- [ ] Deal list pagination works
- [ ] Deal status transitions work
- [ ] Bank-split flow unaffected

---

## Rollout Plan

1. **Hotfix** (today): TASK-001 only - unblocks deal creation
2. **Sprint 1**: TASK-002, TASK-003, TASK-004 - critical functionality
3. **Sprint 2**: TASK-005 through TASK-009 - quality improvements
4. **Backlog**: TASK-010 through TASK-012 - nice-to-have

---

## Notes

- TASK-001 is blocking production - deploy as hotfix
- TASK-004 (phone encryption) may require data migration for existing deals
- Consider feature flag for split functionality until TASK-002, TASK-003 complete
