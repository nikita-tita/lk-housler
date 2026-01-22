'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useCompare } from '@/contexts/CompareContext';
import { api, formatPrice, formatArea, formatRooms } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import type { OfferDetail } from '@/types';

interface CompareRow {
  label: string;
  getValue: (offer: OfferDetail) => string | React.ReactNode;
  highlight?: 'min' | 'max';
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: 'Цена',
    getValue: (o) => formatPrice(o.price),
    highlight: 'min',
  },
  {
    label: 'Цена за м²',
    getValue: (o) => formatPrice(o.price_per_sqm),
    highlight: 'min',
  },
  {
    label: 'Комнат',
    getValue: (o) => formatRooms(o.rooms, o.is_studio),
  },
  {
    label: 'Площадь общая',
    getValue: (o) => formatArea(o.area_total),
    highlight: 'max',
  },
  {
    label: 'Площадь жилая',
    getValue: (o) => o.area_living ? formatArea(o.area_living) : '—',
  },
  {
    label: 'Площадь кухни',
    getValue: (o) => o.area_kitchen ? formatArea(o.area_kitchen) : '—',
  },
  {
    label: 'Этаж',
    getValue: (o) => `${o.floor} из ${o.floors_total}`,
  },
  {
    label: 'Высота потолков',
    getValue: (o) => o.ceiling_height ? `${o.ceiling_height} м` : '—',
  },
  {
    label: 'Отделка',
    getValue: (o) => o.has_finishing ? 'Да' : 'Нет',
  },
  {
    label: 'Балкон',
    getValue: (o) => o.balcony || '—',
  },
  {
    label: 'Санузел',
    getValue: (o) => o.bathroom || '—',
  },
  {
    label: 'ЖК',
    getValue: (o) => o.complex_name,
  },
  {
    label: 'Район',
    getValue: (o) => o.district_name,
  },
  {
    label: 'Метро',
    getValue: (o) => o.metro_station ? `м. ${o.metro_station}` : '—',
  },
  {
    label: 'До метро',
    getValue: (o) => o.metro_distance ? `${o.metro_distance} мин` : '—',
    highlight: 'min',
  },
  {
    label: 'Застройщик',
    getValue: (o) => isValidDeveloperName(o.developer_name) ? o.developer_name! : '—',
  },
  {
    label: 'Срок сдачи',
    getValue: (o) => o.completion_date || '—',
  },
];

export default function ComparePage() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    if (compareIds.size === 0) {
      setOffers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        [...compareIds].map(id => api.getOfferById(id))
      );
      const loadedOffers = results
        .filter(r => r.success && r.data)
        .map(r => r.data as OfferDetail);

      if (loadedOffers.length === 0 && compareIds.size > 0) {
        setError('Не удалось загрузить объекты для сравнения');
      }
      setOffers(loadedOffers);
    } catch (err) {
      console.error('Error loading offers:', err);
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  }, [compareIds]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // Функция для определения лучшего значения
  const getBestValue = (row: CompareRow, offers: OfferDetail[]): number | null => {
    if (!row.highlight || offers.length < 2) return null;

    const values = offers.map((o, idx) => ({
      idx,
      value: parseFloat(String(row.getValue(o)).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    })).filter(v => v.value > 0);

    if (values.length < 2) return null;

    const sorted = [...values].sort((a, b) =>
      row.highlight === 'min' ? a.value - b.value : b.value - a.value
    );

    return sorted[0]?.idx ?? null;
  };

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-semibold mb-4">Сравнение объектов</h1>
        <div className="text-[var(--color-text)] mb-4">{error}</div>
        <button
          onClick={loadOffers}
          className="btn btn-primary"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-semibold mb-4">Сравнение объектов</h1>
        <p className="text-[var(--color-text-light)] mb-8">
          Добавьте объекты для сравнения, нажав на кнопку
          <span className="inline-flex items-center justify-center w-6 h-6 mx-1 bg-gray-200 text-[var(--color-text)] rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          на карточке объекта
        </p>
        <Link
          href="/offers"
          className="btn btn-primary"
        >
          Перейти к объектам
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Сравнение объектов</h1>
        <div className="flex gap-4">
          <Link
            href="/offers"
            className="text-[var(--color-accent)] hover:underline text-sm"
          >
            + Добавить ещё
          </Link>
          <button
            onClick={clearCompare}
            className="text-[var(--color-text-light)] hover:text-[var(--color-text)] text-sm"
          >
            Очистить все
          </button>
        </div>
      </div>

      {/* Compare Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Header with images */}
          <thead>
            <tr>
              <th className="w-48 p-4 text-left bg-gray-50 border-b border-[var(--color-border)]"></th>
              {offers.map(offer => (
                <th
                  key={offer.id}
                  className="p-4 bg-gray-50 border-b border-[var(--color-border)] min-w-[200px]"
                >
                  <div className="relative">
                    <button
                      onClick={() => removeFromCompare(offer.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--gray-900)] text-white rounded-full flex items-center justify-center hover:bg-black z-10"
                      title="Убрать из сравнения"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <Link href={`/offers/${offer.id}`}>
                      <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mb-3">
                        {offer.images?.[0] ? (
                          <img
                            src={typeof offer.images[0] === 'string' ? offer.images[0] : offer.images[0].url}
                            alt={offer.complex_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]">
                        {formatPrice(offer.price)}
                      </div>
                      <div className="text-sm text-[var(--color-text-light)]">
                        {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
                      </div>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {COMPARE_ROWS.map((row, rowIdx) => {
              const bestIdx = getBestValue(row, offers);

              return (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-4 font-medium text-sm text-[var(--color-text-light)] border-b border-[var(--color-border)]">
                    {row.label}
                  </td>
                  {offers.map((offer, offerIdx) => (
                    <td
                      key={offer.id}
                      className={`p-4 text-center border-b border-[var(--color-border)] ${
                        bestIdx === offerIdx ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      {row.getValue(offer)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/offers"
          className="btn btn-secondary"
        >
          Найти ещё
        </Link>
      </div>
    </div>
  );
}
