'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, formatPrice } from '@/services/api';
import { Pagination } from '@/components/ui';
import type { Complex } from '@/types';

export default function ComplexesPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadComplexes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getComplexes({ page, limit: 24, search: search || undefined });
      if (response.success && response.data?.data) {
        setComplexes(response.data.data);
        setTotalPages(response.data.pagination?.total_pages ?? 1);
      } else {
        setError(response.error || 'Не удалось загрузить жилые комплексы');
        setComplexes([]);
      }
    } catch (err) {
      console.error('Failed to load complexes:', err);
      setError('Ошибка при загрузке данных');
      setComplexes([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadComplexes();
  }, [loadComplexes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadComplexes();
  };

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-semibold mb-8">Жилые комплексы</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3 max-w-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию ЖК..."
            className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="btn btn-primary"
          >
            Найти
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse card overflow-hidden">
              <div className="aspect-[16/10] bg-gray-200"></div>
              <div className="p-4">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                  <div>
                    <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text)] mb-4">{error}</div>
          <button
            onClick={() => loadComplexes()}
            className="btn btn-primary"
          >
            Попробовать снова
          </button>
        </div>
      ) : complexes.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text-light)]">
            {search ? 'Ничего не найдено' : 'Нет жилых комплексов'}
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {complexes.map((complex) => (
              <Link
                key={complex.id}
                href={`/complexes/${complex.id}`}
                className="card overflow-hidden hover:shadow-lg"
              >
                {/* Image */}
                <div className="relative aspect-[16/10] bg-[var(--color-bg-gray)]">
                  {complex.image_url ? (
                    <img
                      src={complex.image_url}
                      alt={complex.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h2 className="text-lg font-semibold mb-1">{complex.name}</h2>
                  {complex.district && (
                    <div className="text-sm text-[var(--color-text-light)] mb-2">
                      {complex.district}
                    </div>
                  )}
                  <div className="text-sm text-[var(--color-text-light)] mb-3 line-clamp-1">
                    {complex.address}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[var(--color-text-light)]">Квартиры</div>
                      <div className="font-medium">{complex.offers_count}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-light)]">Цены</div>
                      <div className="font-medium">
                        {Number(complex.min_price) === Number(complex.max_price)
                          ? formatPrice(Number(complex.min_price))
                          : `от ${formatPrice(Number(complex.min_price))}`
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-light)]">Площадь</div>
                      <div className="font-medium">
                        {Number(complex.min_area).toFixed(0)}–{Number(complex.max_area).toFixed(0)} м²
                      </div>
                    </div>
                    {complex.building_state && (
                      <div>
                        <div className="text-[var(--color-text-light)]">Статус</div>
                        <div className="font-medium">
                          {complex.building_state === 'hand-over' ? 'Сдан' : 'Строится'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              className="mt-12"
            />
          )}
        </>
      )}
    </div>
  );
}
