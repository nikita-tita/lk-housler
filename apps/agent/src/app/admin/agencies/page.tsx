'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AdminAgency } from '@/types';

const STATUSES: { value: string; label: string; filled: boolean }[] = [
  { value: 'pending', label: 'На модерации', filled: false },
  { value: 'active', label: 'Активно', filled: true },
  { value: 'rejected', label: 'Отклонено', filled: true },
  { value: 'suspended', label: 'Приостановлено', filled: false },
];

function StatusBadge({ status }: { status: string }) {
  const statusConfig = STATUSES.find(s => s.value === status) || STATUSES[0];
  return (
    <span className={statusConfig.filled ? 'badge-filled' : 'badge'}>
      {statusConfig.label}
    </span>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [editingAgency, setEditingAgency] = useState<AdminAgency | null>(null);
  const limit = 20;

  const loadAgencies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.adminGetAgencies({
        search: search || undefined,
        registration_status: statusFilter || undefined,
        limit,
        offset,
      });
      if (res.success && res.data) {
        setAgencies(res.data.data ?? []);
        setTotal(res.data.pagination?.total ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, offset]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  useEffect(() => {
    setOffset(0);
  }, [search, statusFilter]);

  const handleUpdateStatus = async (agencyId: number, status: string) => {
    const res = await api.adminUpdateAgencyStatus(agencyId, status);
    if (res.success) {
      setEditingAgency(null);
      loadAgencies();
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-light)] mb-1">Поиск</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Название, ИНН, email..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-light)] mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input w-full"
            >
              <option value="">Все статусы</option>
              {STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setStatusFilter('pending')}
              className="btn btn-primary w-full"
            >
              Показать на модерации
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-light)]">
          Найдено: {total.toLocaleString('ru-RU')} агентств
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-gray)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Название</th>
                <th className="px-4 py-3 text-left text-sm font-medium">ИНН</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Телефон</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Агентов</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Создано</th>
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
              ) : agencies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[var(--color-text-light)]">
                    Агентства не найдены
                  </td>
                </tr>
              ) : (
                agencies.map(agency => (
                  <tr key={agency.id}>
                    <td className="px-4 py-3 text-sm">{agency.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{agency.name}</div>
                      <div className="text-xs text-[var(--color-text-light)]">{agency.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{agency.inn || '—'}</td>
                    <td className="px-4 py-3 text-sm">{agency.email || '—'}</td>
                    <td className="px-4 py-3 text-sm">{agency.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-center">{agency.agents_count}</td>
                    <td className="px-4 py-3">
                      {editingAgency?.id === agency.id ? (
                        <select
                          value={editingAgency.registration_status}
                          onChange={e => handleUpdateStatus(agency.id, e.target.value)}
                          onBlur={() => setEditingAgency(null)}
                          className="input input-sm"
                          autoFocus
                        >
                          {STATUSES.map(status => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingAgency(agency)}
                          className="hover:opacity-70"
                        >
                          <StatusBadge status={agency.registration_status} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-light)]">
                      {formatDate(agency.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {agency.registration_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(agency.id, 'active')}
                              className="text-[var(--color-text)] hover:text-[var(--gray-900)] text-sm font-medium"
                            >
                              Одобрить
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(agency.id, 'rejected')}
                              className="text-[var(--color-text-light)] hover:text-[var(--color-text)] text-sm"
                            >
                              Отклонить
                            </button>
                          </>
                        )}
                        {agency.registration_status === 'active' && (
                          <button
                            onClick={() => handleUpdateStatus(agency.id, 'suspended')}
                            className="text-[var(--color-text-light)] hover:text-[var(--color-text)] text-sm"
                          >
                            Приостановить
                          </button>
                        )}
                        {agency.registration_status === 'suspended' && (
                          <button
                            onClick={() => handleUpdateStatus(agency.id, 'active')}
                            className="text-[var(--color-text)] hover:text-[var(--gray-900)] text-sm font-medium"
                          >
                            Активировать
                          </button>
                        )}
                      </div>
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

      {/* Info Card */}
      <div className="card p-5 mt-6">
        <h3 className="font-semibold mb-3">Статусы агентств</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <StatusBadge status="pending" />
            <p className="mt-1 text-[var(--color-text-light)]">
              Ожидает проверки модератором
            </p>
          </div>
          <div>
            <StatusBadge status="active" />
            <p className="mt-1 text-[var(--color-text-light)]">
              Агентство работает на платформе
            </p>
          </div>
          <div>
            <StatusBadge status="rejected" />
            <p className="mt-1 text-[var(--color-text-light)]">
              Заявка отклонена
            </p>
          </div>
          <div>
            <StatusBadge status="suspended" />
            <p className="mt-1 text-[var(--color-text-light)]">
              Временно приостановлено
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
