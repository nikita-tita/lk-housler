'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="container py-12">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-200 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold mb-4">Что-то пошло не так</h1>

        <p className="text-[var(--color-text-light)] mb-6">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернуться на главную.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left bg-gray-100 p-4 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium">
              Техническая информация
            </summary>
            <pre className="mt-2 text-xs text-[var(--color-text)] whitespace-pre-wrap overflow-x-auto">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

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
  );
}
