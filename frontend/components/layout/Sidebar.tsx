'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

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

  return (
    <aside className="sidebar">
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="header-logo">LK Housler</div>
        {user && (
          <p style={{ fontSize: '14px', color: 'var(--color-text-light)', marginTop: '4px' }}>
            {user.email || user.phone}
          </p>
        )}
      </div>

      <nav style={{ flex: 1, padding: '16px 0' }}>
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

      <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
        <button onClick={logout} className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start' }}>
          Выйти
        </button>
      </div>
    </aside>
  );
}
