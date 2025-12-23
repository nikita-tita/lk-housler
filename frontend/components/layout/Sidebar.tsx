'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { cn } from '@/lib/utils/cn';

interface MenuItem {
  href: string;
  label: string;
  icon?: string;
}

interface SidebarProps {
  items: MenuItem[];
}

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-300 flex flex-col">
      <div className="p-6 border-b border-gray-300">
        <h1 className="text-xl font-semibold text-gray-900">LK Housler</h1>
        {user && (
          <p className="text-sm text-gray-600 mt-1">
            {user.email || user.phone}
          </p>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-black text-white'
                      : 'text-gray-900 hover:bg-gray-100'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-300">
        <button
          onClick={logout}
          className="w-full px-4 py-3 text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-left"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}

