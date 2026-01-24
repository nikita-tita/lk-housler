'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { sendSMS, verifySMS, registerClient } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { PhoneInput, SmsCodeInput, DateInput, ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'phone' | 'code' | 'registration';

const STEPS = [
  { id: 'phone', title: 'Телефон' },
  { id: 'code', title: 'Код' },
  { id: 'registration', title: 'Данные' },
];

interface ClientFormData {
  phone: string;
  name: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  consents: {
    personalData: boolean;
    terms: boolean;
    marketing: boolean;
  };
}

// Format date for display
function formatCodeSentDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `сегодня в ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `вчера в ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  }
}

export default function ClientLoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State for existing code
  const [existingCode, setExistingCode] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<string | null>(null);

  // State for resend cooldown (24 hours)
  const [canResendAt, setCanResendAt] = useState<Date | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer (shows hours if > 60 min)
  useEffect(() => {
    if (!canResendAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const diffMs = canResendAt.getTime() - now.getTime();
      const diffSec = Math.max(0, Math.ceil(diffMs / 1000));
      setResendCountdown(diffSec);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [canResendAt]);

  const [formData, setFormData] = useState<ClientFormData>({
    phone: '',
    name: '',
    email: '',
    birthDate: '',
    consents: {
      personalData: false,
      terms: false,
      marketing: false,
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/client/dashboard');
    }
  }, [isAuthenticated, router]);

  const getCleanPhone = () => {
    return phone.replace(/\D/g, '');
  };

  // Format countdown for display
  const formatCountdown = (seconds: number): string => {
    if (seconds >= 3600) {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} ч.`;
    } else if (seconds >= 60) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} мин.`;
    }
    return `${seconds} сек.`;
  };

  // Continue to code entry (without sending SMS)
  const handleContinueToCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length !== 11) {
      setError('Введите номер телефона полностью');
      return;
    }

    setFormData(prev => ({ ...prev, phone: cleanPhone }));
    setExistingCode(true); // Assume code was sent before
    setStep('code');
  };

  // Request new SMS code (explicit user action)
  const handleRequestNewCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await sendSMS(formData.phone);
      if (result.existingCode) {
        // Code already exists
        setExistingCode(true);
        if (result.codeSentAt) setCodeSentAt(result.codeSentAt);
        if (result.canResendAt) setCanResendAt(new Date(result.canResendAt));
      } else {
        // New code sent
        setExistingCode(false);
        if (result.codeSentAt) setCodeSentAt(result.codeSentAt);
        if (result.canResendAt) setCanResendAt(new Date(result.canResendAt));
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка отправки SMS');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify SMS code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await verifySMS(formData.phone, code);
      // User exists - login successful
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      if (axiosError.message === 'NEW_USER_NEEDS_REGISTRATION') {
        // New user - show registration form
        setStep('registration');
      } else {
        // API returns error in 'error' field, not 'message'
        const errorMessage = axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message;
        // Map common errors to user-friendly messages
        if (errorMessage?.includes('Invalid code') || errorMessage?.includes('Неверный код')) {
          setError('Неверный код. Проверьте код и попробуйте снова.');
        } else if (errorMessage?.includes('expired') || errorMessage?.includes('истек')) {
          setError('Код истек. Запросите новый код.');
        } else if (errorMessage?.includes('already used') || errorMessage?.includes('использован')) {
          setError('Код уже был использован. Запросите новый код.');
        } else if (errorMessage?.includes('not found') || errorMessage?.includes('не найден')) {
          setError('Код не найден. Сначала запросите отправку кода.');
        } else {
          setError(errorMessage || 'Ошибка проверки кода');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Complete registration
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate consents
    if (!formData.consents.personalData || !formData.consents.terms) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    // Validate birthDate
    if (!formData.birthDate) {
      setError('Укажите дату рождения');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerClient({
        phone: formData.phone,
        name: formData.name,
        email: formData.email,
        birthDate: formData.birthDate,
        consents: formData.consents,
      });
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const errorMessage = axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message;
      setError(errorMessage || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

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
      <p className="text-[var(--color-text-light)] text-center mb-6">
        Для поиска и подбора недвижимости
      </p>

      <RegistrationStepper steps={STEPS} currentStep={currentStepIndex} />

      {step === 'phone' && (
        <form onSubmit={handleContinueToCode} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Номер телефона</label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={getCleanPhone().length !== 11}
            className="btn btn-primary btn-block"
          >
            Продолжить
          </button>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            Продолжая, вы соглашаетесь с{' '}
            <Link href="https://agent.housler.ru/doc/clients/soglasiya/terms" target="_blank" className="text-[var(--color-accent)] hover:underline">
              Пользовательским соглашением
            </Link>
          </p>

          <p className="text-xs text-[var(--color-text-light)] text-center border-t border-[var(--color-border)] pt-4 mt-4">
            Тест: номера 79999xxxxxx, коды 111111-666666
          </p>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div className="text-center text-sm text-[var(--color-text-light)] mb-4">
            {existingCode ? (
              <>
                Введите код, который вы получали ранее
                {codeSentAt && (
                  <> ({formatCodeSentDate(codeSentAt)})</>
                )}
                <br />
                на <strong>+{formData.phone}</strong>
              </>
            ) : (
              <>Код отправлен на <strong>+{formData.phone}</strong></>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-center">Код из SMS</label>
            <SmsCodeInput
              value={code}
              onChange={setCode}
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
            {isLoading ? 'Проверка...' : 'Продолжить'}
          </button>

          {/* Request new code button */}
          <div className="text-center">
            {resendCountdown > 0 ? (
              <span className="text-sm text-[var(--color-text-light)]">
                Запросить новый код через {formatCountdown(resendCountdown)}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestNewCode}
                disabled={isLoading}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                {existingCode ? 'Забыли код? Запросить новый' : 'Отправить новый код'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
              setCanResendAt(null);
              setExistingCode(false);
              setCodeSentAt(null);
            }}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Изменить номер
          </button>
        </form>
      )}

      {step === 'registration' && (
        <form onSubmit={handleRegistration} className="space-y-5" autoComplete="off">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              ФИО *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Иванов Иван Иванович"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium mb-2">
              Дата рождения *
            </label>
            <DateInput
              id="birthDate"
              value={formData.birthDate}
              onChange={(value) => setFormData(prev => ({ ...prev, birthDate: value }))}
            />
          </div>

          <div className="space-y-3 pt-2">
            <ConsentCheckbox
              id="personalData"
              checked={formData.consents.personalData}
              onChange={(checked) => setFormData(prev => ({
                ...prev,
                consents: { ...prev.consents, personalData: checked }
              }))}
              type="personal_data"
              required
            />

            <ConsentCheckbox
              id="terms"
              checked={formData.consents.terms}
              onChange={(checked) => setFormData(prev => ({
                ...prev,
                consents: { ...prev.consents, terms: checked }
              }))}
              type="terms"
              required
            />

            <ConsentCheckbox
              id="marketing"
              checked={formData.consents.marketing}
              onChange={(checked) => setFormData(prev => ({
                ...prev,
                consents: { ...prev.consents, marketing: checked }
              }))}
              type="marketing"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !formData.name || !formData.email || !formData.birthDate || !formData.consents.personalData || !formData.consents.terms}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('code');
              setError('');
            }}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Назад
          </button>
        </form>
      )}
    </div>
  );
}
