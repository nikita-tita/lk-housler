# Coding Style - lk.housler.ru

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- 200-400 lines typical
- 800 lines max
- High cohesion, low coupling
- Organize by feature/domain

## Backend (Python/FastAPI)

### Type Hints Required
```python
# ✅ Correct
async def get_deal(deal_id: UUID, session: AsyncSession) -> Deal | None:
    ...

# ❌ Wrong
async def get_deal(deal_id, session):
    ...
```

### Pydantic for I/O
```python
# ✅ All API endpoints use Pydantic schemas
class DealCreate(BaseModel):
    client_phone: str
    property_address: str

class DealResponse(BaseModel):
    id: UUID
    client_phone: str
    status: DealStatus
```

### Error Handling
```python
try:
    result = await risky_operation()
    return result
except SpecificError as e:
    logger.error(f"Operation failed: {e}")  # No PII!
    raise HTTPException(status_code=400, detail="User-friendly message")
```

## Frontend (TypeScript/Next.js)

### No `any` Type
```typescript
// ✅ Correct
interface Deal {
  id: string
  clientPhone: string
  status: DealStatus
}

// ❌ Wrong
const deals: any[] = []
```

### Loading/Error States
```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

if (isLoading) return <Spinner />
if (error) return <ErrorMessage message={error} />
```

### UI Rules
- Only black & white (no colors!)
- Use @housler/ui components
- Responsive design required

## Code Quality Checklist

- [ ] Functions < 50 lines
- [ ] No deep nesting (>4 levels)
- [ ] Proper naming (no x, tmp, data)
- [ ] No console.log in production
- [ ] No hardcoded values (use constants)
