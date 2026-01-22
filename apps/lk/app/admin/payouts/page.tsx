'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@housler/ui';
import { Button } from '@housler/ui';
import {
  getPendingPayouts,
  markPayoutPaid,
  exportPayouts,
  PendingPayout,
  PendingPayoutsResponse,
  ROLE_LABELS,
  ExportFormat,
} from '@housler/lib';
import { ExportButton } from '@/components/shared';
import { formatPrice, formatDate } from '@housler/lib';

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    loadPayouts();
  }, [page]);

  async function loadPayouts() {
    try {
      setError(null);
      setLoading(true);

      const res: PendingPayoutsResponse = await getPendingPayouts(limit, page * limit);

      setPayouts(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load payouts:', err);
      setError('Не удалось загрузить выплаты. Проверьте права администратора.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid(payoutId: string) {
    if (!confirm('Отметить выплату как выполненную?')) return;

    try {
      setProcessingId(payoutId);
      await markPayoutPaid(payoutId);
      loadPayouts();
    } catch (err) {
      console.error('Failed to mark payout as paid:', err);
      alert('Не удалось отметить выплату');
    } finally {
      setProcessingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Выплаты</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Ожидают выплаты: {total}</p>
        </div>
        <ExportButton
          label="Экспорт"
          onExport={(format: ExportFormat) => exportPayouts(format)}
        />
      </div>

      {/* Summary */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-4 sm:pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Общая сумма к выплате</p>
              <p className="text-lg sm:text-2xl font-semibold">{formatPrice(totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-500">Получателей</p>
              <p className="text-lg sm:text-2xl font-semibold">{total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-900 mb-4">{error}</p>
            <Button onClick={loadPayouts}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Нет ожидающих выплат
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 font-medium text-gray-600">ID сделки</th>
                    <th className="text-left p-4 font-medium text-gray-600">Получатель</th>
                    <th className="text-left p-4 font-medium text-gray-600">Роль</th>
                    <th className="text-left p-4 font-medium text-gray-600">ИНН</th>
                    <th className="text-right p-4 font-medium text-gray-600">Сумма</th>
                    <th className="text-left p-4 font-medium text-gray-600">Дата</th>
                    <th className="text-right p-4 font-medium text-gray-600">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-mono text-sm text-gray-700">
                          {payout.deal_id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">ID: {payout.user_id}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {ROLE_LABELS[payout.role] || payout.role}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-sm">
                        {payout.inn || '-'}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {formatPrice(payout.amount)}
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        {formatDate(payout.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleMarkPaid(payout.id)}
                          disabled={processingId === payout.id}
                        >
                          {processingId === payout.id ? '...' : 'Выплачено'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 sm:mt-6">
              <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Показано {page * limit + 1}-{Math.min((page + 1) * limit, total)} из {total}
              </p>
              <div className="flex gap-2 justify-center sm:justify-end">
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
