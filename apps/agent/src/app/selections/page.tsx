'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/services/api';
import { Modal, Label, Input, ConfirmModal } from '@/components/ui';
import { RequireAuth } from '@/components/RequireAuth';
import type { Selection, ClientListItem } from '@/types';

function SelectionsContent() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSelection, setCreatedSelection] = useState<Selection | null>(null);
  const [newSelection, setNewSelection] = useState({
    name: '',
    clientName: '',
    clientEmail: '',
    clientId: null as number | null,
  });
  const [creating, setCreating] = useState(false);

  // Клиенты для выбора
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientMode, setClientMode] = useState<'none' | 'select' | 'create'>('none');

  // Подтверждение удаления
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Загрузка зависит от авторизации - RequireAuth уже проверяет доступ

  // Загрузка данных при каждом посещении страницы и при возврате на вкладку
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (user?.role !== 'agent' && user?.role !== 'admin') return;

    loadSelections();

    // Перезагрузка при возврате на вкладку (для обновления счётчиков)
    const handleFocus = () => {
      loadSelections();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authLoading, isAuthenticated, user?.role]);

  const loadSelections = async () => {
    try {
      const response = await api.getSelections();
      if (response.success && response.data) {
        setSelections(response.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const loadClients = useCallback(async () => {
    if (clients.length > 0) return; // Уже загружены
    setClientsLoading(true);
    try {
      const response = await api.getClients();
      if (response.success && response.data) {
        setClients(response.data);
      }
    } catch {
      // silently fail
    } finally {
      setClientsLoading(false);
    }
  }, [clients.length]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSelection.name.trim()) return;

    setCreating(true);
    try {
      const response = await api.createSelection({
        name: newSelection.name,
        clientName: clientMode === 'create' ? newSelection.clientName || undefined : undefined,
        clientEmail: clientMode === 'create' ? newSelection.clientEmail || undefined : undefined,
        clientId: clientMode === 'select' && newSelection.clientId ? newSelection.clientId : undefined,
      });
      if (response.success && response.data) {
        setSelections([response.data, ...selections]);
        setShowCreateModal(false);
        setNewSelection({ name: '', clientName: '', clientEmail: '', clientId: null });
        setClientMode('none');
        // Показываем success-модалку с предложением добавить объекты
        setCreatedSelection(response.data);
        setShowSuccessModal(true);
      }
    } catch {
      showToast('Не удалось создать подборку', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openDeleteModal = (id: number) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      await api.deleteSelection(deletingId);
      setSelections(selections.filter(s => s.id !== deletingId));
      showToast('Подборка удалена', 'success');
    } catch {
      showToast('Не удалось удалить подборку', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletingId(null);
    }
  };

  const copyShareLink = (code: string) => {
    const url = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована', 'success');
  };

  if (authLoading || isLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Мои подборки</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm"
        >
          Создать подборку
        </button>
      </div>

      {selections.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[var(--color-text-light)] mb-4">
            У вас пока нет подборок
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Создать первую подборку
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {selections.map((selection) => (
            <div
              key={selection.id}
              className="card card-body flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/selections/${selection.id}`}
                    className="font-medium text-lg hover:text-[var(--color-accent)]"
                  >
                    {selection.name}
                  </Link>
                  {selection.view_count > 0 && (
                    <span className="badge-filled">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {selection.view_count}
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--color-text-light)] mt-1">
                  {selection.items_count} объектов
                  {selection.client_name && ` • Для: ${selection.client_name}`}
                </div>
                <div className="text-xs text-[var(--color-text-light)] mt-1 flex items-center gap-3">
                  <span>Создана: {new Date(selection.created_at).toLocaleDateString('ru-RU')}</span>
                  {selection.last_viewed_at && (
                    <span className="font-medium text-[var(--color-text)]">
                      Просмотрена: {new Date(selection.last_viewed_at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => copyShareLink(selection.share_code)}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Копировать ссылку
                </button>
                <Link
                  href={`/selections/${selection.id}`}
                  className="btn btn-primary btn-xs"
                >
                  Открыть
                </Link>
                <button
                  onClick={() => openDeleteModal(selection.id)}
                  className="px-3 py-2 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setClientMode('none');
          setNewSelection({ name: '', clientName: '', clientEmail: '', clientId: null });
        }}
        title="Новая подборка"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label required>Название</Label>
            <Input
              type="text"
              value={newSelection.name}
              onChange={(e) => setNewSelection({ ...newSelection, name: e.target.value })}
              placeholder="Например: Квартиры для Ивановых"
              required
            />
          </div>

          {/* Выбор клиента */}
          <div>
            <Label>Клиент</Label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setClientMode('none')}
                className={`tab-btn border ${
                  clientMode === 'none'
                    ? 'tab-btn-active border-gray-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Без клиента
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientMode('select');
                  loadClients();
                }}
                className={`tab-btn border ${
                  clientMode === 'select'
                    ? 'tab-btn-active border-gray-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Выбрать из CRM
              </button>
              <button
                type="button"
                onClick={() => setClientMode('create')}
                className={`tab-btn border ${
                  clientMode === 'create'
                    ? 'tab-btn-active border-gray-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Новый клиент
              </button>
            </div>

            {/* Выбор существующего клиента */}
            {clientMode === 'select' && (
              <div>
                {clientsLoading ? (
                  <div className="text-sm text-[var(--color-text-light)]">Загрузка клиентов...</div>
                ) : clients.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-light)]">
                    У вас пока нет клиентов.{' '}
                    <button
                      type="button"
                      onClick={() => setClientMode('create')}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      Создать нового?
                    </button>
                  </div>
                ) : (
                  <select
                    value={newSelection.clientId || ''}
                    onChange={(e) => setNewSelection({ ...newSelection, clientId: e.target.value ? Number(e.target.value) : null })}
                    className="input w-full"
                  >
                    <option value="">Выберите клиента...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name || client.phone || client.email || `Клиент #${client.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Создание нового клиента (только контактные данные) */}
            {clientMode === 'create' && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label>Имя</Label>
                  <Input
                    type="text"
                    value={newSelection.clientName}
                    onChange={(e) => setNewSelection({ ...newSelection, clientName: e.target.value })}
                    placeholder="Иван Иванов"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newSelection.clientEmail}
                    onChange={(e) => setNewSelection({ ...newSelection, clientEmail: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>
                <p className="text-xs text-[var(--color-text-light)]">
                  Клиент будет сохранён в информации о подборке. Для добавления в CRM перейдите в раздел «Клиенты».
                </p>
              </div>
            )}
          </div>

          <Modal.Footer>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setClientMode('none');
                setNewSelection({ name: '', clientName: '', clientEmail: '', clientId: null });
              }}
              className="btn btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={creating || !newSelection.name.trim()}
              className="btn btn-primary flex-1"
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Success Modal - предложение добавить объекты */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Подборка создана"
      >
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-[var(--gray-900)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium mb-2">
            Подборка «{createdSelection?.name}» создана
          </p>
          <p className="text-[var(--color-text-light)] text-sm">
            Теперь вы можете добавить в неё объекты из каталога
          </p>
        </div>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setShowSuccessModal(false)}
            className="btn btn-secondary flex-1"
          >
            Позже
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSuccessModal(false);
              router.push('/offers');
            }}
            className="btn btn-primary flex-1"
          >
            Добавить объекты
          </button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        title="Удалить подборку"
        message="Вы уверены, что хотите удалить эту подборку? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

export default function SelectionsPage() {
  return (
    <RequireAuth allowedRoles={['agent', 'admin']}>
      <SelectionsContent />
    </RequireAuth>
  );
}
