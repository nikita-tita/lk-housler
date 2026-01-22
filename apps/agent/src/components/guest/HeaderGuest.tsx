'use client';

import Link from 'next/link';
import { useGuest } from '@/contexts/GuestContext';
import { useGuestFavorites } from '@/contexts/GuestFavoritesContext';

export function HeaderGuest() {
  const { context, selectionCode } = useGuest();
  const { favoritesCount } = useGuestFavorites();

  const agencyName = context?.agency?.name || 'Агентство недвижимости';
  const agentName = context?.agent?.name;
  const agentPhone = context?.agent?.phone;
  const logoUrl = context?.agency?.logo_url;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-border)]">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Agency branding */}
          <Link
            href={selectionCode ? `/s/${selectionCode}` : '#'}
            className="flex items-center gap-3"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={agencyName}
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-lg font-semibold tracking-tight">
                {agencyName}
              </span>
            )}
          </Link>

          {/* Navigation & Agent info */}
          <div className="flex items-center gap-4">
            {/* Favorites link */}
            {selectionCode && (
              <Link
                href={`/s/${selectionCode}/favorites`}
                className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
              >
                <svg
                  className={`w-5 h-5 ${favoritesCount > 0 ? 'text-[var(--gray-900)] fill-current' : ''}`}
                  viewBox="0 0 24 24"
                  fill={favoritesCount > 0 ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                <span className="hidden sm:inline">Избранное</span>
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-[var(--gray-900)] text-white text-xs font-bold rounded-full">
                    {favoritesCount > 9 ? '9+' : favoritesCount}
                  </span>
                )}
              </Link>
            )}

            {agentName && (
              <div className="hidden sm:block text-right">
                <div className="text-sm text-[var(--color-text-light)]">Ваш агент</div>
                <div className="text-sm font-medium">{agentName}</div>
              </div>
            )}

            {agentPhone && (
              <a
                href={`tel:${agentPhone}`}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="hidden sm:inline">Позвонить</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
