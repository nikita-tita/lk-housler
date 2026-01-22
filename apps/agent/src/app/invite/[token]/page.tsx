'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { InvitationPublicInfo } from '@/types';

// Note: after accepting invitation, user needs to reload or login again to get updated role

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationPublicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Form state for new user
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const loadInvitation = useCallback(async () => {
    try {
      const res = await api.getInvitationInfo(token);
      if (res.success && res.data) {
        setInvitation(res.data);
      } else {
        setError(res.error || 'Приглашение не найдено или истекло');
      }
    } catch {
      setError('Ошибка загрузки приглашения');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAccepting(true);

    try {
      const res = await api.acceptInvitation(token, {
        name: name || 'Без имени',
        phone: phone || undefined,
      });

      if (res.success) {
        setAccepted(true);
      } else {
        setError(res.error || 'Ошибка принятия приглашения');
      }
    } catch {
      setError('Ошибка принятия приглашения');
    } finally {
      setIsAccepting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    agent: 'Агент',
    operator: 'Оператор',
    agency_admin: 'Администратор',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Приглашение недействительно</h1>
          <p className="text-[var(--color-text-light)] mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="btn btn-primary"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Добро пожаловать в команду!</h1>
          <p className="text-[var(--color-text-light)] mb-6">
            Вы успешно присоединились к {invitation?.agency_name}.
          </p>
          <button
            onClick={() => router.push(user ? '/offers' : '/login')}
            className="btn btn-primary"
          >
            {user ? 'Перейти к объектам' : 'Войти в систему'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-2xl font-bold">
            {invitation?.agency_name?.charAt(0) || 'A'}
          </div>
          <h1 className="text-xl font-semibold mb-2">Приглашение в команду</h1>
          <p className="text-[var(--color-text-light)]">
            <strong>{invitation?.inviter_name || 'Администратор'}</strong> приглашает вас присоединиться к агентству <strong>{invitation?.agency_name}</strong>
          </p>
        </div>

        {/* Role Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-light)]">Ваша роль:</span>
            <span className="font-medium">{roleLabels[invitation?.role || 'operator'] || invitation?.role}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[var(--color-text-light)]">Email:</span>
            <span className="font-medium">{invitation?.email}</span>
          </div>
        </div>

        {/* Already logged in as different user */}
        {user && user.email !== invitation?.email && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              Вы вошли как <strong>{user.email}</strong>, но приглашение для <strong>{invitation?.email}</strong>.
              Выйдите из системы и войдите с правильным аккаунтом.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAccept} className="space-y-4">
          {/* If not logged in, show registration fields */}
          {!user && (
            <>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Ваше имя
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

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  Телефон
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isAccepting || !!(user && user.email !== invitation?.email)}
            className="w-full btn btn-primary py-3"
          >
            {isAccepting ? 'Принятие...' : 'Принять приглашение'}
          </button>

          {/* Login link for existing users */}
          {!user && (
            <p className="text-center text-sm text-[var(--color-text-light)]">
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => router.push(`/login?redirect=/invite/${token}`)}
                className="text-[var(--color-accent)] hover:underline"
              >
                Войдите
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
