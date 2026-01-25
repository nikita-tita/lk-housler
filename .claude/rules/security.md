# Security Rules - lk.housler.ru

## Mandatory Checks (Before ANY Commit)

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] Environment variables for all sensitive config
- [ ] SQL via ORM only (no string concatenation)
- [ ] No PII in logs (phone, email, passport)
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging for sensitive operations

## Secret Management

```python
# ❌ NEVER: Hardcoded
JWT_SECRET = "my-secret-key"

# ✅ ALWAYS: Environment
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET not configured")
```

## Auth Token Pattern

```python
# ✅ Project uses httpOnly cookies (XSS-safe)
from app.core.security import set_auth_cookies, clear_auth_cookies

# On login
set_auth_cookies(response, access_token, refresh_token)

# On logout
clear_auth_cookies(response)
```

## PII Encryption

```python
# ✅ Always encrypt PII before storage
from app.core.encryption import encrypt_phone, decrypt_phone

encrypted = encrypt_phone(phone)  # For storage
phone = decrypt_phone(encrypted)  # For display
```

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Use **security-reviewer** agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues
