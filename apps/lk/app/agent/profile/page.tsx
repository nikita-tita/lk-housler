'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@housler/ui';
import { Input } from '@housler/ui';
import { Select } from '@housler/ui';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';
import {
  getPaymentProfiles,
  startOnboarding,
  getOnboardingStatus,
  autofillBankByBIK,
  autofillCompanyByINN,
  getSettingsProfile,
  updateSettingsProfile,
  uploadProfileAvatar,
  deleteProfileAvatar,
  PaymentProfile,
  OnboardingStatusResponse,
  LegalType,
  LEGAL_TYPE_LABELS,
  ONBOARDING_STATUS_LABELS,
  KYC_STATUS_LABELS,
} from '@housler/lib';
import { ExtendedProfile, UpdateProfileDto, PreferredContact } from '@/types/user';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Агент',
  agency: 'Агентство',
  client: 'Клиент',
  admin: 'Администратор',
};

const LEGAL_TYPE_OPTIONS = [
  { value: 'se', label: 'Самозанятый (НПД)' },
  { value: 'ip', label: 'Индивидуальный предприниматель' },
  { value: 'ooo', label: 'ООО' },
];

const CONTACT_OPTIONS: { value: PreferredContact; label: string }[] = [
  { value: 'phone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

const SPECIALIZATION_OPTIONS = [
  'Новостройки',
  'Вторичное жильё',
  'Коммерческая недвижимость',
  'Загородная недвижимость',
  'Элитная недвижимость',
];

function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
  }
  return phone;
}

interface OnboardingFormData {
  legal_type: LegalType;
  legal_name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  bank_account: string;
  bank_bik: string;
  bank_name: string;
  bank_corr_account: string;
  phone: string;
  email: string;
}

export default function ProfilePage() {
  const { user, isLoading: authLoading, updateUser } = useAuth();

  // Extended profile state
  const [extendedProfile, setExtendedProfile] = useState<ExtendedProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Personal data form state
  const [name, setName] = useState('');
  const [preferredContact, setPreferredContact] = useState<PreferredContact>('phone');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [city, setCity] = useState('');
  const [specialization, setSpecialization] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [about, setAbout] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Payment profile state
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<OnboardingFormData>({
    legal_type: 'se',
    legal_name: '',
    inn: '',
    kpp: '',
    ogrn: '',
    bank_account: '',
    bank_bik: '',
    bank_name: '',
    bank_corr_account: '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  const isAgent = user?.role === 'agent' || user?.role === 'agency_admin' || user?.role === 'operator';

  // Load extended profile
  const loadExtendedProfile = useCallback(async () => {
    try {
      const res = await getSettingsProfile();
      if (res.success && res.data) {
        setExtendedProfile(res.data);
        setAvatarUrl(res.data.avatar_url || null);
        // Populate form
        setName(res.data.name || '');
        setPreferredContact(res.data.preferred_contact || 'phone');
        setTelegramUsername(res.data.telegram_username || '');
        setWhatsappPhone(res.data.whatsapp_phone || '');
        setCity(res.data.city || '');
        setSpecialization(res.data.specialization || []);
        setExperienceYears(res.data.experience_years ?? '');
        setAbout(res.data.about || '');
      }
    } catch {
      console.error('Error loading extended profile');
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadExtendedProfile();
      loadProfiles();
      setFormData((prev) => ({
        ...prev,
        phone: user.phone || '',
        email: user.email || '',
      }));
    }
  }, [user, loadExtendedProfile]);

  async function loadProfiles() {
    try {
      setLoading(true);
      const response = await getPaymentProfiles();
      setProfiles(response.items);

      // If there's an active profile, get its status
      if (response.items.length > 0) {
        try {
          const status = await getOnboardingStatus(response.items[0].id);
          setOnboardingStatus(status);
        } catch {
          // Ignore status errors
        }
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  }

  // Avatar handlers
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Размер файла не должен превышать 5 МБ');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setProfileError('Разрешены только изображения');
      return;
    }

    setIsUploadingAvatar(true);
    setProfileError('');

    try {
      const res = await uploadProfileAvatar(file);
      if (res.success && res.data) {
        setAvatarUrl(res.data.avatar_url);
        setProfileSuccess('Аватар обновлён');
      } else {
        setProfileError(res.error || 'Ошибка загрузки аватара');
      }
    } catch {
      setProfileError('Ошибка загрузки аватара');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarDelete = async () => {
    if (!avatarUrl) return;

    setIsUploadingAvatar(true);
    setProfileError('');

    try {
      const res = await deleteProfileAvatar();
      if (res.success) {
        setAvatarUrl(null);
        setProfileSuccess('Аватар удалён');
      } else {
        setProfileError(res.error || 'Ошибка удаления аватара');
      }
    } catch {
      setProfileError('Ошибка удаления аватара');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Profile update handler
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setIsSavingProfile(true);

    const data: UpdateProfileDto = {
      name: name || undefined,
      preferred_contact: preferredContact,
      telegram_username: telegramUsername || null,
      whatsapp_phone: whatsappPhone || null,
    };

    // Agent-only fields
    if (isAgent) {
      data.city = city || null;
      data.specialization = specialization.length > 0 ? specialization : null;
      data.experience_years = experienceYears !== '' ? Number(experienceYears) : null;
      data.about = about || null;
    }

    try {
      const res = await updateSettingsProfile(data);
      if (res.success && res.data) {
        setExtendedProfile(res.data);
        setProfileSuccess('Профиль обновлён');
        // Update user in auth context
        if (updateUser && user) {
          updateUser({
            ...user,
            name: res.data.name,
          });
        }
      } else {
        setProfileError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setProfileError('Ошибка сохранения');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleSpecialization = (spec: string) => {
    setSpecialization(prev =>
      prev.includes(spec)
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  };

  const handleSubmitOnboarding = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await startOnboarding({
        legal_type: formData.legal_type,
        legal_name: formData.legal_name,
        inn: formData.inn.replace(/\s/g, ''),
        kpp: formData.kpp || undefined,
        ogrn: formData.ogrn || undefined,
        bank_account: formData.bank_account.replace(/\s/g, ''),
        bank_bik: formData.bank_bik,
        bank_name: formData.bank_name,
        bank_corr_account: formData.bank_corr_account.replace(/\s/g, ''),
        phone: formData.phone.replace(/\D/g, ''),
        email: formData.email || undefined,
      });

      setSuccess('Данные успешно сохранены');
      setShowOnboardingForm(false);
      await loadProfiles();

      // If there's an onboarding URL, redirect
      if (response.onboarding_url) {
        window.open(response.onboarding_url, '_blank');
      }
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(errorMessage || 'Ошибка сохранения данных');
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.legal_name || formData.legal_name.length < 2) return false;
    if (!formData.inn || (formData.inn.length !== 10 && formData.inn.length !== 12)) return false;
    if (formData.legal_type === 'ooo' && (!formData.kpp || formData.kpp.length !== 9)) return false;
    if (!formData.bank_account || formData.bank_account.replace(/\s/g, '').length !== 20) return false;
    if (!formData.bank_bik || formData.bank_bik.length !== 9) return false;
    if (!formData.bank_name) return false;
    if (!formData.bank_corr_account || formData.bank_corr_account.replace(/\s/g, '').length !== 20) return false;
    if (!formData.phone || formData.phone.replace(/\D/g, '').length !== 11) return false;
    return true;
  };

  // Autofill bank details by BIK
  const handleBIKChange = async (bik: string) => {
    const cleanBIK = bik.replace(/\D/g, '').slice(0, 9);
    setFormData({ ...formData, bank_bik: cleanBIK });

    if (cleanBIK.length === 9) {
      const bankData = await autofillBankByBIK(cleanBIK);
      if (bankData && bankData.bank_name) {
        setFormData((prev) => ({
          ...prev,
          bank_name: bankData.bank_name || prev.bank_name,
          bank_corr_account: bankData.bank_corr_account || prev.bank_corr_account,
        }));
      }
    }
  };

  // Autofill company details by INN (for IP/OOO)
  const handleINNChange = async (inn: string) => {
    const cleanINN = inn.replace(/\D/g, '').slice(0, 12);
    setFormData({ ...formData, inn: cleanINN });

    // Only autofill for IP/OOO with complete INN (10 digits for legal, 12 for individual)
    if (
      (formData.legal_type === 'ooo' && cleanINN.length === 10) ||
      (formData.legal_type === 'ip' && cleanINN.length === 12)
    ) {
      const companyData = await autofillCompanyByINN(cleanINN);
      if (companyData && companyData.company_name) {
        setFormData((prev) => ({
          ...prev,
          legal_name: companyData.company_name || prev.legal_name,
          kpp: companyData.company_kpp || prev.kpp,
          ogrn: companyData.company_ogrn || prev.ogrn,
        }));
      }
    }
  };

  const activeProfile = profiles.length > 0 ? profiles[0] : null;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Профиль</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Управление вашим профилем</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Фото профиля</CardTitle>
            <CardDescription>Ваш аватар для идентификации</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Avatar Preview */}
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Аватар"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-3">
                  <label className="btn btn-secondary cursor-pointer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                    {isUploadingAvatar ? 'Загрузка...' : 'Загрузить фото'}
                  </label>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarDelete}
                      disabled={isUploadingAvatar}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors"
                    >
                      Удалить
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG или GIF. Максимум 5 МБ.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card>
          <CardHeader>
            <CardTitle>Личные данные</CardTitle>
            <CardDescription>Ваши контактные данные и способы связи</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-500">
                  Email
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                  {extendedProfile?.email || user?.email}
                </div>
              </div>

              {/* Phone (read-only) */}
              {(extendedProfile?.phone || user?.phone) && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-500">
                    Телефон
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                    {formatPhone(extendedProfile?.phone || user?.phone)}
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Имя
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="input"
                />
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-500">
                  Роль
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                  {ROLE_LABELS[user?.role || ''] || user?.role}
                </div>
              </div>

              {/* Preferred Contact */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Предпочтительный способ связи
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTACT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreferredContact(opt.value)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${preferredContact === opt.value
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 hover:border-gray-400'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Telegram */}
              <div>
                <label htmlFor="telegram" className="block text-sm font-medium mb-2">
                  Telegram username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    type="text"
                    id="telegram"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value.replace('@', ''))}
                    placeholder="username"
                    className="input pl-8"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label htmlFor="whatsapp" className="block text-sm font-medium mb-2">
                  WhatsApp телефон
                </label>
                <input
                  type="text"
                  id="whatsapp"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="79991234567"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Если отличается от основного телефона
                </p>
              </div>

              {/* Agent-only fields */}
              {isAgent && (
                <>
                  <hr className="my-6" />
                  <h3 className="text-md font-semibold mb-4">Профессиональные данные</h3>

                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-2">
                      Город
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Москва"
                      className="input"
                    />
                  </div>

                  {/* Specialization */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Специализация
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALIZATION_OPTIONS.map((spec) => (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleSpecialization(spec)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${specialization.includes(spec)
                              ? 'border-black bg-black text-white'
                              : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          {spec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <label htmlFor="experience" className="block text-sm font-medium mb-2">
                      Опыт работы (лет)
                    </label>
                    <input
                      type="number"
                      id="experience"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value ? parseInt(e.target.value) : '')}
                      min={0}
                      max={70}
                      placeholder="5"
                      className="input"
                    />
                  </div>

                  {/* About */}
                  <div>
                    <label htmlFor="about" className="block text-sm font-medium mb-2">
                      О себе
                    </label>
                    <textarea
                      id="about"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Расскажите о своём опыте и подходе к работе..."
                      className="input resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {about.length}/2000
                    </p>
                  </div>
                </>
              )}

              {/* Messages */}
              {profileError && (
                <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-900">{profileError}</p>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-900">{profileSuccess}</p>
                </div>
              )}

              {/* Submit */}
              <Button type="submit" loading={isSavingProfile}>
                Сохранить изменения
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Payment profile / Onboarding */}
        <Card>
          <CardHeader>
            <CardTitle>Реквизиты для выплат</CardTitle>
            <CardDescription>
              {activeProfile
                ? 'Ваши юридические данные и банковские реквизиты'
                : 'Добавьте реквизиты для получения выплат'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-900">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-900">{success}</p>
              </div>
            )}

            {activeProfile && !showOnboardingForm ? (
              <div className="space-y-4">
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Тип</dt>
                    <dd className="text-sm text-gray-900">
                      {LEGAL_TYPE_LABELS[activeProfile.legal_type as LegalType] || activeProfile.legal_type}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Наименование</dt>
                    <dd className="text-sm text-gray-900">{activeProfile.legal_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">ИНН</dt>
                    <dd className="text-sm text-gray-900 font-mono">{activeProfile.inn_masked}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Банк</dt>
                    <dd className="text-sm text-gray-900">{activeProfile.bank_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">БИК</dt>
                    <dd className="text-sm text-gray-900 font-mono">{activeProfile.bank_bik}</dd>
                  </div>
                </dl>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Статус онбординга</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {ONBOARDING_STATUS_LABELS[activeProfile.bank_onboarding_status] ||
                          activeProfile.bank_onboarding_status}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${activeProfile.bank_onboarding_status === 'approved'
                          ? 'bg-black text-white'
                          : activeProfile.bank_onboarding_status === 'rejected'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                      {activeProfile.bank_onboarding_status === 'approved'
                        ? 'Активен'
                        : activeProfile.bank_onboarding_status === 'pending_review'
                          ? 'На проверке'
                          : activeProfile.bank_onboarding_status === 'rejected'
                            ? 'Отклонено'
                            : 'Ожидает'}
                    </span>
                  </div>

                  {onboardingStatus?.rejection_reason && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        Причина отклонения: {onboardingStatus.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : showOnboardingForm ? (
              <div className="space-y-4">
                <Select
                  label="Тип регистрации"
                  options={LEGAL_TYPE_OPTIONS}
                  value={formData.legal_type}
                  onChange={(e) =>
                    setFormData({ ...formData, legal_type: e.target.value as LegalType })
                  }
                />

                <Input
                  label={formData.legal_type === 'se' ? 'ФИО' : 'Наименование'}
                  placeholder={
                    formData.legal_type === 'se'
                      ? 'Иванов Иван Иванович'
                      : formData.legal_type === 'ip'
                        ? 'ИП Иванов И.И.'
                        : 'ООО "Компания"'
                  }
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                />

                <Input
                  label="ИНН"
                  placeholder={formData.legal_type === 'ooo' ? '1234567890' : '123456789012'}
                  value={formData.inn}
                  onChange={(e) => handleINNChange(e.target.value)}
                  helperText={
                    formData.legal_type === 'ooo'
                      ? '10 цифр для юрлица (данные заполнятся автоматически)'
                      : formData.legal_type === 'ip'
                        ? '12 цифр (данные заполнятся автоматически)'
                        : '12 цифр для физлица'
                  }
                />

                {formData.legal_type === 'ooo' && (
                  <Input
                    label="КПП"
                    placeholder="123456789"
                    value={formData.kpp}
                    onChange={(e) =>
                      setFormData({ ...formData, kpp: e.target.value.replace(/\D/g, '').slice(0, 9) })
                    }
                    helperText="9 цифр"
                  />
                )}

                {(formData.legal_type === 'ip' || formData.legal_type === 'ooo') && (
                  <Input
                    label={formData.legal_type === 'ip' ? 'ОГРНИП' : 'ОГРН'}
                    placeholder={formData.legal_type === 'ip' ? '315774600000000' : '1234567890123'}
                    value={formData.ogrn}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ogrn: e.target.value.replace(/\D/g, '').slice(0, 15),
                      })
                    }
                    helperText={formData.legal_type === 'ip' ? '15 цифр' : '13 цифр'}
                  />
                )}

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Банковские реквизиты</h4>

                  <div className="space-y-4">
                    <Input
                      label="БИК банка"
                      placeholder="044525225"
                      value={formData.bank_bik}
                      onChange={(e) => handleBIKChange(e.target.value)}
                      helperText="9 цифр (банк и корр. счёт заполнятся автоматически)"
                    />

                    <Input
                      label="Наименование банка"
                      placeholder="ПАО Сбербанк"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    />

                    <Input
                      label="Корреспондентский счёт"
                      placeholder="30101810400000000225"
                      value={formData.bank_corr_account}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_corr_account: e.target.value.replace(/\D/g, '').slice(0, 20),
                        })
                      }
                      helperText="20 цифр"
                    />

                    <Input
                      label="Расчётный счёт"
                      placeholder="40802810000000000000"
                      value={formData.bank_account}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_account: e.target.value.replace(/\D/g, '').slice(0, 20),
                        })
                      }
                      helperText="20 цифр"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Контактные данные</h4>

                  <div className="space-y-4">
                    <Input
                      label="Телефон"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />

                    <Input
                      label="Email"
                      type="email"
                      placeholder="agent@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSubmitOnboarding}
                    loading={submitting}
                    disabled={!validateForm()}
                  >
                    Сохранить
                  </Button>
                  <Button variant="secondary" onClick={() => setShowOnboardingForm(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 mb-4">
                  Для получения выплат необходимо добавить реквизиты
                </p>
                <Button onClick={() => setShowOnboardingForm(true)}>Добавить реквизиты</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Верификация</CardTitle>
            <CardDescription>Статус проверки личности</CardDescription>
          </CardHeader>
          <CardContent>
            {activeProfile ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900">
                    {KYC_STATUS_LABELS[activeProfile.kyc_status] || activeProfile.kyc_status}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Верификация необходима для работы с безопасными сделками
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full ${activeProfile.kyc_status === 'approved'
                      ? 'bg-black text-white'
                      : activeProfile.kyc_status === 'rejected'
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  {activeProfile.kyc_status === 'approved'
                    ? 'Верифицирован'
                    : activeProfile.kyc_status === 'in_review'
                      ? 'На проверке'
                      : activeProfile.kyc_status === 'rejected'
                        ? 'Отклонено'
                        : 'Ожидает'}
                </span>
              </div>
            ) : (
              <p className="text-gray-600">
                Верификация станет доступна после добавления реквизитов
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
