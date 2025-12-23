'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';

const agencyMenuItems = [
  { href: '/agency/dashboard', label: 'Главная' },
  { href: '/agency/agents', label: 'Агенты' },
  { href: '/agency/deals', label: 'Сделки' },
  { href: '/agency/finance', label: 'Финансы' },
  { href: '/agency/settings', label: 'Настройки' },
];

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth('agency_admin');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar items={agencyMenuItems} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

