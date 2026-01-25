---
name: security-checklist
description: Security checklist for lk.housler.ru - comprehensive security review guide
---

# Security Checklist - lk.housler.ru

## Pre-Commit Checklist

### CRITICAL (Must pass)

- [ ] **No hardcoded secrets** - All secrets in .env
  ```bash
  grep -rn "api[_-]?key\|password\|secret\|JWT_SECRET" --include="*.py" --include="*.ts" .
  ```

- [ ] **SQL via ORM only** - No string concatenation
  ```bash
  grep -rn "execute.*f\"" backend/
  grep -rn "execute.*%" backend/
  ```

- [ ] **No PII in logs** - Phone, email, passport encrypted
  ```bash
  grep -rn "logger.*phone\|logger.*email\|print.*phone" backend/
  ```

- [ ] **Rate limiting on auth** - OTP endpoints protected
  ```python
  await rate_limit_otp_send(request, phone=phone)
  ```

### HIGH (Should fix)

- [ ] **httpOnly cookies** - Tokens not in localStorage
  ```python
  set_auth_cookies(response, access_token, refresh_token)
  ```

- [ ] **Input validation** - Pydantic schemas for all I/O
  ```python
  class SendCodeRequest(BaseModel):
      phone: str = Field(..., pattern=r"^7\d{10}$")
  ```

- [ ] **Audit logging** - Sensitive operations logged
  ```python
  log_audit_event(AuditEvent.LOGIN_SUCCESS, user_id=str(id))
  ```

- [ ] **Error messages** - No internal details leaked
  ```python
  # Bad: detail=str(e)
  # Good: detail="Invalid credentials"
  ```

### MEDIUM (Consider)

- [ ] **CORS restricted** - Only allowed origins
- [ ] **Security headers** - CSP, X-Frame-Options set
- [ ] **API docs disabled** - In production mode
- [ ] **Dependencies audited** - No known vulnerabilities

## Project-Specific Rules

### Auth Flow
```
1. Client sends phone → /auth/send-code
2. Rate limiting checked (3/min/phone)
3. OTP generated and sent via SMS.RU
4. Client verifies → /auth/verify-code
5. httpOnly cookies set with tokens
6. Token blacklist checked on each request
```

### Token Management
- Access token: 15 min
- Refresh token: 7 days
- Token blacklist in Redis
- httpOnly cookies (XSS protection)

### PII Handling
```python
# Always encrypt before storage
from app.core.encryption import encrypt_phone

user.phone_encrypted = encrypt_phone(phone)

# Never log raw PII
logger.info(f"User login: user_id={user.id}")  # OK
logger.info(f"User login: phone={phone}")  # WRONG!
```

## Security Commands

```bash
# Check for secrets
grep -rn "api[_-]?key\|password\|secret" --include="*.py" .

# Check SQL injection risks
grep -rn "execute.*f\"" backend/

# Check localStorage usage (frontend)
grep -rn "localStorage.*token" apps/

# Dependency audit
cd backend && pip audit
cd apps/lk && npm audit
```

## Response Protocol

If security issue found:
1. **STOP** - Don't commit
2. **Document** - Note file:line and severity
3. **Fix** - Apply secure pattern
4. **Verify** - Re-run security checks
5. **Review** - Use security-reviewer agent
