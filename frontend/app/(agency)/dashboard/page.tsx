'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await getDeals();
      setDeals(response.items);

      const activeDeals = response.items.filter(
        (d) => d.status !== 'closed' && d.status !== 'cancelled'
      ).length;
      const completedDeals = response.items.filter(
        (d) => d.status === 'closed'
      ).length;
      const totalRevenue = response.items
        .filter((d) => d.status === 'paid' || d.status === 'closed')
        .reduce((sum, d) => sum + d.commission_agent, 0);

      setStats({
        totalAgents: 0, 
        activeDeals,
        completedDeals,
        totalRevenue,
      });
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard агентства</h1>
        <p className="text-gray-600 mt-1">Обзор деятельности вашего агентства</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardDescription>Агенты</CardDescription>
            <CardTitle className="text-4xl">{stats.totalAgents}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Активные сделки</CardDescription>
            <CardTitle className="text-4xl">{stats.activeDeals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Завершено</CardDescription>
            <CardTitle className="text-4xl">{stats.completedDeals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Выручка</CardDescription>
            <CardTitle className="text-3xl">{formatPrice(stats.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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

