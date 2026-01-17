'use client';

import { clsx } from 'clsx';
import {
  BankSplitStatus,
  BANK_SPLIT_STATUS_LABELS,
  BANK_SPLIT_STATUS_STYLES,
} from '@/lib/api/bank-split';

interface BankSplitStatusBadgeProps {
  status: BankSplitStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function BankSplitStatusBadge({
  status,
  size = 'md',
}: BankSplitStatusBadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-lg font-medium',
        sizeStyles[size],
        BANK_SPLIT_STATUS_STYLES[status]
      )}
    >
      {BANK_SPLIT_STATUS_LABELS[status]}
    </span>
  );
}

// Step indicator for deal progress
interface DealStepIndicatorProps {
  status: BankSplitStatus;
}

const STEP_ORDER: BankSplitStatus[] = [
  'draft',
  'awaiting_signatures',
  'signed',
  'invoiced',
  'payment_pending',
  'hold_period',
  'payout_ready',
  'payout_in_progress',
  'closed',
];

const STEP_LABELS: Partial<Record<BankSplitStatus, string>> = {
  draft: 'Создание',
  awaiting_signatures: 'Подписание',
  signed: 'Подписано',
  invoiced: 'Счет',
  payment_pending: 'Оплата',
  hold_period: 'Удержание',
  payout_ready: 'К выплате',
  closed: 'Закрыто',
};

export function DealStepIndicator({ status }: DealStepIndicatorProps) {
  // Handle terminal states
  if (status === 'cancelled' || status === 'dispute' || status === 'refunded') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-full bg-gray-200 h-1 rounded-full" />
        <BankSplitStatusBadge status={status} size="sm" />
      </div>
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(status);
  const visibleSteps = STEP_ORDER.filter((s) => STEP_LABELS[s]);
  const currentVisibleIndex = visibleSteps.indexOf(status);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {visibleSteps.slice(0, 6).map((step, index) => {
          const isCompleted = currentStepIndex >= STEP_ORDER.indexOf(step);
          const isCurrent = step === status;

          return (
            <div key={step} className="flex flex-col items-center flex-1">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                  isCompleted
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-400 border-gray-300'
                )}
              >
                {index + 1}
              </div>
              <span
                className={clsx(
                  'mt-1 text-xs text-center',
                  isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {visibleSteps.slice(0, 6).map((step, index) => {
          const isCompleted = currentStepIndex >= STEP_ORDER.indexOf(step);
          return (
            <div
              key={step}
              className={clsx(
                'flex-1 h-1 rounded-full',
                isCompleted ? 'bg-black' : 'bg-gray-200'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
