"""Tests for ServiceCompletionService (TASK-2.2)"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4

from app.services.bank_split.completion_service import (
    ServiceCompletionService,
    COMPLETION_ALLOWED_ROLES,
)


class TestCanConfirmCompletion:
    """Tests for RBAC logic in can_confirm_completion"""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return ServiceCompletionService(mock_db)

    @pytest.fixture
    def mock_user(self):
        user = MagicMock()
        user.id = 1
        user.display_name = "Test User"
        return user

    @pytest.fixture
    def mock_deal(self):
        deal = MagicMock()
        deal.id = uuid4()
        deal.agent_user_id = 1
        deal.created_by_user_id = 2
        deal.executor_type = "user"
        deal.executor_id = "1"
        deal.status = "hold_period"
        deal.hold_expires_at = datetime.utcnow() + timedelta(days=3)
        deal.auto_release_at = None
        deal.property_address = "Test Address"
        deal.commission_agent = 100000
        return deal

    @pytest.mark.asyncio
    async def test_agent_can_confirm(self, service, mock_user, mock_deal):
        """Agent of the deal can confirm completion"""
        mock_user.id = mock_deal.agent_user_id

        can_confirm, reason = await service.can_confirm_completion(mock_user, mock_deal)

        assert can_confirm is True
        assert reason == "agent"

    @pytest.mark.asyncio
    async def test_creator_can_confirm(self, service, mock_user, mock_deal):
        """Creator of the deal can confirm completion"""
        mock_user.id = mock_deal.created_by_user_id

        can_confirm, reason = await service.can_confirm_completion(mock_user, mock_deal)

        assert can_confirm is True
        assert reason == "creator"

    @pytest.mark.asyncio
    async def test_random_user_cannot_confirm(self, service, mock_user, mock_deal):
        """Random user cannot confirm completion"""
        mock_user.id = 999  # Not agent or creator

        can_confirm, reason = await service.can_confirm_completion(mock_user, mock_deal)

        assert can_confirm is False
        assert reason == "not_authorized"

    @pytest.mark.asyncio
    async def test_agency_admin_can_confirm_for_org_deal(self, service, mock_user, mock_deal, mock_db):
        """Agency admin can confirm completion for org deal"""
        mock_user.id = 999  # Not agent or creator
        mock_deal.executor_type = "org"
        mock_deal.executor_id = str(uuid4())

        # Mock org membership
        mock_member = MagicMock()
        mock_member.is_active = True
        mock_member.role = MagicMock()
        mock_member.role.value = "admin"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_member
        mock_db.execute.return_value = mock_result

        can_confirm, reason = await service.can_confirm_completion(mock_user, mock_deal)

        assert can_confirm is True
        assert reason == "agency_admin"

    @pytest.mark.asyncio
    async def test_agency_agent_cannot_confirm_for_org_deal(self, service, mock_user, mock_deal, mock_db):
        """Agency agent (not admin) cannot confirm completion for org deal"""
        mock_user.id = 999
        mock_deal.executor_type = "org"
        mock_deal.executor_id = str(uuid4())

        # Mock org membership with agent role
        mock_member = MagicMock()
        mock_member.is_active = True
        mock_member.role = MagicMock()
        mock_member.role.value = "agent"  # Not in allowed roles

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_member
        mock_db.execute.return_value = mock_result

        can_confirm, reason = await service.can_confirm_completion(mock_user, mock_deal)

        assert can_confirm is False
        assert reason == "not_authorized"


class TestCheckOpenDisputes:
    """Tests for dispute checking"""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return ServiceCompletionService(mock_db)

    @pytest.mark.asyncio
    async def test_no_open_dispute(self, service, mock_db):
        """Returns None when no open dispute exists"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        dispute = await service.check_open_disputes(uuid4())

        assert dispute is None

    @pytest.mark.asyncio
    async def test_has_open_dispute(self, service, mock_db):
        """Returns dispute when open dispute exists"""
        mock_dispute = MagicMock()
        mock_dispute.status = "open"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_dispute
        mock_db.execute.return_value = mock_result

        dispute = await service.check_open_disputes(uuid4())

        assert dispute is not None


class TestConfirmServiceCompletion:
    """Tests for the main confirmation flow"""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ServiceCompletionService(mock_db)

    @pytest.fixture
    def mock_user(self):
        user = MagicMock()
        user.id = 1
        user.display_name = "Test Agent"
        return user

    @pytest.fixture
    def mock_deal(self):
        deal = MagicMock()
        deal.id = uuid4()
        deal.agent_user_id = 1
        deal.created_by_user_id = 1  # Same as agent for simple test
        deal.executor_type = "user"
        deal.executor_id = "1"
        deal.status = "hold_period"
        deal.hold_expires_at = datetime.utcnow() + timedelta(days=3)
        deal.auto_release_at = None
        deal.property_address = "Test Address"
        deal.commission_agent = 100000
        return deal

    @pytest.mark.asyncio
    async def test_cannot_confirm_wrong_status(self, service, mock_user, mock_deal):
        """Cannot confirm if deal is not in hold_period"""
        mock_deal.status = "draft"

        with pytest.raises(ValueError) as exc_info:
            await service.confirm_service_completion(mock_deal, mock_user)

        assert "hold period" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cannot_confirm_with_open_dispute(self, service, mock_user, mock_deal, mock_db):
        """Cannot confirm if open dispute exists"""
        # Mock open dispute
        mock_dispute = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_dispute
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValueError) as exc_info:
            await service.confirm_service_completion(mock_deal, mock_user)

        assert "dispute" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cannot_confirm_twice(self, service, mock_user, mock_deal, mock_db):
        """Cannot confirm if user already confirmed"""
        # First call - check for dispute (return None)
        # Second call - check for existing confirmation (return existing)
        mock_existing = MagicMock()
        call_count = [0]

        async def execute_side_effect(*args, **kwargs):
            result = MagicMock()
            call_count[0] += 1
            # First call is dispute check - return None
            if call_count[0] == 1:
                result.scalar_one_or_none.return_value = None
            else:
                # Second call is existing confirmation check - return existing
                result.scalar_one_or_none.return_value = mock_existing
            return result

        mock_db.execute.side_effect = execute_side_effect

        with pytest.raises(ValueError) as exc_info:
            await service.confirm_service_completion(mock_deal, mock_user)

        assert "already confirmed" in str(exc_info.value).lower()


class TestRequiredConfirmers:
    """Tests for get_required_confirmers"""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return ServiceCompletionService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_creator_and_agent(self, service):
        """Returns creator and agent as required confirmers"""
        mock_deal = MagicMock()
        mock_deal.created_by_user_id = 1
        mock_deal.agent_user_id = 2

        required = await service.get_required_confirmers(mock_deal)

        assert 1 in required
        assert 2 in required
        assert len(required) == 2

    @pytest.mark.asyncio
    async def test_deduplicates_when_same_user(self, service):
        """Deduplicates when creator and agent are the same"""
        mock_deal = MagicMock()
        mock_deal.created_by_user_id = 1
        mock_deal.agent_user_id = 1

        required = await service.get_required_confirmers(mock_deal)

        assert 1 in required
        assert len(required) == 1


class TestCompletionAllowedRoles:
    """Tests for RBAC role configuration"""

    def test_agent_roles(self):
        """Agent role is allowed for agent"""
        assert "agent" in COMPLETION_ALLOWED_ROLES["agent"]

    def test_agency_roles(self):
        """Admin and signer roles are allowed for agency"""
        assert "admin" in COMPLETION_ALLOWED_ROLES["agency"]
        assert "signer" in COMPLETION_ALLOWED_ROLES["agency"]
        assert "agent" not in COMPLETION_ALLOWED_ROLES["agency"]
