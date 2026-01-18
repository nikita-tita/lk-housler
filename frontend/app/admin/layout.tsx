'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';

const adminMenuItems = [
  { href: '/admin/dashboard', label: 'Обзор' },
  { href: '/admin/deals', label: 'Сделки' },
  { href: '/admin/disputes', label: 'Споры' },
  { href: '/admin/payouts', label: 'Выплаты' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth('admin');

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Sidebar items={adminMenuItems} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
