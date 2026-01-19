'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getDeals, Deal } from '@/lib/api/deals';
import { formatPrice } from '@/lib/utils/format';

export default function AgencyDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeDeals: 0,
    completedDeals: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setError(null);
      setLoading(true);

      const response = await getDeals();
      setDeals(response.items);

      const activeDeals = response.items.filter(
        (d) => d.status !== 'closed' && d.status !== 'cancelled'
      ).length;
      const completedDeals = response.items.filter(
        (d) => d.status === 'closed'
      ).length;
      const totalRevenue = response.items
        .filter((d) => d.status === 'closed')
        .reduce((sum, d) => sum + d.commission_agent, 0);

      setStats({
        totalAgents: 0,
        activeDeals,
        completedDeals,
        totalRevenue,
      });
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Главная</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Обзор деятельности вашего агентства</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Агенты</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{stats.totalAgents}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Активные сделки</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{stats.activeDeals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Завершено</CardDescription>
            <CardTitle className="text-2xl sm:text-4xl">{stats.completedDeals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Выручка</CardDescription>
            <CardTitle className="text-xl sm:text-3xl">{formatPrice(stats.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Топ агенты</CardTitle>
            <CardDescription>По количеству закрытых сделок</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-8">
              Данные будут доступны после добавления агентов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние сделки</CardTitle>
            <CardDescription>Недавние сделки агентства</CardDescription>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="text-gray-600 text-center py-8">Нет сделок</p>
            ) : (
              <div className="space-y-3">
                {deals.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="p-3 border border-gray-200 rounded-lg">
                    <p className="font-medium text-sm">{deal.address}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatPrice(deal.price)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

