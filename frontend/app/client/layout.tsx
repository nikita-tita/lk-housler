'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth('client');
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="spinner" />
      </div>
    );
  }

  const menuItems = [
    { href: '/client/dashboard', label: 'Мои сделки' },
    { href: '/client/documents', label: 'Документы' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-gray)' }}>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <span className="header-logo">LK Housler</span>
              <nav className="header-nav">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={isActive ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-light)' }}>{user?.email}</span>
              <button onClick={logout} className="btn btn-ghost btn-sm">
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container" style={{ padding: '32px 16px' }}>
        {children}
      </main>
    </div>
  );
}
