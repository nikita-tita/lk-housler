'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import type { OfferListItem, OfferFilters, MapBounds } from '@/types';
import { formatPrice, api } from '@/services/api';
import { OfferCard } from './OfferCard';

import type { YmapsMap, YmapsPlacemark, YmapsClusterer, YmapsClusterEvent } from '@/types/ymaps';

interface MapMarker {
  id: number;
  lat: number;
  lng: number;
  price: number;
  rooms: number;
  is_studio: boolean;
}

interface SplitMapViewProps {
  filters: OfferFilters;
  onToggleMap: () => void;
}

const ITEMS_PER_PAGE = 50;

export function SplitMapView({ filters, onToggleMap }: SplitMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const clustererRef = useRef<YmapsClusterer | null>(null);
  const placemarkRefs = useRef<Map<number, YmapsPlacemark>>(new Map());
  const initialBoundsRef = useRef<MapBounds | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [totalInBounds, setTotalInBounds] = useState(0);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);

  // Load markers for the map
  const loadMarkers = useCallback(async () => {
    const res = await api.getMapMarkers(filters);
    if (res.success && res.data) {
      setMarkers(res.data);
    }
  }, [filters]);

  // Load offers by bounds
  const loadOffersByBounds = useCallback(async (bounds: MapBounds) => {
    setIsLoadingOffers(true);
    try {
      const res = await api.getOffers(
        { ...filters, bounds },
        { limit: 200, sort_by: 'price', sort_order: 'asc' }
      ) as { success: boolean; data?: OfferListItem[]; pagination?: { total: number } };
      if (res.success && res.data) {
        setOffers(res.data);
        setTotalInBounds(res.pagination?.total || res.data.length);
        setDisplayLimit(ITEMS_PER_PAGE);
      }
    } finally {
      setIsLoadingOffers(false);
    }
  }, [filters]);

  // Load offers by specific IDs (for marker/cluster click)
  const loadOffersByIds = useCallback(async (ids: number[]) => {
    setSelectedIds(ids);
    setIsLoadingOffers(true);
    try {
      // Load each offer by ID (in a real app, you'd have a batch endpoint)
      const loadedOffers: OfferListItem[] = [];
      for (const id of ids.slice(0, 50)) {
        const res = await api.getOfferById(id);
        if (res.success && res.data) {
          // Map OfferDetail to OfferListItem format
          const detail = res.data;
          loadedOffers.push({
            id: detail.id,
            rooms: detail.rooms,
            is_studio: detail.is_studio,
            floor: detail.floor,
            floors_total: detail.floors_total,
            area_total: detail.area_total,
            price: detail.price,
            price_per_sqm: detail.price_per_sqm,
            complex_name: detail.complex_name,
            district_name: detail.district_name,
            metro_station: detail.metro_station,
            metro_distance: detail.metro_distance,
            has_finishing: detail.has_finishing,
            image_url: detail.images?.[0]?.url || null,
          });
        }
      }
      setOffers(loadedOffers);
      setTotalInBounds(ids.length);
    } finally {
      setIsLoadingOffers(false);
    }
  }, []);

  // Get bounds from map
  const getBoundsFromMap = useCallback((): MapBounds | null => {
    if (!mapRef.current) return null;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return null;
    return {
      lat_min: bounds[0][0],
      lat_max: bounds[1][0],
      lng_min: bounds[0][1],
      lng_max: bounds[1][1],
    };
  }, []);

  // Initialize map
  const initMap = useCallback(() => {
    if (!window.ymaps || !mapContainerRef.current || mapRef.current) return;

    window.ymaps.ready(() => {
      const map = new window.ymaps.Map(mapContainerRef.current, {
        center: [59.93, 30.31],
        zoom: 11,
        controls: ['zoomControl'],
      });

      mapRef.current = map;

      const clusterer = new window.ymaps.Clusterer({
        preset: 'islands#invertedDarkBlueClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterBalloonContentLayout: 'cluster#balloonCarousel',
      });

      // Handle cluster click
      clusterer.events.add('click', (e: YmapsClusterEvent) => {
        const target = e.get('target');
        // Check if it's a cluster
        const geoObjects = target.getGeoObjects?.();
        if (geoObjects && geoObjects.length > 1) {
          // It's a cluster - get all marker IDs
          const ids = geoObjects.map((obj) => obj.properties.get('markerId'));
          loadOffersByIds(ids);
        }
      });

      clustererRef.current = clusterer;
      map.geoObjects.add(clusterer);

      // Handle map bounds change
      map.events.add('boundschange', () => {
        const newBounds = getBoundsFromMap();
        if (newBounds && initialBoundsRef.current) {
          // Check if bounds changed significantly
          const threshold = 0.001;
          const changed =
            Math.abs(newBounds.lat_min - initialBoundsRef.current.lat_min) > threshold ||
            Math.abs(newBounds.lat_max - initialBoundsRef.current.lat_max) > threshold ||
            Math.abs(newBounds.lng_min - initialBoundsRef.current.lng_min) > threshold ||
            Math.abs(newBounds.lng_max - initialBoundsRef.current.lng_max) > threshold;

          setShowSearchButton(changed);
          setCurrentBounds(newBounds);
        }
      });

      setIsMapReady(true);
    });
  }, [getBoundsFromMap, loadOffersByIds]);

  // Add markers to map
  useEffect(() => {
    if (!isMapReady || !clustererRef.current || markers.length === 0) return;

    placemarkRefs.current.clear();

    const placemarks = markers.map((marker) => {
      const placemark = new window.ymaps.Placemark(
        [marker.lat, marker.lng],
        {
          hintContent: formatPrice(marker.price),
          markerId: marker.id,
        },
        {
          preset: 'islands#darkBlueCircleDotIcon',
        }
      );

      placemark.events.add('click', () => {
        loadOffersByIds([marker.id]);
        // Highlight this marker
        placemarkRefs.current.forEach((pm, id) => {
          pm.options.set('preset', id === marker.id ? 'islands#redCircleDotIcon' : 'islands#darkBlueCircleDotIcon');
        });
      });

      placemarkRefs.current.set(marker.id, placemark);
      return placemark;
    });

    clustererRef.current.removeAll();
    clustererRef.current.add(placemarks);

    if (placemarks.length > 0 && mapRef.current) {
      mapRef.current.setBounds(clustererRef.current.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 40,
      });
      // Save initial bounds and load offers after setBounds
      setTimeout(() => {
        const bounds = getBoundsFromMap();
        if (bounds) {
          initialBoundsRef.current = bounds;
          setCurrentBounds(bounds);
          loadOffersByBounds(bounds);
        }
      }, 100);
    }
  }, [isMapReady, markers, getBoundsFromMap, loadOffersByBounds, loadOffersByIds]);

  // Load markers when filters change
  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  // Highlight marker on hover
  useEffect(() => {
    if (!isMapReady) return;

    placemarkRefs.current.forEach((placemark, id) => {
      const isSelected = selectedIds.includes(id);
      const isHovered = id === hoveredId;
      if (isHovered || isSelected) {
        placemark.options.set('preset', 'islands#redCircleDotIcon');
      } else {
        placemark.options.set('preset', 'islands#darkBlueCircleDotIcon');
      }
    });
  }, [hoveredId, selectedIds, isMapReady]);

  // Handle search in area button click
  const handleSearchInArea = useCallback(() => {
    if (currentBounds) {
      initialBoundsRef.current = currentBounds;
      setShowSearchButton(false);
      setSelectedIds([]);
      loadOffersByBounds(currentBounds);
    }
  }, [currentBounds, loadOffersByBounds]);

  // Handle show more
  const handleShowMore = useCallback(() => {
    setDisplayLimit(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const displayedOffers = offers.slice(0, displayLimit);
  const hasMore = displayLimit < offers.length;

  return (
    <>
      <Script
        src="https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU"
        strategy="afterInteractive"
        onLoad={initMap}
      />

      <div className="grid grid-cols-[1fr_3fr] gap-4 h-[calc(100vh-200px)]">
        {/* Left: Offers List (1/4) */}
        <div className="overflow-y-auto pr-2">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 pb-3 mb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[var(--color-text-light)]">
                {isLoadingOffers ? (
                  'Загрузка...'
                ) : selectedIds.length > 0 ? (
                  `Выбрано: ${totalInBounds} ${totalInBounds === 1 ? 'квартира' : totalInBounds < 5 ? 'квартиры' : 'квартир'}`
                ) : (
                  `${totalInBounds} ${totalInBounds === 1 ? 'квартира' : totalInBounds < 5 ? 'квартиры' : 'квартир'} в области`
                )}
              </div>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedIds([]);
                    if (currentBounds) {
                      loadOffersByBounds(currentBounds);
                    }
                  }}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoadingOffers ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-[4/3] bg-[var(--color-bg-gray)]"></div>
                  <div className="p-4">
                    <div className="h-5 bg-[var(--color-bg-gray)] rounded mb-2"></div>
                    <div className="h-4 bg-[var(--color-bg-gray)] rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : displayedOffers.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-light)]">
              <div className="mb-2">В этой области нет объектов</div>
              <div className="text-sm">Попробуйте расширить область поиска</div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedOffers.map((offer) => (
                <div
                  key={offer.id}
                  onMouseEnter={() => setHoveredId(offer.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <OfferCard
                    offer={offer}
                    highlighted={hoveredId === offer.id || selectedIds.includes(offer.id)}
                    compact
                  />
                </div>
              ))}

              {/* Show more button */}
              {hasMore && (
                <button
                  onClick={handleShowMore}
                  className="w-full py-3 text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-gray)] rounded-lg transition-colors"
                >
                  Показать ещё ({offers.length - displayLimit})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Map (3/4) */}
        <div className="relative rounded-lg overflow-hidden border border-[var(--color-border)]">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* Search in area button */}
          {showSearchButton && (
            <button
              onClick={handleSearchInArea}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Искать в этой области
            </button>
          )}

          {/* Hide map button */}
          <button
            onClick={onToggleMap}
            className="absolute top-4 right-4 z-10 bg-white px-3 py-2 rounded-lg shadow text-sm hover:bg-gray-50"
          >
            Скрыть карту
          </button>

          {/* Loading overlay */}
          {!isMapReady && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full mx-auto mb-3" />
                <div className="text-[var(--color-text-light)]">
                  Загрузка карты...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
