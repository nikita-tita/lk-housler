'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { api, formatPhone } from '@/services/api';
import type { ExtendedProfile, UpdateProfileDto, PreferredContact } from '@/types';

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

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [preferredContact, setPreferredContact] = useState<PreferredContact>('phone');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [city, setCity] = useState('');
  const [specialization, setSpecialization] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [about, setAbout] = useState('');

  const isAgent = user?.role === 'agent' || user?.role === 'agency_admin' || user?.role === 'operator';

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.getSettingsProfile();
      if (res.success && res.data) {
        setProfile(res.data);
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
      setError('Ошибка загрузки профиля');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

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
      const res = await api.updateSettingsProfile(data);
      if (res.success && res.data) {
        setProfile(res.data);
        setSuccess('Профиль обновлён');
        // Update user in auth context
        setUser({
          ...user!,
          name: res.data.name,
        });
      } else {
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const toggleSpecialization = (spec: string) => {
    setSpecialization(prev =>
      prev.includes(spec)
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5 МБ');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Разрешены только изображения');
      return;
    }

    setIsUploadingAvatar(true);
    setError('');

    try {
      const res = await api.uploadProfileAvatar(file);
      if (res.success && res.data) {
        setAvatarUrl(res.data.avatar_url);
        setSuccess('Аватар обновлён');
      } else {
        setError(res.error || 'Ошибка загрузки аватара');
      }
    } catch {
      setError('Ошибка загрузки аватара');
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarDelete = async () => {
    if (!avatarUrl) return;

    setIsUploadingAvatar(true);
    setError('');

    try {
      const res = await api.deleteProfileAvatar();
      if (res.success) {
        setAvatarUrl(null);
        setSuccess('Аватар удалён');
      } else {
        setError(res.error || 'Ошибка удаления аватара');
      }
    } catch {
      setError('Ошибка удаления аватара');
    } finally {
      setIsUploadingAvatar(false);
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

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Фото профиля</h2>

        <div className="flex items-center gap-6">
          {/* Avatar Preview */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-[var(--color-border)] flex-shrink-0">
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
                  className="px-4 py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-lg transition-colors"
                >
                  Удалить
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-light)] mt-2">
              JPG, PNG или GIF. Максимум 5 МБ.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Личные данные</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--color-text-light)]">
              Email
            </label>
            <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-[var(--color-text-light)]">
              {profile?.email}
            </div>
          </div>

          {/* Phone (read-only) */}
          {profile?.phone && (
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--color-text-light)]">
                Телефон
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-[var(--color-text-light)]">
                {formatPhone(profile.phone)}
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
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
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
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    preferredContact === opt.value
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-light)]">@</span>
              <input
                type="text"
                id="telegram"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value.replace('@', ''))}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            <p className="text-xs text-[var(--color-text-light)] mt-1">
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
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        specialization.includes(spec)
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
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
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent resize-none"
                />
                <p className="text-xs text-[var(--color-text-light)] mt-1 text-right">
                  {about.length}/2000
                </p>
              </div>
            </>
          )}

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

      {/* Logout section */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h3 className="text-md font-semibold mb-4">Выход из аккаунта</h3>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-[var(--color-text-light)] hover:text-red-600 border border-[var(--color-border)] hover:border-red-300 rounded-lg transition-colors"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
