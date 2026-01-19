/**
 * Footer Component
 * @sync-with /Users/fatbookpro/Desktop/housler_pervichka/frontend/src/components/Footer.tsx
 *
 * This component should be kept in sync with agent.housler.ru Footer.
 * When updating, ensure both files are modified identically.
 */
'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-16 border-t border-[var(--color-border)]">
      <div className="container">
        {/* Upper footer */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-10">
          {/* Brand */}
          <div className="flex-shrink-0">
            <div className="text-xl font-semibold tracking-tight mb-2">HOUSLER</div>
            <div className="text-sm text-[var(--color-text-light)] max-w-[280px]">
              Покупка и продажа недвижимости в Москве и Санкт-Петербурге
            </div>
          </div>

          {/* Contacts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-12">
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-3">
                Email
              </div>
              <a
                href="mailto:hello@housler.ru"
                className="text-[15px] font-medium hover:text-[var(--color-accent)] transition-colors"
              >
                hello@housler.ru
              </a>
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-3">
                Телефон
              </div>
              <a
                href="tel:+79110295520"
                className="text-[15px] font-medium hover:text-[var(--color-accent)] transition-colors"
              >
                +7 (911) 029-55-20
              </a>
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-3">
                Telegram
              </div>
              <a
                href="https://t.me/housler_spb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium hover:text-[var(--color-accent)] transition-colors"
              >
                @housler_spb
              </a>
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-3">
                Блог
              </div>
              <a
                href="https://housler.ru/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium hover:text-[var(--color-accent)] transition-colors"
              >
                Статьи о недвижимости
              </a>
            </div>
          </div>
        </div>

        {/* Lower footer */}
        <div className="pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[13px] text-[var(--color-text-light)]">
            {currentYear} Housler - Все права защищены
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-[13px] text-[var(--color-text-light)]">
            <Link
              href="/legal/privacy"
              className="hover:text-[var(--color-accent)] transition-colors"
            >
              Политика ПД
            </Link>
            <Link
              href="/legal/terms"
              className="hover:text-[var(--color-accent)] transition-colors"
            >
              Пользовательское соглашение
            </Link>
            <Link
              href="/legal/support"
              className="hover:text-[var(--color-accent)] transition-colors"
            >
              Поддержка
            </Link>
            <Link
              href="/legal/requisites"
              className="hover:text-[var(--color-accent)] transition-colors"
            >
              Контакты
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
