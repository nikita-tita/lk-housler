"""Auth endpoints - Housler 3 auth types"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.rate_limit import rate_limit_otp_send, rate_limit_otp_verify, rate_limit_login, rate_limit_invitation_lookup
from app.core.audit import log_audit_event, AuditEvent
from app.schemas.auth import (
    # Legacy
    OTPRequest,
    OTPVerify,
    # New
    SMSOTPRequest,
    SMSOTPVerify,
    EmailOTPRequest,
    EmailOTPVerify,
    AgencyLoginRequest,
    AgentRegisterRequest,
    AgencyRegisterRequest,
    Token,
    TokenRefresh,
)
from app.core.security import decode_token, create_access_token
from app.services.auth.service_extended import AuthServiceExtended

router = APIRouter()


# ==========================================
# 1. SMS Auth (Agents) - Риелторы
# ==========================================


@router.post("/agent/sms/send", status_code=status.HTTP_200_OK)
async def send_agent_sms(
    request: SMSOTPRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send SMS OTP for agent login"""
    # Rate limit by IP + phone number
    await rate_limit_otp_send(http_request, phone=request.phone)

    ip_address = http_request.client.host if http_request.client else None
    try:
        auth_service = AuthServiceExtended(db)
        await auth_service.send_sms_otp(request.phone)
        log_audit_event(
            AuditEvent.OTP_SENT,
            ip_address=ip_address,
            resource=f"phone:{request.phone[-4:]}",
            details={"method": "sms"},
        )
        return {"message": "SMS code sent"}
    except ValueError as e:
        log_audit_event(
            AuditEvent.OTP_FAILED,
            ip_address=ip_address,
            resource=f"phone:{request.phone[-4:]}",
            details={"reason": str(e)},
            success=False,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send SMS")


@router.post("/agent/sms/verify", response_model=Token)
async def verify_agent_sms(
    request: SMSOTPVerify,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify SMS OTP and login/register agent"""
    # Rate limit by IP + phone number
    await rate_limit_otp_verify(http_request, phone=request.phone)

    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.verify_sms_otp(request.phone, request.code)
        log_audit_event(
            AuditEvent.LOGIN_SUCCESS,
            user_id=str(user.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={"method": "sms", "role": user.role},
        )
        return Token(access_token=access_token, refresh_token=refresh_token)
    except ValueError as e:
        log_audit_event(
            AuditEvent.LOGIN_FAILED,
            ip_address=ip_address,
            user_agent=user_agent,
            resource=f"phone:{request.phone[-4:]}",
            details={"reason": str(e), "method": "sms"},
            success=False,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 2. Email Auth (Clients) - Клиенты
# ==========================================


@router.post("/client/email/send", status_code=status.HTTP_200_OK)
async def send_client_email(
    request: EmailOTPRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send Email OTP for client login"""
    # Rate limit by IP + email
    await rate_limit_otp_send(http_request, email=request.email)

    try:
        auth_service = AuthServiceExtended(db)
        await auth_service.send_email_otp(request.email)
        return {"message": "Email code sent"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send email")


@router.post("/client/email/verify", response_model=Token)
async def verify_client_email(
    request: EmailOTPVerify,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify Email OTP and login/register client"""
    # Rate limit by IP + email
    await rate_limit_otp_verify(http_request, email=request.email)

    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.verify_email_otp(request.email, request.code)

        return Token(access_token=access_token, refresh_token=refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 3. Agency Auth (Email + Password)
# ==========================================


@router.post("/agency/login", response_model=Token)
async def login_agency(
    request: AgencyLoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Agency admin login with email + password"""
    # Rate limit by IP + email
    await rate_limit_login(http_request, email=request.email)

    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    try:
        auth_service = AuthServiceExtended(db)
        user, access_token, refresh_token = await auth_service.login_agency(request.email, request.password)
        log_audit_event(
            AuditEvent.LOGIN_SUCCESS,
            user_id=str(user.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={"method": "password", "role": user.role},
        )
        return Token(access_token=access_token, refresh_token=refresh_token)
    except ValueError as e:
        log_audit_event(
            AuditEvent.LOGIN_FAILED,
            ip_address=ip_address,
            user_agent=user_agent,
            resource=f"email:{request.email}",
            details={"reason": "invalid_credentials", "method": "password"},
            success=False,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


# ==========================================
# Registration with Consents
# ==========================================


@router.post("/register/agent", status_code=status.HTTP_201_CREATED)
async def register_agent(request: AgentRegisterRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
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
            user_agent=user_agent,
        )

        return {"id": str(user.id), "message": "Agent registered successfully. Please verify phone to activate."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/register/agency", status_code=status.HTTP_201_CREATED)
async def register_agency(request: AgencyRegisterRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
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
            user_agent=user_agent,
        )

        return {"id": str(user.id), "message": "Agency registered successfully. Awaiting verification."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 4. Employee Invitations (Public)
# ==========================================

from datetime import datetime
from sqlalchemy import select, and_
from app.models.organization import PendingEmployee, EmployeeInviteStatus, OrganizationMember, MemberRole, Organization
from app.schemas.organization import EmployeeInvitePublicInfo, EmployeeRegisterRequest
from app.models.user import User, UserRole
from app.core.security import create_access_token, create_refresh_token


@router.get("/employee-invite/{token}", response_model=EmployeeInvitePublicInfo)
async def get_employee_invite_info(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get public info about employee invitation (for registration page)"""
    # Rate limit by IP to prevent token enumeration
    await rate_limit_invitation_lookup(request)

    # Find invitation by token
    stmt = (
        select(PendingEmployee, Organization)
        .join(Organization, PendingEmployee.org_id == Organization.id)
        .where(PendingEmployee.invite_token == token)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Приглашение не найдено")

    invitation, organization = row

    is_expired = invitation.expires_at < datetime.utcnow() or invitation.status != EmployeeInviteStatus.PENDING

    return EmployeeInvitePublicInfo(
        token=invitation.invite_token,
        agency_name=organization.legal_name,
        agency_id=organization.id,
        phone=invitation.phone,
        position=invitation.position,
        expires_at=invitation.expires_at,
        is_expired=is_expired,
    )


@router.post("/register-employee", response_model=Token)
async def register_employee(
    request: EmployeeRegisterRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Complete employee registration via invite token"""
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

    # Find invitation by token
    stmt = (
        select(PendingEmployee, Organization)
        .join(Organization, PendingEmployee.org_id == Organization.id)
        .where(PendingEmployee.invite_token == request.token)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Приглашение не найдено")

    invitation, organization = row

    # Check if expired
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Приглашение истекло")

    if invitation.status != EmployeeInviteStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Приглашение уже использовано")

    # Check if user already exists with this phone
    from sqlalchemy import or_
    stmt = select(User).where(
        or_(
            User.phone == invitation.phone,
            User.phone == f"+{invitation.phone}",
        )
    )
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # User exists - just add them to the organization
        user = existing_user
        # Update user name if provided
        if request.name and not user.name:
            user.name = request.name
    else:
        # Create new user
        user = User(
            phone=invitation.phone,
            email=request.email,
            name=request.name,
            role=UserRole.AGENT,  # Employee gets agent role, organization membership defines access
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Add user to organization as employee
    stmt = select(OrganizationMember).where(
        and_(
            OrganizationMember.org_id == organization.id,
            OrganizationMember.user_id == user.id,
        )
    )
    result = await db.execute(stmt)
    existing_member = result.scalar_one_or_none()

    if existing_member:
        # Reactivate if inactive
        existing_member.is_active = True
    else:
        # Create new membership
        member = OrganizationMember(
            org_id=organization.id,
            user_id=user.id,
            role=MemberRole.AGENT,
            is_active=True,
        )
        db.add(member)

    # Mark invitation as accepted
    invitation.status = EmployeeInviteStatus.ACCEPTED
    invitation.accepted_user_id = user.id
    invitation.accepted_at = datetime.utcnow()

    await db.commit()
    await db.refresh(user)

    # Generate tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    log_audit_event(
        AuditEvent.USER_REGISTERED,
        user_id=str(user.id),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"method": "employee_invite", "org_id": str(organization.id)},
    )

    return Token(access_token=access_token, refresh_token=refresh_token)


# ==========================================
# 5. Token Refresh
# ==========================================

from pydantic import BaseModel


class AccessTokenResponse(BaseModel):
    """Access token response"""
    access_token: str
    token_type: str = "bearer"


from app.core.rate_limit import token_blacklist


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_access_token(
    request: TokenRefresh,
    http_request: Request,
):
    """Refresh access token using refresh token"""
    # Check if token is blacklisted (logged out)
    if await token_blacklist.is_blacklisted(request.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    # Decode refresh token
    payload = decode_token(request.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Verify this is a refresh token
    token_type = payload.get("type")
    if token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type - refresh token required",
        )

    # Get user ID from token
    user_id = payload.get("sub") or payload.get("userId")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Create new access token
    access_token = create_access_token(data={"sub": str(user_id)})

    ip_address = http_request.client.host if http_request.client else None
    log_audit_event(
        AuditEvent.TOKEN_REFRESHED,
        user_id=str(user_id),
        ip_address=ip_address,
        details={"method": "refresh_token"},
    )

    return AccessTokenResponse(access_token=access_token)


# ==========================================
# 6. Logout
# ==========================================


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: TokenRefresh,
    http_request: Request,
):
    """
    Logout user by invalidating refresh token.

    The refresh token is added to a blacklist stored in Redis.
    Access tokens are short-lived and will expire naturally.
    """
    # Decode to get user ID for audit logging
    payload = decode_token(request.refresh_token)
    user_id = payload.get("sub") or payload.get("userId") if payload else None

    # Add to blacklist
    await token_blacklist.add(request.refresh_token)

    ip_address = http_request.client.host if http_request.client else None
    log_audit_event(
        AuditEvent.LOGOUT,
        user_id=str(user_id) if user_id else None,
        ip_address=ip_address,
        details={"method": "refresh_token_revoke"},
    )

    return {"message": "Logged out successfully"}
