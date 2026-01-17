'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getDeals, Deal, DealStatus } from '@/lib/api/deals';
import { getDashboardSummary, getTimeSeries, DashboardSummary, TimeSeriesPoint } from '@/lib/api/analytics';
import { formatPrice, formatDate } from '@/lib/utils/format';

const STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  payment_pending: 'Ожидает оплаты',
  in_progress: 'В работе',
  hold_period: 'Удержание',
  payout_ready: 'К выплате',
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
  hold_period: 'bg-gray-100 text-gray-900',
  payout_ready: 'bg-gray-900 text-white',
  closed: 'bg-black text-white',
  dispute: 'bg-gray-300 text-gray-900',
  cancelled: 'bg-gray-200 text-gray-600',
};

export default function AgentDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'bank-split'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [dealsRes, dashboardRes, timeSeriesRes] = await Promise.all([
        getDeals(1, 10),
        getDashboardSummary().catch(() => null),
        getTimeSeries(30).catch(() => []),
      ]);

      setDeals(dealsRes.items);
      setDashboard(dashboardRes);
      setTimeSeries(timeSeriesRes);
    } catch (error) {
      console.error('Failed to load data:', error);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Обзор за текущий месяц</p>
        </div>
        <div className="flex gap-3">
          <Link href="/agent/deals/bank-split/new">
            <Button variant="outline">Bank-Split сделка</Button>
          </Link>
          <Link href="/agent/deals/new">
            <Button>Создать сделку</Button>
          </Link>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardDescription>Всего сделок</CardDescription>
            <CardTitle className="text-4xl">{stats.total_deals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>В работе</CardDescription>
            <CardTitle className="text-4xl">{inProgressCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>К выплате</CardDescription>
            <CardTitle className="text-4xl">{formatPrice(payoutStats.total_pending)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Заработано</CardDescription>
            <CardTitle className="text-4xl">{formatPrice(payoutStats.total_paid + stats.total_commission)}</CardTitle>
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
            <Button variant="outline" size="sm">Все сделки</Button>
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
                  href={`/agent/deals/bank-split/${deal.id}`}
                  className="block p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {deal.property_address || 'Без адреса'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatPrice(deal.commission)} • {formatDate(deal.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
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
