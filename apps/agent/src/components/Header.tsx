'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const { favoriteIds } = useFavorites();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close profile menu on route change
  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  // Проверка активной ссылки
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  // Стили для навигационных ссылок
  const navLinkClass = (href: string) =>
    `text-[15px] font-medium transition-colors ${
      isActive(href)
        ? 'text-[var(--color-accent)]'
        : 'hover:text-[var(--color-text-light)]'
    }`;

  // Не показываем Header на гостевых страницах /s/[code]
  if (pathname?.startsWith('/s/')) {
    return null;
  }

  return (
    <nav className="py-8 border-b border-[var(--color-border)] bg-white">
      <div className="container">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            HOUSLER
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-10">
            <Link href="/offers" className={navLinkClass('/offers')}>
              Квартиры
            </Link>
            <Link href="/complexes" className={navLinkClass('/complexes')}>
              Жилые комплексы
            </Link>
            <Link href="/map" className={navLinkClass('/map')}>
              Карта
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  href="/favorites"
                  className={`${navLinkClass('/favorites')} flex items-center gap-1`}
                >
                  <span>Избранное</span>
                  {favoriteIds.size > 0 && (
                    <span className="bg-[var(--color-accent)] text-white text-xs px-1.5 py-0.5 rounded-full">
                      {favoriteIds.size}
                    </span>
                  )}
                </Link>
                {(user?.role === 'agent' || user?.role === 'admin') && (
                  <>
                    <Link href="/selections" className={navLinkClass('/selections')}>
                      Подборки
                    </Link>
                    <Link href="/clients" className={navLinkClass('/clients')}>
                      Клиенты
                    </Link>
                  </>
                )}
              </>
            )}

            {/* Auth button with dropdown */}
            {isLoading ? (
              <span className="text-[15px] text-[var(--color-text-light)]">...</span>
            ) : isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                    </span>
                  </div>
                  <span className="text-[13px] text-[var(--color-text-light)]">
                    {user?.name || user?.email?.split('@')[0]}
                  </span>
                  <svg
                    className={`w-4 h-4 text-[var(--color-text-light)] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile dropdown menu */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-50">
                    <div className="py-2">
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Мой профиль
                      </Link>
                    </div>

                    <div className="border-t border-[var(--color-border)] py-2 px-3">
                      <p className="text-xs text-[var(--color-text-light)] uppercase tracking-wide mb-2">
                        Другие сервисы
                      </p>
                      <a
                        href="https://lk.housler.ru"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <span className="block text-sm font-medium">Сервис сделок</span>
                          <span className="block text-xs text-[var(--color-text-light)]">lk.housler.ru</span>
                        </div>
                        <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>

                    <div className="border-t border-[var(--color-border)] py-2">
                      <button
                        onClick={() => {
                          logout();
                          setProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Выйти
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="text-[15px] font-medium transition-colors hover:text-[var(--color-text-light)]"
              >
                Войти
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className={`w-6 h-0.5 bg-[var(--color-text)] transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-[var(--color-text)] ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`w-6 h-0.5 bg-[var(--color-text)] transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-6 pb-2 space-y-4">
            <Link
              href="/offers"
              className={`block py-2 ${navLinkClass('/offers')}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Квартиры
            </Link>
            <Link
              href="/complexes"
              className={`block py-2 ${navLinkClass('/complexes')}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Жилые комплексы
            </Link>
            <Link
              href="/map"
              className={`block py-2 ${navLinkClass('/map')}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Карта
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  href="/favorites"
                  className={`block py-2 ${navLinkClass('/favorites')}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Избранное {favoriteIds.size > 0 && `(${favoriteIds.size})`}
                </Link>
                {(user?.role === 'agent' || user?.role === 'admin') && (
                  <>
                    <Link
                      href="/selections"
                      className={`block py-2 ${navLinkClass('/selections')}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Подборки
                    </Link>
                    <Link
                      href="/clients"
                      className={`block py-2 ${navLinkClass('/clients')}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Клиенты
                    </Link>
                  </>
                )}
              </>
            )}

            <div className="pt-4 border-t border-[var(--color-border)]">
              {isAuthenticated ? (
                <div className="space-y-4">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="text-[15px] font-medium">
                        {user?.name || 'Мой профиль'}
                      </div>
                      <div className="text-[13px] text-[var(--color-text-light)]">
                        {user?.email}
                      </div>
                    </div>
                  </Link>

                  {/* Cross-service navigation for mobile */}
                  <div className="py-3">
                    <p className="text-xs text-[var(--color-text-light)] uppercase tracking-wide mb-2">
                      Другие сервисы
                    </p>
                    <a
                      href="https://lk.housler.ru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div>
                        <span className="block text-sm font-medium">Сервис сделок</span>
                        <span className="block text-xs text-[var(--color-text-light)]">lk.housler.ru</span>
                      </div>
                      <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-[15px] font-medium text-[var(--color-text-light)] hover:text-[var(--color-text)] py-2"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="block text-[15px] font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
