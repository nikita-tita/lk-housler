---
name: tdd-guide
description: Test-driven development enforcer for FastAPI (pytest) + Next.js (jest). Write tests FIRST, then implement.
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# TDD Guide - lk.housler.ru

Enforce test-driven development for FastAPI backend + Next.js frontend.

## TDD Cycle

```
RED → GREEN → REFACTOR

1. RED:      Write failing test
2. GREEN:    Minimal implementation to pass
3. REFACTOR: Improve while keeping tests green
```

## Backend (FastAPI + pytest)

### Step 1: Define Schema (Pydantic)
```python
# app/schemas/deal.py
class DealCreate(BaseModel):
    client_phone: str
    property_address: str
    price: Decimal
```

### Step 2: Write Failing Test (RED)
```python
# tests/test_deals.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_deal(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/deals",
        json={
            "client_phone": "79991234567",
            "property_address": "Москва, ул. Тестовая, 1",
            "price": "5000000.00"
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["client_phone"] == "79991234567"
```

### Step 3: Run Test - Verify FAIL
```bash
cd backend && python -m pytest tests/test_deals.py -v
# FAILED - endpoint not implemented
```

### Step 4: Implement (GREEN)
```python
# app/api/v1/deals.py
@router.post("/", status_code=201, response_model=DealResponse)
async def create_deal(
    deal: DealCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_deal = Deal(**deal.model_dump(), agent_id=current_user.id)
    session.add(db_deal)
    await session.commit()
    return db_deal
```

### Step 5: Run Test - Verify PASS
```bash
python -m pytest tests/test_deals.py -v
# PASSED
```

## Frontend (Next.js + Jest)

### Test Component
```typescript
// __tests__/DealCard.test.tsx
import { render, screen } from '@testing-library/react'
import { DealCard } from '@/components/DealCard'

describe('DealCard', () => {
  it('displays deal info', () => {
    const deal = {
      id: '1',
      clientPhone: '79991234567',
      propertyAddress: 'Москва, ул. Тестовая, 1',
      price: 5000000
    }

    render(<DealCard deal={deal} />)

    expect(screen.getByText('Москва, ул. Тестовая, 1')).toBeInTheDocument()
    expect(screen.getByText('5 000 000 ₽')).toBeInTheDocument()
  })
})
```

### Run Frontend Tests
```bash
cd apps/lk && npm test
```

## Coverage Requirements

| Area | Target |
|------|--------|
| Backend API | 80% |
| Core security | 100% |
| Frontend components | 70% |
| Critical flows | 100% |

## Test Fixtures

### Backend
```python
# conftest.py
@pytest.fixture
async def auth_headers(client: AsyncClient):
    # Login with test credentials
    response = await client.post("/api/v1/auth/send-code", json={"phone": "79999000000"})
    response = await client.post("/api/v1/auth/verify-code", json={"phone": "79999000000", "code": "123456"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

## Commands
```bash
# Backend tests with coverage
cd backend && python -m pytest --cov=app --cov-report=term-missing

# Frontend tests
cd apps/lk && npm test -- --coverage

# Single test file
python -m pytest tests/test_auth.py -v
```
