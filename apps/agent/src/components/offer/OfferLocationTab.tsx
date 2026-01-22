'use client';

import { useState } from 'react';
import type { OfferDetail } from '@/types';

interface OfferLocationTabProps {
  offer: OfferDetail;
}

export function OfferLocationTab({ offer }: OfferLocationTabProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (!offer.latitude || !offer.longitude) {
    return (
      <div className="h-48 bg-[var(--color-bg-gray)] rounded-lg flex items-center justify-center text-sm text-[var(--color-text-light)]">
        Координаты не указаны
      </div>
    );
  }

  const mapUrl = `https://yandex.ru/maps/?pt=${offer.longitude},${offer.latitude}&z=16&l=map`;
  const embedUrl = `https://yandex.ru/map-widget/v1/?ll=${offer.longitude}%2C${offer.latitude}&z=16&pt=${offer.longitude}%2C${offer.latitude}%2Cpm2rdm`;

  return (
    <div className="space-y-3">
      {/* Map embed */}
      <div className="relative h-48 bg-[var(--color-bg-gray)] rounded-lg overflow-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-[var(--gray-900)] border-t-transparent rounded-full" />
          </div>
        )}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          style={{ position: 'relative' }}
          onLoad={() => setIsLoaded(true)}
        />
      </div>

      {/* Address */}
      <div className="flex items-start gap-2 text-sm">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[var(--color-text-light)]">{offer.complex_address}</span>
      </div>

      {/* Link to Yandex Maps */}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
      >
        Открыть в Яндекс.Картах
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
