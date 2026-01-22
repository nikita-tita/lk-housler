'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, formatPrice } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import type {
  OfferFilters,
  ClusterLevel,
  ClusterPath,
  ComplexCluster,
  BuildingCluster,
  RoomsCluster,
  FloorCluster,
  RoomsSummary,
  OfferListItem,
} from '@/types';
import { OfferCard } from './OfferCard';

interface ClusteredOffersListProps {
  filters: OfferFilters;
  onFiltersChange?: (filters: OfferFilters) => void;
}

export function ClusteredOffersList({ filters }: ClusteredOffersListProps) {
  const [level, setLevel] = useState<ClusterLevel>('complex');
  const [path, setPath] = useState<ClusterPath>({});
  const [clusters, setClusters] = useState<(ComplexCluster | BuildingCluster | RoomsCluster | FloorCluster)[]>([]);
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка кластеров
  const loadClusters = useCallback(async () => {
    setIsLoading(true);
    try {
      if (level === 'offers') {
        // Загружаем конкретные квартиры
        const offerFilters: OfferFilters = {
          ...filters,
          complex_id: path.complex_id,
        };
        const res = await api.getOffers(offerFilters, { page: 1, limit: 50 });
        if (res.success && res.data) {
          setOffers(res.data.data);
        }
      } else {
        const res = await api.getClusters(level, path, filters);
        if (res.success && res.data) {
          // Защита от undefined clusters
          const clusters = res.data.clusters ?? [];
          setClusters(clusters as (ComplexCluster | BuildingCluster | RoomsCluster | FloorCluster)[]);
        }
      }
    } catch (err) {
      console.error('Error loading clusters:', err);
    } finally {
      setIsLoading(false);
    }
  }, [level, path, filters]);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  // Навигация вглубь
  const handleComplexClick = (cluster: ComplexCluster) => {
    setPath({
      complex_id: cluster.complex_id,
      complex_name: cluster.complex_name,
    });
    setLevel('building');
  };

  const handleBuildingClick = (cluster: BuildingCluster) => {
    setPath(prev => ({
      ...prev,
      building_name: cluster.building_name,
    }));
    setLevel('rooms');
  };

  const handleRoomsClick = (cluster: RoomsCluster) => {
    setPath(prev => ({
      ...prev,
      rooms: cluster.rooms,
      is_studio: cluster.is_studio,
    }));
    setLevel('floors');
  };

  const handleFloorsClick = (cluster: FloorCluster) => {
    setPath(prev => ({
      ...prev,
      floor_min: cluster.floor_min,
      floor_max: cluster.floor_max,
    }));
    setLevel('offers');
  };

  // Навигация назад
  const goBack = () => {
    if (level === 'offers') {
      setPath(prev => ({ ...prev, floor_min: undefined, floor_max: undefined }));
      setLevel('floors');
    } else if (level === 'floors') {
      setPath(prev => ({ ...prev, rooms: undefined, is_studio: undefined }));
      setLevel('rooms');
    } else if (level === 'rooms') {
      setPath(prev => ({ ...prev, building_name: undefined }));
      setLevel('building');
    } else if (level === 'building') {
      setPath({});
      setLevel('complex');
    }
  };

  // Хлебные крошки
  const renderBreadcrumbs = () => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: 'Все ЖК', onClick: level !== 'complex' ? () => { setPath({}); setLevel('complex'); } : undefined },
    ];

    if (path.complex_name) {
      crumbs.push({
        label: path.complex_name,
        onClick: level !== 'building' ? () => { setPath({ complex_id: path.complex_id, complex_name: path.complex_name }); setLevel('building'); } : undefined,
      });
    }

    if (path.building_name) {
      crumbs.push({
        label: path.building_name,
        onClick: level !== 'rooms' ? () => { setPath(prev => ({ ...prev, rooms: undefined, is_studio: undefined })); setLevel('rooms'); } : undefined,
      });
    }

    if (path.rooms !== undefined || path.is_studio) {
      crumbs.push({
        label: path.is_studio ? 'Студии' : `${path.rooms}-комн.`,
        onClick: level !== 'floors' ? () => { setPath(prev => ({ ...prev, floor_min: undefined, floor_max: undefined })); setLevel('floors'); } : undefined,
      });
    }

    if (path.floor_min !== undefined) {
      crumbs.push({ label: `${path.floor_min}-${path.floor_max} эт.` });
    }

    return (
      <nav className="flex items-center gap-2 text-sm mb-4">
        {crumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-2">
            {idx > 0 && <span className="text-[var(--color-text-light)]">/</span>}
            {crumb.onClick ? (
              <button
                onClick={crumb.onClick}
                className="text-[var(--color-accent)] hover:underline"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-[var(--color-text)]">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    );
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-[var(--color-bg-gray)] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {renderBreadcrumbs()}

      {level !== 'complex' && (
        <button
          onClick={goBack}
          className="mb-4 flex items-center gap-2 text-[var(--color-accent)] hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>
      )}

      {/* Level: Complex */}
      {level === 'complex' && (
        <div className="grid gap-4">
          {(clusters as ComplexCluster[]).map(cluster => (
            <ComplexClusterCard
              key={cluster.complex_id}
              cluster={cluster}
              onClick={() => handleComplexClick(cluster)}
            />
          ))}
          {clusters.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-light)]">
              Нет ЖК по заданным фильтрам
            </div>
          )}
        </div>
      )}

      {/* Level: Building */}
      {level === 'building' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clusters as BuildingCluster[]).map(cluster => (
            <BuildingClusterCard
              key={cluster.building_name}
              cluster={cluster}
              onClick={() => handleBuildingClick(cluster)}
            />
          ))}
        </div>
      )}

      {/* Level: Rooms */}
      {level === 'rooms' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(clusters as RoomsCluster[]).map(cluster => (
            <RoomsClusterCard
              key={`${cluster.rooms}-${cluster.is_studio}`}
              cluster={cluster}
              onClick={() => handleRoomsClick(cluster)}
            />
          ))}
        </div>
      )}

      {/* Level: Floors */}
      {level === 'floors' && (
        <div className="flex flex-wrap gap-3">
          {(clusters as FloorCluster[]).map(cluster => (
            <FloorClusterChip
              key={cluster.label}
              cluster={cluster}
              onClick={() => handleFloorsClick(cluster)}
            />
          ))}
        </div>
      )}

      {/* Level: Offers */}
      {level === 'offers' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} usePlanImage />
          ))}
          {offers.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--color-text-light)]">
              Нет квартир по заданным параметрам
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Карточка кластера ЖК
// ============================================

function ComplexClusterCard({
  cluster,
  onClick,
}: {
  cluster: ComplexCluster;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-lg transition-shadow flex gap-4"
    >
      {/* Фото ЖК */}
      <div className="w-32 h-24 bg-[var(--color-bg-gray)] rounded-lg overflow-hidden flex-shrink-0">
        {cluster.image_url ? (
          <img src={cluster.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
      </div>

      {/* Инфо */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-[var(--color-text)] truncate">
              {cluster.complex_name}
            </h3>
            {isValidDeveloperName(cluster.developer_name) && (
              <div className="text-sm text-[var(--color-text-light)]">
                {cluster.developer_name}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm text-[var(--color-text-light)]">от</div>
            <div className="font-semibold text-[var(--color-accent)]">
              {formatPrice(cluster.min_price)}
            </div>
          </div>
        </div>

        {/* Корпуса и сроки */}
        <div className="flex flex-wrap gap-2 mb-2">
          {cluster.buildings && cluster.buildings.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cluster.buildings.slice(0, 4).map(b => (
                <span key={b} className="px-2 py-0.5 text-xs bg-[var(--color-bg-gray)] rounded">
                  {b}
                </span>
              ))}
              {cluster.buildings.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-[var(--color-text-light)]">
                  +{cluster.buildings.length - 4}
                </span>
              )}
            </div>
          )}
          {cluster.completion_years && cluster.completion_years.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cluster.completion_years.sort().map(y => (
                <span key={y} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                  {y}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Комнатность */}
        <RoomsSummaryRow summary={cluster.rooms_summary} />

        {/* Количество */}
        <div className="text-sm text-[var(--color-accent)] mt-2">
          {cluster.offers_count} квартир →
        </div>
      </div>
    </div>
  );
}

// ============================================
// Карточка кластера корпуса
// ============================================

function BuildingClusterCard({
  cluster,
  onClick,
}: {
  cluster: BuildingCluster;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-[var(--color-text)]">
          {cluster.building_name}
        </h4>
        {cluster.completion_date && (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
            {cluster.completion_date}
          </span>
        )}
      </div>

      <RoomsSummaryRow summary={cluster.rooms_summary} />

      <div className="flex items-center justify-between mt-3">
        <span className="text-sm text-[var(--color-text-light)]">от {formatPrice(cluster.min_price)}</span>
        <span className="text-sm text-[var(--color-accent)]">{cluster.offers_count} шт →</span>
      </div>
    </div>
  );
}

// ============================================
// Карточка кластера комнатности
// ============================================

function RoomsClusterCard({
  cluster,
  onClick,
}: {
  cluster: RoomsCluster;
  onClick: () => void;
}) {
  const label = cluster.is_studio ? 'Студии' : `${cluster.rooms}-комн.`;

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-lg transition-shadow text-center"
    >
      <div className="text-2xl font-bold text-[var(--color-text)] mb-1">
        {label}
      </div>
      <div className="text-sm text-[var(--color-text-light)] mb-2">
        {cluster.min_area.toFixed(0)}-{cluster.max_area.toFixed(0)} м²
      </div>
      <div className="font-semibold text-[var(--color-accent)]">
        от {formatPrice(cluster.min_price)}
      </div>
      <div className="text-sm text-[var(--color-text-light)] mt-2">
        {cluster.count} шт
      </div>
    </div>
  );
}

// ============================================
// Чип этажей
// ============================================

function FloorClusterChip({
  cluster,
  onClick,
}: {
  cluster: FloorCluster;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 bg-[var(--color-bg-gray)] hover:bg-[var(--color-border)] rounded-lg transition-colors text-left"
    >
      <div className="font-semibold text-[var(--color-text)]">
        {cluster.label} эт.
      </div>
      <div className="text-sm text-[var(--color-text-light)]">
        {cluster.offers_count} шт · от {formatPrice(cluster.min_price)}
      </div>
    </button>
  );
}

// ============================================
// Строка сводки по комнатам
// ============================================

function RoomsSummaryRow({ summary }: { summary: RoomsSummary[] | null }) {
  if (!summary || summary.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {summary.map(s => (
        <div key={`${s.rooms}-${s.is_studio}`} className="text-center">
          <div className="text-[var(--color-text-light)]">
            {s.is_studio ? 'Ст' : s.rooms}
          </div>
          <div className="text-[var(--color-text)] font-medium">
            {formatPrice(s.min_price).replace(' ₽', '')}
          </div>
        </div>
      ))}
    </div>
  );
}
