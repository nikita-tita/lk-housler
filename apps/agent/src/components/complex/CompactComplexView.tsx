'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import type { ComplexDetail, OfferListItem } from '@/types';
import { formatPrice, formatArea, formatRooms, formatFloor } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import type { YmapsMap } from '@/types/ymaps';

interface CompactComplexViewProps {
  complex: ComplexDetail;
  offers: OfferListItem[];
  isLoading?: boolean;
}

type InfoTab = 'price' | 'developer' | 'specs' | 'location';
type ViewTab = 'cards' | 'table' | 'plans';

export function CompactComplexView({ complex, offers, isLoading }: CompactComplexViewProps) {
  // Info panel tabs
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>('price');
  // View mode tabs
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('cards');
  // Image gallery
  const [activeImage, setActiveImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  // Map
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const images = complex.images?.length
    ? complex.images
    : complex.main_image
      ? [complex.main_image]
      : [];

  // Determine which info tabs are available
  const availableTabs: { id: InfoTab; label: string }[] = [
    { id: 'price', label: 'Цены' },
    ...(isValidDeveloperName(complex.developer_name) ? [{ id: 'developer' as InfoTab, label: 'Застройщик' }] : []),
    { id: 'specs', label: 'Характеристики' },
    ...(complex.latitude && complex.longitude ? [{ id: 'location' as InfoTab, label: 'На карте' }] : []),
  ];

  // Init map when location tab is active
  const initMap = useCallback(() => {
    if (!window.ymaps || !mapContainerRef.current || mapRef.current) return;
    if (!complex.latitude || !complex.longitude) return;

    window.ymaps.ready(() => {
      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [complex.latitude!, complex.longitude!],
        zoom: 15,
        controls: ['zoomControl'],
      });

      const placemark = new window.ymaps.Placemark(
        [complex.latitude!, complex.longitude!],
        { balloonContentHeader: complex.name },
        { preset: 'islands#redDotIcon' }
      );

      map.geoObjects.add(placemark);
      mapRef.current = map;
      setIsMapReady(true);
    });
  }, [complex]);

  // Trigger map init when switching to location tab
  useEffect(() => {
    if (activeInfoTab === 'location' && !mapRef.current && window.ymaps) {
      initMap();
    }
  }, [activeInfoTab, initMap]);

  return (
    <>
      <Script
        src="https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU"
        strategy="afterInteractive"
        onLoad={() => {
          if (activeInfoTab === 'location') initMap();
        }}
      />

      <div className="space-y-6">
        {/* Hero Section - Compact */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Left: Image Gallery */}
          <div className="relative aspect-[16/10] bg-[var(--color-bg-gray)] rounded-xl overflow-hidden">
            {images.length > 0 ? (
              <>
                <img
                  src={images[activeImage]}
                  alt={complex.name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setShowLightbox(true)}
                />
                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    complex.building_state === 'hand-over'
                      ? 'bg-[var(--gray-900)] text-white'
                      : 'bg-white text-[var(--color-text)]'
                  }`}>
                    {complex.building_state === 'hand-over' ? 'Сдан' : 'Строится'}
                  </span>
                </div>
                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 justify-center">
                    {images.slice(0, 5).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === activeImage ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>

          {/* Right: Info Panel with Tabs */}
          <div className="card overflow-hidden flex flex-col">
            {/* Title */}
            <div className="p-4 border-b border-[var(--color-border)]">
              <h1 className="text-xl font-semibold mb-1">{complex.name}</h1>
              <div className="text-sm text-[var(--color-text-light)] flex flex-wrap items-center gap-2">
                {complex.district && <span>{complex.district}</span>}
                {complex.metro_station && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gray-900)]" />
                    {complex.metro_station}
                  </span>
                )}
              </div>
            </div>

            {/* Info Tabs */}
            <div className="flex border-b border-[var(--color-border)]">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveInfoTab(tab.id)}
                  className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeInfoTab === tab.id
                      ? 'text-[var(--color-text)] border-b-2 border-[var(--gray-900)] -mb-px'
                      : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Info Content */}
            <div className="flex-1 p-4 min-h-[200px]">
              {activeInfoTab === 'price' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">Цены от</div>
                    <div className="text-2xl font-semibold">{formatPrice(Number(complex.min_price))}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[var(--color-text-light)]">Квартир</div>
                      <div className="font-medium">{complex.offers_count}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-light)]">Площадь</div>
                      <div className="font-medium">{Number(complex.min_area).toFixed(0)}–{Number(complex.max_area).toFixed(0)} м²</div>
                    </div>
                    {complex.completion_date && (
                      <div>
                        <div className="text-[var(--color-text-light)]">Сдача</div>
                        <div className="font-medium">{complex.completion_date}</div>
                      </div>
                    )}
                  </div>
                  <Link href={`/offers?complex_id=${complex.id}`} className="btn btn-primary w-full">
                    Смотреть квартиры
                  </Link>
                </div>
              )}

              {activeInfoTab === 'developer' && isValidDeveloperName(complex.developer_name) && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">Застройщик</div>
                    <div className="text-lg font-semibold mt-1">{complex.developer_name}</div>
                  </div>
                  {complex.developer_id && (
                    <Link
                      href={`/offers?developers=${encodeURIComponent(complex.developer_name!)}`}
                      className="btn btn-secondary w-full"
                    >
                      Все объекты застройщика →
                    </Link>
                  )}
                </div>
              )}

              {activeInfoTab === 'specs' && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      complex.building_state === 'hand-over' ? 'bg-[var(--gray-900)]' : 'bg-gray-400'
                    }`} />
                    <span>{complex.building_state === 'hand-over' ? 'Дом сдан' : 'Строится'}</span>
                  </div>
                  {complex.class && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-light)]">Класс</span>
                      <span className="font-medium">{complex.class}</span>
                    </div>
                  )}
                  {complex.floors_total && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-light)]">Этажей</span>
                      <span className="font-medium">{complex.floors_total}</span>
                    </div>
                  )}
                  {complex.parking && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-light)]">Парковка</span>
                      <span className="font-medium">{complex.parking}</span>
                    </div>
                  )}
                  {complex.address && (
                    <div className="pt-3 border-t border-[var(--color-border)]">
                      <div className="text-[var(--color-text-light)] mb-1">Адрес</div>
                      <div>{complex.address}</div>
                    </div>
                  )}
                </div>
              )}

              {activeInfoTab === 'location' && (
                <div className="h-full min-h-[180px] -m-4 relative">
                  {complex.latitude && complex.longitude ? (
                    <>
                      <div ref={mapContainerRef} className="absolute inset-0" />
                      {!isMapReady && (
                        <div className="absolute inset-0 bg-[var(--color-bg-gray)] flex items-center justify-center">
                          <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-[var(--color-bg-gray)] flex items-center justify-center text-[var(--color-text-light)]">
                      Координаты не указаны
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Offers Section */}
        <div className="card overflow-hidden">
          {/* View Mode Tabs */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="font-semibold">Квартиры ({complex.offers_count})</h2>
            <div className="flex gap-1 bg-[var(--color-bg-gray)] rounded-lg p-1">
              {[
                { id: 'cards' as ViewTab, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                ), label: 'Карточки' },
                { id: 'table' as ViewTab, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                ), label: 'Список' },
                { id: 'plans' as ViewTab, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                ), label: 'Планировки' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    activeViewTab === tab.id
                      ? 'bg-white shadow-sm text-[var(--color-text)]'
                      : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
                  }`}
                  title={tab.label}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offers Content */}
          <div className="p-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-48"></div>
                ))}
              </div>
            ) : offers.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-light)]">
                Нет доступных квартир
              </div>
            ) : (
              <>
                {/* Cards View */}
                {activeViewTab === 'cards' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {offers.slice(0, 6).map(offer => (
                      <Link
                        key={offer.id}
                        href={`/offers/${offer.id}`}
                        className="group flex gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                      >
                        <div className="w-20 h-20 flex-shrink-0 bg-[var(--color-bg-gray)] rounded-lg overflow-hidden">
                          {(offer.plan_image_url || offer.image_url) ? (
                            <img
                              src={offer.plan_image_url || offer.image_url || ''}
                              alt=""
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base">{formatPrice(offer.price)}</div>
                          <div className="text-sm text-[var(--color-text-light)]">
                            {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
                          </div>
                          <div className="text-xs text-[var(--color-text-light)] mt-1">
                            {formatFloor(offer.floor, offer.floors_total)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Table View */}
                {activeViewTab === 'table' && (
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="text-left py-2 px-4 font-medium text-[var(--color-text-light)]">Комнаты</th>
                          <th className="text-left py-2 px-4 font-medium text-[var(--color-text-light)]">Площадь</th>
                          <th className="text-left py-2 px-4 font-medium text-[var(--color-text-light)]">Этаж</th>
                          <th className="text-right py-2 px-4 font-medium text-[var(--color-text-light)]">Цена</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.slice(0, 10).map(offer => (
                          <tr key={offer.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-gray)]">
                            <td className="py-3 px-4">
                              <Link href={`/offers/${offer.id}`} className="hover:text-[var(--color-accent)]">
                                {formatRooms(offer.rooms, offer.is_studio)}
                              </Link>
                            </td>
                            <td className="py-3 px-4">{formatArea(offer.area_total)}</td>
                            <td className="py-3 px-4">{offer.floor}/{offer.floors_total}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatPrice(offer.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Plans View */}
                {activeViewTab === 'plans' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {offers.slice(0, 10).map(offer => (
                      <Link
                        key={offer.id}
                        href={`/offers/${offer.id}`}
                        className="group relative aspect-square bg-[var(--color-bg-gray)] rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                      >
                        {(offer.plan_image_url || offer.image_url) ? (
                          <img
                            src={offer.plan_image_url || offer.image_url || ''}
                            alt=""
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-xs font-medium">{formatPrice(offer.price)}</div>
                          <div className="text-white/80 text-[10px]">{formatRooms(offer.rooms, offer.is_studio)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Show More Link */}
                {offers.length > (activeViewTab === 'plans' ? 10 : activeViewTab === 'table' ? 10 : 6) && (
                  <div className="text-center mt-4">
                    <Link
                      href={`/offers?complex_id=${complex.id}`}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Показать все {complex.offers_count} квартир →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Description - collapsible */}
        {complex.description && (
          <details className="card group">
            <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-[var(--color-bg-gray)] transition-colors">
              <span className="font-semibold">О комплексе</span>
              <svg className="w-5 h-5 text-[var(--color-text-light)] group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 text-[var(--color-text-light)] whitespace-pre-line">
              {complex.description}
            </div>
          </details>
        )}
      </div>

      {/* Lightbox */}
      {showLightbox && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={images[activeImage]}
            alt={complex.name}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setActiveImage(p => (p - 1 + images.length) % images.length); }}
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActiveImage(p => (p + 1) % images.length); }}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
