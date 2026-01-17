"""
Tests for BankSplitDealService - оркестратор жизненного цикла сделок.

Тестирует:
- Создание сделки (draft)
- State machine переходы
- Валидация переходов
- Отмена сделки
- Автоматический release из холда
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.bank_split.deal_service import (
    BankSplitDealService,
    CreateBankSplitDealInput,
    BankSplitDealResult,
    BANK_SPLIT_TRANSITIONS,
)
from app.models.deal import Deal, DealStatus
from app.models.bank_split import (
    DealSplitRecipient,
    RecipientRole,
    SplitType,
    PayoutStatus,
)
from app.models.user import User
from app.models.organization import Organization
from app.integrations.tbank import TBankError


class TestBankSplitTransitions:
    """Тесты state machine переходов без БД"""

    def test_draft_allowed_transitions(self):
        """Draft может переходить в awaiting_signatures или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["draft"]
        assert "awaiting_signatures" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_awaiting_signatures_allowed_transitions(self):
        """Ожидание подписей -> signed или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["awaiting_signatures"]
        assert "signed" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_signed_allowed_transitions(self):
        """Подписан -> invoiced или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["signed"]
        assert "invoiced" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_invoiced_allowed_transitions(self):
        """Выставлен счёт -> payment_pending или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["invoiced"]
        assert "payment_pending" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_payment_pending_allowed_transitions(self):
        """Ожидание платежа -> hold_period или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["payment_pending"]
        assert "hold_period" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_hold_period_allowed_transitions(self):
        """Холд -> closed или cancelled"""
        allowed = BANK_SPLIT_TRANSITIONS["hold_period"]
        assert "closed" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_closed_is_terminal(self):
        """Закрытая сделка - терминальное состояние"""
        allowed = BANK_SPLIT_TRANSITIONS["closed"]
        assert len(allowed) == 0

    def test_cancelled_is_terminal(self):
        """Отменённая сделка - терминальное состояние"""
        allowed = BANK_SPLIT_TRANSITIONS["cancelled"]
        assert len(allowed) == 0


class TestValidateTransition:
    """Тесты валидации переходов"""

    def setup_method(self):
        """Создаём mock сервис без БД"""
        self.service = BankSplitDealService.__new__(BankSplitDealService)

    def _make_deal(self, status: str) -> Deal:
        """Создаём mock сделку с нужным статусом"""
        deal = MagicMock(spec=Deal)
        deal.status = status
        deal.id = uuid4()
        return deal

    def test_valid_transition_draft_to_awaiting(self):
        """Разрешённый переход: draft -> awaiting_signatures"""
        deal = self._make_deal("draft")
        # Не должно вызывать исключение
        self.service._validate_transition(deal, "awaiting_signatures")

    def test_valid_transition_signed_to_invoiced(self):
        """Разрешённый переход: signed -> invoiced"""
        deal = self._make_deal("signed")
        self.service._validate_transition(deal, "invoiced")

    def test_valid_transition_hold_to_closed(self):
        """Разрешённый переход: hold_period -> closed"""
        deal = self._make_deal("hold_period")
        self.service._validate_transition(deal, "closed")

    def test_invalid_transition_draft_to_closed(self):
        """Запрещённый переход: draft -> closed"""
        deal = self._make_deal("draft")
        with pytest.raises(ValueError, match="Invalid transition"):
            self.service._validate_transition(deal, "closed")

    def test_invalid_transition_closed_to_draft(self):
        """Запрещённый переход: closed -> draft (терминальное состояние)"""
        deal = self._make_deal("closed")
        with pytest.raises(ValueError, match="Invalid transition"):
            self.service._validate_transition(deal, "draft")

    def test_invalid_transition_cancelled_to_signed(self):
        """Запрещённый переход: cancelled -> signed (терминальное состояние)"""
        deal = self._make_deal("cancelled")
        with pytest.raises(ValueError, match="Invalid transition"):
            self.service._validate_transition(deal, "signed")

    def test_invalid_transition_invoiced_to_signed(self):
        """Запрещённый переход: invoiced -> signed (назад)"""
        deal = self._make_deal("invoiced")
        with pytest.raises(ValueError, match="Invalid transition"):
            self.service._validate_transition(deal, "signed")

    def test_any_state_can_be_cancelled(self):
        """Любое не-терминальное состояние может переходить в cancelled"""
        active_states = ["draft", "awaiting_signatures", "signed", "invoiced", "payment_pending", "hold_period"]
        for status in active_states:
            deal = self._make_deal(status)
            self.service._validate_transition(deal, "cancelled")


class TestCreateBankSplitDealInput:
    """Тесты входных данных для создания сделки"""

    def test_input_with_all_fields(self):
        """Создание input со всеми полями"""
        input_data = CreateBankSplitDealInput(
            deal_type="secondary_sell",
            property_address="Москва, ул. Ленина, д. 1",
            price=Decimal("10000000.00"),
            commission_total=Decimal("150000.00"),
            description="Продажа квартиры",
            client_name="Иванов Иван Иванович",
            client_phone="+79001234567",
            client_email="ivanov@example.com",
            agent_user_id=1,
            organization_id=uuid4(),
            agent_split_percent=60,
        )

        assert input_data.deal_type == "secondary_sell"
        assert input_data.price == Decimal("10000000.00")
        assert input_data.agent_split_percent == 60

    def test_input_minimal_fields(self):
        """Создание input с минимальными полями"""
        input_data = CreateBankSplitDealInput(
            deal_type="secondary_buy",
            property_address="СПб, Невский пр. 100",
            price=Decimal("5000000.00"),
            commission_total=Decimal("100000.00"),
            description="Покупка",
            client_name="Петров П.П.",
            client_phone="+79009876543",
        )

        assert input_data.client_email is None
        assert input_data.organization_id is None
        assert input_data.agent_split_percent is None


class TestBankSplitDealServiceMocked:
    """
    Тесты BankSplitDealService с мокнутой БД.

    Используем моки вместо реальной БД для unit-тестирования
    бизнес-логики сервиса.
    """

    def setup_method(self):
        """Настройка моков перед каждым тестом"""
        self.mock_db = AsyncMock()
        self.service = BankSplitDealService(self.mock_db)
        self.service.split_service = AsyncMock()
        self.service.invoice_service = AsyncMock()

    def _make_user(self, user_id: int = 1) -> User:
        """Создаём mock пользователя"""
        user = MagicMock(spec=User)
        user.id = user_id
        user.full_name = "Test Agent"
        user.email = "agent@test.housler.ru"
        return user

    def _make_deal(self, status: str = "draft", deal_id=None) -> Deal:
        """Создаём mock сделку"""
        deal = MagicMock(spec=Deal)
        deal.id = deal_id or uuid4()
        deal.status = status
        deal.payer_email = "client@test.housler.ru"
        deal.client_phone = "+79001234567"
        deal.external_deal_id = None
        deal.payment_link_url = None
        deal.hold_expires_at = None
        return deal

    def _make_recipient(
        self,
        role: RecipientRole = RecipientRole.AGENT,
        amount: Decimal = Decimal("60000.00"),
    ) -> DealSplitRecipient:
        """Создаём mock получателя сплита"""
        recipient = MagicMock(spec=DealSplitRecipient)
        recipient.id = uuid4()
        recipient.role = role.value
        recipient.inn = "123456789012"
        recipient.calculated_amount = amount
        recipient.external_recipient_id = None
        recipient.payout_status = PayoutStatus.PENDING.value
        return recipient

    @pytest.mark.asyncio
    async def test_create_deal_solo_agent(self):
        """Создание сделки соло-агентом (100% комиссии)"""
        # Arrange
        user = self._make_user()
        input_data = CreateBankSplitDealInput(
            deal_type="secondary_sell",
            property_address="Test Address",
            price=Decimal("5000000.00"),
            commission_total=Decimal("100000.00"),
            description="Test Deal",
            client_name="Client",
            client_phone="+79001234567",
        )

        mock_recipients = [self._make_recipient(RecipientRole.AGENT, Decimal("100000.00"))]
        self.service.split_service.get_default_split_percent = AsyncMock(return_value=None)
        self.service.split_service.create_split_recipients = AsyncMock(return_value=mock_recipients)

        # Act
        result = await self.service.create_deal(input_data, user)

        # Assert
        assert isinstance(result, BankSplitDealResult)
        self.mock_db.add.assert_called_once()
        self.mock_db.flush.assert_called()

        # Проверяем, что создан 1 получатель с 100%
        call_args = self.service.split_service.create_split_recipients.call_args
        recipients_input = call_args.kwargs["recipients"]
        assert len(recipients_input) == 1
        assert recipients_input[0].split_value == Decimal("100")

    @pytest.mark.asyncio
    async def test_create_deal_with_agency_split(self):
        """Создание сделки с разделением агент/агентство"""
        # Arrange
        user = self._make_user()
        org_id = uuid4()
        input_data = CreateBankSplitDealInput(
            deal_type="secondary_sell",
            property_address="Test Address",
            price=Decimal("5000000.00"),
            commission_total=Decimal("100000.00"),
            description="Test Deal",
            client_name="Client",
            client_phone="+79001234567",
            organization_id=org_id,
            agent_split_percent=60,
        )

        mock_org = MagicMock(spec=Organization)
        mock_org.inn = "1234567890"
        mock_org.kpp = "123456789"

        mock_recipients = [
            self._make_recipient(RecipientRole.AGENT, Decimal("60000.00")),
            self._make_recipient(RecipientRole.AGENCY, Decimal("40000.00")),
        ]

        self.service._get_organization = AsyncMock(return_value=mock_org)
        self.service.split_service.create_split_recipients = AsyncMock(return_value=mock_recipients)

        # Act
        result = await self.service.create_deal(input_data, user)

        # Assert
        assert len(result.recipients) == 2
        call_args = self.service.split_service.create_split_recipients.call_args
        recipients_input = call_args.kwargs["recipients"]
        assert len(recipients_input) == 2
        assert recipients_input[0].split_value == Decimal("60")
        assert recipients_input[1].split_value == Decimal("40")

    @pytest.mark.asyncio
    async def test_submit_for_signing(self):
        """Переход из draft в awaiting_signatures"""
        # Arrange
        deal = self._make_deal("draft")

        # Act
        result = await self.service.submit_for_signing(deal)

        # Assert
        assert deal.status == "awaiting_signatures"
        self.mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_submit_for_signing_invalid_status(self):
        """Нельзя отправить на подписание сделку не в draft"""
        deal = self._make_deal("signed")

        with pytest.raises(ValueError, match="Invalid transition"):
            await self.service.submit_for_signing(deal)

    @pytest.mark.asyncio
    async def test_mark_signed(self):
        """Переход из awaiting_signatures в signed"""
        deal = self._make_deal("awaiting_signatures")

        result = await self.service.mark_signed(deal)

        assert deal.status == "signed"
        self.mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_mark_signed_invalid_status(self):
        """Нельзя отметить подписанной сделку не в awaiting_signatures"""
        deal = self._make_deal("draft")

        with pytest.raises(ValueError, match="Invalid transition"):
            await self.service.mark_signed(deal)

    @pytest.mark.asyncio
    async def test_create_invoice(self):
        """Создание счёта в T-Bank"""
        # Arrange
        deal = self._make_deal("signed")
        mock_recipients = [
            self._make_recipient(RecipientRole.AGENT, Decimal("60000.00")),
        ]
        mock_recipients[0].external_recipient_id = "tbank-recipient-123"

        self.service.split_service.get_deal_recipients = AsyncMock(return_value=mock_recipients)
        self.service._ensure_recipients_registered = AsyncMock()
        self.service.invoice_service.create_invoice = AsyncMock(return_value=deal)

        # Act
        result = await self.service.create_invoice(deal, return_url="https://example.com/return")

        # Assert
        assert deal.status == "invoiced"
        self.service.invoice_service.create_invoice.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_invoice_no_recipients(self):
        """Ошибка создания счёта без получателей"""
        deal = self._make_deal("signed")
        self.service.split_service.get_deal_recipients = AsyncMock(return_value=[])

        with pytest.raises(ValueError, match="No split recipients"):
            await self.service.create_invoice(deal)

    @pytest.mark.asyncio
    async def test_create_invoice_invalid_status(self):
        """Нельзя создать счёт для сделки не в signed"""
        deal = self._make_deal("draft")

        with pytest.raises(ValueError, match="Invalid transition"):
            await self.service.create_invoice(deal)

    @pytest.mark.asyncio
    async def test_handle_payment_received(self):
        """Обработка получения платежа"""
        # Arrange
        deal = self._make_deal("invoiced")
        mock_recipients = [self._make_recipient()]
        self.service.split_service.get_deal_recipients = AsyncMock(return_value=mock_recipients)

        # Act
        with patch("app.services.bank_split.deal_service.settings") as mock_settings:
            mock_settings.TBANK_HOLD_PERIOD_SECONDS = 3600
            result = await self.service.handle_payment_received(deal)

        # Assert
        assert deal.status == "hold_period"
        assert deal.hold_expires_at is not None
        assert mock_recipients[0].payout_status == PayoutStatus.HOLD.value

    @pytest.mark.asyncio
    async def test_handle_payment_received_wrong_status(self):
        """Платёж в неожиданном статусе логируется, но не падает"""
        deal = self._make_deal("draft")

        result = await self.service.handle_payment_received(deal)

        # Статус не меняется
        assert deal.status == "draft"

    @pytest.mark.asyncio
    async def test_release_from_hold(self):
        """Освобождение сделки из холда"""
        deal = self._make_deal("hold_period")
        self.service.invoice_service.release_deal = AsyncMock(return_value=deal)

        result = await self.service.release_from_hold(deal)

        self.service.invoice_service.release_deal.assert_called_once_with(deal)

    @pytest.mark.asyncio
    async def test_release_from_hold_invalid_status(self):
        """Нельзя освободить сделку не в hold_period"""
        deal = self._make_deal("signed")

        with pytest.raises(ValueError, match="Invalid transition"):
            await self.service.release_from_hold(deal)

    @pytest.mark.asyncio
    async def test_cancel_deal_from_draft(self):
        """Отмена сделки из draft"""
        deal = self._make_deal("draft")

        result = await self.service.cancel_deal(deal, reason="Test cancellation")

        assert deal.status == "cancelled"
        self.mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_deal_with_external_id(self):
        """Отмена сделки с external_deal_id вызывает T-Bank"""
        deal = self._make_deal("invoiced")
        deal.external_deal_id = "tbank-deal-123"
        self.service.invoice_service.cancel_deal = AsyncMock(return_value=deal)

        result = await self.service.cancel_deal(deal, reason="Client cancelled")

        self.service.invoice_service.cancel_deal.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_closed_deal_fails(self):
        """Нельзя отменить закрытую сделку"""
        deal = self._make_deal("closed")

        with pytest.raises(ValueError, match="Cannot cancel closed deal"):
            await self.service.cancel_deal(deal)

    @pytest.mark.asyncio
    async def test_cancel_already_cancelled_deal(self):
        """Повторная отмена уже отменённой сделки - идемпотентно"""
        deal = self._make_deal("cancelled")

        result = await self.service.cancel_deal(deal)

        assert deal.status == "cancelled"
        # flush не вызывается, т.к. сделка уже отменена
        self.mock_db.flush.assert_not_called()


class TestCheckExpiredHolds:
    """Тесты фоновой задачи проверки истёкших холдов"""

    def setup_method(self):
        """Настройка"""
        self.mock_db = AsyncMock()
        self.service = BankSplitDealService(self.mock_db)
        self.service.invoice_service = AsyncMock()

    def _make_expired_deal(self) -> MagicMock:
        """Создаём сделку с истёкшим холдом"""
        deal = MagicMock(spec=Deal)
        deal.id = uuid4()
        deal.status = "hold_period"
        deal.hold_expires_at = datetime.utcnow() - timedelta(hours=1)
        return deal

    @pytest.mark.asyncio
    async def test_check_expired_holds_releases_deals(self):
        """Фоновая задача освобождает сделки с истёкшим холдом"""
        # Arrange
        expired_deal = self._make_expired_deal()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [expired_deal]
        self.mock_db.execute = AsyncMock(return_value=mock_result)
        self.service.release_from_hold = AsyncMock(return_value=expired_deal)

        # Act
        released = await self.service.check_expired_holds()

        # Assert
        assert len(released) == 1
        self.service.release_from_hold.assert_called_once_with(expired_deal)

    @pytest.mark.asyncio
    async def test_check_expired_holds_no_expired(self):
        """Если нет истёкших сделок - возвращается пустой список"""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        self.mock_db.execute = AsyncMock(return_value=mock_result)

        released = await self.service.check_expired_holds()

        assert len(released) == 0

    @pytest.mark.asyncio
    async def test_check_expired_holds_handles_errors(self):
        """Ошибка при освобождении одной сделки не блокирует другие"""
        # Arrange
        deal1 = self._make_expired_deal()
        deal2 = self._make_expired_deal()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [deal1, deal2]
        self.mock_db.execute = AsyncMock(return_value=mock_result)

        # Первая сделка падает, вторая успешно освобождается
        async def release_side_effect(deal):
            if deal == deal1:
                raise TBankError("T-Bank error")
            return deal

        self.service.release_from_hold = AsyncMock(side_effect=release_side_effect)

        # Act
        released = await self.service.check_expired_holds()

        # Assert - только вторая сделка освобождена
        assert len(released) == 1
        assert released[0] == deal2


class TestEnsureRecipientsRegistered:
    """Тесты регистрации получателей в T-Bank"""

    def setup_method(self):
        """Настройка"""
        self.mock_db = AsyncMock()
        self.service = BankSplitDealService(self.mock_db)

    def _make_recipient(
        self,
        inn: str = "123456789012",
        external_id: str = None,
    ) -> MagicMock:
        """Создаём mock получателя"""
        recipient = MagicMock(spec=DealSplitRecipient)
        recipient.id = uuid4()
        recipient.inn = inn
        recipient.external_recipient_id = external_id
        recipient.organization_id = None
        recipient.user_id = 1
        return recipient

    @pytest.mark.asyncio
    async def test_skip_already_registered(self):
        """Пропуск уже зарегистрированных получателей"""
        recipient = self._make_recipient(external_id="already-registered-123")

        with patch("app.services.bank_split.deal_service.get_tbank_deals_client") as mock_client:
            mock_tbank = AsyncMock()
            mock_client.return_value = mock_tbank

            await self.service._ensure_recipients_registered([recipient])

            # create_recipient не вызывается
            mock_tbank.create_recipient.assert_not_called()

    @pytest.mark.asyncio
    async def test_skip_recipients_without_inn(self):
        """Пропуск получателей без ИНН"""
        recipient = self._make_recipient(inn=None)

        with patch("app.services.bank_split.deal_service.get_tbank_deals_client") as mock_client:
            mock_tbank = AsyncMock()
            mock_client.return_value = mock_tbank

            await self.service._ensure_recipients_registered([recipient])

            mock_tbank.create_recipient.assert_not_called()

    @pytest.mark.asyncio
    async def test_register_new_recipient(self):
        """Регистрация нового получателя в T-Bank"""
        recipient = self._make_recipient()

        mock_user = MagicMock()
        mock_user.full_name = "Test User"
        self.service._get_user = AsyncMock(return_value=mock_user)

        with patch("app.services.bank_split.deal_service.get_tbank_deals_client") as mock_client:
            mock_tbank = AsyncMock()
            mock_tbank.create_recipient = AsyncMock(return_value=MagicMock(
                external_id="new-tbank-id-456"
            ))
            mock_client.return_value = mock_tbank

            await self.service._ensure_recipients_registered([recipient])

            mock_tbank.create_recipient.assert_called_once()
            assert recipient.external_recipient_id == "new-tbank-id-456"
            self.mock_db.flush.assert_called()

    @pytest.mark.asyncio
    async def test_tbank_error_propagates(self):
        """Ошибка T-Bank при регистрации пробрасывается"""
        recipient = self._make_recipient()

        mock_user = MagicMock()
        mock_user.full_name = "Test User"
        self.service._get_user = AsyncMock(return_value=mock_user)

        with patch("app.services.bank_split.deal_service.get_tbank_deals_client") as mock_client:
            mock_tbank = AsyncMock()
            mock_tbank.create_recipient = AsyncMock(side_effect=TBankError("Registration failed"))
            mock_client.return_value = mock_tbank

            with pytest.raises(TBankError, match="Registration failed"):
                await self.service._ensure_recipients_registered([recipient])
