'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function OffersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Offers error:', error);
  }, [error]);

  return (
    <div className="section">
      <div className="container">
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold mb-4">Ошибка загрузки</h1>

          <p className="text-[var(--color-text-light)] mb-6">
            Не удалось загрузить страницу квартир. Попробуйте обновить страницу.
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="btn btn-primary"
            >
              Попробовать снова
            </button>
            <Link href="/" className="btn btn-secondary">
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
