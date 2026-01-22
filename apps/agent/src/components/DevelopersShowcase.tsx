'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useFilterOptions } from '@/hooks/useFilterOptions';

interface DevelopersShowcaseProps {
  maxItems?: number;
  title?: string;
}

export function DevelopersShowcase({
  maxItems = 8,
  title = 'Популярные застройщики'
}: DevelopersShowcaseProps) {
  const { filterOptions, isLoading } = useFilterOptions();

  const developers = useMemo(() => {
    if (!filterOptions?.developers) return [];
    return [...filterOptions.developers]
      .sort((a, b) => b.count - a.count)
      .slice(0, maxItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOptions?.developers, maxItems]);

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="h-5 w-48 bg-[var(--color-bg-gray)] rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-[var(--color-bg-gray)] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (developers.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          href="/developers"
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          Все застройщики
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {developers.map((dev) => (
          <Link
            key={dev.name}
            href={`/offers?developers=${encodeURIComponent(dev.name)}`}
            className="p-4 bg-[var(--color-bg-gray)] text-[var(--color-text)] hover:bg-[var(--gray-900)] hover:text-white rounded-lg transition-colors group"
          >
            <div className="font-medium text-sm truncate group-hover:text-white">
              {dev.name}
            </div>
            <div className="text-xs text-[var(--color-text-light)] group-hover:text-white/70 mt-1">
              {dev.count.toLocaleString('ru-RU')} {pluralize(dev.count, 'квартира', 'квартиры', 'квартир')}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
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
