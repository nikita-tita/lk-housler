"""Сервис расчета комиссии и авансов

Логика расчетов:
- Комиссия: процент / фикс / смешанная
- Аванс: нет / фикс / процент от комиссии
- Комиссия платформы: 4% от комиссии агента
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from app.core.config import settings
from app.models.deal import PaymentType, AdvanceType


# Константы
PLATFORM_FEE_PERCENT = Decimal("4")  # 4% комиссия платформы


@dataclass
class PaymentStep:
    """Шаг в плане платежей"""
    type: str  # "advance" | "final" | "full"
    amount: Decimal
    when: str  # Описание момента оплаты
    is_paid: bool = False


@dataclass
class CommissionResult:
    """Результат расчета комиссии"""
    property_price: Decimal  # Цена объекта
    total_commission: Decimal  # Общая комиссия агента
    platform_fee: Decimal  # Комиссия платформы (4%)
    agent_receives: Decimal  # Агент получает (total - platform_fee)
    advance_amount: Decimal  # Сумма аванса
    final_payment: Decimal  # Финальный платеж (после сделки)
    payment_steps: List[PaymentStep]  # План платежей

    def to_dict(self) -> dict:
        """Конвертация в словарь для API"""
        return {
            "property_price": float(self.property_price),
            "total_commission": float(self.total_commission),
            "platform_fee": float(self.platform_fee),
            "agent_receives": float(self.agent_receives),
            "advance_amount": float(self.advance_amount),
            "final_payment": float(self.final_payment),
            "payment_steps": [
                {
                    "type": step.type,
                    "amount": float(step.amount),
                    "when": step.when,
                    "is_paid": step.is_paid,
                }
                for step in self.payment_steps
            ],
        }


class CommissionCalculator:
    """Калькулятор комиссии и платежей"""

    def __init__(
        self,
        platform_fee_percent: Decimal = PLATFORM_FEE_PERCENT,
    ):
        self.platform_fee_percent = platform_fee_percent

    def calculate_commission(
        self,
        property_price: Decimal,
        payment_type: PaymentType,
        commission_percent: Optional[Decimal] = None,
        commission_fixed: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Расчет комиссии агента.

        Args:
            property_price: Цена объекта недвижимости
            payment_type: Тип оплаты (percent/fixed/mixed)
            commission_percent: Процент комиссии (для percent/mixed)
            commission_fixed: Фиксированная сумма (для fixed/mixed)

        Returns:
            Сумма комиссии агента
        """
        if payment_type == PaymentType.PERCENT:
            if commission_percent is None:
                raise ValueError("commission_percent обязателен для типа percent")
            return self._round_amount(property_price * (commission_percent / Decimal("100")))

        elif payment_type == PaymentType.FIXED:
            if commission_fixed is None:
                raise ValueError("commission_fixed обязателен для типа fixed")
            return self._round_amount(commission_fixed)

        elif payment_type == PaymentType.MIXED:
            if commission_percent is None or commission_fixed is None:
                raise ValueError("commission_percent и commission_fixed обязательны для типа mixed")
            percent_part = property_price * (commission_percent / Decimal("100"))
            return self._round_amount(commission_fixed + percent_part)

        raise ValueError(f"Неизвестный тип оплаты: {payment_type}")

    def calculate_advance(
        self,
        total_commission: Decimal,
        advance_type: AdvanceType,
        advance_amount: Optional[Decimal] = None,
        advance_percent: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Расчет аванса.

        Args:
            total_commission: Общая сумма комиссии
            advance_type: Тип аванса (none/advance_fixed/advance_percent)
            advance_amount: Сумма аванса (для fixed)
            advance_percent: Процент аванса (для percent)

        Returns:
            Сумма аванса
        """
        if advance_type == AdvanceType.NONE:
            return Decimal("0")

        elif advance_type == AdvanceType.FIXED:
            if advance_amount is None:
                raise ValueError("advance_amount обязателен для типа advance_fixed")
            # Аванс не может быть больше комиссии
            return self._round_amount(min(advance_amount, total_commission))

        elif advance_type == AdvanceType.PERCENT:
            if advance_percent is None:
                raise ValueError("advance_percent обязателен для типа advance_percent")
            return self._round_amount(total_commission * (advance_percent / Decimal("100")))

        raise ValueError(f"Неизвестный тип аванса: {advance_type}")

    def calculate_platform_fee(self, total_commission: Decimal) -> Decimal:
        """Расчет комиссии платформы"""
        return self._round_amount(total_commission * (self.platform_fee_percent / Decimal("100")))

    def calculate_full(
        self,
        property_price: Decimal,
        payment_type: PaymentType,
        commission_percent: Optional[Decimal] = None,
        commission_fixed: Optional[Decimal] = None,
        advance_type: AdvanceType = AdvanceType.NONE,
        advance_amount: Optional[Decimal] = None,
        advance_percent: Optional[Decimal] = None,
    ) -> CommissionResult:
        """
        Полный расчет комиссии, аванса и плана платежей.

        Args:
            property_price: Цена объекта
            payment_type: Тип оплаты комиссии
            commission_percent: Процент комиссии
            commission_fixed: Фиксированная комиссия
            advance_type: Тип аванса
            advance_amount: Сумма аванса
            advance_percent: Процент аванса

        Returns:
            CommissionResult с полным расчетом
        """
        # Валидация минимальной суммы
        if property_price < settings.MIN_DEAL_AMOUNT:
            raise ValueError(
                f"Цена объекта ({property_price} руб) меньше минимальной ({settings.MIN_DEAL_AMOUNT} руб)"
            )

        if property_price > settings.MAX_DEAL_AMOUNT:
            raise ValueError(
                f"Цена объекта ({property_price} руб) превышает максимальную ({settings.MAX_DEAL_AMOUNT} руб)"
            )

        # Расчет комиссии
        total_commission = self.calculate_commission(
            property_price=property_price,
            payment_type=payment_type,
            commission_percent=commission_percent,
            commission_fixed=commission_fixed,
        )

        # Комиссия платформы
        platform_fee = self.calculate_platform_fee(total_commission)

        # Агент получает
        agent_receives = total_commission - platform_fee

        # Расчет аванса (от того, что получает агент)
        advance = self.calculate_advance(
            total_commission=agent_receives,
            advance_type=advance_type,
            advance_amount=advance_amount,
            advance_percent=advance_percent,
        )

        # Финальный платеж
        final_payment = agent_receives - advance

        # План платежей
        payment_steps = []
        if advance > 0:
            payment_steps.append(PaymentStep(
                type="advance",
                amount=advance,
                when="до начала работ",
            ))
            payment_steps.append(PaymentStep(
                type="final",
                amount=final_payment,
                when="после завершения сделки",
            ))
        else:
            payment_steps.append(PaymentStep(
                type="full",
                amount=agent_receives,
                when="после завершения сделки",
            ))

        return CommissionResult(
            property_price=property_price,
            total_commission=total_commission,
            platform_fee=platform_fee,
            agent_receives=agent_receives,
            advance_amount=advance,
            final_payment=final_payment,
            payment_steps=payment_steps,
        )

    def validate_commission_input(
        self,
        payment_type: PaymentType,
        commission_percent: Optional[Decimal] = None,
        commission_fixed: Optional[Decimal] = None,
    ) -> List[str]:
        """
        Валидация входных данных для расчета комиссии.

        Returns:
            Список ошибок (пустой если все ок)
        """
        errors = []

        if payment_type == PaymentType.PERCENT:
            if commission_percent is None:
                errors.append("Процент комиссии обязателен для типа 'процент'")
            elif commission_percent <= 0 or commission_percent > 100:
                errors.append("Процент комиссии должен быть от 0.01 до 100")

        elif payment_type == PaymentType.FIXED:
            if commission_fixed is None:
                errors.append("Сумма комиссии обязательна для типа 'фикс'")
            elif commission_fixed <= 0:
                errors.append("Сумма комиссии должна быть положительной")

        elif payment_type == PaymentType.MIXED:
            if commission_percent is None:
                errors.append("Процент комиссии обязателен для смешанного типа")
            elif commission_percent <= 0 or commission_percent > 100:
                errors.append("Процент комиссии должен быть от 0.01 до 100")
            if commission_fixed is None:
                errors.append("Сумма фикса обязательна для смешанного типа")
            elif commission_fixed < 0:
                errors.append("Сумма фикса не может быть отрицательной")

        return errors

    def _round_amount(self, amount: Decimal) -> Decimal:
        """Округление суммы до копеек"""
        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# Глобальный экземпляр для использования в API
commission_calculator = CommissionCalculator()
