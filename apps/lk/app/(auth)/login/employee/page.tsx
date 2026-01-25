'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@housler/lib';
import { sendSMS, verifySMS } from '@housler/lib';
import { getDashboardPath } from '@housler/lib';
import { PhoneInput, SmsCodeInput, RegistrationStepper } from '@/components/auth';

type Step = 'phone' | 'code' | 'not_found' | 'wrong_role';

const STEPS = [
  { id: 'phone', title: 'Телефон' },
  { id: 'code', title: 'Код' },
];

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

export default function EmployeeLoginPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
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

  // State for pending employee invite (from backend)
  const [pendingInvite, setPendingInvite] = useState<{
    agencyName: string;
    inviteToken: string;
  } | null>(null);

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
      agency_employee: '/login/employee',
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

    setVerifiedPhone(cleanPhone);
    setExistingCode(true);
    setStep('code');
  };

  // Request new SMS code
  const handleRequestNewCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await sendSMS(verifiedPhone);
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
      const response = await verifySMS(verifiedPhone, code);

      // Check if user role is agency_employee
      if (response.user.role !== 'agency_employee') {
        // User exists but with different role
        setWrongRole({
          role: response.user.role,
          name: response.user.name || '',
        });
        setStep('wrong_role');
        return;
      }

      // User is agency_employee - login successful
      setAuth(response.access_token, response.user);
      router.push(getDashboardPath(response.user.role));
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: string; message?: string; isPendingEmployee?: boolean; agencyName?: string; inviteToken?: string } };
        message?: string
      };

      if (axiosError.message === 'NEW_USER_NEEDS_REGISTRATION') {
        // Check if there's a pending invite for this phone
        const data = axiosError.response?.data;
        if (data?.isPendingEmployee && data?.agencyName && data?.inviteToken) {
          // User has pending invite - redirect to complete registration
          setPendingInvite({
            agencyName: data.agencyName,
            inviteToken: data.inviteToken,
          });
          router.push(`/register/employee?token=${data.inviteToken}`);
        } else {
          // No invite found - show "not found" message
          setStep('not_found');
        }
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

  // Reset to phone step
  const resetToPhone = () => {
    setStep('phone');
    setPhone('');
    setVerifiedPhone('');
    setCode('');
    setError('');
    setCanResendAt(null);
    setExistingCode(false);
    setCodeSentAt(null);
    setWrongRole(null);
    setPendingInvite(null);
  };

  // Get current step index for stepper
  const getCurrentStepIndex = (): number => {
    if (step === 'phone') return 0;
    return 1;
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

      <h1 className="text-2xl font-semibold text-center mb-2">Вход для сотрудников</h1>
      <p className="text-[var(--color-text-light)] text-center mb-6">
        Сотрудники агентств недвижимости
      </p>

      {(step === 'phone' || step === 'code') && (
        <RegistrationStepper steps={STEPS} currentStep={getCurrentStepIndex()} />
      )}

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
              Номер, который указал руководитель при добавлении вас в систему
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
                на <strong>+{verifiedPhone}</strong>
              </>
            ) : (
              <>Код отправлен на <strong>+{verifiedPhone}</strong></>
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
            {isLoading ? 'Проверка...' : 'Войти'}
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

      {/* Not Found - Employee not in system */}
      {step === 'not_found' && (
        <div className="space-y-6">
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-4xl mb-4">?</div>
            <h2 className="text-lg font-semibold mb-2">
              Номер не найден
            </h2>
            <p className="text-[var(--color-text-light)] mb-4">
              Номер <strong>+{verifiedPhone}</strong> не зарегистрирован как сотрудник агентства.
            </p>
            <p className="text-sm text-[var(--color-text-light)]">
              Если вы работаете в агентстве недвижимости, попросите руководителя добавить вас в личном кабинете.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-light)] text-center">
              Или зарегистрируйтесь самостоятельно:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/realtor"
                className="btn btn-secondary text-center"
              >
                Как риелтор
              </Link>
              <Link
                href="/login/agency"
                className="btn btn-secondary text-center"
              >
                Как агентство
              </Link>
            </div>

            <Link
              href="/login/client"
              className="btn btn-secondary btn-block text-center"
            >
              Как клиент
            </Link>
          </div>

          <button
            type="button"
            onClick={resetToPhone}
            className="w-full py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
          >
            Использовать другой номер
          </button>
        </div>
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
              Номер <strong>+{verifiedPhone}</strong> зарегистрирован как <strong>{getRoleDisplayName(wrongRole.role)}</strong>.
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
