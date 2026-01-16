# Интеграция lk.housler.ru в экосистему Housler ✅

## Что сделано

### 1. SMS.RU реальная интеграция ✅

**Файл:** `backend/app/services/sms/provider.py`

```python
class SMSRuProvider(SMSProvider):
    """SMS.RU provider for Housler ecosystem"""
    
    def __init__(self, api_id: str, test_mode: bool = False):
        self.api_id = api_id
        self.test_mode = test_mode
        self.base_url = "https://sms.ru"
```

**Функционал:**
- ✅ Реальная отправка SMS через SMS.RU API
- ✅ Тестовый режим (телефоны 79999000000-79999999999)
- ✅ Проверка баланса
- ✅ Обработка ошибок

**Конфигурация** (`.env`):
```env
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90
SMS_TEST_MODE=false
```

---

### 2. PII Encryption по 152-ФЗ ✅

**Файл:** `backend/app/core/encryption.py`

**Алгоритм:** AES-256 + SHA-256 для хешей

**Функции:**
```python
encrypt_email(email) -> (encrypted, hash)
decrypt_email(encrypted) -> email

encrypt_phone(phone) -> (encrypted, hash)
decrypt_phone(encrypted) -> phone

encrypt_name(name) -> encrypted
decrypt_name(encrypted) -> name

encrypt_inn(inn) -> (encrypted, hash)
decrypt_inn(encrypted) -> inn
```

**Конфигурация:**
```env
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=64_HEX_CHARS_HERE
```

**Как работает:**
1. **Encrypted** — зашифрованные данные (AES-256), хранятся в БД
2. **Hash** — SHA-256 хеш для поиска (невосстановим)
3. Поиск: `WHERE email_hash = hash(input)` → расшифровка: `decrypt(email_encrypted)`

---

### 3. Обновленные модели User ✅

**Файл:** `backend/app/models/user.py`

**Новые поля:**

```python
class User(BaseModel):
    # Роль (определяет способ авторизации)
    role = Column(Enum(UserRole))  # client, agent, agency_admin
    
    # PII: Encrypted + Hash
    phone_encrypted = Column(Text)
    phone_hash = Column(String(64), index=True)
    
    email_encrypted = Column(Text)
    email_hash = Column(String(64), index=True)
    
    # Password только для agency_admin
    password_hash = Column(String(255))
    
    # Consents
    consents = relationship("UserConsent")
```

**Новые модели:**

```python
class UserRole(Enum):
    CLIENT = "client"           # Email + код
    AGENT = "agent"            # SMS + код
    AGENCY_ADMIN = "agency_admin"  # Email + пароль

class ConsentType(Enum):
    PERSONAL_DATA = "personal_data"    # Обработка ПД
    TERMS = "terms"                     # Пользовательское соглашение
    MARKETING = "marketing"             # Маркетинг
    REALTOR_OFFER = "realtor_offer"    # Оферта риелтора
    AGENCY_OFFER = "agency_offer"      # Оферта агентства

class UserConsent(BaseModel):
    user_id = Column(UUID, ForeignKey("users.id"))
    consent_type = Column(Enum(ConsentType))
    granted = Column(Boolean)
    granted_at = Column(DateTime)
    ip_address = Column(String(45))  # Audit
    user_agent = Column(Text)        # Audit
```

---

### 4. Конфигурация Housler ✅

**Файл:** `backend/app/core/config.py`

**Добавлено:**

```python
# Application
APP_NAME: str = "Housler LK"

# PII Encryption
ENCRYPTION_KEY: str  # Required

# SMS.RU
SMS_PROVIDER: str = "sms_ru"
SMS_RU_API_ID: str
SMS_TEST_MODE: bool = False

# Company (ООО "Сектор ИТ")
COMPANY_NAME: str = 'ООО "Сектор ИТ"'
COMPANY_INN: str = "5190237491"
COMPANY_KPP: str = "519001001"
COMPANY_OGRN: str = "1255100001496"
COMPANY_ADDRESS: str = "183008, Мурманская область, г. Мурманск..."
COMPANY_EMAIL: str = "hello@housler.ru"
```

---

### 5. Nginx конфигурации ✅

**Внешний:** `nginx/lk.housler.ru.conf`
- SSL через Let's Encrypt
- Proxy на 127.0.0.1:3090
- Security headers
- Gzip compression

**Docker:** `nginx/nginx.conf`
- Rate limiting (10 req/s для API, 1 req/s для auth)
- Backend + Frontend routing
- WebSocket support

---

### 6. Production Docker Compose ✅

**Файл:** `docker-compose.prod.yml`

**Сервисы:**
- PostgreSQL 15
- Redis 7
- MinIO (S3)
- Backend (FastAPI)
- Frontend (Next.js) — готов к раскомментированию
- Nginx (reverse proxy)

**Порты:**
- Внутри: 80 (nginx)
- Наружу: 127.0.0.1:3090 (для внешнего Nginx)

---

## Что нужно сделать перед деплоем

### 1. Создать .env на сервере

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221

cd /var/www/lk.housler.ru

cat > .env << 'EOF'
# Database
DB_NAME=lk_housler
DB_USER=lk_user
DB_PASSWORD=$(openssl rand -base64 32)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# PII Encryption
ENCRYPTION_KEY=$(openssl rand -hex 32)

# SMS.RU
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90
SMS_TEST_MODE=false

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)
EOF
```

### 2. Миграция БД

Создать первую миграцию с новыми полями:

```bash
cd /var/www/lk.housler.ru
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic revision --autogenerate -m "Housler integration: encryption, consents, roles"
  
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head
```

### 3. Настроить Nginx

```bash
# Скопировать конфиг
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/lk.housler.ru.conf /etc/nginx/sites-enabled/

# Проверить
nginx -t

# Применить
systemctl reload nginx
```

### 4. Получить SSL

```bash
certbot --nginx -d lk.housler.ru
```

### 5. Запустить Docker

```bash
cd /var/www/lk.housler.ru
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Способы авторизации (3 типа)

### 1. Клиенты: Email + код

```
POST /api/auth/request-code
{ email: "client@example.com" }

→ Код на email

POST /api/auth/verify-code
{ email: "client@example.com", code: "123456" }

→ { access_token, refresh_token }
```

**UserRole:** `CLIENT`

---

### 2. Риелторы: SMS + код

```
POST /api/auth/request-sms
{ phone: "+79001234567" }

→ SMS через SMS.RU

POST /api/auth/verify-sms
{ phone: "+79001234567", code: "123456" }

→ { access_token, refresh_token }
```

**UserRole:** `AGENT`

---

### 3. Агентства: Email + пароль

```
POST /api/auth/login-agency
{ email: "admin@agency.ru", password: "password" }

→ { access_token, refresh_token }
```

**UserRole:** `AGENCY_ADMIN`

---

## Миграция данных

При переходе с plain полей на encrypted:

```python
# Migration script (псевдокод)
from app.core.encryption import encrypt_email, encrypt_phone, encrypt_inn

for user in users:
    if user.email and not user.email_encrypted:
        enc, hash = encrypt_email(user.email)
        user.email_encrypted = enc
        user.email_hash = hash
    
    if user.phone and not user.phone_encrypted:
        enc, hash = encrypt_phone(user.phone)
        user.phone_encrypted = enc
        user.phone_hash = hash
```

---

## Тестирование

### Проверить SMS.RU

```bash
curl "https://sms.ru/my/balance?api_id=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90"
```

### Тестовые телефоны

```
79999000000 → код 111111
79999111111 → код 222222
...
79999555555 → код 666666
```

### Тестовая регистрация

```bash
# 1. Запросить код
curl -X POST https://lk.housler.ru/api/auth/request-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999000000"}'

# 2. Верифицировать (любой из кодов 111111-666666)
curl -X POST https://lk.housler.ru/api/auth/verify-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999000000", "code": "111111"}'

# 3. Получить токен
# → { "access_token": "...", "refresh_token": "..." }
```

---

## Что дальше

### TODO: Адаптация авторизации (в процессе)

- [ ] Email + код для клиентов
- [ ] SMS + код для риелторов (уже есть OTP)
- [ ] Email + пароль для агентств
- [ ] Регистрация с consent types

### TODO: Frontend

- [ ] Agent Console (Next.js)
- [ ] Client Portal
- [ ] Agency Admin

### TODO: Документы

- [ ] `/doc` страницы с политиками
- [ ] Оферты для риелторов/агентств

---

## Контрольный чеклист

**Backend:**
- ✅ SMS.RU интеграция
- ✅ PII encryption (152-ФЗ)
- ✅ Consent types модели
- ✅ UserRole (client, agent, agency_admin)
- ✅ Конфигурация Housler
- ✅ ООО "Сектор ИТ" реквизиты
- ⏳ 3 способа авторизации (в процессе)

**DevOps:**
- ✅ docker-compose.prod.yml
- ✅ nginx/lk.housler.ru.conf
- ✅ nginx/nginx.conf (внутренний)
- ✅ Порт 3090 для lk.housler.ru
- ✅ Health checks
- ✅ Security headers

**Документация:**
- ✅ HOUSLER_ECOSYSTEM.md
- ✅ CLAUDE.md
- ✅ HOUSLER_INTEGRATION.md (этот файл)

---

**Статус:** Backend готов к деплою, требуется адаптация авторизации и создание Frontend.

**Дата:** 23 декабря 2025

