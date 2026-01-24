'use client';

import { useRequireAuth } from '@/hooks/useAuth';
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
  const { isLoading } = useRequireAuth(['agency_admin', 'agency_employee']);

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Sidebar items={agencyMenuItems} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
