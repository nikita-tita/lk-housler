'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendEmail, verifyEmail } from '@/lib/api/auth';
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
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleSendEmail}>
        <h1 className="auth-title">Вход для клиентов</h1>
        <p className="auth-subtitle">Введите email для получения кода</p>

        <div className="field">
          <label className="field-label">Email</label>
          <input
            className="input"
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          {error && <p className="field-error">{error}</p>}
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Отправка...' : 'Получить код'}
        </button>

        {process.env.NODE_ENV === 'development' && (
          <p className="footer" style={{ marginTop: '24px', padding: 0 }}>
            Тест: любой email, код 123456
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode}>
      <h1 className="auth-title">Введите код из письма</h1>
      <p className="auth-subtitle">Код отправлен на {email}</p>

      <div className="field">
        <label className="field-label">Код подтверждения</label>
        <input
          className="input"
          type="text"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={loading}
          maxLength={6}
          required
        />
        {error && <p className="field-error">{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Проверка...' : 'Войти'}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep('email');
          setCode('');
          setError('');
        }}
        className="btn btn-ghost btn-block"
        style={{ marginTop: '12px' }}
      >
        Изменить email
      </button>
    </form>
  );
}
