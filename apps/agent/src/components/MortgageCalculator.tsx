'use client';

import { useState, useMemo } from 'react';
import { calculateAnnuityPayment, DEFAULT_MORTGAGE_PARAMS } from '@/utils/mortgage';

interface MortgageCalculatorProps {
  price: number;
  className?: string;
}

export function MortgageCalculator({ price, className = '' }: MortgageCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(DEFAULT_MORTGAGE_PARAMS.downPaymentPercent);
  const [term, setTerm] = useState<number>(DEFAULT_MORTGAGE_PARAMS.termYears);
  const [rate, setRate] = useState<number>(DEFAULT_MORTGAGE_PARAMS.annualRate);

  const downPayment = Math.round(price * downPaymentPercent / 100);
  const loanAmount = price - downPayment;

  const monthlyPayment = useMemo(
    () => calculateAnnuityPayment(loanAmount, rate, term),
    [loanAmount, rate, term]
  );
  const totalPayment = monthlyPayment * term * 12;
  const overpayment = totalPayment - loanAmount;

  const formatNumber = (num: number) => {
    return num.toLocaleString('ru-RU');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full px-4 py-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium ${className}`}
      >
        Рассчитать ипотеку
      </button>
    );
  }

  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold">Ипотечный калькулятор</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[var(--color-text-light)] hover:text-[var(--color-text)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Первоначальный взнос */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--color-text-light)]">Первоначальный взнос</span>
          <span className="font-medium">{formatNumber(downPayment)} ₽ ({downPaymentPercent}%)</span>
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="5"
          value={downPaymentPercent}
          onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-text)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-light)] mt-1">
          <span>10%</span>
          <span>90%</span>
        </div>
      </div>

      {/* Срок */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--color-text-light)]">Срок кредита</span>
          <span className="font-medium">{term} лет</span>
        </div>
        <input
          type="range"
          min="1"
          max="30"
          step="1"
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-text)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-light)] mt-1">
          <span>1 год</span>
          <span>30 лет</span>
        </div>
      </div>

      {/* Ставка */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--color-text-light)]">Процентная ставка</span>
          <span className="font-medium">{rate}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="35"
          step="0.5"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-text)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-light)] mt-1">
          <span>1%</span>
          <span>35%</span>
        </div>
      </div>

      {/* Результат */}
      <div className="border-t border-[var(--color-border)] pt-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-light)]">Сумма кредита</span>
          <span className="font-medium">{formatNumber(loanAmount)} ₽</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-light)]">Ежемесячный платёж</span>
          <span className="text-xl font-semibold">{formatNumber(monthlyPayment)} ₽</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-light)]">Переплата</span>
          <span className="text-[var(--color-text-light)]">{formatNumber(overpayment)} ₽</span>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-light)] mt-4">
        * Расчёт носит информационный характер и не является публичной офертой
      </p>
    </div>
  );
}
