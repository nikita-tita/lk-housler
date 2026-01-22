'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@housler/lib';

interface MenuItem {
  href: string;
  label: string;
}

interface SidebarProps {
  items: MenuItem[];
}

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="header-logo">LK Housler</div>
        <button
          className="menu-button"
          onClick={() => setIsOpen(true)}
          aria-label="Открыть меню"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="header-logo">LK Housler</div>
            {user && (
              <>
                <p style={{ fontSize: '14px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  {user.name || user.email || user.phone}
                </p>
                {user.agency && (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-light)', marginTop: '2px', opacity: 0.7 }}>
                    {user.agency.short_name || user.agency.legal_name}
                  </p>
                )}
              </>
            )}
          </div>
          {/* Close button for mobile */}
          <button
            className="menu-button lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Закрыть меню"
            style={{ marginRight: '-8px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Cross-service navigation */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Другие сервисы
          </p>
          <a
            href="https://agent.housler.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '0',
              textDecoration: 'none',
            }}
          >
            <div>
              <span style={{ fontWeight: 500 }}>Сервис новостроек</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-light)', marginTop: '2px' }}>
                agent.housler.ru
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={logout} className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start' }}>
            Выйти
          </button>
        </div>
      </aside>
    </>
  );
}
