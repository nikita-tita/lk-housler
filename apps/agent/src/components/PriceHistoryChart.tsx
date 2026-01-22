'use client';

import { useState, useEffect } from 'react';
import { api, formatPrice } from '@/services/api';

interface PricePoint {
  price: number;
  price_per_sqm: number | null;
  recorded_at: string;
}

interface PriceHistoryChartProps {
  offerId: number;
}

export function PriceHistoryChart({ offerId }: PriceHistoryChartProps) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPriceHistory(offerId)
      .then(res => {
        if (res.success && res.data) {
          setHistory(res.data);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [offerId]);

  if (isLoading) {
    return (
      <div className="animate-pulse h-32 bg-[var(--color-bg-gray)] rounded-lg" />
    );
  }

  if (error || history.length === 0) {
    return null; // Не показываем блок если нет истории
  }

  // Если только одна запись — показываем сообщение
  if (history.length === 1) {
    return (
      <div className="p-4 bg-[var(--color-bg-gray)] rounded-lg text-sm text-[var(--color-text-light)]">
        Цена не менялась с момента публикации
      </div>
    );
  }

  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const priceDiff = lastPrice - firstPrice;
  const percentChange = ((priceDiff / firstPrice) * 100).toFixed(1);

  // SVG dimensions
  const width = 300;
  const height = 80;
  const padding = 10;

  // Generate path
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((h.price - minPrice) / priceRange) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const isUp = priceDiff > 0;
  const color = '#1f2937'; // gray-800 for the line

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">История цены</span>
        <span className={`text-sm font-medium ${isUp ? 'text-[var(--color-text)]' : 'text-[var(--color-text-light)]'}`}>
          {isUp ? '+' : ''}{formatPrice(priceDiff)} ({isUp ? '+' : ''}{percentChange}%)
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />

          {/* Price line */}
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots */}
          {history.map((h, i) => {
            const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((h.price - minPrice) / priceRange) * (height - 2 * padding);
            return (
              <circle key={i} cx={x} cy={y} r="3" fill={color} />
            );
          })}
        </svg>

        {/* Labels */}
        <div className="flex justify-between text-xs text-[var(--color-text-light)] mt-1">
          <span>{new Date(history[0].recorded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
          <span>{new Date(history[history.length - 1].recorded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      {/* Price range */}
      <div className="flex justify-between text-xs text-[var(--color-text-light)]">
        <span>Мин: {formatPrice(minPrice)}</span>
        <span>Макс: {formatPrice(maxPrice)}</span>
      </div>
    </div>
  );
}
