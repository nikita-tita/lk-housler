'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';

const TABS = [
  { href: '/admin', label: 'Статистика', icon: 'chart' },
  { href: '/admin/users', label: 'Пользователи', icon: 'users' },
  { href: '/admin/agencies', label: 'Агентства', icon: 'building' },
];

function TabIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'chart':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'users':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case 'building':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RequireAuth allowedRoles={['admin']}>
    <div className="section">
      <div className="container">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Админ-панель</h1>
            <p className="text-sm text-[var(--color-text-light)] mt-1">
              Управление платформой Housler
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(tab => {
            const isActive = tab.href === '/admin'
              ? pathname === '/admin'
              : pathname?.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tab-btn flex items-center gap-2 ${isActive ? 'tab-btn-active' : ''}`}
              >
                <TabIcon icon={tab.icon} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
    </RequireAuth>
  );
}
