'use client';

import { useState, useEffect } from 'react';

export interface SplitParticipant {
  id: string;
  name: string;
  role: 'agent' | 'coagent' | 'agency' | 'platform';
  percent: number;
  amount?: number;
  locked?: boolean; // Cannot be changed (e.g., platform fee)
}

interface SplitSliderProps {
  totalAmount: number;
  platformFeePercent: number;
  participants: SplitParticipant[];
  onChange: (participants: SplitParticipant[]) => void;
  minPercent?: number; // Minimum percent per participant
  showAmounts?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  agent: 'Агент',
  coagent: 'Со-агент',
  agency: 'Агентство',
  platform: 'Комиссия платформы',
};

const ROLE_COLORS: Record<string, string> = {
  agent: 'bg-gray-900',
  coagent: 'bg-gray-600',
  agency: 'bg-gray-400',
  platform: 'bg-gray-300',
};

export function SplitSlider({
  totalAmount,
  platformFeePercent,
  participants,
  onChange,
  minPercent = 1,
  showAmounts = true,
}: SplitSliderProps) {
  // Calculate amounts based on percentages
  const calculateAmounts = (parts: SplitParticipant[]): SplitParticipant[] => {
    return parts.map((p) => ({
      ...p,
      amount: Math.round((totalAmount * p.percent) / 100),
    }));
  };

  const handlePercentChange = (id: string, newPercent: number) => {
    // Find unlocked participants (excluding the one being changed)
    const currentParticipant = participants.find((p) => p.id === id);
    const lockedTotal = participants
      .filter((p) => p.locked || p.id === id)
      .reduce((sum, p) => sum + (p.id === id ? newPercent : p.percent), 0);

    // Distribute remaining percentage among other unlocked participants
    const remainingPercent = 100 - lockedTotal;
    const otherUnlocked = participants.filter((p) => !p.locked && p.id !== id);
    const currentOthersTotal = otherUnlocked.reduce((sum, p) => sum + p.percent, 0);

    const newParticipants = participants.map((p) => {
      if (p.id === id) {
        return { ...p, percent: newPercent };
      }
      if (p.locked) {
        return p;
      }
      // Proportionally adjust other participants
      const proportion = currentOthersTotal > 0 ? p.percent / currentOthersTotal : 1 / otherUnlocked.length;
      const adjustedPercent = Math.max(minPercent, Math.round(remainingPercent * proportion));
      return { ...p, percent: adjustedPercent };
    });

    // Normalize to ensure total is 100%
    const total = newParticipants.reduce((sum, p) => sum + p.percent, 0);
    if (total !== 100) {
      // Adjust the last unlocked participant
      const lastUnlocked = [...newParticipants].reverse().find((p) => !p.locked && p.id !== id);
      if (lastUnlocked) {
        const idx = newParticipants.findIndex((p) => p.id === lastUnlocked.id);
        newParticipants[idx] = {
          ...newParticipants[idx],
          percent: newParticipants[idx].percent + (100 - total),
        };
      }
    }

    onChange(calculateAmounts(newParticipants));
  };

  // Calculate total and validate
  const total = participants.reduce((sum, p) => sum + p.percent, 0);
  const isValid = total === 100;

  return (
    <div className="space-y-4">
      {/* Visual bar */}
      <div className="h-8 flex rounded-lg overflow-hidden border border-gray-200">
        {participants.map((p) => (
          <div
            key={p.id}
            className={`${ROLE_COLORS[p.role]} flex items-center justify-center text-xs text-white font-medium transition-all duration-200`}
            style={{ width: `${p.percent}%` }}
            title={`${ROLE_LABELS[p.role]}: ${p.percent}%`}
          >
            {p.percent >= 10 && `${p.percent}%`}
          </div>
        ))}
      </div>

      {/* Sliders for each participant */}
      <div className="space-y-3">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-4">
            <div className="w-32 flex-shrink-0">
              <div className="text-sm font-medium">{p.name || ROLE_LABELS[p.role]}</div>
              <div className="text-xs text-gray-500">{ROLE_LABELS[p.role]}</div>
            </div>

            <div className="flex-1">
              <input
                type="range"
                value={p.percent}
                onChange={(e) => handlePercentChange(p.id, Number(e.target.value))}
                min={minPercent}
                max={100 - participants.filter((x) => x.id !== p.id && x.locked).reduce((s, x) => s + x.percent, 0) - (participants.length - 1) * minPercent}
                disabled={p.locked}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                  p.locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-200 accent-black'
                }`}
              />
            </div>

            <div className="w-20 text-right">
              <div className="text-sm font-medium">{p.percent}%</div>
              {showAmounts && (
                <div className="text-xs text-gray-500">
                  {((totalAmount * p.percent) / 100).toLocaleString('ru-RU')} RUB
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Всего:</span>
          <span className={`font-medium ${isValid ? 'text-gray-900' : 'text-red-600'}`}>
            {total}%
            {!isValid && ' (должно быть 100%)'}
          </span>
        </div>
        {showAmounts && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Сумма:</span>
            <span className="font-medium">{totalAmount.toLocaleString('ru-RU')} RUB</span>
          </div>
        )}
      </div>
    </div>
  );
}
