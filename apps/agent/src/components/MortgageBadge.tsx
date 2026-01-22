'use client';

import { useMemo, useState } from 'react';
import { calculateDefaultMortgagePayment, DEFAULT_MORTGAGE_PARAMS } from '@/utils/mortgage';

interface MortgageBadgeProps {
  price: number;
  className?: string;
}

/**
 * Компактный бейдж с ипотечным платежом для карточки объекта.
 * Показывает примерный ежемесячный платёж при стандартных условиях.
 */
export function MortgageBadge({ price, className = '' }: MortgageBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { downPaymentPercent, termYears: term, annualRate: rate } = DEFAULT_MORTGAGE_PARAMS;

  const monthlyPayment = useMemo(
    () => calculateDefaultMortgagePayment(price),
    [price]
  );

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${Math.round(num / 1000)} тыс.`;
    }
    return num.toLocaleString('ru-RU');
  };

  if (monthlyPayment <= 0) return null;

  return (
    <div
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-xs text-[var(--color-text-light)]">
        ≈ {formatNumber(monthlyPayment)} ₽/мес
      </span>

      {/* Иконка информации */}
      <svg
        className="w-3.5 h-3.5 text-[var(--color-text-light)] cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Тултип */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-[var(--color-text)] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          <div>При {downPaymentPercent}% взносе, {term} лет, {rate}%</div>
          <div className="absolute bottom-0 left-4 translate-y-1/2 rotate-45 w-2 h-2 bg-[var(--color-text)]"></div>
        </div>
      )}
    </div>
  );
}
