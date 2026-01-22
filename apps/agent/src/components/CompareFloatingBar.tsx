'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCompare } from '@/contexts/CompareContext';

export function CompareFloatingBar() {
  const pathname = usePathname();
  const { count, clearCompare } = useCompare();

  // Не показываем на гостевых страницах /s/[code]
  if (pathname?.startsWith('/s/') || count === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[var(--gray-900)] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-medium">
            {count} {count === 1 ? 'объект' : count < 5 ? 'объекта' : 'объектов'}
          </span>
        </div>

        <Link
          href="/compare"
          className="bg-white text-[var(--color-text)] px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Сравнить
        </Link>

        <button
          onClick={clearCompare}
          className="text-gray-400 hover:text-white transition-colors"
          title="Очистить"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
