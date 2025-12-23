"""Auth endpoints - Housler 3 auth types"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import (
    # Legacy
    OTPRequest, OTPVerify,
    # New
    SMSOTPRequest, SMSOTPVerify,
    EmailOTPRequest, EmailOTPVerify,
    AgencyLoginRequest,
    AgentRegisterRequest, AgencyRegisterRequest,
    Token
)
from app.services.auth.service import AuthService
from app.services.auth.service_extended import AuthServiceExtended

router = APIRouter()


# ==========================================
# 1. SMS Auth (Agents) - Риелторы
# ==========================================

@router.post("/agent/sms/send", status_code=status.HTTP_200_OK)
async def send_agent_sms(
    request: SMSOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send SMS OTP for agent login"""
    try:
        auth_service = AuthServiceExtended(db)
        await auth_service.send_sms_otp(request.phone)
        return {"message": "SMS code sent"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send SMS"
        )


@router.post("/agent/sms/verify", response_model=Token)
async def verify_agent_sms(
    request: SMSOTPVerify,
    db: AsyncSession = Depends(get_db)
):
    """Verify SMS OTP and login/register agent"""
    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.verify_sms_otp(
            request.phone,
            request.code
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ==========================================
# 2. Email Auth (Clients) - Клиенты
# ==========================================

@router.post("/client/email/send", status_code=status.HTTP_200_OK)
async def send_client_email(
    request: EmailOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send Email OTP for client login"""
    try:
        auth_service = AuthServiceExtended(db)
        await auth_service.send_email_otp(request.email)
        return {"message": "Email code sent"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )


@router.post("/client/email/verify", response_model=Token)
async def verify_client_email(
    request: EmailOTPVerify,
    db: AsyncSession = Depends(get_db)
):
    """Verify Email OTP and login/register client"""
    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.verify_email_otp(
            request.email,
            request.code
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ==========================================
# 3. Agency Auth (Email + Password)
# ==========================================

@router.post("/agency/login", response_model=Token)
async def login_agency(
    request: AgencyLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Agency admin login with email + password"""
    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.login_agency(
            request.email,
            request.password
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


# ==========================================
# Registration with Consents
# ==========================================

@router.post("/register/agent", status_code=status.HTTP_201_CREATED)
async def register_agent(
    request: AgentRegisterRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register new agent with full profile"""
    try:
        auth_service = AuthServiceExtended(db)
        
        # Get client IP and User-Agent
        ip_address = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent")
        
        user = await auth_service.register_agent(
            phone=request.phone,
            name=request.name,
            email=request.email,
            consents=request.consents,
            city=request.city,
            is_self_employed=request.is_self_employed,
            personal_inn=request.personal_inn,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "id": str(user.id),
            "message": "Agent registered successfully. Please verify phone to activate."
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/register/agency", status_code=status.HTTP_201_CREATED)
async def register_agency(
    request: AgencyRegisterRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register new agency with admin account"""
    try:
        auth_service = AuthServiceExtended(db)
        
        # Get client IP and User-Agent
        ip_address = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent")
        
        user = await auth_service.register_agency(
            inn=request.inn,
            name=request.name,
            legal_address=request.legal_address,
            contact_name=request.contact_name,
            contact_phone=request.contact_phone,
            contact_email=request.contact_email,
            password=request.password,
            consents=request.consents,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "id": str(user.id),
            "message": "Agency registered successfully. Awaiting verification."
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ==========================================
# Legacy endpoints (backward compatibility)
# ==========================================

@router.post("/otp/send", status_code=status.HTTP_200_OK)
async def send_otp(
    request: OTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send OTP code (legacy)"""
    try:
        auth_service = AuthService(db)
        await auth_service.send_otp(request.phone, request.purpose)
        return {"message": "OTP sent successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP"
        )


@router.post("/otp/verify", response_model=Token)
async def verify_otp(
    request: OTPVerify,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP and login/register (legacy)"""
    try:
        auth_service = AuthService(db)
        user, access_token, refresh_token = await auth_service.login_with_otp(
            request.phone,
            request.code
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify OTP"
        )

