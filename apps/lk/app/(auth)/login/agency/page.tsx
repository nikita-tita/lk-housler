'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { sendSMS, verifySMS, registerAgency } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { PhoneInput, SmsCodeInput, ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'phone' | 'code' | 'company' | 'contact' | 'consents' | 'wrong_role';

const STEPS = [
  { id: 'phone', title: 'Телефон' },
  { id: 'code', title: 'Код' },
  { id: 'company', title: 'Компания' },
  { id: 'contact', title: 'Контакт' },
  { id: 'consents', title: 'Согласия' },
];

interface AgencyFormData {
  // Verified phone (admin's phone)
  verifiedPhone: string;
  // Company data
  inn: string;
  name: string;
  legalAddress: string;
  companyPhone: string;
  companyEmail: string;
  // Contact person
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  // Consents
  consents: {
    personalData: boolean;
    terms: boolean;
    agencyOffer: boolean;
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

export default function AgencyLoginPage() {
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

  // State for resend cooldown
  const [canResendAt, setCanResendAt] = useState<Date | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // State for wrong role
  const [wrongRole, setWrongRole] = useState<{ role: string; name: string } | null>(null);

  // Registration form data
  const [formData, setFormData] = useState<AgencyFormData>({
    verifiedPhone: '',
    inn: '',
    name: '',
    legalAddress: '',
    companyPhone: '',
    companyEmail: '',
    contactName: '',
    contactPosition: '',
    contactEmail: '',
    consents: {
      personalData: false,
      terms: false,
      agencyOffer: false,
      marketing: false,
    },
  });

  // Countdown timer
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

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/agency/dashboard');
    }
  }, [isAuthenticated, router]);

  const getCleanPhone = () => phone.replace(/\D/g, '');

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

  // Continue to code entry
  const handleContinueToCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length !== 11) {
      setError('Введите номер телефона полностью');
      return;
    }

    setFormData(prev => ({ ...prev, verifiedPhone: cleanPhone }));
    setExistingCode(true);
    setStep('code');
  };

  // Request new SMS code
  const handleRequestNewCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await sendSMS(formData.verifiedPhone);
      if (result.existingCode) {
        setExistingCode(true);
        if (result.codeSentAt) setCodeSentAt(result.codeSentAt);
        if (result.canResendAt) setCanResendAt(new Date(result.canResendAt));
      } else {
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
      const response = await verifySMS(formData.verifiedPhone, code);

      // Check if user role matches expected roles (agency_admin or agency_employee)
      if (response.user.role !== 'agency_admin' && response.user.role !== 'agency_employee') {
        setWrongRole({
          role: response.user.role,
          name: response.user.name || '',
        });
        setStep('wrong_role');
        return;
      }

      // User is agency member - login successful
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      if (axiosError.message === 'NEW_USER_NEEDS_REGISTRATION') {
        // New user - show registration form (company step)
        setStep('company');
      } else {
        const errorMessage = axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message;
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

  // Validation helpers
  const validateINN = (inn: string): boolean => {
    const cleanINN = inn.replace(/\D/g, '');
    return cleanINN.length === 10 || cleanINN.length === 12;
  };

  const validateCompanyStep = (): boolean => {
    return (
      validateINN(formData.inn) &&
      formData.name.length >= 2 &&
      formData.legalAddress.length >= 10
    );
  };

  const validateContactStep = (): boolean => {
    return (
      formData.contactName.length >= 2 &&
      formData.contactEmail.includes('@')
    );
  };

  const validateConsentsStep = (): boolean => {
    return (
      formData.consents.personalData &&
      formData.consents.terms &&
      formData.consents.agencyOffer
    );
  };

  // Navigation between registration steps
  const handleNextStep = () => {
    setError('');
    if (step === 'company' && validateCompanyStep()) {
      setStep('contact');
    } else if (step === 'contact' && validateContactStep()) {
      setStep('consents');
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (step === 'contact') {
      setStep('company');
    } else if (step === 'consents') {
      setStep('contact');
    }
  };

  // Complete registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateConsentsStep()) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerAgency({
        inn: formData.inn.replace(/\D/g, ''),
        name: formData.name,
        legalAddress: formData.legalAddress,
        phone: formData.companyPhone.replace(/\D/g, '') || undefined,
        companyEmail: formData.companyEmail || undefined,
        contactName: formData.contactName,
        contactPosition: formData.contactPosition || undefined,
        contactPhone: formData.verifiedPhone, // Use verified phone
        contactEmail: formData.contactEmail.toLowerCase().trim(),
        consents: formData.consents,
      });
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to phone step
  const resetToPhone = () => {
    setStep('phone');
    setPhone('');
    setCode('');
    setError('');
    setCanResendAt(null);
    setExistingCode(false);
    setCodeSentAt(null);
    setWrongRole(null);
    setFormData({
      verifiedPhone: '',
      inn: '',
      name: '',
      legalAddress: '',
      companyPhone: '',
      companyEmail: '',
      contactName: '',
      contactPosition: '',
      contactEmail: '',
      consents: {
        personalData: false,
        terms: false,
        agencyOffer: false,
        marketing: false,
      },
    });
  };

  // Get current step index for stepper
  const getCurrentStepIndex = (): number => {
    const stepOrder: Step[] = ['phone', 'code', 'company', 'contact', 'consents'];
    return stepOrder.indexOf(step);
  };

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

      <h1 className="text-2xl font-semibold text-center mb-2">
        {step === 'phone' || step === 'code' ? 'Вход для агентств' : 'Регистрация агентства'}
      </h1>
      <p className="text-[var(--color-text-light)] text-center mb-6">
        {step === 'phone' || step === 'code' ? 'Сотрудники агентств недвижимости' : 'Создание аккаунта агентства'}
      </p>

      <RegistrationStepper steps={STEPS} currentStep={getCurrentStepIndex()} />

      {/* Step 1: Phone */}
      {step === 'phone' && (
        <form onSubmit={handleContinueToCode} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Номер телефона</label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder="+7 (999) 123-45-67"
            />
            <p className="text-xs text-[var(--color-text-light)] mt-1">
              Телефон администратора агентства
            </p>
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

      {/* Step 2: SMS Code */}
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
                на <strong>+{formData.verifiedPhone}</strong>
              </>
            ) : (
              <>Код отправлен на <strong>+{formData.verifiedPhone}</strong></>
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
            onClick={resetToPhone}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Изменить номер
          </button>
        </form>
      )}

      {/* Step 3: Company */}
      {step === 'company' && (
        <form onSubmit={(e) => { e.preventDefault(); if (validateCompanyStep()) handleNextStep(); }} className="space-y-5">
          <div>
            <label htmlFor="inn" className="block text-sm font-medium mb-2">
              ИНН компании *
            </label>
            <input
              type="text"
              id="inn"
              value={formData.inn}
              onChange={(e) => setFormData(prev => ({ ...prev, inn: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
              placeholder="1234567890"
              required
              className="input"
            />
            <p className="text-xs text-[var(--color-text-light)] mt-1">10 или 12 цифр</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Название компании *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder='ООО "Агентство недвижимости"'
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="legalAddress" className="block text-sm font-medium mb-2">
              Юридический адрес *
            </label>
            <textarea
              id="legalAddress"
              value={formData.legalAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, legalAddress: e.target.value }))}
              placeholder="г. Москва, ул. Примерная, д. 1, офис 100"
              required
              rows={2}
              className="input resize-none"
            />
          </div>

          <div>
            <label htmlFor="companyPhone" className="block text-sm font-medium mb-2">
              Телефон компании
            </label>
            <PhoneInput
              value={formData.companyPhone}
              onChange={(value) => setFormData(prev => ({ ...prev, companyPhone: value }))}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div>
            <label htmlFor="companyEmail" className="block text-sm font-medium mb-2">
              Email компании
            </label>
            <input
              type="email"
              id="companyEmail"
              value={formData.companyEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, companyEmail: e.target.value }))}
              placeholder="info@agency.com"
              className="input"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!validateCompanyStep()}
            className="btn btn-primary btn-block"
          >
            Далее
          </button>

          <button
            type="button"
            onClick={() => setStep('code')}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Назад
          </button>
        </form>
      )}

      {/* Step 4: Contact */}
      {step === 'contact' && (
        <form onSubmit={(e) => { e.preventDefault(); if (validateContactStep()) handleNextStep(); }} className="space-y-5">
          <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm text-center mb-4">
            Телефон: <strong>+{formData.verifiedPhone}</strong> (подтверждён)
          </div>

          <div>
            <label htmlFor="contactName" className="block text-sm font-medium mb-2">
              ФИО контактного лица *
            </label>
            <input
              type="text"
              id="contactName"
              value={formData.contactName}
              onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
              placeholder="Иванов Иван Иванович"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="contactPosition" className="block text-sm font-medium mb-2">
              Должность
            </label>
            <input
              type="text"
              id="contactPosition"
              value={formData.contactPosition}
              onChange={(e) => setFormData(prev => ({ ...prev, contactPosition: e.target.value }))}
              placeholder="Директор"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium mb-2">
              Email контактного лица *
            </label>
            <input
              type="email"
              id="contactEmail"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="ivanov@agency.com"
              required
              className="input"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn btn-secondary flex-1"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={!validateContactStep()}
              className="btn btn-primary flex-1"
            >
              Далее
            </button>
          </div>
        </form>
      )}

      {/* Step 5: Consents */}
      {step === 'consents' && (
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-4">
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
              id="agencyOffer"
              checked={formData.consents.agencyOffer}
              onChange={(checked) => setFormData(prev => ({
                ...prev,
                consents: { ...prev.consents, agencyOffer: checked }
              }))}
              type="agency_offer"
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn btn-secondary flex-1"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={isLoading || !validateConsentsStep()}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрировать'}
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            После регистрации ваша заявка будет рассмотрена модератором
          </p>
        </form>
      )}

      {/* Wrong Role */}
      {step === 'wrong_role' && wrongRole && (
        <div className="space-y-6 text-center">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="text-4xl mb-4">!</div>
            <h2 className="text-lg font-semibold mb-2">
              Вы уже зарегистрированы
            </h2>
            <p className="text-[var(--color-text-light)] mb-4">
              Номер <strong>+{formData.verifiedPhone}</strong> зарегистрирован как <strong>{getRoleDisplayName(wrongRole.role)}</strong>.
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
            onClick={resetToPhone}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Использовать другой номер
          </button>
        </div>
      )}
    </div>
  );
}
