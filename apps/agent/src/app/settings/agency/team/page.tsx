'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { TeamMember, TeamInvitation, TeamMemberRole } from '@/types';

const roleLabels: Record<TeamMemberRole, string> = {
  agent: 'Агент',
  operator: 'Оператор',
  agency_admin: 'Администратор',
};

const roleColors: Record<TeamMemberRole, string> = {
  agent: 'bg-blue-100 text-blue-800',
  operator: 'bg-gray-100 text-gray-800',
  agency_admin: 'bg-purple-100 text-purple-800',
};

export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'agent' | 'operator'>('operator');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Confirm dialogs
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<TeamInvitation | null>(null);

  // Check access
  useEffect(() => {
    if (user && user.role !== 'agency_admin') {
      router.push('/settings/profile');
    }
  }, [user, router]);

  const loadData = useCallback(async () => {
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        api.getTeamMembers(),
        api.getTeamInvitations(),
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (invitationsRes.success && invitationsRes.data) {
        setInvitations(invitationsRes.data);
      }
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSendingInvite(true);

    try {
      const res = await api.sendTeamInvitation({
        email: inviteEmail,
        name: inviteName || undefined,
        role: inviteRole,
      });

      if (res.success && res.data) {
        setInvitations([...invitations, res.data]);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('operator');
        setSuccess('Приглашение отправлено');
      } else {
        setError(res.error || 'Ошибка отправки приглашения');
      }
    } catch {
      setError('Ошибка отправки приглашения');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvitation = async (invitation: TeamInvitation) => {
    setError('');
    setSuccess('');

    try {
      const res = await api.cancelTeamInvitation(invitation.id);
      if (res.success) {
        setInvitations(invitations.filter((i) => i.id !== invitation.id));
        setSuccess('Приглашение отменено');
      } else {
        setError(res.error || 'Ошибка отмены приглашения');
      }
    } catch {
      setError('Ошибка отмены приглашения');
    } finally {
      setConfirmCancel(null);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    setError('');
    setSuccess('');

    try {
      const res = await api.removeTeamMember(member.id);
      if (res.success) {
        setMembers(members.filter((m) => m.id !== member.id));
        setSuccess('Сотрудник удалён из команды');
      } else {
        setError(res.error || 'Ошибка удаления сотрудника');
      }
    } catch {
      setError('Ошибка удаления сотрудника');
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    setError('');
    setSuccess('');
    const newActiveState = !member.is_active;

    try {
      const res = await api.toggleTeamMemberActive(member.id, newActiveState);
      if (res.success) {
        setMembers(members.map((m) => (m.id === member.id ? { ...m, is_active: newActiveState } : m)));
        setSuccess(newActiveState ? 'Сотрудник активирован' : 'Сотрудник деактивирован');
      } else {
        setError(res.error || 'Ошибка изменения статуса');
      }
    } catch {
      setError('Ошибка изменения статуса');
    }
  };

  const handleRoleChange = async (member: TeamMember, newRole: 'agent' | 'operator') => {
    setError('');
    setSuccess('');

    try {
      const res = await api.updateTeamMemberRole(member.id, newRole);
      if (res.success) {
        setMembers(members.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
        setSuccess('Роль изменена');
      } else {
        setError(res.error || 'Ошибка изменения роли');
      }
    } catch {
      setError('Ошибка изменения роли');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (user?.role !== 'agency_admin') {
    return null;
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

      {/* Invite Form */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Пригласить в команду</h2>

        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="inviteEmail" className="block text-sm font-medium mb-2">
                Email *
              </label>
              <input
                type="email"
                id="inviteEmail"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="email@example.com"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="inviteName" className="block text-sm font-medium mb-2">
                Имя
              </label>
              <input
                type="text"
                id="inviteName"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="inviteRole" className="block text-sm font-medium mb-2">
                Роль
              </label>
              <select
                id="inviteRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'agent' | 'operator')}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              >
                <option value="operator">Оператор</option>
                <option value="agent">Агент</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSendingInvite || !inviteEmail}
            className="btn btn-primary"
          >
            {isSendingInvite ? 'Отправка...' : 'Отправить приглашение'}
          </button>
        </form>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Ожидающие приглашения</h2>

          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div>
                  <div className="font-medium">{invitation.email}</div>
                  {invitation.name && (
                    <div className="text-sm text-[var(--color-text-light)]">{invitation.name}</div>
                  )}
                  <div className="text-xs text-[var(--color-text-light)] mt-1">
                    Роль: {roleLabels[invitation.role]} • Истекает: {formatDate(invitation.expires_at)}
                  </div>
                </div>

                <button
                  onClick={() => setConfirmCancel(invitation)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Отменить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Сотрудники ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-[var(--color-text-light)]">
            В команде пока нет сотрудников. Отправьте приглашение выше.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg ${
                  member.is_active
                    ? 'border-[var(--color-border)] bg-white'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4 mb-3 md:mb-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-medium">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${!member.is_active ? 'text-gray-500' : ''}`}>
                        {member.name || 'Без имени'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                      {!member.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          Неактивен
                        </span>
                      )}
                      {member.id === user?.id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          Вы
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--color-text-light)]">
                      {member.email}
                      {member.phone && ` • ${member.phone}`}
                    </div>
                    {member.last_login_at && (
                      <div className="text-xs text-[var(--color-text-light)]">
                        Последний вход: {formatDate(member.last_login_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions (not for self) */}
                {member.id !== user?.id && (
                  <div className="flex items-center gap-3">
                    {/* Role change (only for non-admin members) */}
                    {member.role !== 'agency_admin' && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as 'agent' | 'operator')}
                        className="text-sm px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      >
                        <option value="operator">Оператор</option>
                        <option value="agent">Агент</option>
                      </select>
                    )}

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(member)}
                      className={`text-sm px-3 py-2 rounded-lg border ${
                        member.is_active
                          ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {member.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => setConfirmRemove(member)}
                      className="text-sm px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Remove Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Удалить сотрудника?</h3>
            <p className="text-[var(--color-text-light)] mb-6">
              Вы уверены, что хотите удалить <strong>{confirmRemove.name || confirmRemove.email}</strong> из команды?
              Это действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={() => handleRemoveMember(confirmRemove)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancel Invitation Modal */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Отменить приглашение?</h3>
            <p className="text-[var(--color-text-light)] mb-6">
              Отменить приглашение для <strong>{confirmCancel.email}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
              >
                Нет
              </button>
              <button
                onClick={() => handleCancelInvitation(confirmCancel)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Отменить приглашение
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
