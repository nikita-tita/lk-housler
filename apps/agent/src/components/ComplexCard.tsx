'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import type { ComplexCluster, RoomsSummary } from '@/types';

interface ComplexCardProps {
  complex: ComplexCluster;
}

// Преобразует HTTP в HTTPS для mixed content
function toHttps(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, 'https://');
}

// Вычисляем общий диапазон площади из rooms_summary
function getAreaRange(summary: RoomsSummary[] | null): { min: number; max: number } | null {
  if (!summary || summary.length === 0) return null;

  let min = Infinity;
  let max = 0;

  for (const s of summary) {
    if (s.min_area < min) min = s.min_area;
    if (s.max_area > max) max = s.max_area;
  }

  return min !== Infinity ? { min, max } : null;
}

// Форматирует число квартир
function formatOffersCount(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${count} квартир`;
  }
  if (lastDigit === 1) {
    return `${count} квартира`;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} квартиры`;
  }
  return `${count} квартир`;
}

export function ComplexCard({ complex }: ComplexCardProps) {
  const [imgError, setImgError] = useState(false);
  const showDeveloper = isValidDeveloperName(complex.developer_name);
  const areaRange = getAreaRange(complex.rooms_summary);
  const hasMultiplePrices = complex.max_price > complex.min_price;
  const imageUrl = toHttps(complex.image_url);

  return (
    <Link
      href={`/complexes/${complex.complex_id}`}
      className="card overflow-hidden hover:shadow-lg transition-shadow group"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] bg-[var(--color-bg-gray)] overflow-hidden">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={complex.complex_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}

        {/* Completion years badges */}
        {complex.completion_years && complex.completion_years.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {complex.completion_years.sort().slice(0, 2).map(year => (
              <span
                key={year}
                className="px-2 py-0.5 text-xs font-medium bg-white/90 text-[var(--color-text)] rounded shadow-sm"
              >
                {year}
              </span>
            ))}
            {complex.completion_years.length > 2 && (
              <span className="px-2 py-0.5 text-xs bg-white/70 text-[var(--color-text-light)] rounded">
                +{complex.completion_years.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name & Developer */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold leading-tight line-clamp-2 mb-1">
            {complex.complex_name}
          </h3>
          {showDeveloper && (
            <div className="text-sm text-[var(--color-text-light)]">
              {complex.developer_name}
            </div>
          )}
        </div>

        {/* Price Range */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-semibold text-[var(--color-accent)]">
              от {formatPrice(complex.min_price)}
            </span>
            {hasMultiplePrices && (
              <>
                <span className="text-[var(--color-text-light)]">→</span>
                <span className="text-base text-[var(--color-text)]">
                  до {formatPrice(complex.max_price)}
                </span>
              </>
            )}
          </div>
          {/* Area Range */}
          {areaRange && (
            <div className="text-sm text-[var(--color-text-light)] mt-1">
              {areaRange.min === areaRange.max
                ? `${Math.round(areaRange.min)} м²`
                : `${Math.round(areaRange.min)} – ${Math.round(areaRange.max)} м²`
              }
            </div>
          )}
        </div>

        {/* Rooms Summary Tags */}
        {complex.rooms_summary && complex.rooms_summary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {complex.rooms_summary
              .sort((a, b) => {
                // Студии первые, потом по количеству комнат
                if (a.is_studio && !b.is_studio) return -1;
                if (!a.is_studio && b.is_studio) return 1;
                return a.rooms - b.rooms;
              })
              .map(s => (
                <div
                  key={`${s.rooms}-${s.is_studio}`}
                  className="px-3 py-1.5 bg-[var(--color-bg-gray)] rounded-lg text-center min-w-[60px]"
                >
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {s.is_studio ? 'Ст' : `${s.rooms}к`}
                  </div>
                  <div className="text-xs text-[var(--color-text-light)]">
                    {s.count} шт
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-light)]">
            {formatOffersCount(complex.offers_count)}
          </span>
          <span className="text-sm text-[var(--color-accent)] font-medium group-hover:translate-x-1 transition-transform">
            Подробнее →
          </span>
        </div>
      </div>
    </Link>
  );
}
