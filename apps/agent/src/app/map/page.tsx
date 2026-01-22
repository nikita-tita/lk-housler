'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { api, formatPrice, formatRooms, formatArea } from '@/services/api';
import type { OfferListItem } from '@/types';

interface MapMarker {
  id: number;
  lat: number;
  lng: number;
  price: number;
  rooms: number;
  is_studio: boolean;
  complex_name?: string;
}

import type { YmapsMap, YmapsClusterer, YmapsPlacemark } from '@/types/ymaps';

// Расширяем интерфейс для хранения данных маркера
interface ExtendedPlacemark extends YmapsPlacemark {
  markerData?: MapMarker;
}

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const clustererRef = useRef<YmapsClusterer | null>(null);
  const placemarksRef = useRef<Map<number, ExtendedPlacemark>>(new Map());

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Состояние для боковой панели
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<OfferListItem[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelTitle, setPanelTitle] = useState('');

  // Load markers
  useEffect(() => {
    api.getMapMarkers()
      .then(res => {
        if (res.success && res.data) {
          setMarkers(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Загрузить офферы по ID (batch запрос)
  const loadOffersByIds = useCallback(async (ids: number[], title: string) => {
    setPanelLoading(true);
    setPanelTitle(title);
    setIsPanelOpen(true);

    try {
      const response = await api.getOffersByIds(ids.slice(0, 50));

      if (response.success && response.data) {
        setSelectedOffers(response.data);
      } else {
        setSelectedOffers([]);
      }
    } catch (error) {
      console.error('Error loading offers:', error);
      setSelectedOffers([]);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  // Initialize map when script loads
  const initMap = useCallback(() => {
    if (!window.ymaps || !mapContainerRef.current || mapRef.current) return;

    window.ymaps.ready(() => {
      // Create map centered on SPb
      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [59.93, 30.31],
        zoom: 11,
        controls: ['zoomControl', 'geolocationControl']
      });

      mapRef.current = map;

      // Create clusterer
      const clusterer = new window.ymaps.Clusterer({
        preset: 'islands#invertedDarkBlueClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: true, // Отключаем авто-зум при клике на кластер
        clusterHideIconOnBalloonOpen: false,
        geoObjectHideIconOnBalloonOpen: false,
        clusterBalloonContentLayout: 'cluster#balloonCarousel'
      });

      // Обработка клика на кластер
      clusterer.events.add('click', (e) => {
        const target = e.get('target');

        // Проверяем, это кластер или одиночный маркер
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (target && typeof (target as any).getGeoObjects === 'function') {
          // Это кластер
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const geoObjects = (target as any).getGeoObjects();
          const ids: number[] = [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          geoObjects.forEach((obj: any) => {
            if (obj.markerData?.id) {
              ids.push(obj.markerData.id);
            }
          });

          if (ids.length > 0) {
            loadOffersByIds(ids, `${ids.length} объектов`);
          }
        }
      });

      clustererRef.current = clusterer;
      map.geoObjects.add(clusterer);

      setIsMapReady(true);
    });
  }, [loadOffersByIds]);

  // Add markers to map when data is ready
  useEffect(() => {
    if (!isMapReady || !clustererRef.current || markers.length === 0) return;

    placemarksRef.current.clear();

    const placemarks = markers.map(marker => {
      const placemark = new window.ymaps.Placemark(
        [marker.lat, marker.lng],
        {
          balloonContentHeader: formatRooms(marker.rooms, marker.is_studio),
          balloonContentBody: `<strong>${formatPrice(marker.price)}</strong>`,
          balloonContentFooter: `<a href="/offers/${marker.id}" target="_blank">Подробнее</a>`,
          hintContent: formatPrice(marker.price),
          markerId: marker.id
        },
        {
          preset: 'islands#darkBlueCircleDotIcon'
        }
      ) as ExtendedPlacemark;

      // Сохраняем данные маркера
      placemark.markerData = marker;

      // Обработка клика на одиночный маркер
      placemark.events.add('click', () => {
        loadOffersByIds([marker.id], formatRooms(marker.rooms, marker.is_studio));
      });

      placemarksRef.current.set(marker.id, placemark);
      return placemark;
    });

    clustererRef.current.removeAll();
    clustererRef.current.add(placemarks);

    // Fit bounds to show all markers
    if (placemarks.length > 0 && mapRef.current && clustererRef.current) {
      mapRef.current.setBounds(clustererRef.current.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 40
      });
    }
  }, [isMapReady, markers, loadOffersByIds]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedOffers([]);
    setPanelTitle('');
  }, []);

  return (
    <>
      <Script
        src="https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU"
        strategy="afterInteractive"
        onLoad={initMap}
      />

      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/offers" className="text-[var(--color-text-light)] hover:text-[var(--color-text)]">
              ← К списку
            </Link>
            <h1 className="text-lg font-semibold">
              Карта объявлений
            </h1>
          </div>
          <div className="text-sm text-[var(--color-text-light)]">
            {isLoading ? 'Загрузка...' : `${markers.length.toLocaleString('ru-RU')} объектов`}
          </div>
        </div>

        {/* Map Container with Side Panel */}
        <div className="flex-1 relative flex min-h-0 overflow-hidden">
          {/* Side Panel */}
          <div
            className={`absolute md:relative z-30 h-full bg-white border-r border-[var(--color-border)] transition-all duration-300 overflow-hidden ${
              isPanelOpen ? 'w-full md:w-96' : 'w-0'
            }`}
          >
            {isPanelOpen && (
              <div className="h-full max-h-full flex flex-col overflow-hidden">
                {/* Panel Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                  <h2 className="font-semibold">{panelTitle}</h2>
                  <button
                    onClick={closePanel}
                    className="p-1 text-[var(--color-text-light)] hover:text-[var(--color-text)]"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {panelLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-32 bg-gray-200 rounded-lg mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-2/3 mb-1"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : selectedOffers.length === 0 ? (
                    <div className="p-4 text-center text-[var(--color-text-light)]">
                      Нет данных
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {selectedOffers.map((offer) => (
                        <Link
                          key={offer.id}
                          href={`/offers/${offer.id}`}
                          className="block bg-white rounded-lg border border-[var(--color-border)] overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {/* Image */}
                          <div className="relative aspect-[16/10] bg-gray-100">
                            {offer.image_url ? (
                              <img
                                src={offer.image_url}
                                alt={offer.complex_name || 'Квартира'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3">
                            <div className="text-lg font-semibold text-[var(--color-text)]">
                              {formatPrice(offer.price)}
                            </div>
                            <div className="text-sm text-[var(--color-text-light)] mb-2">
                              {formatRooms(offer.rooms, offer.is_studio)} · {formatArea(offer.area_total)} · {offer.floor}/{offer.floors_total} эт.
                            </div>
                            <div className="text-sm font-medium">{offer.complex_name}</div>
                            {offer.district_name && (
                              <div className="text-xs text-[var(--color-text-light)]">
                                {offer.district_name}
                                {offer.metro_station && ` · м. ${offer.metro_station}`}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}

                      {selectedOffers.length >= 50 && (
                        <div className="text-center text-sm text-[var(--color-text-light)] py-2">
                          Показаны первые 50 объектов
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0" />

            {/* Loading overlay */}
            {(isLoading || !isMapReady) && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                <div className="text-center max-w-xs">
                  <div className="relative mb-4">
                    <div className="w-12 h-12 border-3 border-gray-200 rounded-full mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin w-12 h-12 border-3 border-[var(--color-accent)] border-t-transparent rounded-full"></div>
                    </div>
                  </div>
                  <div className="text-[var(--color-text)] font-medium mb-1">
                    {isLoading ? 'Загрузка объявлений' : 'Инициализация карты'}
                  </div>
                  <div className="text-sm text-[var(--color-text-light)]">
                    {isLoading
                      ? 'Получаем данные о квартирах...'
                      : 'Подготовка интерактивной карты...'}
                  </div>
                </div>
              </div>
            )}

            {/* Hint when panel is closed */}
            {!isPanelOpen && !isLoading && isMapReady && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-20 text-center">
                <div className="text-sm text-[var(--color-text-light)]">
                  Нажмите на маркер или группу маркеров для просмотра объектов
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
