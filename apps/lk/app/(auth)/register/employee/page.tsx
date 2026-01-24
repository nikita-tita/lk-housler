'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { getEmployeeInvite, registerEmployee, EmployeeInviteInfo } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'loading' | 'info' | 'registration' | 'expired' | 'not_found';

const STEPS = [
  { id: 'info', title: 'Приглашение' },
  { id: 'registration', title: 'Данные' },
];

interface EmployeeFormData {
  name: string;
  email: string;
  consents: {
    personalData: boolean;
    terms: boolean;
    agencyOffer: boolean;
    marketing: boolean;
  };
}

function EmployeeRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<EmployeeInviteInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    email: '',
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

  // Load invite info
  useEffect(() => {
    if (!token) {
      setStep('not_found');
      return;
    }

    const loadInvite = async () => {
      try {
        const inviteInfo = await getEmployeeInvite(token);
        setInvite(inviteInfo);
        if (inviteInfo.isExpired) {
          setStep('expired');
        } else {
          setStep('info');
        }
      } catch {
        setStep('not_found');
      }
    };

    loadInvite();
  }, [token]);

  // Continue to registration form
  const handleContinueToRegistration = () => {
    setStep('registration');
  };

  // Complete registration
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate consents
    if (!formData.consents.personalData || !formData.consents.terms || !formData.consents.agencyOffer) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    if (!token || !invite) {
      setError('Отсутствует токен приглашения');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerEmployee({
        token,
        name: formData.name,
        email: formData.email,
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

  // Get current step index for stepper
  const getCurrentStepIndex = (): number => {
    if (step === 'info') return 0;
    if (step === 'registration') return 1;
    return 0;
  };

  // Format phone for display
  const formatPhone = (phone: string): string => {
    if (phone.length === 11) {
      return `+${phone[0]} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
    }
    return `+${phone}`;
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
        На страницу входа
      </Link>

      <h1 className="text-2xl font-semibold text-center mb-2">Регистрация сотрудника</h1>
      <p className="text-[var(--color-text-light)] text-center mb-6">
        Завершите регистрацию в агентстве
      </p>

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      )}

      {/* Not Found */}
      {step === 'not_found' && (
        <div className="space-y-6 text-center">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="text-4xl mb-4">?</div>
            <h2 className="text-lg font-semibold mb-2">
              Приглашение не найдено
            </h2>
            <p className="text-[var(--color-text-light)]">
              Ссылка на приглашение недействительна или уже была использована.
            </p>
          </div>

          <p className="text-sm text-[var(--color-text-light)]">
            Если вас добавили в агентство, попросите руководителя отправить новое приглашение.
          </p>

          <Link href="/login/employee" className="btn btn-primary btn-block">
            Войти как сотрудник
          </Link>
        </div>
      )}

      {/* Expired */}
      {step === 'expired' && invite && (
        <div className="space-y-6 text-center">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
            <div className="text-4xl mb-4">!</div>
            <h2 className="text-lg font-semibold mb-2">
              Приглашение истекло
            </h2>
            <p className="text-[var(--color-text-light)] mb-4">
              Срок действия приглашения от агентства <strong>{invite.agencyName}</strong> истёк.
            </p>
            <p className="text-sm text-[var(--color-text-light)]">
              Попросите руководителя отправить новое приглашение.
            </p>
          </div>

          <Link href="/login/employee" className="btn btn-primary btn-block">
            Войти как сотрудник
          </Link>
        </div>
      )}

      {/* Info and Registration steps */}
      {(step === 'info' || step === 'registration') && invite && (
        <>
          <RegistrationStepper steps={STEPS} currentStep={getCurrentStepIndex()} />

          {/* Step 1: Invite Info */}
          {step === 'info' && (
            <div className="space-y-6">
              <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
                <h2 className="text-lg font-semibold mb-4 text-center">
                  Приглашение в агентство
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-light)]">Агентство</span>
                    <span className="font-medium">{invite.agencyName}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-light)]">Телефон</span>
                    <span className="font-medium">{formatPhone(invite.phone)}</span>
                  </div>

                  {invite.position && (
                    <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                      <span className="text-[var(--color-text-light)]">Должность</span>
                      <span className="font-medium">{invite.position}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueToRegistration}
                className="btn btn-primary btn-block"
              >
                Продолжить регистрацию
              </button>

              <p className="text-xs text-[var(--color-text-light)] text-center">
                Если это не ваше приглашение, закройте эту страницу.
              </p>
            </div>
          )}

          {/* Step 2: Registration Form */}
          {step === 'registration' && (
            <form onSubmit={handleRegistration} className="space-y-5" autoComplete="off">
              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg mb-4">
                <p className="text-sm text-[var(--color-text-light)]">
                  Регистрация в агентстве: <strong>{invite.agencyName}</strong>
                </p>
              </div>

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

              <button
                type="submit"
                disabled={isLoading || !formData.name || !formData.email || !formData.consents.personalData || !formData.consents.terms || !formData.consents.agencyOffer}
                className="btn btn-primary btn-block"
              >
                {isLoading ? 'Регистрация...' : 'Завершить регистрацию'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('info');
                  setError('');
                }}
                className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
              >
                Назад
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default function EmployeeRegisterPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      </div>
    }>
      <EmployeeRegisterContent />
    </Suspense>
  );
}
