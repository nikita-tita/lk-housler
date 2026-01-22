'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setStoredToken } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput, ConsentCheckbox, RegistrationStepper } from '@/components/auth';

type Step = 'company' | 'contact' | 'password' | 'consents';

const STEPS = [
  { id: 'company', title: 'Компания' },
  { id: 'contact', title: 'Контакт' },
  { id: 'password', title: 'Пароль' },
  { id: 'consents', title: 'Согласия' },
];

interface AgencyFormData {
  // Данные компании
  inn: string;
  name: string;
  legalAddress: string;
  phone: string;
  companyEmail: string;
  // Контактное лицо
  contactName: string;
  contactPosition: string;
  contactPhone: string;
  contactEmail: string;
  // Пароль
  password: string;
  passwordConfirm: string;
  // Согласия
  consents: {
    personalData: boolean;
    terms: boolean;
    agencyOffer: boolean;
    marketing: boolean;
  };
}

export default function AgencyRegistrationPage() {
  const router = useRouter();
  const { setUser, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('company');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [innChecking, setInnChecking] = useState(false);
  const [innExists, setInnExists] = useState<{ exists: boolean; agencyName?: string } | null>(null);

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
  if (isAuthenticated) {
    router.push('/profile');
    return null;
  }

  const getCleanPhone = (phone: string) => phone.replace(/\D/g, '');

  const checkInn = async (inn: string) => {
    if (inn.length !== 10 && inn.length !== 12) {
      setInnExists(null);
      return;
    }

    setInnChecking(true);
    try {
      const result = await api.checkInn(inn);
      if (result.success && result.data) {
        setInnExists({ exists: result.data.exists, agencyName: result.data.agencyName });
      }
    } catch {
      // Ignore errors
    } finally {
      setInnChecking(false);
    }
  };

  const handleInnChange = (value: string) => {
    const inn = value.replace(/\D/g, '').slice(0, 12);
    setFormData(prev => ({ ...prev, inn }));
    if (inn.length === 10 || inn.length === 12) {
      checkInn(inn);
    } else {
      setInnExists(null);
    }
  };

  const validateCompanyStep = (): boolean => {
    if (!formData.inn || (formData.inn.length !== 10 && formData.inn.length !== 12)) {
      setError('ИНН должен содержать 10 или 12 цифр');
      return false;
    }
    if (innExists?.exists) {
      setError('Агентство с таким ИНН уже зарегистрировано');
      return false;
    }
    if (!formData.name || formData.name.length < 2) {
      setError('Введите название компании');
      return false;
    }
    if (!formData.legalAddress || formData.legalAddress.length < 10) {
      setError('Введите юридический адрес');
      return false;
    }
    return true;
  };

  const validateContactStep = (): boolean => {
    if (!formData.contactName || formData.contactName.length < 2) {
      setError('Введите ФИО контактного лица');
      return false;
    }
    const cleanPhone = getCleanPhone(formData.contactPhone);
    if (cleanPhone.length !== 11) {
      setError('Введите номер телефона полностью');
      return false;
    }
    if (!formData.contactEmail || !formData.contactEmail.includes('@')) {
      setError('Введите корректный email');
      return false;
    }
    return true;
  };

  const validatePasswordStep = (): boolean => {
    if (!formData.password || formData.password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('Пароли не совпадают');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');

    if (step === 'company') {
      if (validateCompanyStep()) {
        setStep('contact');
      }
    } else if (step === 'contact') {
      if (validateContactStep()) {
        setStep('password');
      }
    } else if (step === 'password') {
      if (validatePasswordStep()) {
        setStep('consents');
      }
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 'contact') setStep('company');
    else if (step === 'password') setStep('contact');
    else if (step === 'consents') setStep('password');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.consents.personalData || !formData.consents.terms || !formData.consents.agencyOffer) {
      setError('Необходимо принять обязательные соглашения');
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.registerAgency({
        inn: formData.inn,
        name: formData.name,
        legalAddress: formData.legalAddress,
        phone: getCleanPhone(formData.phone) || undefined,
        companyEmail: formData.companyEmail || undefined,
        contactName: formData.contactName,
        contactPosition: formData.contactPosition || undefined,
        contactPhone: getCleanPhone(formData.contactPhone),
        contactEmail: formData.contactEmail,
        password: formData.password,
        consents: formData.consents,
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Ошибка регистрации');
        return;
      }

      setStoredToken(result.data.token);
      setUser(result.data.user);
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
      <div className="w-full max-w-lg px-8">
        <Link
          href="/login/agency"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-accent)] mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Назад к входу
        </Link>

        <h1 className="text-2xl font-semibold text-center mb-2">Регистрация агентства</h1>
        <p className="text-[var(--color-text-light)] text-center mb-6">
          Создайте аккаунт агентства недвижимости
        </p>

        <RegistrationStepper steps={STEPS} currentStep={currentStepIndex} />

        {/* Шаг 1: Данные компании */}
        {step === 'company' && (
          <div className="space-y-5">
            <div>
              <label htmlFor="inn" className="block text-sm font-medium mb-2">
                ИНН компании *
              </label>
              <input
                type="text"
                id="inn"
                value={formData.inn}
                onChange={(e) => handleInnChange(e.target.value)}
                placeholder="1234567890"
                maxLength={12}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
              <p className="text-xs text-[var(--color-text-light)] mt-1">
                10 цифр для юрлица, 12 для ИП
              </p>
              {innChecking && (
                <p className="text-xs text-[var(--color-text-light)] mt-1">Проверка...</p>
              )}
              {innExists?.exists && (
                <p className="text-xs text-[var(--color-text)] mt-1">
                  Агентство {innExists.agencyName} уже зарегистрировано
                </p>
              )}
              {innExists && !innExists.exists && (
                <p className="text-xs text-[var(--color-text-light)] mt-1">ИНН свободен</p>
              )}
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                placeholder="123456, г. Москва, ул. Примерная, д. 1, офис 100"
                rows={2}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!formData.inn || !formData.name || !formData.legalAddress || innExists?.exists}
              className="btn btn-primary btn-block"
            >
              Далее
            </button>
          </div>
        )}

        {/* Шаг 2: Контактное лицо */}
        {step === 'contact' && (
          <div className="space-y-5">
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Телефон *
              </label>
              <PhoneInput
                value={formData.contactPhone}
                onChange={(value) => setFormData(prev => ({ ...prev, contactPhone: value }))}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium mb-2">
                Email *
              </label>
              <input
                type="email"
                id="contactEmail"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="manager@agency.com"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
              <p className="text-xs text-[var(--color-text-light)] mt-1">
                Этот email будет использоваться для входа
              </p>
            </div>

            {error && (
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-secondary flex-1"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!formData.contactName || !formData.contactPhone || !formData.contactEmail}
                className="btn btn-primary flex-1"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Шаг 3: Пароль */}
        {step === 'password' && (
          <div className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Пароль *
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
              <p className="text-xs text-[var(--color-text-light)] mt-1">
                Минимум 8 символов
              </p>
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
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-secondary flex-1"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!formData.password || !formData.passwordConfirm}
                className="btn btn-primary flex-1"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Шаг 4: Согласия */}
        {step === 'consents' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-2">Проверьте данные</h3>
              <div className="text-sm text-[var(--color-text-light)] space-y-1">
                <p><strong>Компания:</strong> {formData.name}</p>
                <p><strong>ИНН:</strong> {formData.inn}</p>
                <p><strong>Контакт:</strong> {formData.contactName}</p>
                <p><strong>Email для входа:</strong> {formData.contactEmail}</p>
              </div>
            </div>

            <div className="space-y-3">
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
              <div className="text-[var(--color-text)] text-sm text-center">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-secondary flex-1"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.consents.personalData || !formData.consents.terms || !formData.consents.agencyOffer}
                className="btn btn-primary flex-1"
              >
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
