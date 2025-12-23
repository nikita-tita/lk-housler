'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sendEmail, verifyEmail, getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDashboardPath } from '@/lib/utils/redirect';

export function EmailAuthForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendEmail(email.toLowerCase().trim());
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка отправки письма');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await verifyEmail(email.toLowerCase().trim(), code);

      // Получаем данные пользователя
      const user = await getCurrentUser();

      // Сохраняем в store
      setAuth(response.access_token, user);

      // Редирект на dashboard по роли
      router.push(getDashboardPath(user.role));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleSendEmail} className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Вход для клиентов
          </h2>
          <p className="text-gray-600">
            Введите email для получения кода
          </p>
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="example@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          disabled={loading}
          required
        />

        <Button type="submit" loading={loading} fullWidth>
          Получить код
        </Button>

        <p className="text-sm text-gray-600 text-center">
          Код будет отправлен на указанный email
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Введите код из письма
        </h2>
        <p className="text-gray-600">
          Код отправлен на {email}
        </p>
      </div>

      <Input
        label="Код подтверждения"
        type="text"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        error={error}
        disabled={loading}
        maxLength={6}
        required
      />

      <Button type="submit" loading={loading} fullWidth>
        Войти
      </Button>

      <button
        type="button"
        onClick={() => {
          setStep('email');
          setCode('');
          setError('');
        }}
        className="text-sm text-gray-600 hover:text-black transition-colors"
      >
        Изменить email
      </button>
    </form>
  );
}

