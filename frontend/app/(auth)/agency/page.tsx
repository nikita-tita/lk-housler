'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { loginAgency } from '@/lib/api/auth';
import { getDashboardPath } from '@/lib/utils/redirect';

type Mode = 'login' | 'register';

export default function AgencyLoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/agency/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await loginAgency(loginEmail.toLowerCase().trim(), loginPassword);
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-accent)] mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Выбрать другую роль
      </Link>

      <h1 className="text-2xl font-semibold text-center mb-2">Вход для агентств</h1>
      <p className="text-[var(--color-text-light)] text-center mb-8">
        Сотрудники агентств недвижимости
      </p>

      {/* Login/Register toggle */}
      <div className="flex gap-2 mb-8 bg-[var(--color-bg-secondary)] rounded-lg p-1">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-white shadow-sm text-[var(--color-text)]'
              : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
          }`}
        >
          Вход
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-white shadow-sm text-[var(--color-text)]'
              : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
          }`}
        >
          Регистрация
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="email@agency.com"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="********"
              required
              className="input"
            />
          </div>

          {error && (
            <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading || !loginEmail || !loginPassword}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            Нет аккаунта?{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="text-[var(--color-accent)] hover:underline"
            >
              Зарегистрируйте агентство
            </button>
          </p>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--gray-900)]/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">Регистрация агентства</h3>
            <p className="text-sm text-[var(--color-text-light)] mb-4">
              Для регистрации агентства недвижимости перейдите на страницу регистрации
            </p>
            <Link
              href="https://agent.housler.ru/registration/agency"
              target="_blank"
              className="btn btn-primary inline-flex"
            >
              Зарегистрировать агентство
            </Link>
          </div>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-[var(--color-accent)] hover:underline"
            >
              Войти
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
