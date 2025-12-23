'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sendSMS, verifySMS, getCurrentUser } from '@/lib/api/auth';
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
      // Нормализация телефона
      const normalizedPhone = phone.replace(/\D/g, '');
      const fullPhone = normalizedPhone.startsWith('7')
        ? `+${normalizedPhone}`
        : `+7${normalizedPhone}`;

      await sendSMS(fullPhone);
      setPhone(fullPhone);
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка отправки SMS');
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

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendSMS} className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Вход для агентов
          </h2>
          <p className="text-gray-600">
            Введите номер телефона для получения кода
          </p>
        </div>

        <Input
          label="Номер телефона"
          type="tel"
          placeholder="+7 999 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={error}
          disabled={loading}
          required
        />

        <Button type="submit" loading={loading} fullWidth>
          Получить код
        </Button>

        <p className="text-sm text-gray-600 text-center">
          Для тестирования используйте номера 79999000000-79999999999
          <br />
          Коды: 111111-666666
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Введите код из SMS
        </h2>
        <p className="text-gray-600">
          Код отправлен на номер {formatPhone(phone)}
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
          setStep('phone');
          setCode('');
          setError('');
        }}
        className="text-sm text-gray-600 hover:text-black transition-colors"
      >
        Изменить номер
      </button>
    </form>
  );
}

