# Development Guide

lk.housler.ru Backend Development

---

## Prerequisites

- Python 3.11+
- Docker & Docker Compose
- Git

---

## Quick Start

```bash
# 1. Clone repository
git clone git@github.com:housler/lk-housler.git && cd lk-housler

# 2. Setup environment
cp .env.example .env.local

# 3. Start infrastructure
docker-compose up -d postgres redis minio

# 4. Install dependencies & run migrations
cd backend && pip install -r requirements.txt && alembic upgrade head

# 5. Start development server
uvicorn app.main:app --reload --port 8000
```

---

## Environment Setup

### 1. Clone & Setup

```bash
git clone git@github.com:housler/lk-housler.git
cd lk-housler
cp .env.example .env.local
```

### 2. Environment Variables

Required variables (store sensitive values in 1Password):

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | App secret key | `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection (async) | `postgresql+asyncpg://user:pass@localhost:5432/lk_db` |
| `DATABASE_URL_SYNC` | PostgreSQL connection (sync) | `postgresql://user:pass@localhost:5432/lk_db` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | JWT signing key | `openssl rand -base64 32` |
| `HOUSLER_CRYPTO_KEY` | PII encryption (64 hex chars) | See generation below |
| `S3_ENDPOINT` | MinIO endpoint | `localhost:9000` |
| `S3_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `S3_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `CELERY_BROKER_URL` | Celery broker | `redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND` | Celery backend | `redis://localhost:6379/2` |

**Generate HOUSLER_CRYPTO_KEY:**

```bash
python -c "from housler_crypto import HouslerCrypto; print(HouslerCrypto.generate_key())"
```

**Local development .env.local example:**

```env
APP_ENV=development
DEBUG=true
SECRET_KEY=dev-secret-key-change-in-prod

DATABASE_URL=postgresql+asyncpg://lk_user:lk_password@localhost:5432/lk_db
DATABASE_URL_SYNC=postgresql://lk_user:lk_password@localhost:5432/lk_db
REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=dev-jwt-secret-change-in-prod
HOUSLER_CRYPTO_KEY=0000000000000000000000000000000000000000000000000000000000000000

S3_ENDPOINT=localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

SMS_TEST_MODE=true
EMAIL_PROVIDER=mock
```

### 3. Docker Services

```bash
# Start all infrastructure
docker-compose up -d postgres redis minio

# Or start everything including backend
docker-compose up -d
```

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL 15 database |
| redis | 6379 | Redis 7 cache & queue |
| minio | 9000, 9001 | S3-compatible storage |
| backend | 8001 | FastAPI (in Docker) |
| celery-worker | - | Background tasks |
| celery-beat | - | Scheduled tasks |

**MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)

### 4. Backend (Local Development)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

### 5. Celery (Background Tasks)

```bash
# In separate terminal, from backend directory
cd backend

# Start worker (default + bank_split + payouts queues)
celery -A app.tasks.celery_app worker --loglevel=info -Q default,bank_split,payouts

# Start beat scheduler (periodic tasks)
celery -A app.tasks.celery_app beat --loglevel=info
```

---

## Database

### Migrations

```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply all migrations
alembic upgrade head

# Apply specific migration
alembic upgrade +1

# Rollback one migration
alembic downgrade -1

# Rollback all
alembic downgrade base

# Show current revision
alembic current

# Show migration history
alembic history
```

### Direct Database Access

```bash
# Via Docker
docker exec -it lk_postgres psql -U lk_user -d lk_db

# Or using psql directly
psql postgresql://lk_user:lk_password@localhost:5432/lk_db
```

### Test Accounts

Test mode enabled when `SMS_TEST_MODE=true`:

- **Test phones:** 79999000000 - 79999999999
- **Test codes:** 111111, 222222, 333333, 444444, 555555, 666666
- **Test emails:** *@test.housler.ru

---

## Testing

```bash
cd backend

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=app

# Run with coverage report
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_health.py

# Run specific test function
pytest tests/test_health.py::test_root_endpoint

# Run tests matching pattern
pytest -k "health"
```

---

## API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

---

## Project Structure

```
backend/
├── alembic/              # Database migrations
│   └── versions/         # Migration files
├── app/
│   ├── api/              # API endpoints
│   │   └── v1/
│   │       └── endpoints/
│   ├── core/             # Config, security, errors
│   ├── db/               # Database connection
│   ├── integrations/     # External services (T-Bank, etc.)
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── tasks/            # Celery tasks
│   └── main.py           # FastAPI application
├── tests/                # Test files
├── Dockerfile
├── requirements.txt
└── pytest.ini
```

---

## Common Issues

### Issue: Database connection refused

**Symptoms:**
```
psycopg2.OperationalError: connection refused
```

**Solutions:**
1. Ensure PostgreSQL container is running:
   ```bash
   docker-compose up -d postgres
   docker-compose ps  # Check status
   ```
2. Wait for health check to pass:
   ```bash
   docker-compose logs postgres
   ```
3. Verify port 5432 is not used by another service:
   ```bash
   lsof -i :5432
   ```

### Issue: Redis connection error

**Symptoms:**
```
redis.exceptions.ConnectionError: Error connecting to localhost:6379
```

**Solutions:**
1. Ensure Redis container is running:
   ```bash
   docker-compose up -d redis
   ```
2. Check Redis logs:
   ```bash
   docker-compose logs redis
   ```
3. Test connection:
   ```bash
   redis-cli ping  # Should return PONG
   ```

### Issue: MinIO bucket not found

**Symptoms:**
```
botocore.exceptions.NoSuchBucket
```

**Solutions:**
1. Access MinIO console: http://localhost:9001
2. Create required buckets: `lk-documents`, `lk-receipts`
3. Or create via CLI:
   ```bash
   docker exec lk_minio mc alias set local http://localhost:9000 minioadmin minioadmin
   docker exec lk_minio mc mb local/lk-documents
   docker exec lk_minio mc mb local/lk-receipts
   ```

### Issue: Alembic "Target database is not up to date"

**Solutions:**
```bash
# Check current state
alembic current

# Apply all pending migrations
alembic upgrade head

# If conflicts, stamp current version
alembic stamp head
```

### Issue: housler-crypto not installed

**Symptoms:**
```
ModuleNotFoundError: No module named 'housler_crypto'
```

**Solutions:**
```bash
# Install from git (if not on PyPI)
pip install git+https://github.com/housler/housler-crypto.git

# Or add to requirements.txt and reinstall
pip install -r requirements.txt
```

### Issue: HOUSLER_CRYPTO_KEY validation error

**Symptoms:**
```
ValueError: HOUSLER_CRYPTO_KEY must be 64 hex characters (32 bytes)
```

**Solutions:**
Generate valid key:
```bash
python -c "from housler_crypto import HouslerCrypto; print(HouslerCrypto.generate_key())"
```
Or use 64 zeros for development: `0000000000000000000000000000000000000000000000000000000000000000`

---

## IDE Setup

### VS Code

**Recommended extensions:**

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "ms-python.flake8",
    "charliermarsh.ruff",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg"
  ]
}
```

**settings.json:**

```json
{
  "python.defaultInterpreterPath": "./backend/venv/bin/python",
  "python.analysis.typeCheckingMode": "basic",
  "[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "black-formatter.args": ["--line-length", "120"]
}
```

### PyCharm

1. **Project Interpreter:** Set to `backend/venv/bin/python`
2. **Source Root:** Mark `backend` as Sources Root
3. **Database:** Add PostgreSQL connection (localhost:5432, lk_user/lk_password, lk_db)
4. **Run Configuration:**
   - Script: `uvicorn`
   - Parameters: `app.main:app --reload --port 8000`
   - Working directory: `backend`
   - Environment: Load from `.env.local`

---

## Code Quality

```bash
cd backend

# Format code with Black
black .

# Lint with flake8
flake8 app/

# Type check with mypy
mypy app/
```

---

## Useful Commands

```bash
# View container logs
docker-compose logs -f backend
docker-compose logs -f celery-worker

# Restart specific service
docker-compose restart backend

# Rebuild containers
docker-compose up -d --build

# Clean up everything
docker-compose down -v  # Warning: removes volumes!

# Check API health
curl http://localhost:8000/health | jq
```

---

## Related Documentation

- [Unified Auth](./UNIFIED_AUTH.md) - Authentication system
- [Contract Templates](./CONTRACT_TEMPLATES_SPEC.md) - Template specification
- [Auth Specification](./AUTH_SPECIFICATION.md) - Auth flow details
- [CLAUDE.md](../CLAUDE.md) - Project conventions
