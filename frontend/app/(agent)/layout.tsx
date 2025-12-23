'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';

const agentMenuItems = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/deals', label: 'Сделки' },
  { href: '/profile', label: 'Профиль' },
];

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth('agent');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar items={agentMenuItems} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

