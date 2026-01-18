'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getAdminDeals,
  AdminDeal,
  AdminDealsResponse,
  DEAL_STATUS_LABELS,
} from '@/lib/api/admin';
import { formatPrice, formatDate } from '@/lib/utils/format';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-900',
  awaiting_signatures: 'bg-gray-100 text-gray-900',
  signed: 'bg-gray-100 text-gray-900',
  payment_pending: 'bg-gray-100 text-gray-900',
  invoiced: 'bg-gray-100 text-gray-900',
  hold_period: 'bg-gray-300 text-gray-900',
  payment_failed: 'bg-gray-300 text-gray-900',
  payout_ready: 'bg-gray-900 text-white',
  payout_in_progress: 'bg-gray-800 text-white',
  closed: 'bg-black text-white',
  dispute: 'bg-gray-700 text-white',
  cancelled: 'bg-gray-200 text-gray-600',
  refunded: 'bg-gray-300 text-gray-700',
};

const STATUSES = [
  'all',
  'draft',
  'awaiting_signatures',
  'signed',
  'invoiced',
  'payment_pending',
  'hold_period',
  'payout_ready',
  'closed',
  'cancelled',
  'dispute',
];

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadDeals();
  }, [statusFilter, page]);

  async function loadDeals() {
    try {
      setError(null);
      setLoading(true);

      const status = statusFilter === 'all' ? undefined : statusFilter;
      const res: AdminDealsResponse = await getAdminDeals(status, limit, page * limit);

      setDeals(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError('Не удалось загрузить сделки. Проверьте права администратора.');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Сделки</h1>
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
                {status === 'all' ? 'Все' : DEAL_STATUS_LABELS[status] || status}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-900 mb-4">{error}</p>
            <Button onClick={loadDeals}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
        </div>
      ) : deals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Нет сделок с выбранным статусом
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 font-medium text-gray-600">Адрес</th>
                    <th className="text-left p-4 font-medium text-gray-600">Клиент</th>
                    <th className="text-left p-4 font-medium text-gray-600">Агент ID</th>
                    <th className="text-right p-4 font-medium text-gray-600">Комиссия</th>
                    <th className="text-left p-4 font-medium text-gray-600">Статус</th>
                    <th className="text-left p-4 font-medium text-gray-600">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-medium text-gray-900 truncate block max-w-[250px]">
                          {deal.property_address || 'Без адреса'}
                        </span>
                        <span className="text-xs text-gray-500">{deal.id.slice(0, 8)}...</span>
                      </td>
                      <td className="p-4 text-gray-700">
                        {deal.client_name || '-'}
                      </td>
                      <td className="p-4 text-gray-700">
                        {deal.agent_user_id}
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatPrice(deal.commission)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full ${
                            STATUS_COLORS[deal.status] || 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {DEAL_STATUS_LABELS[deal.status] || deal.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        {formatDate(deal.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

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
    </div>
  );
}
