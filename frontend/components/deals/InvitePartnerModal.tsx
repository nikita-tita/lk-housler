'use client';

import { useState } from 'react';
import {
  createInvitation,
  InvitationRole,
  INVITATION_ROLE_LABELS,
} from '@/lib/api/invitations';

interface InvitePartnerModalProps {
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  maxSplitPercent?: number;
}

export function InvitePartnerModal({
  dealId,
  isOpen,
  onClose,
  onSuccess,
  maxSplitPercent = 100,
}: InvitePartnerModalProps) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('coagent');
  const [splitPercent, setSplitPercent] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setError('Введите корректный номер телефона');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await createInvitation(dealId, {
        invited_phone: cleanPhone.startsWith('7') ? `+${cleanPhone}` : `+7${cleanPhone}`,
        invited_email: email || undefined,
        role,
        split_percent: splitPercent,
      });

      // Reset form
      setPhone('');
      setEmail('');
      setRole('coagent');
      setSplitPercent(30);

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Ошибка отправки приглашения');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Пригласить партнера</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Телефон партнера *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+7 (999) 123-45-67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                required
              />
            </div>

            {/* Email (optional) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Email (необязательно)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Роль партнера
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InvitationRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              >
                <option value="coagent">{INVITATION_ROLE_LABELS.coagent}</option>
                <option value="agency">{INVITATION_ROLE_LABELS.agency}</option>
              </select>
            </div>

            {/* Split percent */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Доля комиссии партнера: {splitPercent}%
              </label>
              <input
                type="range"
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                min={1}
                max={maxSplitPercent}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1%</span>
                <span>{maxSplitPercent}%</span>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Партнеру будет отправлено SMS с приглашением. После принятия
              приглашения он станет участником сделки с указанной долей комиссии.
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Отправка...' : 'Отправить приглашение'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
