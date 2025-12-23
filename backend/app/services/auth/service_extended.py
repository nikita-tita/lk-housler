"""Extended Auth service with 3 auth types for Housler"""

from datetime import datetime, timedelta
from typing import Tuple, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password
)
from app.core.encryption import encrypt_email, encrypt_phone, encrypt_name, encrypt_inn
from app.models.user import User, UserStatus, UserRole, UserProfile, UserConsent, ConsentType
from app.services.auth.otp import OTPService
from app.services.sms.provider import get_sms_provider
from app.services.email.provider import get_email_provider, send_otp_email
from app.services.user.service import UserService
from app.schemas.auth import ConsentInput


class AuthServiceExtended:
    """Extended authentication service for Housler (3 auth types)"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
        self.otp_service = OTPService(db, get_sms_provider())
    
    # ==========================================
    # 1. SMS Auth (Agents) - Риелторы
    # ==========================================
    
    async def send_sms_otp(self, phone: str) -> None:
        """Send SMS OTP for agent login/registration"""
        await self.otp_service.send_otp(phone, "login")
    
    async def verify_sms_otp(
        self,
        phone: str,
        code: str
    ) -> Tuple[User, str, str]:
        """Verify SMS OTP and login/register agent"""
        # Verify OTP
        verified = await self.otp_service.verify_otp(phone, code, "login")
        
        if not verified:
            raise ValueError("Invalid OTP code")
        
        # Get or create user
        user = await self._get_user_by_phone(phone)
        
        if not user:
            # Create new agent
            phone_enc, phone_hash = encrypt_phone(phone)
            user = User(
                phone=phone,  # Plain (deprecated, for compatibility)
                phone_encrypted=phone_enc,
                phone_hash=phone_hash,
                role=UserRole.AGENT,
                status=UserStatus.ACTIVE,
                last_login_at=datetime.utcnow()
            )
            self.db.add(user)
            await self.db.flush()
            await self.db.refresh(user)
        else:
            # Update last login
            user.last_login_at = datetime.utcnow()
            await self.db.flush()
        
        # Generate tokens
        tokens = self._generate_tokens(user)
        return user, tokens[0], tokens[1]
    
    # ==========================================
    # 2. Email Auth (Clients) - Клиенты
    # ==========================================
    
    async def send_email_otp(self, email: str) -> None:
        """Send Email OTP for client login/registration"""
        # Generate OTP (fixed code in test mode)
        from app.core.security import generate_otp
        if settings.EMAIL_TEST_MODE or settings.EMAIL_PROVIDER == "mock":
            code = "123456"
        else:
            code = generate_otp(settings.OTP_LENGTH)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        
        # Store in OTPSession (reuse phone field for email)
        from app.models.user import OTPSession
        session = OTPSession(
            phone=email,  # Используем поле phone для email (оба уникальны)
            code=code,
            purpose="email_login",
            expires_at=expires_at
        )
        self.db.add(session)
        await self.db.flush()
        
        # Send email
        await send_otp_email(email, code)
    
    async def verify_email_otp(
        self,
        email: str,
        code: str
    ) -> Tuple[User, str, str]:
        """Verify Email OTP and login/register client"""
        # Verify OTP
        verified = await self.otp_service.verify_otp(email, code, "email_login")
        
        if not verified:
            raise ValueError("Invalid OTP code")
        
        # Get or create user
        user = await self._get_user_by_email(email)
        
        if not user:
            # Create new client
            email_enc, email_hash = encrypt_email(email)
            user = User(
                email=email,  # Plain (deprecated, for compatibility)
                email_encrypted=email_enc,
                email_hash=email_hash,
                role=UserRole.CLIENT,
                status=UserStatus.ACTIVE,
                last_login_at=datetime.utcnow()
            )
            self.db.add(user)
            await self.db.flush()
            await self.db.refresh(user)
        else:
            # Update last login
            user.last_login_at = datetime.utcnow()
            await self.db.flush()
        
        # Generate tokens
        tokens = self._generate_tokens(user)
        return user, tokens[0], tokens[1]
    
    # ==========================================
    # 3. Agency Auth (Email + Password)
    # ==========================================
    
    async def login_agency(
        self,
        email: str,
        password: str
    ) -> Tuple[User, str, str]:
        """Agency admin login with email + password"""
        # Find user by email
        user = await self._get_user_by_email(email)
        
        if not user:
            raise ValueError("Invalid credentials")
        
        # Check role
        if user.role != UserRole.AGENCY_ADMIN:
            raise ValueError("Invalid credentials")
        
        # Check password
        if not user.password_hash or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")
        
        # Check status
        if user.status != UserStatus.ACTIVE:
            raise ValueError("Account is not active")
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.db.flush()
        
        # Generate tokens
        tokens = self._generate_tokens(user)
        return user, tokens[0], tokens[1]
    
    # ==========================================
    # Registration with Consents
    # ==========================================
    
    async def register_agent(
        self,
        phone: str,
        name: str,
        email: str,
        consents: ConsentInput,
        city: Optional[str] = None,
        is_self_employed: bool = False,
        personal_inn: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> User:
        """Register new agent with consents"""
        # Check if exists
        existing = await self._get_user_by_phone(phone)
        if existing:
            raise ValueError("Phone already registered")
        
        # Create user
        phone_enc, phone_hash = encrypt_phone(phone)
        email_enc, email_hash = encrypt_email(email)
        
        user = User(
            phone=phone,
            phone_encrypted=phone_enc,
            phone_hash=phone_hash,
            email=email,
            email_encrypted=email_enc,
            email_hash=email_hash,
            role=UserRole.AGENT,
            status=UserStatus.PENDING  # Требует верификации
        )
        self.db.add(user)
        await self.db.flush()
        
        # Create profile
        name_enc = encrypt_name(name)
        inn_enc, inn_hash = encrypt_inn(personal_inn) if personal_inn else (None, None)
        
        from app.models.user import TaxStatus
        profile = UserProfile(
            user_id=user.id,
            full_name=name,
            full_name_encrypted=name_enc,
            personal_inn_encrypted=inn_enc,
            personal_inn_hash=inn_hash,
            tax_status=TaxStatus.NPD if is_self_employed else None,
            city=city
        )
        self.db.add(profile)
        
        # Save consents
        await self._save_consents(user.id, consents, ip_address, user_agent)
        
        await self.db.flush()
        await self.db.refresh(user)
        
        return user
    
    async def register_agency(
        self,
        inn: str,
        name: str,
        legal_address: str,
        contact_name: str,
        contact_phone: str,
        contact_email: str,
        password: str,
        consents: ConsentInput,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> User:
        """Register new agency with admin account"""
        # Check if exists
        existing = await self._get_user_by_email(contact_email)
        if existing:
            raise ValueError("Email already registered")
        
        # Create organization first
        from app.models.organization import Organization, OrganizationType, OrganizationStatus
        org = Organization(
            type=OrganizationType.AGENCY,
            legal_name=name,
            inn=inn,
            legal_address=legal_address,
            status=OrganizationStatus.PENDING
        )
        self.db.add(org)
        await self.db.flush()
        
        # Create admin user
        email_enc, email_hash = encrypt_email(contact_email)
        phone_enc, phone_hash = encrypt_phone(contact_phone)
        
        user = User(
            email=contact_email,
            email_encrypted=email_enc,
            email_hash=email_hash,
            phone=contact_phone,
            phone_encrypted=phone_enc,
            phone_hash=phone_hash,
            role=UserRole.AGENCY_ADMIN,
            password_hash=get_password_hash(password),
            status=UserStatus.PENDING
        )
        self.db.add(user)
        await self.db.flush()
        
        # Create profile
        name_enc = encrypt_name(contact_name)
        profile = UserProfile(
            user_id=user.id,
            full_name=contact_name,
            full_name_encrypted=name_enc
        )
        self.db.add(profile)
        
        # Link user to organization
        from app.models.organization import OrganizationMember
        member = OrganizationMember(
            org_id=org.id,
            user_id=user.id,
            role="admin",
            is_active=True
        )
        self.db.add(member)
        
        # Save consents
        await self._save_consents(user.id, consents, ip_address, user_agent)
        
        await self.db.flush()
        await self.db.refresh(user)
        
        return user
    
    # ==========================================
    # Helpers
    # ==========================================
    
    async def _get_user_by_phone(self, phone: str) -> Optional[User]:
        """Get user by phone (search by hash)"""
        from app.core.encryption import pii_encryption
        phone_hash = pii_encryption.hash(''.join(filter(str.isdigit, phone)))
        
        stmt = select(User).where(User.phone_hash == phone_hash)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email (search by hash)"""
        from app.core.encryption import pii_encryption
        email_hash = pii_encryption.hash(email.lower())
        
        stmt = select(User).where(User.email_hash == email_hash)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    def _generate_tokens(self, user: User) -> Tuple[str, str]:
        """Generate access and refresh tokens"""
        token_data = {
            "sub": str(user.id),
            "role": user.role.value if user.role else "client"
        }
        
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        return access_token, refresh_token
    
    async def _save_consents(
        self,
        user_id: UUID,
        consents: ConsentInput,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Save user consents"""
        consent_mapping = {
            'personal_data': (ConsentType.PERSONAL_DATA, consents.personal_data),
            'terms': (ConsentType.TERMS, consents.terms),
            'marketing': (ConsentType.MARKETING, consents.marketing),
            'realtor_offer': (ConsentType.REALTOR_OFFER, consents.realtor_offer),
            'agency_offer': (ConsentType.AGENCY_OFFER, consents.agency_offer),
        }
        
        now = datetime.utcnow()
        
        for _, (consent_type, granted) in consent_mapping.items():
            if granted:
                consent = UserConsent(
                    user_id=user_id,
                    consent_type=consent_type,
                    granted=True,
                    granted_at=now,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                self.db.add(consent)

