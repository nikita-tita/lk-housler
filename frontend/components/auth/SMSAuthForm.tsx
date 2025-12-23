'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendSMS, verifySMS } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { formatPhone } from '@/lib/utils/format';
import { getDashboardPath } from '@/lib/utils/redirect';

export function SMSAuthForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Ошибка отправки SMS');
    } finally {
      setLoading(false);
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
    } catch (err: any) {
      if (err.message === 'NEW_USER_NEEDS_REGISTRATION') {
        setError('Номер не зарегистрирован. Пожалуйста, зарегистрируйтесь на agent.housler.ru');
      } else {
        setError(err.response?.data?.message || err.message || 'Неверный код');
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

        <p className="footer" style={{ marginTop: '24px', padding: 0 }}>
          Тест: номера 79999xxxxxx, коды 111111-666666
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode}>
      <h1 className="auth-title">Введите код из SMS</h1>
      <p className="auth-subtitle">Код отправлен на {formatPhone(phone)}</p>

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
          setStep('phone');
          setCode('');
          setError('');
        }}
        className="btn btn-ghost btn-block"
        style={{ marginTop: '12px' }}
      >
        Изменить номер
      </button>
    </form>
  );
}
