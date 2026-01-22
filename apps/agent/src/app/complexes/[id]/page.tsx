'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/services/api';
import { OfferCard } from '@/components/OfferCard';
import { PlansGrid } from '@/components/PlansGrid';
import {
  ComplexHero,
  ComplexSidebar,
  ComplexTabs,
  ChessBoard,
  LocationSection,
  type ComplexTabId,
} from '@/components/complex';
import type { ComplexDetail, OfferListItem } from '@/types';

export default function ComplexDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [complex, setComplex] = useState<ComplexDetail | null>(null);
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<ComplexTabId>('offers');

  useEffect(() => {
    if (!id) return;

    api.getComplexById(id)
      .then(res => {
        if (res.success && res.data) {
          setComplex(res.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!complex) return;

    let isCancelled = false;
    // Load more offers for chess view
    const limit = activeTab === 'chess' ? 100 : 12;

    const loadOffers = async () => {
      setOffersLoading(true);
      try {
        const res = await api.getOffers({ complex_id: complex.id }, { page: activeTab === 'chess' ? 1 : page, limit });
        if (!isCancelled && res.success && res.data) {
          setOffers(res.data.data);
          setTotalPages(res.data.pagination.total_pages);
        }
      } finally {
        if (!isCancelled) setOffersLoading(false);
      }
    };

    loadOffers();

    return () => { isCancelled = true; };
  }, [complex, page, activeTab]);

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="aspect-[21/9] bg-gray-200 rounded-xl mb-8"></div>
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!complex) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-semibold mb-4">ЖК не найден</h1>
        <Link href="/complexes" className="text-[var(--color-accent)]">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6">
        <Link href="/complexes" className="text-[var(--color-text-light)] hover:text-[var(--color-text)]">
          Жилые комплексы
        </Link>
        <span className="mx-2 text-[var(--color-text-light)]">/</span>
        <span>{complex.name}</span>
      </nav>

      {/* Hero */}
      <ComplexHero complex={complex} />

      {/* Main Content */}
      <div className="grid lg:grid-cols-[1fr_350px] gap-8 mt-8">
        {/* Left Column - Content */}
        <div>
          {/* Tabs */}
          <ComplexTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            offersCount={complex.offers_count}
          />

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'offers' && (
              <>
                {offersLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
                    ))}
                  </div>
                ) : offers.length === 0 ? (
                  <div className="text-center py-12 text-[var(--color-text-light)]">
                    Нет доступных квартир
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {offers.map((offer) => (
                        <OfferCard key={offer.id} offer={offer} usePlanImage />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 mt-8">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="btn btn-secondary disabled:opacity-50"
                        >
                          Назад
                        </button>
                        <span className="px-4 py-2 text-[var(--color-text-light)]">
                          {page} из {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="btn btn-secondary disabled:opacity-50"
                        >
                          Вперёд
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {activeTab === 'chess' && (
              offersLoading ? (
                <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
              ) : (
                <ChessBoard
                  offers={offers}
                  floorsTotal={complex.floors_total || 25}
                />
              )
            )}

            {activeTab === 'plans' && (
              offersLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-200 rounded-lg aspect-square"></div>
                  ))}
                </div>
              ) : (
                <PlansGrid offers={offers} />
              )
            )}

            {activeTab === 'location' && (
              <LocationSection complex={complex} />
            )}
          </div>

          {/* Description */}
          {complex.description && activeTab === 'offers' && (
            <div className="mt-12 pt-8 border-t border-[var(--color-border)]">
              <h2 className="text-xl font-semibold mb-4">О комплексе</h2>
              <div className="text-[var(--color-text-light)] whitespace-pre-line">
                {complex.description}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ComplexSidebar complex={complex} />
        </aside>
      </div>
    </div>
  );
}
