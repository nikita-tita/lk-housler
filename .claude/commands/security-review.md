---
description: Run security analysis on code
---

# /security-review Command

Invokes **security-reviewer** agent for vulnerability detection.

## Usage

```
/security-review              # Review recent changes
/security-review auth.py      # Review specific file
/security-review --full       # Full codebase scan
```

## What It Checks

### CRITICAL
- Hardcoded secrets
- SQL injection
- Command injection
- Exposed PII

### HIGH
- Missing rate limiting
- Weak auth patterns
- XSS vulnerabilities

### MEDIUM
- Insufficient logging
- Missing input validation

## Project-Specific Checks

```python
# Auth must use httpOnly cookies
from app.core.security import set_auth_cookies

# PII must be encrypted
from app.core.encryption import encrypt_phone

# Rate limiting required
from app.core.rate_limit import rate_limit_otp_send
```

## Commands

```bash
# Check for secrets
grep -rn "api[_-]?key\|password\|secret" --include="*.py" .

# Check for SQL injection
grep -rn "execute.*f\"" backend/

# Dependency audit
cd backend && pip audit
cd apps/lk && npm audit
```

## Report Format

```markdown
## Security Review

**Risk Level:** CRITICAL / HIGH / MEDIUM / LOW

### Issues
1. **[SEVERITY]** [Description] @ `file:line`
   - Impact: [what could happen]
   - Fix: [code example]
```
