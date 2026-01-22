'use client';

import { useState } from 'react';

interface YandexMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  className?: string;
}

export function YandexMap({ latitude, longitude, address, className = '' }: YandexMapProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Yandex Maps Static API embed URL
  const mapUrl = `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16&l=map`;

  // Embed через iframe с Yandex Maps Constructor
  const embedUrl = `https://yandex.ru/map-widget/v1/?ll=${longitude}%2C${latitude}&z=16&pt=${longitude}%2C${latitude}%2Cpm2rdm`;

  return (
    <div className={`relative ${className}`}>
      <div className="aspect-[16/9] bg-[var(--color-bg-gray)] rounded-lg overflow-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[var(--color-text-light)]">Загрузка карты...</div>
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

      {address && (
        <div className="mt-3 flex items-start gap-2 text-sm">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[var(--color-text-light)]">{address}</span>
        </div>
      )}

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
      >
        <span>Открыть в Яндекс.Картах</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
