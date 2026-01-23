'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';
import { Button } from '@housler/ui';
import { getDeals, Deal, DealStatus } from '@housler/lib';
import { formatPrice, formatDate } from '@housler/lib';

const STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  payment_pending: 'Ожидает оплаты',
  in_progress: 'В работе',
  invoiced: 'Счёт создан',
  hold_period: 'Удержание',
  payment_failed: 'Ошибка оплаты',
  payout_ready: 'К выплате',
  payout_in_progress: 'Выплата',
  refunded: 'Возврат',
  closed: 'Закрыта',
  dispute: 'Спор',
  cancelled: 'Отменена',
};

export default function ClientDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      setError(null);
      setLoading(true);

      const response = await getDeals();
      setDeals(response?.items || []);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError('Не удалось загрузить сделки. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-900 mb-4">{error}</p>
            <Button onClick={loadDeals}>Повторить</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Мои сделки</h1>
        <p className="text-gray-600 mt-1">Ваши текущие и завершенные сделки</p>
      </div>

      {deals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">У вас пока нет сделок</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {deals.map((deal) => (
            <Link key={deal.id} href={`/client/dashboard/${deal.id}`}>
              <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{deal.address}</CardTitle>
                      <CardDescription className="mt-2">
                        {formatPrice(deal.price)} • Создано {formatDate(deal.created_at)}
                      </CardDescription>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${deal.status === 'draft'
                        ? 'bg-gray-200 text-gray-900'
                        : deal.status === 'closed'
                          ? 'bg-black text-white'
                          : deal.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-500'
                            : deal.status === 'dispute'
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-900'
                        }`}
                    >
                      {STATUS_LABELS[deal.status] || deal.status}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

