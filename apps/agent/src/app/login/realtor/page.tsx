'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput, SmsCodeInput, ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'phone' | 'code' | 'registration';

// Тестовые аккаунты: телефоны 79999* принимают коды 111111-333333
const TEST_PHONE_PREFIX = '79999';
const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN === 'true';

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

export default function RealtorLoginPage() {
  const router = useRouter();
  const { isAuthenticated, resendSmsCode, verifySmsCode, registerRealtor } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Состояние для существующего кода
  const [existingCode, setExistingCode] = useState(false);
  const [canResendAt, setCanResendAt] = useState<Date | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown таймер для повторной отправки
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
  if (isAuthenticated) {
    router.push('/profile');
    return null;
  }

  // Получаем чистый номер (только цифры)
  const getCleanPhone = () => {
    return phone.replace(/\D/g, '');
  };

  // Переход к вводу кода БЕЗ отправки SMS
  const handleContinueToCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length !== 11) {
      setError('Введите номер телефона полностью');
      return;
    }

    setFormData(prev => ({ ...prev, phone: cleanPhone }));
    setExistingCode(true); // Предполагаем что код уже был отправлен ранее
    setStep('code');
  };

  // Запрос нового SMS-кода (явное действие пользователя)
  const handleRequestNewCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      await resendSmsCode(formData.phone);
      setExistingCode(false); // Теперь код точно новый
      setCanResendAt(new Date(Date.now() + 60 * 1000)); // Cooldown 1 минута
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await verifySmsCode(formData.phone, code);

      if (result.isNewUser) {
        // Новый пользователь — показываем форму регистрации
        setStep('registration');
      } else {
        // Существующий пользователь — AuthContext уже залогинил, редиректим
        router.push('/profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация согласий
    if (!formData.consents.personalData || !formData.consents.terms || !formData.consents.realtorOffer) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    // Валидация ИНН для самозанятых
    if (formData.isSelfEmployed && formData.personalInn.length !== 12) {
      setError('ИНН должен содержать 12 цифр');
      return;
    }

    setIsLoading(true);

    try {
      await registerRealtor({
        phone: formData.phone,
        name: formData.name,
        email: formData.email,
        city: formData.city || undefined,
        isSelfEmployed: formData.isSelfEmployed,
        personalInn: formData.isSelfEmployed ? formData.personalInn : undefined,
        consents: formData.consents,
      });
      // AuthContext уже залогинил пользователя, редиректим
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="w-full max-w-md px-8">
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
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={getCleanPhone().length !== 11}
              className="btn btn-primary btn-block"
            >
              Продолжить
            </button>

            {SHOW_DEV_LOGIN && getCleanPhone().startsWith(TEST_PHONE_PREFIX) && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, phone: getCleanPhone() }));
                  setStep('code');
                }}
                className="w-full py-2 text-sm text-[var(--color-accent)] hover:underline"
              >
                У меня есть постоянный код
              </button>
            )}

            <p className="text-xs text-[var(--color-text-light)] text-center">
              Продолжая, вы соглашаетесь с{' '}
              <Link href="/doc/clients/soglasiya/terms" className="text-[var(--color-accent)] hover:underline">
                Пользовательским соглашением
              </Link>
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="text-center text-sm text-[var(--color-text-light)] mb-4">
              {existingCode ? (
                <>Введите код, который вы получали ранее на <strong>+{formData.phone}</strong></>
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
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="btn btn-primary btn-block"
            >
              {isLoading ? 'Проверка...' : 'Продолжить'}
            </button>

            {/* Кнопка запроса кода по SMS */}
            <div className="text-center">
              {resendCountdown > 0 ? (
                <span className="text-sm text-[var(--color-text-light)]">
                  Запросить код через {resendCountdown} сек.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestNewCode}
                  disabled={isLoading}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  {existingCode ? 'Запросить код по SMS' : 'Отправить новый код'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
                setExistingCode(true);
                setCanResendAt(null);
              }}
              className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
            >
              Изменить номер
            </button>
          </form>
        )}

        {step === 'registration' && (
          <form onSubmit={handleRegistration} className="space-y-5">
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div className="border border-[var(--color-border)] rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isSelfEmployed}
                  onChange={(e) => setFormData(prev => ({ ...prev, isSelfEmployed: e.target.checked }))}
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
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
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
      </div>
    </div>
  );
}
