'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';
import { Button } from '@housler/ui';
import {
  getGlobalAnalytics,
  getLeaderboard,
  getAdminDeals,
  getAdminDisputes,
  exportSummary,
  GlobalAnalytics,
  LeaderboardEntry,
  AdminDeal,
  AdminDispute,
  DEAL_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  ExportFormat,
} from '@housler/lib';
import { ExportButton } from '@/components/shared/ExportButton';
import { formatPrice, formatDate } from '@housler/lib';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-900',
  awaiting_signatures: 'bg-gray-100 text-gray-900',
  signed: 'bg-gray-100 text-gray-900',
  payment_pending: 'bg-gray-100 text-gray-900',
  hold_period: 'bg-gray-100 text-gray-900',
  payout_ready: 'bg-gray-900 text-white',
  closed: 'bg-black text-white',
  dispute: 'bg-gray-300 text-gray-900',
  cancelled: 'bg-gray-200 text-gray-600',
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-900 text-white',
  under_review: 'bg-gray-700 text-white',
  resolved: 'bg-gray-200 text-gray-900',
  rejected: 'bg-gray-300 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<GlobalAnalytics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentDeals, setRecentDeals] = useState<AdminDeal[]>([]);
  const [openDisputes, setOpenDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setError(null);
      setLoading(true);

      const [analyticsRes, leaderboardRes, dealsRes, disputesRes] = await Promise.all([
        getGlobalAnalytics().catch(() => null),
        getLeaderboard(5).catch(() => []),
        getAdminDeals(undefined, 5).catch(() => ({ items: [], total: 0, limit: 5, offset: 0 })),
        getAdminDisputes('open', 5).catch(() => ({ items: [], total: 0, limit: 5, offset: 0 })),
      ]);

      setAnalytics(analyticsRes);
      setLeaderboard(leaderboardRes);
      setRecentDeals(dealsRes.items);
      setOpenDisputes(disputesRes.items);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setError('Не удалось загрузить данные. Проверьте права администратора.');
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

  const dealStats = analytics?.deals || {
    total: 0,
    by_status: {},
    total_commission: 0,
    avg_commission: 0,
  };

  const payoutStats = analytics?.payouts || {
    total_paid: 0,
    pending_count: 0,
    pending_amount: 0,
  };

  const disputeStats = analytics?.disputes || {
    total: 0,
    open: 0,
    resolved: 0,
    refund_total: 0,
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Админ-панель</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Общая статистика платформы</p>
        </div>
        <ExportButton
          label="Экспорт отчёта"
          onExport={(format: ExportFormat) => exportSummary(format)}
        />
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Всего сделок</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{dealStats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Общий оборот</CardDescription>
            <CardTitle className="text-xl sm:text-4xl">{formatPrice(dealStats.total_commission)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">К выплате</CardDescription>
            <CardTitle className="text-xl sm:text-4xl">{formatPrice(payoutStats.pending_amount)}</CardTitle>
            <p className="text-xs sm:text-sm text-gray-500">{payoutStats.pending_count} получателей</p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Открытых споров</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{disputeStats.open}</CardTitle>
            <p className="text-xs sm:text-sm text-gray-500">из {disputeStats.total} всего</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
        {/* Status breakdown */}
        {Object.keys(dealStats.by_status || {}).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Сделки по статусам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dealStats.by_status).map(([status, count]) => (
                  <div
                    key={status}
                    className={`px-3 py-1.5 rounded-lg text-sm ${STATUS_COLORS[status] || 'bg-gray-100'}`}
                  >
                    <span className="font-medium">{count as number}</span>
                    <span className="ml-1.5 opacity-80">
                      {DEAL_STATUS_LABELS[status] || status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Топ агентов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((agent, i) => (
                  <div
                    key={agent.user_id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-900 text-white rounded-full text-sm font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{agent.user_name || `ID: ${agent.user_id}`}</p>
                        <p className="text-sm text-gray-500">{agent.deals_count} сделок</p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatPrice(agent.total_commission)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Recent deals */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">Последние сделки</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Недавно созданные</CardDescription>
            </div>
            <Link href="/admin/deals">
              <Button variant="secondary" size="sm">Все сделки</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentDeals.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Нет сделок</p>
            ) : (
              <div className="space-y-3">
                {recentDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {deal.property_address || 'Без адреса'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {formatPrice(deal.commission)} | {formatDate(deal.created_at)}
                        </p>
                      </div>
                      <span
                        className={`self-start sm:self-center px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          STATUS_COLORS[deal.status] || 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {DEAL_STATUS_LABELS[deal.status] || deal.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open disputes */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">Открытые споры</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Требуют внимания</CardDescription>
            </div>
            <Link href="/admin/disputes">
              <Button variant="secondary" size="sm">Все споры</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {openDisputes.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Нет открытых споров</p>
            ) : (
              <div className="space-y-3">
                {openDisputes.map((dispute) => (
                  <Link
                    key={dispute.id}
                    href={`/admin/disputes?id=${dispute.id}`}
                    className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          Сделка: {dispute.deal_id.slice(0, 8)}...
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {dispute.refund_requested && dispute.refund_amount
                            ? `Возврат: ${formatPrice(dispute.refund_amount)}`
                            : 'Без возврата'}
                        </p>
                      </div>
                      <span
                        className={`self-start sm:self-center px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          DISPUTE_STATUS_COLORS[dispute.status] || 'bg-gray-100'
                        }`}
                      >
                        {DISPUTE_STATUS_LABELS[dispute.status] || dispute.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
