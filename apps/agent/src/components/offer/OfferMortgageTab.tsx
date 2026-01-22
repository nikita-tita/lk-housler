'use client';

import { useState, useMemo } from 'react';
import { calculateAnnuityPayment, DEFAULT_MORTGAGE_PARAMS } from '@/utils/mortgage';

interface OfferMortgageTabProps {
  price: number;
}

export function OfferMortgageTab({ price }: OfferMortgageTabProps) {
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(DEFAULT_MORTGAGE_PARAMS.downPaymentPercent);
  const [term, setTerm] = useState<number>(DEFAULT_MORTGAGE_PARAMS.termYears);
  const [rate, setRate] = useState<number>(DEFAULT_MORTGAGE_PARAMS.annualRate);

  const downPayment = Math.round(price * downPaymentPercent / 100);
  const loanAmount = price - downPayment;

  const monthlyPayment = useMemo(
    () => calculateAnnuityPayment(loanAmount, rate, term),
    [loanAmount, rate, term]
  );

  const formatNumber = (num: number) => num.toLocaleString('ru-RU');

  return (
    <div className="space-y-4">
      {/* Down payment */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
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
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
        />
      </div>

      {/* Term */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
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
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
        />
      </div>

      {/* Rate */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
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
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
        />
      </div>

      {/* Result */}
      <div className="pt-3 border-t border-[var(--color-border)]">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-[var(--color-text-light)]">Ежемесячный платёж</span>
          <span className="text-lg font-semibold">{formatNumber(monthlyPayment)} ₽</span>
        </div>
        <div className="text-xs text-[var(--color-text-light)] mt-1">
          Сумма кредита: {formatNumber(loanAmount)} ₽
        </div>
      </div>

      <p className="text-[10px] text-[var(--color-text-light)]">
        * Расчёт носит информационный характер
      </p>
    </div>
  );
}
