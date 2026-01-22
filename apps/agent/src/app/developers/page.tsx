'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import type { FilterOptions } from '@/types';

interface Developer {
  name: string;
  count: number;
}

// Склонение слов
function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getFilters()
      .then(res => {
        if (res.success && res.data) {
          const data = res.data as FilterOptions;
          // Сортируем по количеству квартир
          const sorted = [...(data.developers || [])]
            .sort((a, b) => b.count - a.count);
          setDevelopers(sorted);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Фильтрация по поиску
  const filteredDevelopers = search
    ? developers.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase())
      )
    : developers;

  // Считаем общее количество квартир
  const totalOffers = developers.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-semibold mb-2">Застройщики</h1>
      <p className="text-[var(--color-text-light)] mb-8">
        {isLoading
          ? 'Загрузка...'
          : `${developers.length} застройщиков, ${totalOffers.toLocaleString('ru-RU')} квартир`
        }
      </p>

      {/* Поиск */}
      <div className="mb-8 max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-24 bg-[var(--color-bg-gray)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredDevelopers.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text-light)]">
            {search ? 'Ничего не найдено' : 'Нет застройщиков'}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDevelopers.map((dev) => (
            <Link
              key={dev.name}
              href={`/offers?developers=${encodeURIComponent(dev.name)}`}
              className="p-5 bg-[var(--color-bg-gray)] text-[var(--color-text)] hover:bg-[var(--gray-900)] hover:text-white rounded-lg transition-colors group"
            >
              <div className="font-semibold text-base mb-1 group-hover:text-white">
                {dev.name}
              </div>
              <div className="text-sm text-[var(--color-text-light)] group-hover:text-white/70">
                {dev.count.toLocaleString('ru-RU')} {pluralize(dev.count, 'квартира', 'квартиры', 'квартир')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
