"""T-Bank Onboarding API Client (TASK-5.2)

Client for T-Bank Multiracchety partner onboarding.
Handles merchant registration for bank-split payment receiving.
"""

import logging
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class OnboardingSessionStatus(str, Enum):
    """Status of onboarding session"""
    CREATED = "created"
    DOCUMENTS_REQUIRED = "documents_required"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    PENDING_REVIEW = "pending_review"
    ADDITIONAL_INFO_REQUIRED = "additional_info_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class DocumentType(str, Enum):
    """Supported document types for onboarding"""
    PASSPORT_MAIN = "passport_main"
    PASSPORT_REGISTRATION = "passport_registration"
    INN_CERTIFICATE = "inn_certificate"
    BANK_DETAILS = "bank_details"
    SELFIE_WITH_PASSPORT = "selfie_with_passport"
    NPD_REGISTRATION = "npd_registration"
    IP_REGISTRATION = "ip_registration"
    OOO_CHARTER = "ooo_charter"


@dataclass
class OnboardingDocument:
    """Document for onboarding submission"""
    document_type: DocumentType
    file_url: str
    file_name: str
    file_size: int
    mime_type: str = "application/pdf"
    uploaded_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class OnboardingSession:
    """Onboarding session data"""
    session_id: str
    profile_id: UUID
    status: OnboardingSessionStatus
    created_at: datetime
    expires_at: datetime
    onboarding_url: Optional[str] = None
    required_documents: List[DocumentType] = field(default_factory=list)
    submitted_documents: List[str] = field(default_factory=list)
    review_started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    additional_info_request: Optional[str] = None


@dataclass
class OnboardingStatus:
    """Status response from T-Bank"""
    session_id: str
    status: OnboardingSessionStatus
    progress_percent: int
    current_step: str
    required_documents: List[DocumentType]
    submitted_documents: List[str]
    rejection_reason: Optional[str] = None
    additional_info_request: Optional[str] = None
    estimated_completion_hours: Optional[int] = None


@dataclass
class MerchantCredentials:
    """Merchant credentials after successful onboarding"""
    merchant_id: str
    terminal_key: Optional[str] = None
    account_id: Optional[str] = None
    nominal_account_number: Optional[str] = None
    split_enabled: bool = True
    activated_at: datetime = field(default_factory=datetime.utcnow)


class TBankOnboardingClient:
    """
    Client for T-Bank Onboarding API.

    Handles the merchant onboarding flow for bank-split payments:
    1. Initiate onboarding session
    2. Submit required documents
    3. Track status
    4. Complete onboarding and receive credentials

    Features:
    - Mock mode for development/testing
    - Retry logic with exponential backoff
    - Comprehensive error handling
    """

    DEFAULT_TIMEOUT = 30.0
    MAX_RETRIES = 3
    RETRY_BACKOFF_BASE = 1.0

    def __init__(self, mock_mode: Optional[bool] = None):
        """Initialize client.

        Args:
            mock_mode: Override mock mode setting. If None, uses config.
        """
        self.mock_mode = (
            mock_mode if mock_mode is not None
            else settings.TBANK_ONBOARDING_MOCK_MODE
        )
        self.api_url = settings.TBANK_ONBOARDING_API_URL
        self.api_key = settings.TBANK_ONBOARDING_API_KEY

        # In-memory storage for mock mode
        self._mock_sessions: Dict[str, OnboardingSession] = {}
        self._mock_credentials: Dict[str, MerchantCredentials] = {}

    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic.

        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request body
            retry_count: Current retry attempt

        Returns:
            Response data

        Raises:
            TBankOnboardingError: On API error
        """
        url = f"{self.api_url}{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._get_headers(),
                    json=data,
                )

                if response.status_code >= 500 and retry_count < self.MAX_RETRIES:
                    # Server error - retry with backoff
                    wait_time = self.RETRY_BACKOFF_BASE * (2 ** retry_count)
                    logger.warning(
                        f"T-Bank API error {response.status_code}, "
                        f"retrying in {wait_time}s (attempt {retry_count + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    return await self._make_request(method, endpoint, data, retry_count + 1)

                if response.status_code >= 400:
                    error_data = response.json() if response.content else {}
                    raise TBankOnboardingError(
                        code=error_data.get("errorCode", str(response.status_code)),
                        message=error_data.get("message", response.text),
                        status_code=response.status_code,
                    )

                return response.json()

        except httpx.TimeoutException:
            if retry_count < self.MAX_RETRIES:
                wait_time = self.RETRY_BACKOFF_BASE * (2 ** retry_count)
                logger.warning(
                    f"T-Bank API timeout, retrying in {wait_time}s "
                    f"(attempt {retry_count + 1})"
                )
                await asyncio.sleep(wait_time)
                return await self._make_request(method, endpoint, data, retry_count + 1)
            raise TBankOnboardingError(
                code="TIMEOUT",
                message="Request timeout after retries",
            )

        except httpx.RequestError as e:
            logger.error(f"T-Bank API request error: {e}")
            raise TBankOnboardingError(
                code="REQUEST_ERROR",
                message=str(e),
            )

    async def initiate_onboarding(
        self,
        profile_id: UUID,
        legal_type: str,
        legal_name: str,
        inn: str,
        phone: str,
        email: Optional[str] = None,
        bank_bik: Optional[str] = None,
        bank_account: Optional[str] = None,
    ) -> OnboardingSession:
        """Initiate onboarding session for a payment profile.

        Args:
            profile_id: PaymentProfile ID
            legal_type: Legal type (se/ip/ooo)
            legal_name: Legal name
            inn: INN
            phone: Contact phone
            email: Contact email
            bank_bik: Bank BIK
            bank_account: Bank account number

        Returns:
            OnboardingSession with session details
        """
        if self.mock_mode:
            return await self._mock_initiate_onboarding(
                profile_id, legal_type, legal_name, inn, phone
            )

        data = {
            "externalId": str(profile_id),
            "legalType": legal_type.upper(),
            "legalName": legal_name,
            "inn": inn,
            "phone": phone,
        }

        if email:
            data["email"] = email
        if bank_bik:
            data["bankBik"] = bank_bik
        if bank_account:
            data["bankAccount"] = bank_account

        response = await self._make_request("POST", "/sessions", data)

        session = OnboardingSession(
            session_id=response["sessionId"],
            profile_id=profile_id,
            status=OnboardingSessionStatus(response.get("status", "created")),
            created_at=datetime.fromisoformat(response["createdAt"].replace("Z", "+00:00")),
            expires_at=datetime.fromisoformat(response["expiresAt"].replace("Z", "+00:00")),
            onboarding_url=response.get("onboardingUrl"),
            required_documents=[
                DocumentType(d) for d in response.get("requiredDocuments", [])
            ],
        )

        logger.info(
            f"Initiated onboarding session {session.session_id} "
            f"for profile {profile_id}"
        )

        return session

    async def get_onboarding_status(self, session_id: str) -> OnboardingStatus:
        """Get current status of onboarding session.

        Args:
            session_id: Onboarding session ID

        Returns:
            OnboardingStatus with current status details
        """
        if self.mock_mode:
            return await self._mock_get_status(session_id)

        response = await self._make_request("GET", f"/sessions/{session_id}")

        return OnboardingStatus(
            session_id=session_id,
            status=OnboardingSessionStatus(response["status"]),
            progress_percent=response.get("progressPercent", 0),
            current_step=response.get("currentStep", "initiated"),
            required_documents=[
                DocumentType(d) for d in response.get("requiredDocuments", [])
            ],
            submitted_documents=response.get("submittedDocuments", []),
            rejection_reason=response.get("rejectionReason"),
            additional_info_request=response.get("additionalInfoRequest"),
            estimated_completion_hours=response.get("estimatedCompletionHours"),
        )

    async def submit_documents(
        self,
        session_id: str,
        documents: List[OnboardingDocument],
    ) -> bool:
        """Submit documents for onboarding.

        Args:
            session_id: Onboarding session ID
            documents: List of documents to submit

        Returns:
            True if submission successful
        """
        if self.mock_mode:
            return await self._mock_submit_documents(session_id, documents)

        data = {
            "sessionId": session_id,
            "documents": [
                {
                    "type": doc.document_type.value,
                    "fileUrl": doc.file_url,
                    "fileName": doc.file_name,
                    "fileSize": doc.file_size,
                    "mimeType": doc.mime_type,
                }
                for doc in documents
            ],
        }

        response = await self._make_request("POST", f"/sessions/{session_id}/documents", data)

        success = response.get("success", False)
        if success:
            logger.info(
                f"Submitted {len(documents)} documents for session {session_id}"
            )
        else:
            logger.warning(
                f"Document submission failed for session {session_id}: "
                f"{response.get('message')}"
            )

        return success

    async def complete_onboarding(self, session_id: str) -> MerchantCredentials:
        """Complete onboarding and get merchant credentials.

        This should only be called after onboarding is approved.

        Args:
            session_id: Onboarding session ID

        Returns:
            MerchantCredentials with merchant details
        """
        if self.mock_mode:
            return await self._mock_complete_onboarding(session_id)

        response = await self._make_request("POST", f"/sessions/{session_id}/complete")

        credentials = MerchantCredentials(
            merchant_id=response["merchantId"],
            terminal_key=response.get("terminalKey"),
            account_id=response.get("accountId"),
            nominal_account_number=response.get("nominalAccountNumber"),
            split_enabled=response.get("splitEnabled", True),
            activated_at=datetime.fromisoformat(
                response["activatedAt"].replace("Z", "+00:00")
            ) if response.get("activatedAt") else datetime.utcnow(),
        )

        logger.info(
            f"Completed onboarding for session {session_id}, "
            f"merchant_id: {credentials.merchant_id}"
        )

        return credentials

    # =========================================================================
    # Mock implementations for development/testing
    # =========================================================================

    async def _mock_initiate_onboarding(
        self,
        profile_id: UUID,
        legal_type: str,
        legal_name: str,
        inn: str,
        phone: str,
    ) -> OnboardingSession:
        """Mock implementation of initiate_onboarding"""
        session_id = f"mock_session_{uuid4().hex[:8]}"

        # Determine required documents based on legal type
        required_docs = [DocumentType.PASSPORT_MAIN, DocumentType.BANK_DETAILS]
        if legal_type.lower() == "se":
            required_docs.append(DocumentType.NPD_REGISTRATION)
        elif legal_type.lower() == "ip":
            required_docs.append(DocumentType.IP_REGISTRATION)
        elif legal_type.lower() == "ooo":
            required_docs.append(DocumentType.OOO_CHARTER)

        session = OnboardingSession(
            session_id=session_id,
            profile_id=profile_id,
            status=OnboardingSessionStatus.DOCUMENTS_REQUIRED,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
            onboarding_url=f"https://business.tbank.ru/onboarding/{session_id}",
            required_documents=required_docs,
        )

        self._mock_sessions[session_id] = session

        logger.info(f"[MOCK] Created onboarding session {session_id}")
        return session

    async def _mock_get_status(self, session_id: str) -> OnboardingStatus:
        """Mock implementation of get_onboarding_status"""
        session = self._mock_sessions.get(session_id)

        if not session:
            raise TBankOnboardingError(
                code="SESSION_NOT_FOUND",
                message=f"Session {session_id} not found",
                status_code=404,
            )

        # Calculate progress based on status
        progress_map = {
            OnboardingSessionStatus.CREATED: 10,
            OnboardingSessionStatus.DOCUMENTS_REQUIRED: 20,
            OnboardingSessionStatus.DOCUMENTS_SUBMITTED: 50,
            OnboardingSessionStatus.PENDING_REVIEW: 70,
            OnboardingSessionStatus.ADDITIONAL_INFO_REQUIRED: 60,
            OnboardingSessionStatus.APPROVED: 100,
            OnboardingSessionStatus.REJECTED: 0,
            OnboardingSessionStatus.EXPIRED: 0,
        }

        return OnboardingStatus(
            session_id=session_id,
            status=session.status,
            progress_percent=progress_map.get(session.status, 0),
            current_step=session.status.value,
            required_documents=session.required_documents,
            submitted_documents=session.submitted_documents,
            rejection_reason=session.rejection_reason,
            additional_info_request=session.additional_info_request,
            estimated_completion_hours=24 if session.status == OnboardingSessionStatus.PENDING_REVIEW else None,
        )

    async def _mock_submit_documents(
        self,
        session_id: str,
        documents: List[OnboardingDocument],
    ) -> bool:
        """Mock implementation of submit_documents"""
        session = self._mock_sessions.get(session_id)

        if not session:
            raise TBankOnboardingError(
                code="SESSION_NOT_FOUND",
                message=f"Session {session_id} not found",
                status_code=404,
            )

        # Add submitted document types
        for doc in documents:
            if doc.document_type.value not in session.submitted_documents:
                session.submitted_documents.append(doc.document_type.value)

        # Check if all required documents submitted
        required_set = {d.value for d in session.required_documents}
        submitted_set = set(session.submitted_documents)

        if required_set.issubset(submitted_set):
            session.status = OnboardingSessionStatus.PENDING_REVIEW
            session.review_started_at = datetime.utcnow()
            logger.info(f"[MOCK] All documents submitted for {session_id}, moved to review")
        else:
            session.status = OnboardingSessionStatus.DOCUMENTS_SUBMITTED
            logger.info(
                f"[MOCK] Partial documents submitted for {session_id}, "
                f"missing: {required_set - submitted_set}"
            )

        return True

    async def _mock_complete_onboarding(self, session_id: str) -> MerchantCredentials:
        """Mock implementation of complete_onboarding"""
        session = self._mock_sessions.get(session_id)

        if not session:
            raise TBankOnboardingError(
                code="SESSION_NOT_FOUND",
                message=f"Session {session_id} not found",
                status_code=404,
            )

        # For mock, auto-approve if in PENDING_REVIEW
        if session.status == OnboardingSessionStatus.PENDING_REVIEW:
            session.status = OnboardingSessionStatus.APPROVED
            session.completed_at = datetime.utcnow()

        if session.status != OnboardingSessionStatus.APPROVED:
            raise TBankOnboardingError(
                code="NOT_APPROVED",
                message=f"Session not approved. Current status: {session.status.value}",
                status_code=400,
            )

        merchant_id = f"mock_merchant_{uuid4().hex[:8]}"

        credentials = MerchantCredentials(
            merchant_id=merchant_id,
            terminal_key=f"TERMINAL_{merchant_id.upper()}",
            account_id=f"ACC_{merchant_id}",
            nominal_account_number=f"40702810{uuid4().hex[:12]}",
            split_enabled=True,
        )

        self._mock_credentials[session_id] = credentials

        logger.info(f"[MOCK] Completed onboarding for {session_id}, merchant: {merchant_id}")
        return credentials

    # =========================================================================
    # Helper methods for testing
    # =========================================================================

    async def mock_approve_session(self, session_id: str) -> bool:
        """Helper to manually approve a mock session (for testing)"""
        if not self.mock_mode:
            raise ValueError("mock_approve_session only available in mock mode")

        session = self._mock_sessions.get(session_id)
        if not session:
            return False

        session.status = OnboardingSessionStatus.APPROVED
        session.completed_at = datetime.utcnow()
        return True

    async def mock_reject_session(self, session_id: str, reason: str) -> bool:
        """Helper to manually reject a mock session (for testing)"""
        if not self.mock_mode:
            raise ValueError("mock_reject_session only available in mock mode")

        session = self._mock_sessions.get(session_id)
        if not session:
            return False

        session.status = OnboardingSessionStatus.REJECTED
        session.rejection_reason = reason
        session.completed_at = datetime.utcnow()
        return True


class TBankOnboardingError(Exception):
    """T-Bank Onboarding API error"""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: Optional[int] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(f"[{code}] {message}")
