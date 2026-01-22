'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { api, formatPrice } from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import { StageBadge } from '@/components/clients/StageBadge';
import { PriorityBadge } from '@/components/clients/PriorityBadge';
import type { ClientDetail, ClientStage, ClientPriority } from '@/types';

const STAGES: { value: ClientStage; label: string }[] = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'fixation', label: 'Фиксация' },
  { value: 'booking', label: 'Бронь' },
  { value: 'deal', label: 'Сделка' },
  { value: 'completed', label: 'Завершено' },
  { value: 'failed', label: 'Сорвано' },
];

const PRIORITIES: { value: ClientPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const clientId = Number(params.id);

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClientDetail>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadClient = useCallback(async () => {
    try {
      const response = await api.getClient(clientId);
      if (response.success && response.data) {
        setClient(response.data);
        setEditForm(response.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId, loadClient]);

  const handleStageChange = async (stage: ClientStage) => {
    try {
      const response = await api.updateClientStage(clientId, stage);
      if (response.success && response.data) {
        setClient({ ...client!, ...response.data });
        showToast('Этап изменён', 'success');
      }
    } catch {
      showToast('Не удалось изменить этап', 'error');
    }
  };

  const handleSave = async () => {
    try {
      const response = await api.updateClient(clientId, {
        name: editForm.name || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        telegram: editForm.telegram || undefined,
        priority: editForm.priority,
        comment: editForm.comment || undefined,
        budget_min: editForm.budget_min || undefined,
        budget_max: editForm.budget_max || undefined,
        next_contact_date: editForm.next_contact_date || undefined,
      });

      if (response.success && response.data) {
        setClient({ ...client!, ...response.data });
        setIsEditing(false);
        showToast('Изменения сохранены', 'success');
      }
    } catch {
      showToast('Не удалось сохранить изменения', 'error');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await api.deleteClient(clientId);
      if (response.success) {
        showToast('Клиент удалён', 'success');
        router.push('/clients');
      }
    } catch {
      showToast('Не удалось удалить клиента', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleRecordContact = async () => {
    try {
      const response = await api.recordClientContact(clientId);
      if (response.success) {
        loadClient();
        showToast('Контакт записан', 'success');
      }
    } catch {
      showToast('Не удалось записать контакт', 'error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-light)] mb-4">Клиент не найден</p>
        <Link href="/clients" className="text-[var(--color-accent)]">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const displayName = client.name || client.phone || client.email || 'Без имени';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]">
          &larr; К списку клиентов
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold mb-2">{displayName}</h2>
          <div className="flex items-center gap-3">
            <StageBadge stage={client.stage} size="md" />
            <PriorityBadge priority={client.priority} size="md" />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRecordContact}
            className="btn btn-secondary btn-sm"
          >
            Записать контакт
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-secondary btn-sm"
          >
            {isEditing ? 'Отмена' : 'Редактировать'}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-sm btn-secondary"
          >
            Удалить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Контактная информация</h3>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Имя</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Телефон</label>
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Telegram</label>
                  <input
                    type="text"
                    value={editForm.telegram || ''}
                    onChange={(e) => setEditForm({ ...editForm, telegram: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {client.phone && (
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">Телефон</div>
                    <div className="font-medium">{client.phone}</div>
                  </div>
                )}
                {client.email && (
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">Email</div>
                    <div className="font-medium">{client.email}</div>
                  </div>
                )}
                {client.telegram && (
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">Telegram</div>
                    <div className="font-medium">{client.telegram}</div>
                  </div>
                )}
                {client.whatsapp && (
                  <div>
                    <div className="text-sm text-[var(--color-text-light)]">WhatsApp</div>
                    <div className="font-medium">{client.whatsapp}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage Selector */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Этап воронки</h3>
            <div className="flex flex-wrap gap-2">
              {STAGES.map(s => (
                <button
                  key={s.value}
                  onClick={() => handleStageChange(s.value)}
                  className={`tab-btn ${client.stage === s.value ? 'tab-btn-active' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget & Preferences */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Пожелания</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-[var(--color-text-light)]">Бюджет</div>
                <div className="font-medium">
                  {client.budget_min || client.budget_max
                    ? `${client.budget_min ? formatPrice(client.budget_min) : '—'} — ${client.budget_max ? formatPrice(client.budget_max) : '—'}`
                    : '—'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-text-light)]">Комнаты</div>
                <div className="font-medium">
                  {client.desired_rooms?.length
                    ? client.desired_rooms.map(r => r === 0 ? 'Студия' : r).join(', ')
                    : '—'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-text-light)]">Срок сделки</div>
                <div className="font-medium">{formatDate(client.desired_deadline)}</div>
              </div>
            </div>
          </div>

          {/* Comment */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Комментарий</h3>
            {isEditing ? (
              <textarea
                value={editForm.comment || ''}
                onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                rows={4}
                className="input resize-none"
              />
            ) : (
              <p className="text-[var(--color-text-light)]">
                {client.comment || 'Нет комментария'}
              </p>
            )}
          </div>

          {/* Save Button */}
          {isEditing && (
            <button onClick={handleSave} className="btn btn-primary">
              Сохранить изменения
            </button>
          )}

          {/* Selections */}
          {client.selections.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Подборки ({client.selections.length})</h3>
              <div className="space-y-3">
                {client.selections.map(sel => (
                  <Link
                    key={sel.id}
                    href={`/selections/${sel.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-gray)] hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{sel.name}</div>
                      <div className="text-sm text-[var(--color-text-light)]">
                        {sel.items_count} объектов
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-text-light)]">
                      {formatDateTime(sel.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Bookings */}
          {client.bookings.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Брони ({client.bookings.length})</h3>
              <div className="space-y-3">
                {client.bookings.map(booking => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-gray)]"
                  >
                    <div>
                      <div className="font-medium">{booking.complex_name || `Объект #${booking.offer_id}`}</div>
                      <div className="text-sm text-[var(--color-text-light)]">
                        Статус: {booking.status}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-text-light)]">
                      {formatDateTime(booking.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Priority & Dates */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Управление</h3>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Приоритет</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as ClientPriority })}
                    className="select"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-light)] mb-1">Следующий контакт</label>
                  <input
                    type="date"
                    value={editForm.next_contact_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, next_contact_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-[var(--color-text-light)]">Следующий контакт</div>
                  <div className="font-medium">{formatDate(client.next_contact_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-light)]">Последний контакт</div>
                  <div className="font-medium">{formatDate(client.last_contact_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-light)]">Создан</div>
                  <div className="font-medium">{formatDate(client.created_at)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log */}
          {client.activity.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">История</h3>
              <div className="space-y-3">
                {client.activity.slice(0, 10).map(item => (
                  <div key={item.id} className="text-sm">
                    <div className="text-[var(--color-text-light)]">
                      {formatDateTime(item.created_at)}
                    </div>
                    <div>{getActionLabel(item.action)}</div>
                    {item.new_value && (
                      <div className="text-[var(--color-text-light)]">
                        {item.old_value && `${item.old_value} → `}{item.new_value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Удалить клиента"
        message="Вы уверены, что хотите удалить этого клиента? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: 'Клиент создан',
    stage_changed: 'Изменён этап',
    priority_changed: 'Изменён приоритет',
    selection_linked: 'Привязана подборка',
    booking_linked: 'Привязана бронь',
    contact_made: 'Записан контакт',
  };
  return labels[action] || action;
}
