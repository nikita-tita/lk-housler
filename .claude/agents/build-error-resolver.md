---
name: build-error-resolver
description: Fix build and type errors for FastAPI + Next.js. Use when build fails or TypeScript/Python type errors occur.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

# Build Error Resolver - lk.housler.ru

Fix build errors for FastAPI backend and Next.js frontend.

## Workflow

1. Read error output carefully
2. Identify error type and location
3. Fix the root cause (not symptoms)
4. Verify fix with rebuild

## Common Errors

### TypeScript / Next.js

```bash
# Type error
Type 'string' is not assignable to type 'number'
→ Check type definitions, fix assignment

# Module not found
Cannot find module '@housler/lib'
→ Run: npm install in root, check tsconfig paths

# Build error
→ Run: cd apps/lk && npm run build
```

### Python / FastAPI

```bash
# Import error
ImportError: cannot import name 'X' from 'Y'
→ Check circular imports, verify module exists

# Type error (mypy)
error: Incompatible types
→ Add proper type hints

# Pydantic validation
ValidationError: field required
→ Check schema definitions
```

## Debug Commands

```bash
# Frontend build
cd apps/lk && npm run build
cd apps/lk && npx tsc --noEmit

# Backend
cd backend && python -m mypy app/
cd backend && python -m pytest -x  # Stop on first failure

# Check imports
cd backend && python -c "from app.main import app"
```

## Fix Strategy

1. **Read error** - Understand what's failing
2. **Locate** - Find exact file:line
3. **Root cause** - Why is it failing?
4. **Fix** - Minimal change to resolve
5. **Verify** - Rebuild to confirm
