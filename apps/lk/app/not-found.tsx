'use client';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg-gray)' }}>
            <div className="text-center max-w-md">
                <h1 className="text-6xl font-semibold mb-4" style={{ color: 'var(--gray-900)' }}>
                    404
                </h1>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--gray-900)' }}>
                    Страница не найдена
                </h2>
                <p className="mb-6" style={{ color: 'var(--gray-600)' }}>
                    Запрашиваемая страница не существует или была перемещена.
                </p>
                <a
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg transition-colors"
                    style={{
                        background: 'var(--gray-900)',
                        color: 'var(--white)',
                    }}
                >
                    Вернуться на главную
                </a>
            </div>
        </div>
    );
}
