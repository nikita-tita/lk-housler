'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getDeals, Deal, DealStatus } from '@/lib/api/deals';
import { getDashboardSummary, getTimeSeries, DashboardSummary, TimeSeriesPoint, exportAgentSummary, ExportFormat } from '@/lib/api/analytics';
import { ExportButton } from '@/components/shared';
import { formatPrice, formatDate } from '@/lib/utils/format';

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

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-900',
  awaiting_signatures: 'bg-gray-100 text-gray-900',
  signed: 'bg-gray-100 text-gray-900',
  payment_pending: 'bg-gray-100 text-gray-900',
  in_progress: 'bg-gray-100 text-gray-900',
  invoiced: 'bg-gray-100 text-gray-900',
  hold_period: 'bg-gray-100 text-gray-900',
  payment_failed: 'bg-gray-300 text-gray-900',
  payout_ready: 'bg-gray-900 text-white',
  payout_in_progress: 'bg-gray-800 text-white',
  refunded: 'bg-gray-300 text-gray-900',
  closed: 'bg-black text-white',
  dispute: 'bg-gray-300 text-gray-900',
  cancelled: 'bg-gray-200 text-gray-600',
};

export default function AgentDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setError(null);
      setLoading(true);

      const [dealsRes, dashboardRes, timeSeriesRes] = await Promise.all([
        getDeals(1, 10),
        getDashboardSummary().catch(() => null),
        getTimeSeries(30).catch(() => []),
      ]);

      setDeals(dealsRes.items);
      setDashboard(dashboardRes);
      setTimeSeries(timeSeriesRes);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Не удалось загрузить данные. Попробуйте обновить страницу.');
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-900 mb-4">{error}</p>
              <Button onClick={loadData}>Повторить</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getDealLink = (deal: { id: string; deal_type?: 'legacy' | 'bank_split' }) => {
    // Default to bank_split if no type specified (dashboard returns bank-split deals)
    if (deal.deal_type === 'legacy') {
      return `/agent/deals/${deal.id}`;
    }
    return `/agent/deals/bank-split/${deal.id}`;
  };

  const stats = dashboard?.month_stats || {
    total_deals: deals.filter(d => d.status === 'closed').length,
    total_commission: deals.filter(d => d.status === 'closed').reduce((s, d) => s + d.commission_agent, 0),
    deals_by_status: {},
  };

  const payoutStats = dashboard?.payouts || {
    total_pending: 0,
    total_paid: 0,
  };

  const recentDeals = dashboard?.recent_deals || deals.slice(0, 5).map(d => ({
    id: d.id,
    property_address: d.address,
    status: d.status,
    commission: d.commission_agent,
    created_at: d.created_at,
  }));

  const inProgressCount = deals.filter(
    d => ['awaiting_signatures', 'signed', 'in_progress', 'hold_period', 'payment_pending'].includes(d.status)
  ).length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Главная</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Обзор за текущий месяц</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <ExportButton
            label="Экспорт"
            onExport={(format: ExportFormat) => exportAgentSummary(format)}
          />
          <Link href="/agent/deals/new">
            <Button size="sm">Создать сделку</Button>
          </Link>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Всего сделок</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{stats.total_deals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">В работе</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{inProgressCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">К выплате</CardDescription>
            <CardTitle className="text-xl sm:text-4xl">{formatPrice(payoutStats.total_pending)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Заработано</CardDescription>
            <CardTitle className="text-xl sm:text-4xl">{formatPrice(payoutStats.total_paid + stats.total_commission)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Chart placeholder */}
      {timeSeries.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Динамика за 30 дней</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between gap-1">
              {timeSeries.slice(-14).map((point, i) => {
                const maxCommission = Math.max(...timeSeries.map(p => p.commission), 1);
                const height = (point.commission / maxCommission) * 100;
                return (
                  <div
                    key={point.date}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full bg-gray-900 rounded-t"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${point.date}: ${formatPrice(point.commission)}`}
                    />
                    {i % 2 === 0 && (
                      <span className="text-xs text-gray-500 mt-2">
                        {point.date.slice(8, 10)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status breakdown */}
      {Object.keys(stats.deals_by_status || {}).length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>По статусам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.deals_by_status).map(([status, count]) => (
                <div
                  key={status}
                  className={`px-4 py-2 rounded-lg ${STATUS_COLORS[status] || 'bg-gray-100'}`}
                >
                  <span className="font-medium">{count}</span>
                  <span className="ml-2 text-sm opacity-80">
                    {STATUS_LABELS[status as DealStatus] || status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent deals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Последние сделки</CardTitle>
            <CardDescription>Ваши недавние сделки</CardDescription>
          </div>
          <Link href="/agent/deals">
            <Button variant="secondary" size="sm">Все сделки</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="mb-4">У вас пока нет сделок</p>
              <Link href="/agent/deals/new">
                <Button>Создать первую сделку</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeals.map((deal) => (
                <Link
                  key={deal.id}
                  href={getDealLink(deal)}
                  className="block p-3 sm:p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {deal.property_address || 'Без адреса'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        {formatPrice(deal.commission)} • {formatDate(deal.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full self-start sm:self-center whitespace-nowrap ${
                        STATUS_COLORS[deal.status] || 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {STATUS_LABELS[deal.status as DealStatus] || deal.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
