'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/services/api';
import { useGuestFavorites } from '@/contexts/GuestFavoritesContext';
import { useGuest } from '@/contexts/GuestContext';
import { OfferCardGuest } from '@/components/guest/OfferCardGuest';
import type { OfferDetail } from '@/types';

export default function GuestFavoritesPage() {
  const params = useParams();
  const code = params.code as string;
  const { favoriteIds, favoritesCount } = useGuestFavorites();
  const { activateGuestMode, isGuest } = useGuest();
  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Активируем гостевой режим при загрузке
  useEffect(() => {
    if (code && !isGuest) {
      activateGuestMode(code);
    }
  }, [code, isGuest, activateGuestMode]);

  // Загружаем данные об офферах из избранного
  useEffect(() => {
    if (favoriteIds.size === 0) {
      setOffers([]);
      setIsLoading(false);
      return;
    }

    const loadOffers = async () => {
      setIsLoading(true);
      try {
        // Загружаем информацию о каждом оффере
        const offerPromises = [...favoriteIds].map(id =>
          api.getOfferById(id).then(res => res.success ? res.data : null)
        );

        const results = await Promise.all(offerPromises);
        const validOffers = results.filter((o): o is OfferDetail => o !== null);
        setOffers(validOffers);
      } catch (error) {
        console.error('Error loading favorite offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOffers();
  }, [favoriteIds]);

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/s/${code}`}
            className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-accent)] mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад к подборке
          </Link>
          <h1 className="text-2xl font-bold">Избранное</h1>
          <p className="text-[var(--color-text-light)]">
            {favoritesCount === 0
              ? 'Вы ещё не добавили ничего в избранное'
              : `${favoritesCount} ${favoritesCount === 1 ? 'квартира' : favoritesCount < 5 ? 'квартиры' : 'квартир'}`}
          </p>
        </div>

        <Link
          href={`/s/${code}/offers`}
          className="btn-primary"
        >
          Искать квартиры
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-[4/3] bg-[var(--color-bg-gray)]" />
              <div className="p-5 space-y-3">
                <div className="h-6 bg-[var(--color-bg-gray)] rounded w-1/2" />
                <div className="h-4 bg-[var(--color-bg-gray)] rounded w-3/4" />
                <div className="h-4 bg-[var(--color-bg-gray)] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-gray)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Избранное пусто</h2>
          <p className="text-[var(--color-text-light)] mb-6">
            Нажмите на сердечко на карточке квартиры, чтобы добавить её в избранное
          </p>
          <Link href={`/s/${code}/offers`} className="btn-primary">
            Перейти к каталогу
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <OfferCardGuest
              key={offer.id}
              offer={offer}
              selectionCode={code}
            />
          ))}
        </div>
      )}

      {/* Info block */}
      {favoritesCount > 0 && (
        <div className="mt-8 p-4 bg-gray-50 border border-[var(--color-border)] rounded-lg">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[var(--color-text-light)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-[var(--color-text)]">
              <p className="font-medium mb-1">Избранное хранится в браузере</p>
              <p className="text-[var(--color-text-light)]">
                Ваши избранные квартиры сохраняются локально в этом браузере.
                При очистке данных браузера или использовании другого устройства избранное будет пустым.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
