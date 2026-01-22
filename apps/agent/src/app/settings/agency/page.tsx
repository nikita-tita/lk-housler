'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { AgencySettings, UpdateAgencySettingsDto } from '@/types';

export default function AgencySettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [actualAddress, setActualAddress] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [contactPosition, setContactPosition] = useState('');

  // Check access
  useEffect(() => {
    if (user && user.role !== 'agency_admin') {
      router.push('/settings/profile');
    }
  }, [user, router]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getAgencySettings();
      if (res.success && res.data) {
        setSettings(res.data);
        setLogoUrl(res.data.logo_url || null);
        // Populate form
        setName(res.data.name || '');
        setPhone(res.data.phone || '');
        setEmail(res.data.email || '');
        setDescription(res.data.description || '');
        setWebsite(res.data.website || '');
        setBrandPrimaryColor(res.data.brand_primary_color || '');
        setBrandSecondaryColor(res.data.brand_secondary_color || '');
        setLegalAddress(res.data.legal_address || '');
        setActualAddress(res.data.actual_address || '');
        setDirectorName(res.data.director_name || '');
        setContactPosition(res.data.contact_position || '');
      }
    } catch {
      setError('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    const data: UpdateAgencySettingsDto = {
      name: name || undefined,
      phone: phone || null,
      email: email || null,
      description: description || null,
      website: website || null,
      brand_primary_color: brandPrimaryColor || null,
      brand_secondary_color: brandSecondaryColor || null,
      legal_address: legalAddress || null,
      actual_address: actualAddress || null,
      director_name: directorName || null,
      contact_position: contactPosition || null,
    };

    try {
      const res = await api.updateAgencySettings(data);
      if (res.success && res.data) {
        setSettings(res.data);
        setSuccess('Настройки сохранены');
      } else {
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10 МБ');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Разрешены только изображения');
      return;
    }

    setIsUploadingLogo(true);
    setError('');

    try {
      const res = await api.uploadAgencyLogo(file);
      if (res.success && res.data) {
        setLogoUrl(res.data.logo_url);
        setSuccess('Логотип обновлён');
      } else {
        setError(res.error || 'Ошибка загрузки логотипа');
      }
    } catch {
      setError('Ошибка загрузки логотипа');
    } finally {
      setIsUploadingLogo(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!logoUrl) return;

    setIsUploadingLogo(true);
    setError('');

    try {
      const res = await api.deleteAgencyLogo();
      if (res.success) {
        setLogoUrl(null);
        setSuccess('Логотип удалён');
      } else {
        setError(res.error || 'Ошибка удаления логотипа');
      }
    } catch {
      setError('Ошибка удаления логотипа');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (user?.role !== 'agency_admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Логотип компании</h2>

        <div className="flex items-center gap-6">
          {/* Logo Preview */}
          <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-[var(--color-border)] flex-shrink-0">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Логотип"
                fill
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  className="hidden"
                />
                {isUploadingLogo ? 'Загрузка...' : 'Загрузить логотип'}
              </label>

              {logoUrl && (
                <button
                  type="button"
                  onClick={handleLogoDelete}
                  disabled={isUploadingLogo}
                  className="px-4 py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-lg transition-colors"
                >
                  Удалить
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-light)] mt-2">
              JPG, PNG или SVG. Рекомендуемый размер 512x512. Максимум 10 МБ.
            </p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Профиль агентства</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Название компании
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ООО 'Агентство недвижимости'"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Телефон компании
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (495) 123-45-67"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email компании
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@agency.ru"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium mb-2">
              Веб-сайт
            </label>
            <input
              type="url"
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://agency.ru"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Описание
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Краткое описание агентства..."
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
            />
          </div>

          <hr className="my-6" />
          <h3 className="text-md font-semibold mb-4">Брендирование</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Color */}
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium mb-2">
                Основной цвет
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={brandPrimaryColor || '#1976D2'}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-[var(--color-border)] cursor-pointer"
                />
                <input
                  type="text"
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  placeholder="#1976D2"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium mb-2">
                Вторичный цвет
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="secondaryColor"
                  value={brandSecondaryColor || '#FF9800'}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-[var(--color-border)] cursor-pointer"
                />
                <input
                  type="text"
                  value={brandSecondaryColor}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  placeholder="#FF9800"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <hr className="my-6" />
          <h3 className="text-md font-semibold mb-4">Юридические данные</h3>

          {/* INN, KPP, OGRN (read-only) */}
          {(settings?.inn || settings?.ogrn) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {settings?.inn && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-light)]">
                    ИНН
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-[var(--color-text-light)]">
                    {settings.inn}
                  </div>
                </div>
              )}
              {settings?.kpp && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-light)]">
                    КПП
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-[var(--color-text-light)]">
                    {settings.kpp}
                  </div>
                </div>
              )}
              {settings?.ogrn && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-light)]">
                    ОГРН
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-[var(--color-text-light)]">
                    {settings.ogrn}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legal Address */}
          <div>
            <label htmlFor="legalAddress" className="block text-sm font-medium mb-2">
              Юридический адрес
            </label>
            <textarea
              id="legalAddress"
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="г. Москва, ул. Примерная, д. 1, офис 100"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
            />
          </div>

          {/* Actual Address */}
          <div>
            <label htmlFor="actualAddress" className="block text-sm font-medium mb-2">
              Фактический адрес
            </label>
            <textarea
              id="actualAddress"
              value={actualAddress}
              onChange={(e) => setActualAddress(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="г. Москва, ул. Другая, д. 2"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
            />
          </div>

          {/* Director Name */}
          <div>
            <label htmlFor="directorName" className="block text-sm font-medium mb-2">
              ФИО руководителя
            </label>
            <input
              type="text"
              id="directorName"
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Contact Position */}
          <div>
            <label htmlFor="contactPosition" className="block text-sm font-medium mb-2">
              Должность контактного лица
            </label>
            <input
              type="text"
              id="contactPosition"
              value={contactPosition}
              onChange={(e) => setContactPosition(e.target.value)}
              placeholder="Генеральный директор"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>
    </div>
  );
}
