---
description: Start TDD workflow - write tests first, then implement
---

# /tdd Command

Invokes **tdd-guide** agent for test-driven development.

## Workflow

1. **Define schemas** (Pydantic/TypeScript interfaces)
2. **Write failing test** (RED)
3. **Run test** - verify it fails
4. **Implement** minimal code (GREEN)
5. **Run test** - verify it passes
6. **Refactor** (IMPROVE)
7. **Check coverage** (80%+)

## Usage

```
/tdd I need an endpoint to create a new deal
/tdd Add a component for deal status badge
/tdd Fix the login validation bug
```

## Backend Example

```python
# 1. Schema
class DealCreate(BaseModel):
    client_phone: str
    property_address: str

# 2. Test (RED)
@pytest.mark.asyncio
async def test_create_deal(client, auth_headers):
    response = await client.post(
        "/api/v1/deals",
        json={"client_phone": "79991234567", "property_address": "Address"},
        headers=auth_headers
    )
    assert response.status_code == 201

# 3. Run - FAIL
# 4. Implement
# 5. Run - PASS
# 6. Refactor
# 7. Coverage check
```

## Commands

```bash
# Backend
cd backend && python -m pytest --cov=app -v

# Frontend
cd apps/lk && npm test -- --coverage
```
