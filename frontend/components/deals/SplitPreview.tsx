'use client';

import { SplitParticipant } from './SplitSlider';

interface SplitPreviewProps {
  totalAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  totalClientPayment: number;
  participants: SplitParticipant[];
}

const ROLE_COLORS: Record<string, string> = {
  agent: 'border-gray-900',
  coagent: 'border-gray-600',
  agency: 'border-gray-400',
  platform: 'border-gray-300',
};

const ROLE_LABELS: Record<string, string> = {
  agent: 'Агент',
  coagent: 'Со-агент',
  agency: 'Агентство',
  platform: 'Комиссия платформы',
};

export function SplitPreview({
  totalAmount,
  platformFeePercent,
  platformFeeAmount,
  totalClientPayment,
  participants,
}: SplitPreviewProps) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <h3 className="font-medium text-gray-900">Распределение комиссии</h3>

      {/* Client payment */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Клиент оплачивает</div>
        <div className="text-xl font-semibold">{formatCurrency(totalClientPayment)} RUB</div>
        <div className="text-xs text-gray-500 mt-1">
          Комиссия {formatCurrency(totalAmount)} + сбор платформы {platformFeePercent}%
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className={`bg-white rounded-lg p-3 border-l-4 ${ROLE_COLORS[p.role]} border border-gray-200`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">{p.name || ROLE_LABELS[p.role]}</div>
                <div className="text-xs text-gray-500">{ROLE_LABELS[p.role]}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(p.amount || 0)} RUB</div>
                <div className="text-xs text-gray-500">{p.percent}%</div>
              </div>
            </div>
          </div>
        ))}

        {/* Platform fee */}
        <div className="bg-white rounded-lg p-3 border-l-4 border-gray-300 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-sm">Сбор платформы</div>
              <div className="text-xs text-gray-500">Housler ({platformFeePercent}%)</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatCurrency(platformFeeAmount)} RUB</div>
              <div className="text-xs text-gray-500">{platformFeePercent}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Итого к распределению:</span>
          <span className="font-medium">{formatCurrency(totalClientPayment)} RUB</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Проверка:</span>
          <span>
            {formatCurrency(participants.reduce((s, p) => s + (p.amount || 0), 0) + platformFeeAmount)} RUB
          </span>
        </div>
      </div>
    </div>
  );
}
