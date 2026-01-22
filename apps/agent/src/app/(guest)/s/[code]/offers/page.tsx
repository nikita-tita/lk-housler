'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { OfferCardGuest } from '@/components/guest/OfferCardGuest';
import { Filters } from '@/components/Filters';
import { Pagination } from '@/components/ui';
import { api } from '@/services/api';
import { useGuest } from '@/contexts/GuestContext';
import type { OfferListItem, OfferFilters, PaginatedResponse } from '@/types';

type SortOption = 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc' | 'updated_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'area_asc', label: 'По площади (меньше)' },
  { value: 'area_desc', label: 'По площади (больше)' },
  { value: 'updated_desc', label: 'По дате обновления' },
];

function GuestOffersContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params.code as string;

  const { activateGuestMode, isLoading: guestLoading } = useGuest();

  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<OfferListItem>['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<OfferFilters>({});

  const page = Number(searchParams.get('page')) || 1;
  const sortBy = (searchParams.get('sort') as SortOption) || 'updated_desc';

  // Активируем гостевой режим
  useEffect(() => {
    if (code) {
      activateGuestMode(code);
    }
  }, [code, activateGuestMode]);

  const buildUrl = useCallback((newParams: Record<string, string | number | undefined>) => {
    const urlParams = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        urlParams.set(key, String(value));
      } else {
        urlParams.delete(key);
      }
    });

    return `/s/${code}/offers?${urlParams.toString()}`;
  }, [searchParams, code]);

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [sort_by, sort_order] = sortBy.split('_') as [string, 'asc' | 'desc'];

    try {
      const response = await api.getOffers(currentFilters, { page, limit: 20, sort_by, sort_order }) as unknown as {
        success: boolean;
        data: OfferListItem[];
        pagination: PaginatedResponse<OfferListItem>['pagination'];
        error?: string;
      };

      if (response.success && response.data) {
        setOffers(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.error || 'Ошибка загрузки');
      }
    } catch (err) {
      setError('Не удалось загрузить объявления');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters, page, sortBy]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const handleFiltersChange = useCallback((filters: OfferFilters) => {
    setCurrentFilters(filters);
  }, []);

  if (guestLoading) {
    return (
      <div className="section">
        <div className="container">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid lg:grid-cols-[320px_1fr] gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="container">
        {/* Back to selection */}
        <div className="mb-6">
          <Link
            href={`/s/${code}`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-accent)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Вернуться к подборке
          </Link>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
              Поиск квартир
            </h1>
            <p className="text-[var(--color-text-light)]">
              {pagination?.total
                ? `Найдено ${pagination.total.toLocaleString('ru-RU')} квартир`
                : 'Загрузка...'}
            </p>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-light)] hidden sm:inline">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => router.push(buildUrl({ sort: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] bg-white"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Filters Sidebar */}
          <aside>
            <Filters onFiltersChange={handleFiltersChange} />
          </aside>

          {/* Offers Grid */}
          <div>
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="aspect-[4/3] bg-[var(--color-bg-gray)]"></div>
                    <div className="p-5">
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
                <button onClick={loadOffers} className="btn btn-primary">
                  Попробовать снова
                </button>
              </div>
            ) : offers.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-xl font-medium mb-2">Ничего не найдено</div>
                <div className="text-[var(--color-text-light)]">
                  Попробуйте изменить параметры поиска
                </div>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {offers.map(offer => (
                    <OfferCardGuest
                      key={offer.id}
                      offer={offer}
                      selectionCode={code}
                    />
                  ))}
                </div>

                {pagination && pagination.total_pages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.total_pages}
                    buildUrl={(p) => buildUrl({ page: p })}
                    className="mt-12"
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuestOffersPage() {
  return (
    <Suspense fallback={
      <div className="section">
        <div className="container">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid lg:grid-cols-[320px_1fr] gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <GuestOffersContent />
    </Suspense>
  );
}
