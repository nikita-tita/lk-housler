'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getAdminDisputes,
  resolveDispute,
  AdminDispute,
  AdminDisputesResponse,
  DISPUTE_STATUS_LABELS,
  DISPUTE_REASON_LABELS,
} from '@/lib/api/admin';
import { formatPrice, formatDate } from '@/lib/utils/format';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-900 text-white',
  under_review: 'bg-gray-700 text-white',
  resolved: 'bg-gray-200 text-gray-900',
  rejected: 'bg-gray-300 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUSES = ['all', 'open', 'under_review', 'resolved', 'rejected', 'cancelled'];

const RESOLUTIONS = [
  { value: 'approved', label: 'Удовлетворить (полный возврат)' },
  { value: 'partial', label: 'Частично удовлетворить' },
  { value: 'rejected', label: 'Отклонить' },
];

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Resolve modal state
  const [resolveModal, setResolveModal] = useState<AdminDispute | null>(null);
  const [resolution, setResolution] = useState('approved');
  const [notes, setNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, [statusFilter, page]);

  async function loadDisputes() {
    try {
      setError(null);
      setLoading(true);

      const status = statusFilter === 'all' ? undefined : statusFilter;
      const res: AdminDisputesResponse = await getAdminDisputes(status, limit, page * limit);

      setDisputes(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load disputes:', err);
      setError('Не удалось загрузить споры. Проверьте права администратора.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    if (!resolveModal) return;

    try {
      setResolving(true);
      await resolveDispute(resolveModal.id, resolution, notes || undefined);
      setResolveModal(null);
      setResolution('approved');
      setNotes('');
      loadDisputes();
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
      alert('Не удалось разрешить спор');
    } finally {
      setResolving(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Споры</h1>
          <p className="text-gray-600 mt-1">Всего: {total}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  statusFilter === status
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Все' : DISPUTE_STATUS_LABELS[status] || status}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-900 mb-4">{error}</p>
            <Button onClick={loadDisputes}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
        </div>
      ) : disputes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Нет споров с выбранным статусом
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            STATUS_COLORS[dispute.status] || 'bg-gray-100'
                          }`}
                        >
                          {DISPUTE_STATUS_LABELS[dispute.status] || dispute.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(dispute.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">ID сделки</p>
                          <p className="font-mono text-sm">{dispute.deal_id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Инициатор</p>
                          <p className="font-medium">ID: {dispute.initiator_user_id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Причина</p>
                          <p className="font-medium">
                            {DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Возврат</p>
                          <p className="font-medium">
                            {dispute.refund_requested
                              ? dispute.refund_amount
                                ? formatPrice(dispute.refund_amount)
                                : 'Запрошен'
                              : 'Не запрошен'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {dispute.status === 'open' && (
                      <Button
                        onClick={() => setResolveModal(dispute)}
                        size="sm"
                      >
                        Разрешить
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Показано {page * limit + 1}-{Math.min((page + 1) * limit, total)} из {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Разрешить спор</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Сделка</p>
                  <p className="font-mono text-sm">{resolveModal.deal_id}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Причина спора</p>
                  <p className="font-medium">
                    {DISPUTE_REASON_LABELS[resolveModal.reason] || resolveModal.reason}
                  </p>
                </div>

                {resolveModal.refund_requested && resolveModal.refund_amount && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Запрошен возврат</p>
                    <p className="font-medium">{formatPrice(resolveModal.refund_amount)}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Решение
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Комментарий (опционально)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Описание решения..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setResolveModal(null)}
                    disabled={resolving}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleResolve}
                    disabled={resolving}
                    className="flex-1"
                  >
                    {resolving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
