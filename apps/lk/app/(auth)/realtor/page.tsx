'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { sendSMS, resendSMS, verifySMS, registerAgent } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { PhoneInput, SmsCodeInput, ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'phone' | 'code' | 'registration' | 'wrong_role';

const STEPS = [
  { id: 'phone', title: 'Телефон' },
  { id: 'code', title: 'Код' },
  { id: 'registration', title: 'Данные' },
];

interface RealtorFormData {
  phone: string;
  name: string;
  email: string;
  city: string;
  isSelfEmployed: boolean;
  personalInn: string;
  consents: {
    personalData: boolean;
    terms: boolean;
    realtorOffer: boolean;
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

export default function RealtorLoginPage() {
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

  // State for wrong role (user registered as client/agency trying to login as agent)
  const [wrongRole, setWrongRole] = useState<{ role: string; name: string } | null>(null);

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

  const [formData, setFormData] = useState<RealtorFormData>({
    phone: '',
    name: '',
    email: '',
    city: '',
    isSelfEmployed: false,
    personalInn: '',
    consents: {
      personalData: false,
      terms: false,
      realtorOffer: false,
      marketing: false,
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/agent/dashboard');
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

  // Request new SMS code (explicit user action) - always sends new code
  const handleRequestNewCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Use resendSMS to force send new code (invalidates old one)
      const result = await resendSMS(formData.phone);
      // New code sent successfully
      setExistingCode(false);
      if (result.codeSentAt) setCodeSentAt(result.codeSentAt);
      if (result.canResendAt) setCanResendAt(new Date(result.canResendAt));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка отправки SMS');
    } finally {
      setIsLoading(false);
    }
  };

  // Get role display name in Russian
  const getRoleDisplayName = (role: string): string => {
    const roleNames: Record<string, string> = {
      agent: 'риелтор',
      agency_admin: 'администратор агентства',
      agency_employee: 'сотрудник агентства',
      client: 'клиент',
    };
    return roleNames[role] || role;
  };

  // Get login path for role
  const getLoginPathForRole = (role: string): string => {
    const paths: Record<string, string> = {
      agent: '/realtor',
      agency_admin: '/login/agency',
      agency_employee: '/login/agency',
      client: '/login/client',
    };
    return paths[role] || '/login';
  };

  // Verify SMS code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await verifySMS(formData.phone, code);

      // Check if user role matches expected role (agent)
      if (response.user.role !== 'agent') {
        // User is registered with different role - show message
        setWrongRole({
          role: response.user.role,
          name: response.user.name || '',
        });
        setStep('wrong_role');
        return;
      }

      // User is agent - login successful
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
    if (!formData.consents.personalData || !formData.consents.terms || !formData.consents.realtorOffer) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      setError('Введите корректный email адрес');
      return;
    }

    // Validate INN for self-employed
    if (formData.isSelfEmployed && formData.personalInn.length !== 12) {
      setError('ИНН должен содержать 12 цифр');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerAgent({
        phone: formData.phone,
        name: formData.name,
        email: formData.email,
        city: formData.city || undefined,
        isSelfEmployed: formData.isSelfEmployed,
        personalInn: formData.isSelfEmployed ? formData.personalInn : undefined,
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

      <h1 className="text-2xl font-semibold text-center mb-2">Вход для риелторов</h1>
      <p className="text-[var(--color-text-light)] text-center mb-6">
        Частные риелторы и самозанятые
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
            <label htmlFor="city" className="block text-sm font-medium mb-2">
              Город
            </label>
            <input
              type="text"
              id="city"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Москва"
              className="input"
            />
          </div>

          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isSelfEmployed"
                checked={formData.isSelfEmployed}
                onChange={(e) => setFormData(prev => ({ ...prev, isSelfEmployed: e.target.checked }))}
                autoComplete="off"
                className="w-5 h-5 rounded border-[var(--color-border)]"
              />
              <span className="text-sm">Я самозанятый (плательщик НПД)</span>
            </label>

            {formData.isSelfEmployed && (
              <div className="mt-4">
                <label htmlFor="inn" className="block text-sm font-medium mb-2">
                  ИНН *
                </label>
                <input
                  type="text"
                  id="inn"
                  value={formData.personalInn}
                  onChange={(e) => setFormData(prev => ({ ...prev, personalInn: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                  placeholder="123456789012"
                  maxLength={12}
                  required={formData.isSelfEmployed}
                  className="input"
                />
                <p className="text-xs text-[var(--color-text-light)] mt-1">12 цифр</p>
              </div>
            )}
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
              id="realtorOffer"
              checked={formData.consents.realtorOffer}
              onChange={(checked) => setFormData(prev => ({
                ...prev,
                consents: { ...prev.consents, realtorOffer: checked }
              }))}
              type="realtor_offer"
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
            disabled={isLoading || !formData.name || !formData.email || !formData.consents.personalData || !formData.consents.terms || !formData.consents.realtorOffer}
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

      {step === 'wrong_role' && wrongRole && (
        <div className="space-y-6 text-center">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="text-4xl mb-4">!</div>
            <h2 className="text-lg font-semibold mb-2">
              Вы уже зарегистрированы
            </h2>
            <p className="text-[var(--color-text-light)] mb-4">
              Номер <strong>+{formData.phone}</strong> зарегистрирован как <strong>{getRoleDisplayName(wrongRole.role)}</strong>.
              {wrongRole.name && (
                <><br />Имя: {wrongRole.name}</>
              )}
            </p>
            <p className="text-sm text-[var(--color-text-light)]">
              Для входа используйте соответствующую форму авторизации.
            </p>
          </div>

          <Link
            href={getLoginPathForRole(wrongRole.role)}
            className="btn btn-primary btn-block"
          >
            Войти как {getRoleDisplayName(wrongRole.role)}
          </Link>

          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
              setWrongRole(null);
              setPhone('');
              setFormData(prev => ({ ...prev, phone: '' }));
            }}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Использовать другой номер
          </button>
        </div>
      )}
    </div>
  );
}
