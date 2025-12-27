'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { sendEmail, verifyEmail } from '@/lib/api/auth';
import { getDashboardPath } from '@/lib/utils/redirect';

type Step = 'email' | 'code';

export default function ClientLoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Resend cooldown
  const [canResendAt, setCanResendAt] = useState<Date | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!canResendAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = Math.max(0, Math.ceil((canResendAt.getTime() - now.getTime()) / 1000));
      setResendCountdown(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [canResendAt]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/client/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await sendEmail(email.toLowerCase().trim());
      setCanResendAt(new Date(Date.now() + 60 * 1000));
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      await sendEmail(email.toLowerCase().trim());
      setCanResendAt(new Date(Date.now() + 60 * 1000));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Ошибка повторной отправки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await verifyEmail(email.toLowerCase().trim(), code);
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Неверный код');
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

      <h1 className="text-2xl font-semibold text-center mb-2">Вход для клиентов</h1>
      <p className="text-[var(--color-text-light)] text-center mb-8">
        Для поиска и подбора недвижимости
      </p>

      {step === 'email' ? (
        <form onSubmit={handleRequestCode} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="input"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'Отправка...' : 'Получить код'}
          </button>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            Продолжая, вы соглашаетесь с{' '}
            <Link href="https://agent.housler.ru/doc/clients/soglasiya/terms" target="_blank" className="text-[var(--color-accent)] hover:underline">
              Пользовательским соглашением
            </Link>{' '}
            и{' '}
            <Link href="https://agent.housler.ru/doc/clients/politiki/privacy" target="_blank" className="text-[var(--color-accent)] hover:underline">
              Политикой конфиденциальности
            </Link>
          </p>

          <p className="text-xs text-[var(--color-text-light)] text-center border-t border-[var(--color-border)] pt-4 mt-4">
            Тест: любой email @test.housler.ru, коды 111111-666666
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div className="text-center text-sm text-[var(--color-text-light)] mb-4">
            Код отправлен на <strong>{email}</strong>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              Код из письма
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              maxLength={6}
              className="input text-center text-2xl tracking-widest"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'Проверка...' : 'Войти'}
          </button>

          {/* Resend code button */}
          <div className="text-center">
            {resendCountdown > 0 ? (
              <span className="text-sm text-[var(--color-text-light)]">
                Отправить новый код через {resendCountdown} сек.
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Отправить новый код
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError('');
              setCanResendAt(null);
            }}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Изменить email
          </button>
        </form>
      )}
    </div>
  );
}
