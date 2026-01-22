'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const COOKIE_CONSENT_KEY = 'housler_cookie_consent';

type ConsentStatus = 'pending' | 'accepted' | 'rejected';

interface CookieConsent {
  status: ConsentStatus;
  timestamp: string;
  functional: boolean;
  analytics: boolean;
}

export function CookieBanner() {
  const pathname = usePathname();
  // Lazy initialization to avoid setState in useEffect
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(COOKIE_CONSENT_KEY);
  });
  const [isExpanded, setIsExpanded] = useState(false);

  // Не показываем на гостевых страницах /s/[code]
  if (pathname?.startsWith('/s/')) {
    return null;
  }

  const saveConsent = (status: ConsentStatus, analytics: boolean) => {
    const consent: CookieConsent = {
      status,
      timestamp: new Date().toISOString(),
      functional: true,
      analytics,
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    saveConsent('accepted', true);
  };

  const handleRejectAll = () => {
    saveConsent('rejected', false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-[var(--color-border)] shadow-lg">
      <div className="container max-w-4xl mx-auto">
        {!isExpanded ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-[var(--color-text)] flex-1">
              Мы используем файлы cookie и сервисы веб-аналитики.
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Подробнее
              </button>
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Отклонить все
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Принять все
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-[var(--color-text)] space-y-3">
              <p>
                Нажимая &laquo;Принять все&raquo; вы даёте{' '}
                <Link
                  href="/doc/clients/soglasiya/cookie"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  согласие на обработку cookie-файлов
                </Link>{' '}
                (подробнее в{' '}
                <Link
                  href="/doc/clients/politiki/privacy"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Политике конфиденциальности
                </Link>
                ).
              </p>
              <p>
                <strong>ООО &laquo;Сектор ИТ&raquo;</strong> обрабатывает cookie, в том числе через
                сервисы веб-аналитики Яндекс Метрика с целью обеспечения функционирования сайта,
                аналитики действий на сайте и улучшения качества обслуживания.
              </p>
              <p>
                Нажимая &laquo;Отклонить все&raquo; или продолжая использовать сайт,
                мы будем обрабатывать только функциональные cookie-файлы, необходимые для работы сайта.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
              >
                Свернуть
              </button>
              <div className="flex-1" />
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Отклонить все
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Принять все
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
