'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { Footer } from '@/components/shared/Footer';
import { Button } from '@housler/ui';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.push(getDashboardPath(user.role));
    }
  }, [isAuthenticated, isLoading, user, router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 border-b border-[var(--color-border)]">
        <div className="container">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              HOUSLER
            </Link>

            <Link
              href="/login"
              className="text-[15px] font-medium hover:text-[var(--color-text-light)] transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
              Личный кабинет
            </h1>
            <p className="text-lg text-[var(--color-text-light)] mb-10 max-w-lg mx-auto">
              Платформа автоматизации агентских сделок на рынке недвижимости
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="btn btn-primary btn-lg"
              >
                Авторизация
              </Link>
              <Link
                href="/realtor"
                className="btn btn-secondary btn-lg"
              >
                Регистрация риелтора
              </Link>
              <Button />
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-8 mt-20 text-left">
              <div>
                <div className="w-12 h-12 bg-[var(--color-bg-secondary)] rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">Управление сделками</h3>
                <p className="text-sm text-[var(--color-text-light)]">
                  Ведите сделки от первого контакта до закрытия в одном месте
                </p>
              </div>

              <div>
                <div className="w-12 h-12 bg-[var(--color-bg-secondary)] rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">Документооборот</h3>
                <p className="text-sm text-[var(--color-text-light)]">
                  Храните и подписывайте документы онлайн
                </p>
              </div>

              <div>
                <div className="w-12 h-12 bg-[var(--color-bg-secondary)] rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">Финансы</h3>
                <p className="text-sm text-[var(--color-text-light)]">
                  Отслеживайте комиссии и выплаты в реальном времени
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
