'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendSMS, resendSMS, verifySMS } from '@housler/lib';
import { useAuthStore } from '@housler/lib';
import { formatPhone } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';

export function SMSAuthForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Normalize to format 7XXXXXXXXXX (no +)
      const normalizedPhone = phone.replace(/\D/g, '');
      const fullPhone = normalizedPhone.startsWith('7')
        ? normalizedPhone
        : `7${normalizedPhone}`;

      await sendSMS(fullPhone);
      setPhone(fullPhone);
      setStep('code');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка отправки SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSMS = async () => {
    setError('');
    setResendSuccess(false);
    setResending(true);

    try {
      await resendSMS(phone);
      setResendSuccess(true);
      setCode('');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка отправки SMS');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await verifySMS(phone, code);
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      if (axiosError.message === 'NEW_USER_NEEDS_REGISTRATION') {
        setError('Номер не зарегистрирован. Пожалуйста, зарегистрируйтесь на agent.housler.ru');
      } else {
        setError(axiosError.response?.data?.error || axiosError.message || 'Неверный код');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendSMS}>
        <h1 className="auth-title">Вход для агентов</h1>
        <p className="auth-subtitle">Введите номер телефона для получения кода</p>

        <div className="field">
          <label className="field-label">Номер телефона</label>
          <input
            className="input"
            type="tel"
            placeholder="+7 999 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
            Тест: номера 79999xxxxxx, коды 111111-666666
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode}>
      <h1 className="auth-title">Введите код из SMS</h1>
      <p className="auth-subtitle">
        Код отправлен на {formatPhone(phone)}
        {resendSuccess && <span style={{ color: '#16a34a', display: 'block', marginTop: '4px' }}>Новый код отправлен!</span>}
      </p>

      <div className="field">
        <label className="field-label">Код подтверждения</label>
        <input
          className="input"
          type="text"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={loading || resending}
          maxLength={6}
          required
        />
        {error && <p className="field-error">{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={loading || resending}>
        {loading ? 'Проверка...' : 'Войти'}
      </button>

      <button
        type="button"
        onClick={handleResendSMS}
        className="btn btn-ghost btn-block"
        style={{ marginTop: '12px' }}
        disabled={resending || loading}
      >
        {resending ? 'Отправка...' : 'Отправить новый код'}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep('phone');
          setCode('');
          setError('');
          setResendSuccess(false);
        }}
        className="btn btn-ghost btn-block"
        style={{ marginTop: '8px' }}
      >
        Изменить номер
      </button>
    </form>
  );
}
