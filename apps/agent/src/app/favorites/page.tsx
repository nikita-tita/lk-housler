'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api, formatPrice, formatArea, formatRooms } from '@/services/api';
import { FavoriteButton } from '@/components/FavoriteButton';
import { RequireAuth } from '@/components/RequireAuth';
import type { FavoriteOffer } from '@/types';

function FavoritesContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getFavorites();
      if (response.success && response.data) {
        setFavorites(response.data);
      } else {
        setError(response.error || 'Не удалось загрузить избранное');
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <h1 className="text-2xl font-semibold mb-8">Избранное</h1>

      {error ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text)] mb-4">{error}</div>
          <button
            onClick={loadFavorites}
            className="btn btn-primary"
          >
            Попробовать снова
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text-light)] mb-4">
            В избранном пока ничего нет
          </div>
          <Link
            href="/offers"
            className="btn btn-primary"
          >
            Перейти к поиску
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((offer) => (
            <Link
              key={offer.id}
              href={`/offers/${offer.id}`}
              className="group bg-white rounded-lg overflow-hidden border border-[var(--color-border)] hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {offer.image_url ? (
                  <img
                    src={offer.image_url}
                    alt={offer.complex_name || 'Квартира'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <FavoriteButton offerId={offer.id} size="sm" />
                </div>
              </div>

              <div className="p-4">
                <div className="text-lg font-semibold mb-1">
                  {formatPrice(offer.price)}
                </div>
                <div className="text-sm text-[var(--color-text-light)] mb-2">
                  {formatRooms(offer.rooms, offer.is_studio)} · {formatArea(offer.area_total)} · {offer.floor}/{offer.floors_total} эт.
                </div>
                <div className="text-sm font-medium">{offer.complex_name}</div>
                {offer.district_name && (
                  <div className="text-sm text-[var(--color-text-light)]">
                    {offer.district_name}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesContent />
    </RequireAuth>
  );
}
