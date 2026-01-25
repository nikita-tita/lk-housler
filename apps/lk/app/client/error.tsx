'use client';

import { useEffect } from 'react';
import { Button } from '@housler/ui';

export default function ClientError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            console.error('Client error:', error);
        }
    }, [error]);

    return (
        <div className="flex items-center justify-center px-4 py-16">
            <div className="text-center max-w-md">
                <h1 className="text-4xl font-semibold mb-4" style={{ color: 'var(--gray-900)' }}>
                    Ошибка
                </h1>
                <p className="mb-6" style={{ color: 'var(--gray-600)' }}>
                    Произошла ошибка при загрузке страницы. Попробуйте обновить или вернитесь на главную.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset}>
                        Попробовать снова
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/client/dashboard'}>
                        На главную
                    </Button>
                </div>
            </div>
        </div>
    );
}
