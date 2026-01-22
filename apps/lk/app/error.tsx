'use client';

import { useEffect } from 'react';
import { Button } from '@housler/ui';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            console.error('Global error boundary:', error);
        }
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg-gray)' }}>
            <div className="text-center max-w-md">
                <h1 className="text-6xl font-semibold mb-4" style={{ color: 'var(--gray-900)' }}>
                    500
                </h1>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--gray-900)' }}>
                    Что-то пошло не так
                </h2>
                <p className="mb-6" style={{ color: 'var(--gray-600)' }}>
                    Произошла ошибка при обработке запроса. Попробуйте обновить страницу.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset}>
                        Попробовать снова
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/'}>
                        Вернуться на главную
                    </Button>
                </div>
            </div>
        </div>
    );
}
