---
description: Fix build and type errors
---

# /build-fix Command

Invokes **build-error-resolver** agent to fix build failures.

## Usage

```
/build-fix                    # Fix any build errors
/build-fix TypeError in auth  # Fix specific error
```

## Workflow

1. Read error output carefully
2. Identify error type and location
3. Fix root cause (not symptoms)
4. Verify with rebuild

## Common Fixes

### TypeScript
```bash
# Module not found
→ npm install, check tsconfig paths

# Type error
→ Fix type assignment, add proper types
```

### Python
```bash
# Import error
→ Check circular imports

# Pydantic validation
→ Check schema definitions
```

## Commands

```bash
# Frontend
cd apps/lk && npm run build
cd apps/lk && npx tsc --noEmit

# Backend
cd backend && python -m mypy app/
cd backend && python -c "from app.main import app"
```
