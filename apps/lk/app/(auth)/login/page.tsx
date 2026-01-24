'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { useEffect } from 'react';

const roles = [
  {
    id: 'client',
    title: 'Клиент',
    description: 'Для физических лиц, ищущих недвижимость',
    href: '/login/client',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: 'realtor',
    title: 'Частный риелтор',
    description: 'Для самозанятых и индивидуально работающих агентов',
    href: '/realtor',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
      </svg>
    ),
  },
  {
    id: 'agency',
    title: 'Агентство недвижимости',
    description: 'Регистрация агентства или вход для руководителя',
    href: '/login/agency',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    id: 'employee',
    title: 'Сотрудник агентства',
    description: 'Вход для сотрудников, добавленных руководителем',
    href: '/login/employee',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && !isLoading && user) {
      router.push(getDashboardPath(user.role));
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-center mb-2">Выберите свою роль</h1>
      <p className="text-[var(--color-text-light)] text-center mb-8">
        Для входа или регистрации в личном кабинете Housler
      </p>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Link
            key={role.id}
            href={role.href}
            className="flex items-center gap-4 p-5 border border-[var(--color-border)] rounded-xl hover:border-[var(--gray-400)] hover:bg-[var(--color-bg-secondary)] transition-all"
          >
            <div className="text-[var(--color-accent)]">
              {role.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-medium mb-1">{role.title}</h2>
              <p className="text-sm text-[var(--color-text-light)]">{role.description}</p>
            </div>
            <svg className="w-5 h-5 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>

      <p className="text-center text-sm text-[var(--color-text-light)] mt-8">
        Уже зарегистрированы?{' '}
        <Link href="/login/client" className="text-[var(--color-accent)] hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
