"""Application configuration"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    APP_NAME: str = "Housler LK"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str
    
    # PII Encryption (152-ФЗ)
    ENCRYPTION_KEY: str  # 32 bytes hex key for AES-256
    ENCRYPTION_SALT: str = "housler_salt_v1"  # Salt for key derivation (change in production!)
    
    # Company Info (ООО "Сектор ИТ")
    COMPANY_NAME: str = 'ООО "Сектор ИТ"'
    COMPANY_INN: str = "5190237491"
    COMPANY_KPP: str = "519001001"
    COMPANY_OGRN: str = "1255100001496"
    COMPANY_ADDRESS: str = "183008, Мурманская область, г. Мурманск, ул. Олега Кошевого, д. 6 к. 1, помещ. 1"
    COMPANY_EMAIL: str = "hello@housler.ru"
    COMPANY_PHONE: str = "+7 (800) 555-35-35"

    # Bank Details (для реквизитов в договорах)
    COMPANY_BANK_NAME: str = ""       # Название банка
    COMPANY_BANK_BIK: str = ""        # БИК
    COMPANY_BANK_ACCOUNT: str = ""    # Расчетный счет
    COMPANY_BANK_CORR: str = ""       # Корр. счет

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

