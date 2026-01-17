'use client';

import { clsx } from 'clsx';
import {
  Recipient,
  RecipientRole,
  RECIPIENT_ROLE_LABELS,
} from '@/lib/api/bank-split';
import { formatPrice } from '@/lib/utils/format';

interface SplitRecipientsProps {
  recipients: Recipient[];
  totalCommission: number;
}

export function SplitRecipients({
  recipients,
  totalCommission,
}: SplitRecipientsProps) {
  if (!recipients || recipients.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900">
        Распределение комиссии
      </h4>
      <div className="space-y-2">
        {recipients.map((recipient) => (
          <RecipientRow
            key={recipient.id}
            recipient={recipient}
            totalCommission={totalCommission}
          />
        ))}
      </div>
      <div className="pt-2 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-900">Итого</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatPrice(totalCommission)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface RecipientRowProps {
  recipient: Recipient;
  totalCommission: number;
}

function RecipientRow({ recipient, totalCommission }: RecipientRowProps) {
  const calculatedAmount =
    recipient.calculated_amount ||
    Math.round(totalCommission * (recipient.split_value / 100));

  const payoutStatusLabels: Record<string, string> = {
    pending: 'Ожидает',
    ready: 'Готов к выплате',
    processing: 'В процессе',
    completed: 'Выплачено',
    failed: 'Ошибка',
  };

  const payoutStatusStyles: Record<string, string> = {
    pending: 'text-gray-500',
    ready: 'text-gray-700',
    processing: 'text-gray-600',
    completed: 'text-gray-900',
    failed: 'text-gray-900',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
          <RoleIcon role={recipient.role} />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {RECIPIENT_ROLE_LABELS[recipient.role]}
          </div>
          <div className="text-xs text-gray-500">
            {recipient.split_value}% от комиссии
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900">
          {formatPrice(calculatedAmount)}
        </div>
        <div
          className={clsx('text-xs', payoutStatusStyles[recipient.payout_status])}
        >
          {payoutStatusLabels[recipient.payout_status]}
        </div>
      </div>
    </div>
  );
}

function RoleIcon({ role }: { role: RecipientRole }) {
  // Simple icons using SVG
  switch (role) {
    case 'agent':
      return (
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case 'coagent':
      return (
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      );
    case 'agency':
      return (
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    default:
      return null;
  }
}

// Compact version for list views
export function SplitRecipientsCompact({
  recipients,
}: {
  recipients: Recipient[];
}) {
  if (!recipients || recipients.length === 0) {
    return <span className="text-gray-500 text-sm">100% агент</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {recipients.map((r) => (
        <span
          key={r.id}
          className="text-xs bg-gray-100 px-2 py-1 rounded"
          title={RECIPIENT_ROLE_LABELS[r.role]}
        >
          {r.split_value}% {RECIPIENT_ROLE_LABELS[r.role].toLowerCase()}
        </span>
      ))}
    </div>
  );
}
