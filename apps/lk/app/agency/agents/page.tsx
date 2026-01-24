'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, useToast } from '@housler/ui';
import { Button } from '@housler/ui';
import { Input } from '@housler/ui';
import {
  getOrganizations,
  getAgents,
  addAgentByPhone,
  removeAgent,
  getEmployeeInvitations,
  sendEmployeeInvitation,
  cancelEmployeeInvitation,
  resendEmployeeInvitation,
  AgentInfo,
  Organization,
  EmployeeInvitation,
} from '@housler/lib';

type TabType = 'employees' | 'invitations';

export default function AgentsPage() {
  const toast = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [invitations, setInvitations] = useState<EmployeeInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('employees');

  // Add/Invite form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'invite'>('invite');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Get user's organization
      const orgs = await getOrganizations();
      if (orgs.length === 0) {
        setError('Вы не состоите ни в одной организации');
        return;
      }

      const org = orgs[0];
      setOrganization(org);

      // Load agents and invitations in parallel
      const [agentsResponse, invitationsResponse] = await Promise.all([
        getAgents(org.id),
        getEmployeeInvitations(org.id),
      ]);

      setAgents(agentsResponse.items);
      setInvitations(invitationsResponse.items.filter(i => i.status === 'pending'));
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  const formatPhoneDisplay = (phone: string): string => {
    if (phone.length === 11) {
      return `+${phone[0]} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
    }
    return `+${phone}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0 && value[0] === '8') {
      value = '7' + value.slice(1);
    }
    if (value.length === 0) {
      value = '7';
    }
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    setNewPhone(value);
  };

  const openAddForm = (mode: 'add' | 'invite') => {
    setFormMode(mode);
    setNewPhone('');
    setNewName('');
    setNewPosition('');
    setAddError('');
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    const digits = newPhone.replace(/\D/g, '');
    if (digits.length !== 11) {
      setAddError('Введите корректный номер телефона');
      return;
    }

    try {
      setSubmitting(true);
      setAddError('');

      if (formMode === 'add') {
        // Add existing user
        const newAgent = await addAgentByPhone(organization.id, digits);
        setAgents([...agents, newAgent]);
      } else {
        // Send invitation
        const invitation = await sendEmployeeInvitation(organization.id, {
          phone: digits,
          name: newName || undefined,
          position: newPosition || undefined,
        });
        setInvitations([...invitations, invitation]);
      }

      setShowAddForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string; error?: string } }; message?: string };
      setAddError(
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Ошибка'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAgent = async (userId: number) => {
    if (!organization) return;
    if (!confirm('Вы уверены, что хотите удалить сотрудника из организации?')) return;

    try {
      await removeAgent(organization.id, userId);
      setAgents(agents.filter((a) => a.user_id !== userId));
      toast.success('Сотрудник удалён');
    } catch (err) {
      toast.error('Ошибка удаления сотрудника');
      console.error(err);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!organization) return;
    if (!confirm('Вы уверены, что хотите отменить приглашение?')) return;

    try {
      await cancelEmployeeInvitation(organization.id, invitationId);
      setInvitations(invitations.filter((i) => i.id !== invitationId));
      toast.success('Приглашение отменено');
    } catch (err) {
      toast.error('Ошибка отмены приглашения');
      console.error(err);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!organization) return;

    try {
      await resendEmployeeInvitation(organization.id, invitationId);
      toast.success('SMS с приглашением отправлено повторно');
    } catch (err) {
      toast.error('Ошибка отправки SMS');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-[var(--color-text-light)]">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Сотрудники</h1>
          <p className="text-[var(--color-text-light)] mt-1">
            {organization?.legal_name} — {agents.length} сотрудников
            {invitations.length > 0 && `, ${invitations.length} приглашений`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openAddForm('add')}>
            Добавить существующего
          </Button>
          <Button onClick={() => openAddForm('invite')}>
            Пригласить нового
          </Button>
        </div>
      </div>

      {/* Add/Invite modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowAddForm(false)}
            />
            <div
              className="relative bg-[var(--color-bg)] rounded-lg shadow-xl max-w-md w-full p-6 border border-[var(--color-border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">
                {formMode === 'add' ? 'Добавить существующего пользователя' : 'Пригласить нового сотрудника'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Телефон"
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  value={formatPhone(newPhone)}
                  onChange={handlePhoneChange}
                  helperText={formMode === 'add'
                    ? 'Пользователь должен быть зарегистрирован в системе'
                    : 'На этот номер будет отправлено SMS с приглашением'
                  }
                />

                {formMode === 'invite' && (
                  <>
                    <Input
                      label="ФИО (необязательно)"
                      type="text"
                      placeholder="Иванов Иван Иванович"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />

                    <Input
                      label="Должность (необязательно)"
                      type="text"
                      placeholder="Риелтор"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                    />
                  </>
                )}

                {addError && (
                  <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)]">
                    {addError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddForm(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" loading={submitting}>
                    {formMode === 'add' ? 'Добавить' : 'Отправить приглашение'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'employees'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)]'
            }`}
          >
            Сотрудники ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'invitations'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)]'
            }`}
          >
            Приглашения ({invitations.length})
          </button>
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <Card>
          <CardHeader>
            <CardTitle>Список сотрудников</CardTitle>
            <CardDescription>Все сотрудники вашего агентства</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-light)] mb-4">
                  Нет добавленных сотрудников
                </p>
                <Button onClick={() => openAddForm('invite')}>
                  Пригласить первого сотрудника
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {agents.map((agent) => (
                  <div
                    key={agent.user_id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center text-[var(--color-text-light)] font-medium">
                        {agent.name?.charAt(0).toUpperCase() || 'С'}
                      </div>
                      <div>
                        <div className="font-medium">
                          {agent.name || 'Без имени'}
                        </div>
                        <div className="text-sm text-[var(--color-text-light)]">
                          {agent.phone ? formatPhoneDisplay(agent.phone) : agent.email || `ID: ${agent.user_id}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          agent.role === 'admin'
                            ? 'bg-[var(--color-text)] text-[var(--color-bg)]'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
                        }`}
                      >
                        {agent.role === 'admin' ? 'Админ' : 'Сотрудник'}
                      </span>
                      {agent.role !== 'admin' && (
                        <button
                          onClick={() => handleRemoveAgent(agent.user_id)}
                          className="text-[var(--color-text-light)] hover:text-[var(--color-text)]"
                          title="Удалить"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <Card>
          <CardHeader>
            <CardTitle>Ожидающие приглашения</CardTitle>
            <CardDescription>Приглашения, которые ещё не приняты</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-light)] mb-4">
                  Нет ожидающих приглашений
                </p>
                <Button onClick={() => openAddForm('invite')}>
                  Отправить приглашение
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center text-[var(--color-text-light)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium">
                          {invitation.name || formatPhoneDisplay(invitation.phone)}
                        </div>
                        <div className="text-sm text-[var(--color-text-light)]">
                          {invitation.name && formatPhoneDisplay(invitation.phone)}
                          {invitation.position && ` — ${invitation.position}`}
                        </div>
                        <div className="text-xs text-[var(--color-text-light)] mt-1">
                          Истекает: {new Date(invitation.expiresAt).toLocaleDateString('ru')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="text-[var(--color-accent)] hover:underline text-sm"
                        title="Отправить SMS повторно"
                      >
                        Повторить SMS
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="text-[var(--color-text-light)] hover:text-[var(--color-text)] p-2"
                        title="Отменить приглашение"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
