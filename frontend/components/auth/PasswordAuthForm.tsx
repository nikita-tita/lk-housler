'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginAgency, getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDashboardPath } from '@/lib/utils/redirect';

export function PasswordAuthForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginAgency(email.toLowerCase().trim(), password);

      // Получаем данные пользователя
      const user = await getCurrentUser();

      // Сохраняем в store
      setAuth(response.access_token, user);

      // Редирект на dashboard по роли
      router.push(getDashboardPath(user.role));
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Неверный email или пароль'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Вход для агентств
        </h2>
        <p className="text-gray-600">
          Войдите используя корпоративный email и пароль
        </p>
      </div>

      <Input
        label="Email"
        type="email"
        placeholder="admin@agency.ru"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
      />

      <Input
        label="Пароль"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
        disabled={loading}
        required
      />

      <Button type="submit" loading={loading} fullWidth>
        Войти
      </Button>

      <div className="text-sm text-gray-600 text-center">
        <p>Забыли пароль?</p>
        <button
          type="button"
          className="text-black hover:underline"
          onClick={() => {
            // TODO: Implement password reset
            alert('Функция восстановления пароля будет реализована позже');
          }}
        >
          Восстановить доступ
        </button>
      </div>
    </form>
  );
}

