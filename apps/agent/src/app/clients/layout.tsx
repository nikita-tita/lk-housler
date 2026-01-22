'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';

const TABS = [
  { href: '/clients', label: 'Все клиенты' },
  { href: '/clients/funnel', label: 'Воронка' },
  { href: '/clients/fixations', label: 'Фиксации' },
  { href: '/clients/deals', label: 'Сделки' },
  { href: '/clients/failures', label: 'Срывы' },
];

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Определяем активный таб
  const isExactMatch = pathname === '/clients';
  const isFunnelMatch = pathname === '/clients/funnel';
  const isFixationsMatch = pathname?.startsWith('/clients/fixations');
  const isDealsMatch = pathname?.startsWith('/clients/deals');
  const isFailuresMatch = pathname?.startsWith('/clients/failures');
  const isDetailPage = pathname?.startsWith('/clients/') && !isFunnelMatch && !isFixationsMatch && !isDealsMatch && !isFailuresMatch && pathname !== '/clients/new';

  return (
    <RequireAuth allowedRoles={['agent', 'admin']}>
      <div className="section">
        <div className="container">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold">Клиенты</h1>
            <Link
              href="/clients/new"
              className="btn btn-primary btn-sm"
            >
              + Добавить клиента
            </Link>
          </div>

          {/* Tabs — показываем только на списке и воронке */}
          {!isDetailPage && pathname !== '/clients/new' && (
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {TABS.map(tab => {
                const isActive = tab.href === '/clients'
                  ? isExactMatch
                  : pathname?.startsWith(tab.href);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`tab-btn ${isActive ? 'tab-btn-active' : ''}`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
