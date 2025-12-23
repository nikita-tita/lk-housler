'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';

const agentMenuItems = [
  { href: '/agent/dashboard', label: 'Главная' },
  { href: '/agent/deals', label: 'Сделки' },
  { href: '/agent/profile', label: 'Профиль' },
];

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth('agent');

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Sidebar items={agentMenuItems} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
