/**
 * Рассчитывает аннуитетный ежемесячный платёж по ипотеке.
 *
 * @param principal - Сумма кредита (тело долга) в рублях
 * @param annualRate - Годовая процентная ставка (например, 28 для 28%)
 * @param termYears - Срок кредита в годах
 * @returns Ежемесячный платёж, округлённый до целого числа
 */
export function calculateAnnuityPayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal <= 0 || termYears <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const months = termYears * 12;

  // Формула аннуитетного платежа
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);

  return Math.round(payment);
}

/**
 * Стандартные параметры ипотеки для быстрых расчётов
 */
export const DEFAULT_MORTGAGE_PARAMS = {
  downPaymentPercent: 20,
  termYears: 20,
  annualRate: 28,
} as const;

/**
 * Рассчитывает ежемесячный платёж со стандартными параметрами.
 * Используется для компактного отображения на карточках.
 *
 * @param price - Полная стоимость квартиры
 * @returns Ежемесячный платёж
 */
export function calculateDefaultMortgagePayment(price: number): number {
  const { downPaymentPercent, termYears, annualRate } = DEFAULT_MORTGAGE_PARAMS;
  const downPayment = price * downPaymentPercent / 100;
  const principal = price - downPayment;

  return calculateAnnuityPayment(principal, annualRate, termYears);
}
