'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAgency } from '@housler/lib';
import { useAuthStore } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';

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
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosError.response?.data?.message || axiosError.message || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <h1 className="auth-title">Вход для агентств</h1>
      <p className="auth-subtitle">Войдите используя корпоративный email и пароль</p>

      <div className="field">
        <label className="field-label">Email</label>
        <input
          className="input"
          type="email"
          placeholder="admin@agency.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="field">
        <label className="field-label">Пароль</label>
        <input
          className="input"
          type="password"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        {error && <p className="field-error">{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Вход...' : 'Войти'}
      </button>

      <div className="footer" style={{ marginTop: '24px', padding: 0 }}>
        <p>Забыли пароль?</p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => alert('Функция восстановления пароля будет реализована позже')}
        >
          Восстановить доступ
        </button>
      </div>
    </form>
  );
}
