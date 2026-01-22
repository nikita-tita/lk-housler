'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface OfferBookingInlineProps {
  offerId: number;
  complexName: string;
}

export function OfferBookingInline({ offerId, complexName }: OfferBookingInlineProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Prefill from user
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
    setIsSubmitting(true);

    try {
      const response = await api.createBooking({
        offerId,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        clientEmail: formData.clientEmail || undefined,
      });

      if (response.success) {
        setIsSuccess(true);
        showToast('Заявка отправлена!', 'success');
      } else {
        showToast(response.error || 'Ошибка отправки', 'error');
      }
    } catch {
      showToast('Ошибка отправки заявки', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="bg-[var(--gray-900)] text-white rounded-lg p-4 text-center">
        <div className="font-medium">Заявка отправлена!</div>
        <div className="text-sm opacity-80 mt-1">Мы свяжемся с вами</div>
      </div>
    );
  }

  // Not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="relative">
        <button
          disabled
          className="btn btn-primary w-full opacity-50 cursor-not-allowed"
        >
          Записаться на просмотр
        </button>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
          <Link href="/login" className="btn btn-primary btn-sm">
            Войти
          </Link>
        </div>
      </div>
    );
  }

  // Collapsed state
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="btn btn-primary w-full"
      >
        Записаться на просмотр
      </button>
    );
  }

  // Expanded form
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="text-xs text-[var(--color-text-light)] mb-2">
        {complexName}
      </div>

      <input
        type="text"
        value={formData.clientName}
        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
        placeholder="Ваше имя *"
        required
        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--gray-900)]"
      />

      <input
        type="tel"
        value={formData.clientPhone}
        onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
        placeholder="Телефон *"
        required
        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--gray-900)]"
      />

      <input
        type="email"
        value={formData.clientEmail}
        onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
        placeholder="Email"
        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--gray-900)]"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="btn btn-secondary flex-1 text-sm py-2"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !formData.clientName || !formData.clientPhone}
          className="btn btn-primary flex-1 text-sm py-2"
        >
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </button>
      </div>

      <div className="text-[10px] text-[var(--color-text-light)] text-center">
        Нажимая кнопку, вы соглашаетесь на обработку персональных данных
      </div>
    </form>
  );
}
