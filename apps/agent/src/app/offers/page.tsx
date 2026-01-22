'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { FiltersWithSmartSearch } from '@/components/Filters';
import { DevelopersShowcase } from '@/components/DevelopersShowcase';
import { ComplexCard } from '@/components/ComplexCard';
import { api } from '@/services/api';
import type { ComplexCluster, OfferFilters } from '@/types';

function OffersContent() {
  const [complexes, setComplexes] = useState<ComplexCluster[]>([]);
  const [totalOffers, setTotalOffers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<OfferFilters>({});

  const loadComplexes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getClusters('complex', {}, currentFilters);
      if (response.success && response.data) {
        // Защита от undefined clusters
        const clusters = (response.data.clusters ?? []) as ComplexCluster[];
        setComplexes(clusters);
        // Подсчитываем общее количество квартир
        const total = clusters.reduce(
          (sum: number, c: ComplexCluster) => sum + (c.offers_count || 0),
          0
        );
        setTotalOffers(total);
      } else {
        setError(response.error || 'Ошибка загрузки');
      }
    } catch (err) {
      setError('Не удалось загрузить жилые комплексы');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters]);

  useEffect(() => {
    loadComplexes();
  }, [loadComplexes]);

  const handleFiltersChange = useCallback((filters: OfferFilters) => {
    setCurrentFilters(filters);
  }, []);

  return (
    <div className="section">
      <div className="container">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            Квартиры в новостройках
          </h1>
          <p className="text-[var(--color-text-light)]">
            {isLoading
              ? 'Загрузка...'
              : `${complexes.length} ЖК, ${totalOffers.toLocaleString('ru-RU')} квартир`}
          </p>
        </div>

        {/* Developers Showcase */}
        <DevelopersShowcase maxItems={8} />

        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Filters Sidebar */}
          <aside>
            <Suspense fallback={
              <div className="card p-6 animate-pulse">
                <div className="h-4 bg-[var(--color-bg-gray)] rounded w-1/4 mb-4"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-10 w-16 bg-[var(--color-bg-gray)] rounded"></div>
                  ))}
                </div>
              </div>
            }>
              <FiltersWithSmartSearch
                onFiltersChange={handleFiltersChange}
                totalOffers={totalOffers}
              />
            </Suspense>
          </aside>

          {/* Complexes Grid */}
          <div>
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="aspect-[16/10] bg-[var(--color-bg-gray)]"></div>
                    <div className="p-4">
                      <div className="h-6 bg-[var(--color-bg-gray)] rounded mb-2"></div>
                      <div className="h-4 bg-[var(--color-bg-gray)] rounded w-2/3 mb-4"></div>
                      <div className="h-4 bg-[var(--color-bg-gray)] rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="card p-8 text-center">
                <div className="text-[var(--color-text-light)] mb-4">{error}</div>
                <button onClick={loadComplexes} className="btn btn-primary">
                  Попробовать снова
                </button>
              </div>
            ) : complexes.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-xl font-medium mb-2">Ничего не найдено</div>
                <div className="text-[var(--color-text-light)]">
                  Попробуйте изменить параметры поиска
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {complexes.map(complex => (
                  <ComplexCard key={complex.complex_id} complex={complex} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OffersPage() {
  return (
    <Suspense fallback={
      <div className="section">
        <div className="container">
          <div className="animate-pulse">
            <div className="h-10 bg-[var(--color-bg-gray)] rounded w-1/3 mb-8"></div>
            <div className="grid lg:grid-cols-[320px_1fr] gap-8">
              <div className="h-96 bg-[var(--color-bg-gray)] rounded"></div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-[var(--color-bg-gray)] rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <OffersContent />
    </Suspense>
  );
}
