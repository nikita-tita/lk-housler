---
description: Run code review on recent changes
---

# /code-review Command

Invokes **code-reviewer** agent to review code quality.

## What It Checks

### CRITICAL (Block)
- Hardcoded secrets
- SQL injection risks
- PII in logs
- Missing type hints

### HIGH (Fix before merge)
- Missing tests
- No error handling
- console.log statements

### MEDIUM (Should fix)
- Long functions (>50 lines)
- Deep nesting
- Poor naming

## Usage

```
/code-review           # Review recent changes
/code-review auth.py   # Review specific file
```

## Workflow

1. Run `git diff` to see changes
2. Analyze against project patterns
3. Report issues by severity
4. Suggest fixes with examples

## Output Format

```markdown
## Code Review

### CRITICAL
- **Secret found** @ `config.py:42`

### HIGH
- **Missing tests** @ `api/deals.py`

### MEDIUM
- **Long function** @ `utils.py:156` (80 lines)

**Decision:** BLOCK / APPROVE WITH CHANGES / APPROVE
```
