'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@housler/lib';
import {
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  InvitationPublicInfo,
  INVITATION_ROLE_LABELS,
} from '@housler/lib';

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInvitationByToken(token);
      setInvitation(data);
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 404) {
        setError('Приглашение не найдено');
      } else {
        setError('Ошибка загрузки приглашения');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(`/login?returnUrl=/invite/${token}`);
      return;
    }

    try {
      setActionLoading(true);
      await acceptInvitation(token);
      router.push(`/agent/deals/bank-split/${invitation?.deal_id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Ошибка принятия приглашения');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      setActionLoading(true);
      await declineInvitation(token, declineReason || undefined);
      setInvitation((prev) => (prev ? { ...prev, status: 'declined' } : null));
      setShowDeclineForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Ошибка отклонения приглашения');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto" />
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 p-6 bg-white border border-gray-200 rounded-lg text-center">
          <div className="text-gray-900 mb-4">{error}</div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  const canRespond = invitation.status === 'pending' && !invitation.is_expired;

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Приглашение в сделку</h1>

          {error && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div>
              <div className="text-xs sm:text-sm text-gray-500">Адрес объекта</div>
              <div className="font-medium text-sm sm:text-base">{invitation.property_address}</div>
            </div>

            <div>
              <div className="text-xs sm:text-sm text-gray-500">От кого</div>
              <div className="font-medium text-sm sm:text-base">{invitation.inviter_name}</div>
            </div>

            <div>
              <div className="text-xs sm:text-sm text-gray-500">Ваша роль</div>
              <div className="font-medium text-sm sm:text-base">{INVITATION_ROLE_LABELS[invitation.role]}</div>
            </div>

            <div>
              <div className="text-xs sm:text-sm text-gray-500">Ваша доля комиссии</div>
              <div className="font-medium text-sm sm:text-base">{invitation.split_percent}%</div>
            </div>

            <div>
              <div className="text-xs sm:text-sm text-gray-500">Действует до</div>
              <div className="font-medium text-sm sm:text-base">
                {new Date(invitation.expires_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {invitation.is_expired && (
            <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm mb-6">
              Срок действия приглашения истек
            </div>
          )}

          {invitation.status === 'accepted' && (
            <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm mb-6">
              Вы приняли это приглашение
            </div>
          )}

          {invitation.status === 'declined' && (
            <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm mb-6">
              Вы отклонили это приглашение
            </div>
          )}

          {canRespond && (
            <>
              {showDeclineForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Причина отклонения (необязательно)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
                      rows={3}
                      placeholder="Укажите причину..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDecline}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {actionLoading ? 'Отправка...' : 'Подтвердить отказ'}
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="flex-1 py-3 px-4 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm sm:text-base"
                  >
                    {actionLoading
                      ? 'Загрузка...'
                      : isAuthenticated
                        ? 'Принять приглашение'
                        : 'Войти и принять'}
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    disabled={actionLoading}
                    className="py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm sm:text-base"
                  >
                    Отклонить
                  </button>
                </div>
              )}

              {!isAuthenticated && (
                <p className="text-xs sm:text-sm text-gray-500 mt-4 text-center">
                  Для принятия приглашения необходимо войти в систему
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
