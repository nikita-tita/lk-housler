'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  agentOnly?: boolean;
  agencyAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/settings/profile', label: 'Профиль', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )},
  { href: '/settings/notifications', label: 'Уведомления', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )},
  { href: '/settings/legal', label: 'Юр. данные', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ), agentOnly: true },
  { href: '/settings/agency', label: 'Агентство', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ), agencyAdminOnly: true },
  { href: '/settings/agency/team', label: 'Команда', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ), agencyAdminOnly: true },
];

function SettingsNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAgent = user?.role === 'agent' || user?.role === 'agency_admin' || user?.role === 'operator';
  const isAgencyAdmin = user?.role === 'agency_admin';

  const visibleItems = navItems.filter(item => {
    if (item.agentOnly && !isAgent) return false;
    if (item.agencyAdminOnly && !isAgencyAdmin) return false;
    return true;
  });

  return (
    <nav className="space-y-1">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-[var(--color-accent)]'
                : 'text-[var(--color-text)] hover:bg-gray-100'
            }`}
            style={isActive ? { color: '#FFFFFF' } : undefined}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-8">Настройки</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar navigation */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-[var(--color-border)] rounded-lg p-4">
            <SettingsNav />
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </RequireAuth>
  );
}
