---
name: fastapi-patterns
description: FastAPI backend patterns for lk.housler.ru - async SQLAlchemy, Pydantic, security
---

# FastAPI Patterns - lk.housler.ru

## Project Structure

```
backend/
├── app/
│   ├── api/v1/          # API routes
│   ├── core/            # Security, config, utils
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   └── services/        # Business logic
├── alembic/             # Migrations
└── tests/               # pytest
```

## Authentication Pattern

```python
# httpOnly Cookies (XSS-safe)
from app.core.security import set_auth_cookies, clear_auth_cookies, get_token_from_request

# Login - set cookies
response = JSONResponse(content={"message": "success"})
set_auth_cookies(response, access_token, refresh_token)
return response

# Get token from request (works with cookies + header)
token = get_token_from_request(request)

# Logout - clear cookies
response = JSONResponse(content={"message": "logged out"})
clear_auth_cookies(response)
return response
```

## Rate Limiting

```python
# Async function, NOT decorator
from app.core.rate_limit import rate_limit_otp_send

@router.post("/send-code")
async def send_code(request: Request, data: SendCodeRequest):
    await rate_limit_otp_send(request, phone=data.phone)  # 3/min per phone
    # ... send OTP
```

## PII Encryption

```python
from app.core.encryption import encrypt_phone, decrypt_phone

# Store encrypted
user.phone_encrypted = encrypt_phone(phone)

# Display decrypted
phone = decrypt_phone(user.phone_encrypted)
```

## Audit Logging

```python
from app.core.audit import log_audit_event, AuditEvent

log_audit_event(
    AuditEvent.LOGIN_SUCCESS,
    user_id=str(user.id),
    ip_address=request.client.host,
    details={"method": "otp"}
)
```

## API Endpoint Pattern

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/deals", tags=["deals"])

@router.post("/", status_code=201, response_model=DealResponse)
async def create_deal(
    deal: DealCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new deal."""
    db_deal = Deal(**deal.model_dump(), agent_id=current_user.id)
    session.add(db_deal)
    await session.commit()
    await session.refresh(db_deal)
    return db_deal
```

## Pydantic Schemas

```python
from pydantic import BaseModel, Field
from uuid import UUID
from decimal import Decimal

class DealCreate(BaseModel):
    client_phone: str = Field(..., pattern=r"^7\d{10}$")
    property_address: str
    price: Decimal = Field(..., gt=0)

class DealResponse(BaseModel):
    id: UUID
    client_phone: str
    status: DealStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

## SQLAlchemy Async Queries

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Get by ID
result = await session.execute(select(Deal).where(Deal.id == deal_id))
deal = result.scalar_one_or_none()

# List with filter
result = await session.execute(
    select(Deal)
    .where(Deal.agent_id == agent_id)
    .order_by(Deal.created_at.desc())
    .limit(20)
)
deals = result.scalars().all()
```

## Error Handling

```python
from fastapi import HTTPException

# Validation error
raise HTTPException(status_code=400, detail="Invalid phone format")

# Not found
raise HTTPException(status_code=404, detail="Deal not found")

# Forbidden
raise HTTPException(status_code=403, detail="Access denied")

# Rate limit
raise HTTPException(status_code=429, detail="Too many requests")
```

## Datetime Handling (Python 3.12+)

```python
from app.core.security import utc_now

# Use instead of datetime.utcnow()
now = utc_now()
expires_at = utc_now() + timedelta(hours=1)
```
