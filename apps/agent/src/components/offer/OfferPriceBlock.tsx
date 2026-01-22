'use client';

import { useState, useEffect } from 'react';
import { api, formatPrice } from '@/services/api';

interface PricePoint {
  price: number;
  price_per_sqm: number | null;
  recorded_at: string;
}

interface OfferPriceBlockProps {
  offerId: number;
  price: number;
  pricePerSqm: number;
}

export function OfferPriceBlock({ offerId, price, pricePerSqm }: OfferPriceBlockProps) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    api.getPriceHistory(offerId)
      .then(res => {
        if (res.success && res.data) {
          setHistory(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [offerId]);

  // Вычисляем изменение цены
  const priceChange = history.length >= 2
    ? {
        diff: history[history.length - 1].price - history[0].price,
        percent: ((history[history.length - 1].price - history[0].price) / history[0].price * 100).toFixed(1),
      }
    : null;

  return (
    <div className="pb-4 border-b border-[var(--color-border)]">
      {/* Main price */}
      <div className="text-2xl md:text-3xl font-semibold tracking-tight">
        {formatPrice(price)}
      </div>
      <div className="text-sm text-[var(--color-text-light)] mt-1">
        {formatPrice(pricePerSqm)}/м²
      </div>

      {/* Price change indicator */}
      {!isLoading && priceChange && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex items-center gap-1.5 text-sm group"
        >
          <span className={priceChange.diff > 0 ? 'text-[var(--color-text)]' : 'text-[var(--color-text-light)]'}>
            {priceChange.diff > 0 ? '▲' : '▼'} {priceChange.diff > 0 ? '+' : ''}{formatPrice(priceChange.diff)}
            <span className="ml-1 opacity-70">({priceChange.diff > 0 ? '+' : ''}{priceChange.percent}%)</span>
          </span>
          <svg
            className={`w-4 h-4 text-[var(--color-text-light)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Expanded price history */}
      {isExpanded && history.length > 1 && (
        <div className="mt-3 p-3 bg-[var(--color-bg-gray)] rounded-lg">
          <div className="text-xs font-medium text-[var(--color-text-light)] mb-2">
            История цены
          </div>

          {/* Mini chart */}
          <PriceChart history={history} />

          {/* Price range */}
          <div className="flex justify-between text-xs text-[var(--color-text-light)] mt-2">
            <span>Мин: {formatPrice(Math.min(...history.map(h => h.price)))}</span>
            <span>Макс: {formatPrice(Math.max(...history.map(h => h.price)))}</span>
          </div>
        </div>
      )}

      {/* No history message */}
      {!isLoading && history.length <= 1 && (
        <div className="mt-2 text-xs text-[var(--color-text-light)]">
          Цена не менялась
        </div>
      )}
    </div>
  );
}

// Mini price chart component
function PriceChart({ history }: { history: PricePoint[] }) {
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const width = 200;
  const height = 50;
  const padding = 5;

  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((h.price - minPrice) / priceRange) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
        {/* Grid line */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />

        {/* Price line */}
        <path d={pathD} fill="none" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {history.map((h, i) => {
          const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
          const y = height - padding - ((h.price - minPrice) / priceRange) * (height - 2 * padding);
          return <circle key={i} cx={x} cy={y} r="2" fill="#1f2937" />;
        })}
      </svg>

      {/* Date labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-text-light)] mt-1">
        <span>{new Date(history[0].recorded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
        <span>{new Date(history[history.length - 1].recorded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}
