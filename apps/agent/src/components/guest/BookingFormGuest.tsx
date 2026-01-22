'use client';

import { useState } from 'react';
import { api } from '@/services/api';
import { useGuest } from '@/contexts/GuestContext';
import { PhoneInput } from '@/components/auth/PhoneInput';

interface BookingFormGuestProps {
  offerId: number;
  complexName: string;
}

export function BookingFormGuest({ offerId, complexName }: BookingFormGuestProps) {
  const { getGuestClientId, selectionCode, context } = useGuest();

  const [isOpen, setIsOpen] = useState(true); // По умолчанию открыта для гостей
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const agentName = context?.agent?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const guestClientId = getGuestClientId();

      const response = await api.createGuestBooking({
        offerId,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        clientEmail: formData.clientEmail || undefined,
        comment: formData.comment || undefined,
        guestClientId,
        sourceSelectionCode: selectionCode || undefined,
      });

      if (response.success) {
        setIsSuccess(true);
        setFormData({ clientName: '', clientPhone: '', clientEmail: '', comment: '' });
      } else {
        setError(response.error || 'Ошибка отправки заявки');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки заявки');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-[var(--gray-900)] text-white rounded-lg p-6 text-center">
        <div className="text-lg font-medium mb-2">Заявка отправлена!</div>
        <div className="text-sm opacity-90 mb-2">
          {agentName
            ? `${agentName} свяжется с вами в ближайшее время`
            : 'Мы свяжемся с вами в ближайшее время'}
        </div>
        <button
          onClick={() => setIsSuccess(false)}
          className="mt-4 text-sm opacity-75 hover:opacity-100"
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium">Оставить заявку на просмотр</span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="text-sm text-[var(--color-text-light)] mb-4">
            Объект: {complexName}
            {agentName && (
              <span className="block mt-1">Ваш агент: {agentName}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ваше имя *</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Телефон *</label>
            <PhoneInput
              value={formData.clientPhone}
              onChange={(phone) => setFormData({ ...formData, clientPhone: phone })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.clientEmail}
              onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={3}
              placeholder="Удобное время для связи, вопросы..."
              className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
            />
          </div>

          {error && (
            <div className="text-[var(--color-text)] text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !formData.clientName || !formData.clientPhone}
            className="btn btn-primary btn-block"
          >
            {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
          </button>

          <div className="text-xs text-[var(--color-text-light)] text-center">
            Нажимая кнопку, вы соглашаетесь на обработку персональных данных
          </div>
        </form>
      )}
    </div>
  );
}
