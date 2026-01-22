'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { NotificationSettings, UpdateNotificationSettingsDto } from '@/types';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function Toggle({ enabled, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 ${
        enabled ? 'bg-[var(--color-accent)]' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function SettingRow({ label, description, enabled, onChange, disabled }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-[var(--color-text-light)] mt-0.5">{description}</div>
        )}
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getNotificationSettings();
      if (res.success && res.data) {
        setSettings(res.data);
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

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    setError('');
    setSuccess('');
    setIsSaving(true);

    // Optimistic update
    const prevSettings = settings;
    setSettings({ ...settings, [key]: value });

    try {
      const data: UpdateNotificationSettingsDto = { [key]: value };
      const res = await api.updateNotificationSettings(data);
      if (res.success && res.data) {
        setSettings(res.data);
        setSuccess('Настройки обновлены');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        // Revert on error
        setSettings(prevSettings);
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setSettings(prevSettings);
      setError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
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

  if (!settings) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <p className="text-[var(--color-text-light)]">Не удалось загрузить настройки</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Email Notifications */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Email-уведомления</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4">
          Уведомления на вашу электронную почту
        </p>

        <div className="divide-y divide-[var(--color-border)]">
          <SettingRow
            label="Новые предложения"
            description="Получать письма о новых квартирах по вашим критериям"
            enabled={settings.email_new_offers}
            onChange={(v) => updateSetting('email_new_offers', v)}
            disabled={isSaving}
          />
          <SettingRow
            label="Изменения цен"
            description="Уведомления об изменении цен в избранном"
            enabled={settings.email_price_changes}
            onChange={(v) => updateSetting('email_price_changes', v)}
            disabled={isSaving}
          />
          <SettingRow
            label="Обновления подборок"
            description="Уведомления об обновлениях ваших подборок"
            enabled={settings.email_selection_updates}
            onChange={(v) => updateSetting('email_selection_updates', v)}
            disabled={isSaving}
          />
          <SettingRow
            label="Статус бронирований"
            description="Уведомления об изменении статуса бронирований"
            enabled={settings.email_booking_status}
            onChange={(v) => updateSetting('email_booking_status', v)}
            disabled={isSaving}
          />
          <SettingRow
            label="Маркетинговые рассылки"
            description="Новости, акции и специальные предложения"
            enabled={settings.email_marketing}
            onChange={(v) => updateSetting('email_marketing', v)}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* SMS Notifications */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">SMS-уведомления</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4">
          Важные уведомления на телефон
        </p>

        <div className="divide-y divide-[var(--color-border)]">
          <SettingRow
            label="Статус бронирований"
            description="SMS об изменении статуса бронирований"
            enabled={settings.sms_booking_status}
            onChange={(v) => updateSetting('sms_booking_status', v)}
            disabled={isSaving}
          />
          <SettingRow
            label="Обновления подборок"
            description="SMS при добавлении объектов в подборку"
            enabled={settings.sms_selection_updates}
            onChange={(v) => updateSetting('sms_selection_updates', v)}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Push & Telegram */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Другие каналы</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4">
          Push-уведомления и Telegram
        </p>

        <div className="divide-y divide-[var(--color-border)]">
          <SettingRow
            label="Push-уведомления"
            description="Уведомления в браузере (скоро)"
            enabled={settings.push_enabled}
            onChange={(v) => updateSetting('push_enabled', v)}
            disabled={true}
          />
          <SettingRow
            label="Telegram-бот"
            description="Уведомления через Telegram (скоро)"
            enabled={settings.telegram_enabled}
            onChange={(v) => updateSetting('telegram_enabled', v)}
            disabled={true}
          />
        </div>

        <p className="text-xs text-[var(--color-text-light)] mt-4">
          Push-уведомления и Telegram-бот скоро будут доступны
        </p>
      </div>
    </div>
  );
}
