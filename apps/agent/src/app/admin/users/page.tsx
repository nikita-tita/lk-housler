'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import type { AdminUser, UserRole } from '@/types';

// Роли: admin и operator - filled, остальные - badge
const ROLES: { value: UserRole; label: string; filled: boolean }[] = [
  { value: 'client', label: 'Клиент', filled: false },
  { value: 'agent', label: 'Агент', filled: false },
  { value: 'agency_admin', label: 'Админ АН', filled: true },
  { value: 'operator', label: 'Оператор', filled: false },
  { value: 'admin', label: 'Админ', filled: true },
];

function RoleBadge({ role }: { role: UserRole }) {
  const roleConfig = ROLES.find(r => r.value === role) || ROLES[0];
  return (
    <span className={roleConfig.filled ? 'badge-filled' : 'badge'}>
      {roleConfig.label}
    </span>
  );
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.adminGetUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        is_active: activeFilter === 'true' ? true : activeFilter === 'false' ? false : undefined,
        limit,
        offset,
      });
      if (res.success && res.data) {
        setUsers(res.data.data ?? []);
        setTotal(res.data.pagination?.total ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, activeFilter, offset]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setOffset(0);
  }, [search, roleFilter, activeFilter]);

  const handleToggleActive = async (user: AdminUser) => {
    const res = await api.adminToggleUserActive(user.id, !user.is_active);
    if (res.success) {
      loadUsers();
      showToast(user.is_active ? 'Пользователь деактивирован' : 'Пользователь активирован', 'success');
    } else {
      showToast('Не удалось изменить статус', 'error');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    const res = await api.adminUpdateUserRole(userId, role);
    if (res.success) {
      setEditingUser(null);
      loadUsers();
      showToast('Роль изменена', 'success');
    } else {
      showToast('Не удалось изменить роль', 'error');
    }
  };

  const openDeleteModal = (user: AdminUser) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    const res = await api.adminDeleteUser(deletingUser.id);
    if (res.success) {
      loadUsers();
      showToast('Пользователь удалён', 'success');
    } else {
      showToast('Не удалось удалить пользователя', 'error');
    }
    setIsDeleting(false);
    setShowDeleteModal(false);
    setDeletingUser(null);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-light)] mb-1">Поиск</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Email, имя, телефон..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-light)] mb-1">Роль</label>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="input w-full"
            >
              <option value="">Все роли</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-light)] mb-1">Статус</label>
            <select
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value)}
              className="input w-full"
            >
              <option value="">Все</option>
              <option value="true">Активные</option>
              <option value="false">Деактивированные</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary w-full"
            >
              + Создать пользователя
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-light)]">
          Найдено: {total.toLocaleString('ru-RU')} пользователей
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-gray)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Имя</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Телефон</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Роль</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Агентство</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Последний вход</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[var(--color-text-light)]">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 text-sm">{user.id}</td>
                    <td className="px-4 py-3 text-sm font-medium">{user.email}</td>
                    <td className="px-4 py-3 text-sm">{user.name || '—'}</td>
                    <td className="px-4 py-3 text-sm">{user.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {editingUser?.id === user.id ? (
                        <select
                          value={editingUser.role}
                          onChange={e => handleUpdateRole(user.id, e.target.value)}
                          onBlur={() => setEditingUser(null)}
                          className="input input-sm"
                          autoFocus
                        >
                          {ROLES.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingUser(user)}
                          className="hover:opacity-70"
                        >
                          <RoleBadge role={user.role} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{user.agency_name || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={user.is_active ? 'badge-filled' : 'badge'}
                      >
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-light)]">
                      {formatDate(user.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="text-[var(--color-text-light)] hover:text-[var(--color-text)] text-sm"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-light)]">
              Страница {currentPage} из {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="btn btn-sm"
              >
                Назад
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                className="btn btn-sm"
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadUsers();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingUser(null);
        }}
        onConfirm={handleDelete}
        title="Удалить пользователя"
        message={`Вы уверены, что хотите деактивировать пользователя ${deletingUser?.email}?`}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

function CreateUserModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('client');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await api.adminCreateUser({
      email,
      name: name || undefined,
      phone: phone || undefined,
      role,
    });

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || 'Ошибка при создании пользователя');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Создать пользователя</h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Телефон</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Роль</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="input w-full"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-[var(--color-text)] text-sm mt-4">{error}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
