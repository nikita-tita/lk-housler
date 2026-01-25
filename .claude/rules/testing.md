# Testing Rules - lk.housler.ru

## Minimum Coverage: 80%

## Test Types Required

1. **Unit Tests** - Functions, utilities, components
2. **Integration Tests** - API endpoints, database ops
3. **E2E Tests** - Critical user flows

## TDD Workflow (Mandatory)

```
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)
```

## Backend Testing (pytest)

```python
# tests/test_auth.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # Send OTP
    response = await client.post(
        "/api/v1/auth/send-code",
        json={"phone": "79999000000"}
    )
    assert response.status_code == 200

    # Verify OTP (test mode: 123456)
    response = await client.post(
        "/api/v1/auth/verify-code",
        json={"phone": "79999000000", "code": "123456"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
```

## Frontend Testing (Jest)

```typescript
// __tests__/LoginForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import LoginForm from '@/components/LoginForm'

test('submits phone number', async () => {
  render(<LoginForm />)

  const input = screen.getByPlaceholderText(/телефон/i)
  fireEvent.change(input, { target: { value: '79991234567' } })

  const button = screen.getByRole('button', { name: /получить код/i })
  fireEvent.click(button)

  // Assert loading state
  expect(screen.getByText(/отправка/i)).toBeInTheDocument()
})
```

## Commands

```bash
# Backend
cd backend && python -m pytest --cov=app --cov-report=term-missing

# Frontend
cd apps/lk && npm test -- --coverage

# Single file
python -m pytest tests/test_auth.py -v
```

## Agent Support

- **tdd-guide** - Enforce write-tests-first workflow
- **code-reviewer** - Verify test coverage
