"""Application configuration"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        """Validate settings based on environment"""
        # Validate APP_ENV
        valid_envs = {"development", "staging", "production"}
        if self.APP_ENV not in valid_envs:
            raise ValueError(f"APP_ENV must be one of {valid_envs}, got '{self.APP_ENV}'")

        # Validate HOUSLER_CRYPTO_KEY length (should be 64 hex chars = 32 bytes)
        if len(self.HOUSLER_CRYPTO_KEY) != 64:
            raise ValueError("HOUSLER_CRYPTO_KEY must be 64 hex characters (32 bytes)")

        # Production-specific validations
        if self.APP_ENV == "production":
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            if self.SMS_TEST_MODE:
                raise ValueError("SMS_TEST_MODE must be False in production")
            if self.EMAIL_TEST_MODE:
                raise ValueError("EMAIL_TEST_MODE must be False in production")
            if "localhost" in self.FRONTEND_URL:
                raise ValueError("FRONTEND_URL cannot contain 'localhost' in production")

        return self

    # Application
    APP_NAME: str = "Housler LK"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = False
    SECRET_KEY: str

    # Frontend URL (for links in emails, SMS, etc.)
    FRONTEND_URL: str = "http://localhost:3000"

    # PII Encryption (152-ФЗ) - housler-crypto library
    # Generate key: python -c "from housler_crypto import HouslerCrypto; print(HouslerCrypto.generate_key())"
    HOUSLER_CRYPTO_KEY: str  # 64 hex chars (32 bytes) for AES-256-GCM

    # Legacy keys (deprecated - kept for migration if needed)
    ENCRYPTION_KEY: str = ""  # Old Fernet key
    ENCRYPTION_SALT: str = ""  # Old Fernet salt

    # Company Info (ООО "Сектор ИТ")
    COMPANY_NAME: str = 'ООО "Сектор ИТ"'
    COMPANY_INN: str = "5190237491"
    COMPANY_KPP: str = "519001001"
    COMPANY_OGRN: str = "1255100001496"
    COMPANY_ADDRESS: str = "183008, Мурманская область, г. Мурманск, ул. Олега Кошевого, д. 6 к. 1, помещ. 1"
    COMPANY_EMAIL: str = "hello@housler.ru"
    COMPANY_PHONE: str = "+7 (800) 555-35-35"

    # Bank Details (для реквизитов в договорах)
    COMPANY_BANK_NAME: str = ""  # Название банка
    COMPANY_BANK_BIK: str = ""  # БИК
    COMPANY_BANK_ACCOUNT: str = ""  # Расчетный счет
    COMPANY_BANK_CORR: str = ""  # Корр. счет

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Redis
    REDIS_URL: str

    # Celery
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # S3/MinIO
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_DOCUMENTS: str = "lk-documents"
    S3_BUCKET_RECEIPTS: str = "lk-receipts"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OTP
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_BLOCK_MINUTES: int = 10

    # SMS (SMS.RU for Housler)
    SMS_PROVIDER: str = "sms_ru"
    SMS_RU_API_ID: str = ""  # SMS.RU API ID
    SMS_TEST_MODE: bool = False  # Test mode: accept 79999xxxxxx phones
    SMS_SENDER_NAME: str = "Housler"

    # Email (Yandex 360 SMTP or SendGrid)
    EMAIL_PROVIDER: str = "mock"  # mock, smtp, or sendgrid
    EMAIL_TEST_MODE: bool = False  # Test mode: use fixed code 123456
    SMTP_HOST: str = "smtp.yandex.ru"
    SMTP_PORT: int = 465  # 465 for SSL, 587 for STARTTLS
    SMTP_USER: str = ""  # email@domain.ru or email@yandex.ru
    SMTP_PASSWORD: str = ""  # App password, not main password!
    SMTP_FROM_EMAIL: str = "noreply@housler.ru"
    SMTP_FROM_NAME: str = "Housler"
    SMTP_USE_SSL: bool = True  # True for port 465
    SMTP_USE_TLS: bool = False  # True for port 587

    # SendGrid (альтернатива если SMTP порты заблокированы)
    SENDGRID_API_KEY: str = ""  # API key from sendgrid.com

    # KYC
    FNS_API_KEY: str = ""
    MVD_API_KEY: str = ""
    ROSFINMONITORING_API_KEY: str = ""

    # Payment
    PAYMENT_PROVIDER: str = "mock"
    PAYMENT_API_KEY: str = ""
    PAYMENT_WEBHOOK_SECRET: str = ""
    PAYMENT_ACQUIRER_FEE_PERCENT: float = 2.0
    PAYMENT_BANK_FEE_PERCENT: float = 0.7
    PAYMENT_PLATFORM_REBATE_PERCENT: float = 1.3

    # Antifraud
    ANTIFRAUD_NEW_AGENT_MAX_DEAL_AMOUNT: int = 50000
    ANTIFRAUD_NEW_AGENT_MAX_MONTHLY_GMV: int = 100000
    ANTIFRAUD_NEW_AGENT_PAYOUT_HOLD_DAYS: int = 3

    # Limits
    MIN_PAYMENT_AMOUNT: int = 10000
    MAX_PAYMENT_AMOUNT: int = 10000000

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # Monitoring
    SENTRY_DSN: str = ""


# Global settings instance
settings = Settings()
