'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { formatPrice, formatArea, formatRooms, formatFloor, api } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AddToSelectionButton } from '@/components/AddToSelectionButton';
import { OfferPdfButton } from '@/components/OfferPdfButton';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { calculateAnnuityPayment, DEFAULT_MORTGAGE_PARAMS } from '@/utils/mortgage';
import type { OfferDetail } from '@/types';

interface OfferInfoPanelProps {
  offer: OfferDetail;
}

export function OfferInfoPanel({ offer }: OfferInfoPanelProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { showToast } = useToast();

  // Collapsible states
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showMortgage, setShowMortgage] = useState(false);

  // Booking form
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Mortgage calculator
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(DEFAULT_MORTGAGE_PARAMS.downPaymentPercent);
  const [term, setTerm] = useState<number>(DEFAULT_MORTGAGE_PARAMS.termYears);
  const [rate, setRate] = useState<number>(DEFAULT_MORTGAGE_PARAMS.annualRate);

  const loanAmount = offer.price - Math.round(offer.price * downPaymentPercent / 100);
  const monthlyPayment = useMemo(
    () => calculateAnnuityPayment(loanAmount, rate, term),
    [loanAmount, rate, term]
  );

  // Prefill form from user
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

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.createBooking({
        offerId: offer.id,
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${formatRooms(offer.rooms, offer.is_studio)}, ${formatArea(offer.area_total)}`,
          text: `${offer.complex_name} - ${formatPrice(offer.price)}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Ссылка скопирована', 'success');
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('ru-RU');

  // Specs to display
  const specs = [
    { label: 'Общая площадь', value: formatArea(offer.area_total) },
    offer.area_living && { label: 'Жилая площадь', value: formatArea(offer.area_living) },
    offer.area_kitchen && { label: 'Кухня', value: formatArea(offer.area_kitchen) },
    { label: 'Этаж', value: formatFloor(offer.floor, offer.floors_total) },
    offer.ceiling_height && { label: 'Потолки', value: `${offer.ceiling_height} м` },
    { label: 'Отделка', value: offer.has_finishing ? 'Чистовая' : 'Без отделки' },
    offer.balcony && { label: 'Балкон', value: offer.balcony },
    offer.bathroom && { label: 'Санузел', value: offer.bathroom },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="card p-5 space-y-4">
      {/* Price Section */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold">{formatPrice(offer.price)}</div>
            <div className="text-sm text-[var(--color-text-light)]">
              {formatPrice(offer.price_per_sqm)}/м²
            </div>
          </div>
          <button
            onClick={() => setShowPriceHistory(!showPriceHistory)}
            className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            История
            <svg className={`w-3 h-3 transition-transform ${showPriceHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {showPriceHistory && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <PriceHistoryChart offerId={offer.id} />
          </div>
        )}
      </div>

      {/* Title & Location */}
      <div className="border-t border-[var(--color-border)] pt-5">
        <h1 className="text-lg font-semibold">
          {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
        </h1>
        <p className="text-sm text-[var(--color-text-light)] mt-1">
          {formatFloor(offer.floor, offer.floors_total)} • {offer.complex_name}
        </p>
        {offer.metro_station && (
          <p className="text-sm text-[var(--color-text-light)] mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--gray-900)]" />
            {offer.metro_station}
            {offer.metro_distance && <span className="opacity-70">• {offer.metro_distance} мин</span>}
          </p>
        )}
      </div>

      {/* Description (if exists, short version) */}
      {offer.description && (
        <div className="text-sm text-[var(--color-text-light)] line-clamp-3">
          {offer.description}
        </div>
      )}

      {/* Actions Grid */}
      <div className="grid grid-cols-2 gap-2">
        <FavoriteButton
          offerId={offer.id}
          size="md"
          className="!w-full !h-auto !rounded-lg !py-2.5 !px-3 !bg-[var(--color-bg-gray)] hover:!bg-gray-200 !shadow-none flex items-center justify-center gap-2"
        />
        <AddToSelectionButton offerId={offer.id} />
        <OfferPdfButton offer={offer} variant="compact" className="!w-full !h-auto !rounded-lg !py-2.5 !bg-[var(--color-bg-gray)] hover:!bg-gray-200" />
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[var(--color-bg-gray)] hover:bg-gray-200 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* Specs - compact grid */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <h2 className="font-semibold mb-2">Характеристики</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {specs.map((spec, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-[var(--color-text-light)]">{spec.label}</span>
              <span className="font-medium">{spec.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Complex Info - compact, no duplicate of complex_name */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">О доме</h2>
          {offer.complex_id && (
            <Link
              href={`/complexes/${offer.complex_id}`}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Подробнее
            </Link>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          {isValidDeveloperName(offer.developer_name) && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-light)]">Застройщик</span>
              <span className="font-medium">{offer.developer_name}</span>
            </div>
          )}
          {offer.completion_date && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-light)]">Сдача</span>
              <span className="font-medium">{offer.completion_date}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-text-light)]">Адрес</span>
            <span className="font-medium text-right max-w-[55%]">{offer.complex_address}</span>
          </div>
        </div>
      </div>

      {/* Mortgage Calculator - Collapsible */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <button
          onClick={() => setShowMortgage(!showMortgage)}
          className="w-full flex items-center justify-between"
        >
          <div className="text-left">
            <div className="font-semibold">Ипотека</div>
            <div className="text-sm text-[var(--color-text-light)]">
              от {formatNumber(monthlyPayment)} ₽/мес
            </div>
          </div>
          <svg className={`w-5 h-5 text-[var(--color-text-light)] transition-transform ${showMortgage ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMortgage && (
          <div className="mt-4 space-y-4">
            {/* Down Payment */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-light)]">Первоначальный взнос</span>
                <span className="font-medium">{formatNumber(Math.round(offer.price * downPaymentPercent / 100))} ₽ ({downPaymentPercent}%)</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
              />
            </div>

            {/* Term */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-light)]">Срок</span>
                <span className="font-medium">{term} лет</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={term}
                onChange={(e) => setTerm(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
              />
            </div>

            {/* Rate */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-light)]">Ставка</span>
                <span className="font-medium">{rate}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="35"
                step="0.5"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--gray-900)]"
              />
            </div>

            {/* Result */}
            <div className="bg-[var(--color-bg-gray)] rounded-lg p-3">
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
        )}
      </div>

      {/* CTA - Booking */}
      <div className="border-t border-[var(--color-border)] pt-4">
        {isSuccess ? (
          <div className="bg-[var(--gray-900)] text-white rounded-lg p-4 text-center">
            <div className="font-medium">Заявка отправлена!</div>
            <div className="text-sm opacity-80 mt-1">Мы свяжемся с вами в ближайшее время</div>
          </div>
        ) : !showBookingForm ? (
          <div>
            <button
              onClick={() => setShowBookingForm(true)}
              className="btn btn-primary w-full py-3 text-base"
            >
              Записаться на просмотр
            </button>
            {/* Guest hint - UNDER the button, not overlay */}
            {!authLoading && !isAuthenticated && (
              <div className="text-center mt-3 text-sm text-[var(--color-text-light)]">
                <Link href="/login" className="text-[var(--color-accent)] hover:underline">Войдите</Link>
                {' '}для быстрой записи
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleBookingSubmit} className="space-y-3">
            <div className="text-xs text-[var(--color-text-light)] mb-2">
              {offer.complex_name} • {formatRooms(offer.rooms, offer.is_studio)}
            </div>

            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="Ваше имя *"
              required
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gray-900)]"
            />

            <input
              type="tel"
              value={formData.clientPhone}
              onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
              placeholder="Телефон *"
              required
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gray-900)]"
            />

            <input
              type="email"
              value={formData.clientEmail}
              onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              placeholder="Email"
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gray-900)]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBookingForm(false)}
                className="btn btn-secondary flex-1 py-2.5"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.clientName || !formData.clientPhone}
                className="btn btn-primary flex-1 py-2.5"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>

            <div className="text-[10px] text-[var(--color-text-light)] text-center">
              Нажимая кнопку, вы соглашаетесь на обработку персональных данных
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
