'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { loginAgency, registerAgency } from '@housler/lib';
import type { AgencyRegisterData } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { ConsentCheckbox } from '@/components/auth/ConsentCheckbox';
import { RegistrationStepper } from '@/components/auth/RegistrationStepper';

type Mode = 'login' | 'register' | 'wrong_role';
type RegisterStep = 'company' | 'contact' | 'password' | 'consents';

const REGISTER_STEPS = [
  { id: 'company', title: 'Компания' },
  { id: 'contact', title: 'Контакт' },
  { id: 'password', title: 'Пароль' },
  { id: 'consents', title: 'Согласия' },
];

interface AgencyFormData {
  // Company data
  inn: string;
  name: string;
  legalAddress: string;
  phone: string;
  companyEmail: string;
  // Contact person
  contactName: string;
  contactPosition: string;
  contactPhone: string;
  contactEmail: string;
  // Password
  password: string;
  passwordConfirm: string;
  // Consents
  consents: {
    personalData: boolean;
    terms: boolean;
    agencyOffer: boolean;
    marketing: boolean;
  };
}

export default function AgencyLoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('company');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State for wrong role
  const [wrongRole, setWrongRole] = useState<{ role: string; name: string; email: string } | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration form
  const [formData, setFormData] = useState<AgencyFormData>({
    inn: '',
    name: '',
    legalAddress: '',
    phone: '',
    companyEmail: '',
    contactName: '',
    contactPosition: '',
    contactPhone: '',
    contactEmail: '',
    password: '',
    passwordConfirm: '',
    consents: {
      personalData: false,
      terms: false,
      agencyOffer: false,
      marketing: false,
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/agency/dashboard');
    }
  }, [isAuthenticated, router]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await loginAgency(loginEmail.toLowerCase().trim(), loginPassword);

      // Check if user role matches expected roles (agency_admin or agency_employee)
      if (response.user.role !== 'agency_admin' && response.user.role !== 'agency_employee') {
        // User is registered with different role - show message
        setWrongRole({
          role: response.user.role,
          name: response.user.name || '',
          email: loginEmail,
        });
        setMode('wrong_role');
        return;
      }

      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation helpers
  const validateINN = (inn: string): boolean => {
    const cleanINN = inn.replace(/\D/g, '');
    return cleanINN.length === 10 || cleanINN.length === 12;
  };

  const validateStep = (step: RegisterStep): boolean => {
    switch (step) {
      case 'company':
        return (
          validateINN(formData.inn) &&
          formData.name.length >= 2 &&
          formData.legalAddress.length >= 10
        );
      case 'contact':
        return (
          formData.contactName.length >= 2 &&
          formData.contactPhone.replace(/\D/g, '').length === 11 &&
          formData.contactEmail.includes('@')
        );
      case 'password':
        return (
          formData.password.length >= 8 &&
          formData.password === formData.passwordConfirm
        );
      case 'consents':
        return (
          formData.consents.personalData &&
          formData.consents.terms &&
          formData.consents.agencyOffer
        );
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    setError('');
    const steps: RegisterStep[] = ['company', 'contact', 'password', 'consents'];
    const currentIndex = steps.indexOf(registerStep);
    if (currentIndex < steps.length - 1) {
      setRegisterStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevStep = () => {
    setError('');
    const steps: RegisterStep[] = ['company', 'contact', 'password', 'consents'];
    const currentIndex = steps.indexOf(registerStep);
    if (currentIndex > 0) {
      setRegisterStep(steps[currentIndex - 1]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateStep('consents')) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    setIsLoading(true);

    try {
      const registerData: AgencyRegisterData = {
        inn: formData.inn.replace(/\D/g, ''),
        name: formData.name,
        legalAddress: formData.legalAddress,
        phone: formData.phone.replace(/\D/g, '') || undefined,
        companyEmail: formData.companyEmail || undefined,
        contactName: formData.contactName,
        contactPosition: formData.contactPosition || undefined,
        contactPhone: formData.contactPhone.replace(/\D/g, ''),
        contactEmail: formData.contactEmail.toLowerCase().trim(),
        password: formData.password,
        consents: formData.consents,
      };

      const response = await registerAgency(registerData);
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } }; message?: string };
      setError(axiosError.response?.data?.error || axiosError.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = REGISTER_STEPS.findIndex(s => s.id === registerStep);

  const resetToLogin = () => {
    setMode('login');
    setRegisterStep('company');
    setError('');
    setFormData({
      inn: '',
      name: '',
      legalAddress: '',
      phone: '',
      companyEmail: '',
      contactName: '',
      contactPosition: '',
      contactPhone: '',
      contactEmail: '',
      password: '',
      passwordConfirm: '',
      consents: {
        personalData: false,
        terms: false,
        agencyOffer: false,
        marketing: false,
      },
    });
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
        {mode === 'login' ? 'Вход для агентств' : 'Регистрация агентства'}
      </h1>
      <p className="text-[var(--color-text-light)] text-center mb-8">
        {mode === 'login' ? 'Сотрудники агентств недвижимости' : 'Создание аккаунта агентства'}
      </p>

      {/* Login/Register toggle */}
      <div className="flex gap-2 mb-8 bg-[var(--color-bg-secondary)] rounded-lg p-1">
        <button
          onClick={resetToLogin}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-white shadow-sm text-[var(--color-text)]'
              : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
          }`}
        >
          Вход
        </button>
        <button
          onClick={() => { setMode('register'); setError(''); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-white shadow-sm text-[var(--color-text)]'
              : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
          }`}
        >
          Регистрация
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="email@agency.com"
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="********"
              required
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
            disabled={isLoading || !loginEmail || !loginPassword}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>

          <p className="text-xs text-[var(--color-text-light)] text-center">
            Нет аккаунта?{' '}
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className="text-[var(--color-accent)] hover:underline"
            >
              Зарегистрируйте агентство
            </button>
          </p>
        </form>
      ) : (
        <div className="space-y-6">
          <RegistrationStepper steps={REGISTER_STEPS} currentStep={currentStepIndex} />

          {/* Step 1: Company */}
          {registerStep === 'company' && (
            <form onSubmit={(e) => { e.preventDefault(); if (validateStep('company')) handleNextStep(); }} className="space-y-5">
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
                  value={formData.phone}
                  onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
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
                disabled={!validateStep('company')}
                className="btn btn-primary btn-block"
              >
                Далее
              </button>

              <button
                type="button"
                onClick={resetToLogin}
                className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
              >
                Уже есть аккаунт? Войти
              </button>
            </form>
          )}

          {/* Step 2: Contact */}
          {registerStep === 'contact' && (
            <form onSubmit={(e) => { e.preventDefault(); if (validateStep('contact')) handleNextStep(); }} className="space-y-5">
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
                <label htmlFor="contactPhone" className="block text-sm font-medium mb-2">
                  Телефон контактного лица *
                </label>
                <PhoneInput
                  value={formData.contactPhone}
                  onChange={(value) => setFormData(prev => ({ ...prev, contactPhone: value }))}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium mb-2">
                  Email контактного лица * <span className="font-normal text-[var(--color-text-light)]">(для входа)</span>
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
                  disabled={!validateStep('contact')}
                  className="btn btn-primary flex-1"
                >
                  Далее
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Password */}
          {registerStep === 'password' && (
            <form onSubmit={(e) => { e.preventDefault(); if (validateStep('password')) handleNextStep(); }} className="space-y-5">
              <div>
                <label htmlFor="regPassword" className="block text-sm font-medium mb-2">
                  Пароль *
                </label>
                <input
                  type="password"
                  id="regPassword"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="********"
                  required
                  className="input"
                />
                <p className="text-xs text-[var(--color-text-light)] mt-1">Минимум 8 символов</p>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium mb-2">
                  Подтверждение пароля *
                </label>
                <input
                  type="password"
                  id="passwordConfirm"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData(prev => ({ ...prev, passwordConfirm: e.target.value }))}
                  placeholder="********"
                  required
                  className="input"
                />
                {formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
                  <p className="text-xs text-[var(--color-text)] mt-1">Пароли не совпадают</p>
                )}
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
                  disabled={!validateStep('password')}
                  className="btn btn-primary flex-1"
                >
                  Далее
                </button>
              </div>
            </form>
          )}

          {/* Step 4: Consents */}
          {registerStep === 'consents' && (
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
                  disabled={isLoading || !validateStep('consents')}
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
        </div>
      )}

      {mode === 'wrong_role' && wrongRole && (
        <div className="space-y-6 text-center">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="text-4xl mb-4">!</div>
            <h2 className="text-lg font-semibold mb-2">
              Вы уже зарегистрированы
            </h2>
            <p className="text-[var(--color-text-light)] mb-4">
              Email <strong>{wrongRole.email}</strong> зарегистрирован как <strong>{getRoleDisplayName(wrongRole.role)}</strong>.
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
              setMode('login');
              setLoginEmail('');
              setLoginPassword('');
              setError('');
              setWrongRole(null);
            }}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Использовать другой email
          </button>
        </div>
      )}
    </div>
  );
}
