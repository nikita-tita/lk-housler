'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getDeals, Deal } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

export default function AgentDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState({
    inProgress: 0,
    completed: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await getDeals(1, 10);
      setDeals(response.items);

      const inProgress = response.items.filter(
        (d) => d.status === 'awaiting_signatures' || d.status === 'signed'
      ).length;
      const completed = response.items.filter((d) => d.status === 'paid' || d.status === 'closed').length;
      const totalRevenue = response.items
        .filter((d) => d.status === 'paid' || d.status === 'closed')
        .reduce((sum, d) => sum + d.commission_agent, 0);

      setStats({ inProgress, completed, totalRevenue });
    } catch (error) {
      console.error('Failed to load deals:', error);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Главная</h1>
          <p className="text-gray-600 mt-1">Обзор ваших сделок</p>
        </div>
        <Link href="/deals/new">
          <Button>Создать сделку</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardDescription>В работе</CardDescription>
            <CardTitle className="text-4xl">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Завершено</CardDescription>
            <CardTitle className="text-4xl">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Заработано</CardDescription>
            <CardTitle className="text-4xl">{formatPrice(stats.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние сделки</CardTitle>
          <CardDescription>Ваши недавние сделки</CardDescription>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="mb-4">У вас пока нет сделок</p>
              <Link href="/deals/new">
                <Button>Создать первую сделку</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="block p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{deal.address}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatPrice(deal.price)} • Создано {formatDate(deal.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
                        deal.status === 'draft'
                          ? 'bg-gray-200 text-gray-900'
                          : deal.status === 'closed'
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {deal.status}
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

