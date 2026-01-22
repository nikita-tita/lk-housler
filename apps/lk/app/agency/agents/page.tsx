'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';
import { Button } from '@housler/ui';
import { Input } from '@housler/ui';
import {
  getOrganizations,
  getAgents,
  addAgentByPhone,
  removeAgent,
  AgentInfo,
  Organization,
} from '@housler/lib';

export default function AgentsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add agent form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [addingAgent, setAddingAgent] = useState(false);
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

      // Get agents
      const agentsResponse = await getAgents(org.id);
      setAgents(agentsResponse.items);
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
    setNewAgentPhone(value);
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    const digits = newAgentPhone.replace(/\D/g, '');
    if (digits.length !== 11) {
      setAddError('Введите корректный номер телефона');
      return;
    }

    try {
      setAddingAgent(true);
      setAddError('');

      const newAgent = await addAgentByPhone(organization.id, digits);
      setAgents([...agents, newAgent]);
      setNewAgentPhone('');
      setShowAddForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setAddError(error.response?.data?.detail || 'Ошибка добавления агента');
    } finally {
      setAddingAgent(false);
    }
  };

  const handleRemoveAgent = async (userId: number) => {
    if (!organization) return;
    if (!confirm('Вы уверены, что хотите удалить агента из организации?')) return;

    try {
      await removeAgent(organization.id, userId);
      setAgents(agents.filter((a) => a.user_id !== userId));
    } catch (err) {
      alert('Ошибка удаления агента');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Агенты</h1>
          <p className="text-gray-600 mt-1">
            {organization?.legal_name} — {agents.length} агентов
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>Добавить агента</Button>
      </div>

      {/* Add agent modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowAddForm(false)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Добавить агента</h2>

              <form onSubmit={handleAddAgent} className="space-y-4">
                <Input
                  label="Телефон агента"
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  value={formatPhone(newAgentPhone)}
                  onChange={handlePhoneChange}
                  helperText="Агент должен быть зарегистрирован в системе"
                />

                {addError && (
                  <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700">
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
                  <Button type="submit" loading={addingAgent}>
                    Добавить
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список агентов</CardTitle>
          <CardDescription>Все агенты вашего агентства</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-gray-600 text-center py-12">
              Нет добавленных агентов
            </p>
          ) : (
            <div className="divide-y divide-gray-200">
              {agents.map((agent) => (
                <div
                  key={agent.user_id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                      {agent.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {agent.name || 'Без имени'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.phone || agent.email || `ID: ${agent.user_id}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        agent.role === 'admin'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {agent.role === 'admin' ? 'Админ' : 'Агент'}
                    </span>
                    {agent.role !== 'admin' && (
                      <button
                        onClick={() => handleRemoveAgent(agent.user_id)}
                        className="text-gray-400 hover:text-gray-600"
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
    </div>
  );
}
