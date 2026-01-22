'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/auth/PhoneInput';

interface BookingFormProps {
  offerId: number;
  complexName: string;
}

// Генерация UUID для гостя (без зависимости от GuestContext)
function generateGuestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Ключ для localStorage
const GUEST_ID_KEY = 'housler_booking_guest_id';

export function BookingForm({ offerId, complexName }: BookingFormProps) {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(true); // UX-002: форма открыта по умолчанию
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isGuestBooking, setIsGuestBooking] = useState(false); // Для показа предложения регистрации
  const [error, setError] = useState('');

  // Получаем или создаём guestClientId
  const getGuestClientId = useCallback((): string => {
    if (typeof window === 'undefined') return generateGuestId();

    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
      guestId = generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
  }, []);

  // Предзаполняем данные из профиля пользователя
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        clientName: user.name || prev.clientName,
        clientPhone: user.phone || prev.clientPhone,
        clientEmail: user.email || prev.clientEmail,
      }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let response;

      if (isAuthenticated) {
        // Авторизованный пользователь — обычное бронирование
        response = await api.createBooking({
          offerId,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientEmail: formData.clientEmail || undefined,
          comment: formData.comment || undefined,
        });
        setIsGuestBooking(false);
      } else {
        // UX-001: Гостевое бронирование без авторизации
        const guestClientId = getGuestClientId();
        response = await api.createGuestBooking({
          offerId,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientEmail: formData.clientEmail || undefined,
          comment: formData.comment || undefined,
          guestClientId,
        });
        setIsGuestBooking(true);
      }

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
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-lg font-medium mb-2">Заявка отправлена!</div>
        <div className="text-sm opacity-90 mb-4">
          Мы свяжемся с вами в ближайшее время
        </div>

        {/* UX-001: Предложение регистрации для гостей */}
        {isGuestBooking && (
          <div className="border-t border-white/20 pt-4 mt-4">
            <p className="text-sm opacity-75 mb-3">
              Хотите отслеживать статус заявки?
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-white text-[var(--gray-900)] rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Зарегистрироваться
            </Link>
          </div>
        )}

        <button
          onClick={() => setIsSuccess(false)}
          className="mt-4 text-sm opacity-75 hover:opacity-100 block mx-auto"
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  // UX-001: Убран blur overlay — форма доступна всем

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
