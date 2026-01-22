'use client';

import { useState, useRef, useCallback } from 'react';
import Script from 'next/script';
import type { ComplexDetail } from '@/types';

import type { YmapsMap } from '@/types/ymaps';

interface LocationSectionProps {
  complex: ComplexDetail;
}

interface InfraItem {
  type: 'metro' | 'school' | 'kindergarten' | 'hospital' | 'shop' | 'park';
  name: string;
  distance: string;
}

const INFRA_CONFIG: Record<InfraItem['type'], { icon: React.ReactNode; label: string }> = {
  metro: {
    label: 'Метро',
    icon: (
      <span className="w-4 h-4 rounded-full bg-[var(--gray-900)] flex items-center justify-center">
        <span className="text-white text-[10px] font-bold">М</span>
      </span>
    ),
  },
  school: {
    label: 'Школы',
    icon: (
      <svg className="w-4 h-4 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  kindergarten: {
    label: 'Детские сады',
    icon: (
      <svg className="w-4 h-4 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  hospital: {
    label: 'Медицина',
    icon: (
      <svg className="w-4 h-4 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  shop: {
    label: 'Магазины',
    icon: (
      <svg className="w-4 h-4 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  park: {
    label: 'Парки',
    icon: (
      <svg className="w-4 h-4 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
};

export function LocationSection({ complex }: LocationSectionProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Infrastructure data - only real data from API (metro)
  const infrastructure: InfraItem[] = complex.metro_station ? [{
    type: 'metro' as const,
    name: complex.metro_station,
    distance: complex.metro_distance ? `${complex.metro_distance} мин пешком` : '',
  }] : [];

  const initMap = useCallback(() => {
    if (!window.ymaps || !mapContainerRef.current || mapRef.current) return;
    if (!complex.latitude || !complex.longitude) return;

    window.ymaps.ready(() => {
      const lat = complex.latitude!;
      const lng = complex.longitude!;

      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      // Add main marker
      const placemark = new window.ymaps.Placemark(
        [lat, lng],
        {
          balloonContentHeader: complex.name,
          balloonContentBody: complex.address,
        },
        {
          preset: 'islands#redDotIcon',
        }
      );

      map.geoObjects.add(placemark);
      mapRef.current = map;
      setIsMapReady(true);
    });
  }, [complex]);

  return (
    <>
      <Script
        src="https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU"
        strategy="afterInteractive"
        onLoad={initMap}
      />

      <div className="grid lg:grid-cols-[1fr_350px] gap-8">
        {/* Map */}
        <div className="relative h-[400px] rounded-xl overflow-hidden border border-[var(--color-border)]">
          {complex.latitude && complex.longitude ? (
            <>
              <div ref={mapContainerRef} className="absolute inset-0" />
              {!isMapReady && (
                <div className="absolute inset-0 bg-[var(--color-bg-gray)] flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full mx-auto mb-3" />
                    <div className="text-[var(--color-text-light)]">Загрузка карты...</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-[var(--color-bg-gray)] flex items-center justify-center">
              <div className="text-[var(--color-text-light)]">
                Координаты не указаны
              </div>
            </div>
          )}
        </div>

        {/* Infrastructure & Address */}
        <div>
          {/* Metro info */}
          {infrastructure.length > 0 && (
            <>
              <h3 className="text-lg font-semibold mb-4">Транспорт</h3>

              <div className="space-y-4">
                {infrastructure.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      {INFRA_CONFIG[item.type].icon}
                      <span className="text-sm font-medium">
                        {INFRA_CONFIG[item.type].label}
                      </span>
                    </div>
                    <div className="space-y-1 pl-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-light)]">{item.name}</span>
                        {item.distance && (
                          <span className="text-[var(--color-text-light)]">{item.distance}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Address */}
          <div className={infrastructure.length > 0 ? "mt-6 pt-6 border-t border-[var(--color-border)]" : ""}>
            <div className="text-sm text-[var(--color-text-light)] mb-1">Адрес</div>
            <div className="font-medium">{complex.address}</div>
            {complex.district && (
              <div className="text-sm text-[var(--color-text-light)] mt-1">
                {complex.district}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
