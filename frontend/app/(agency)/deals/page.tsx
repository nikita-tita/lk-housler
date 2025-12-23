'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { getDeals, Deal } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

export default function AgencyDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      const response = await getDeals();
      setDeals(response.items);
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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Все сделки</h1>
        <p className="text-gray-600 mt-1">Сделки всех агентов агентства</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список сделок ({deals.length})</CardTitle>
          <CardDescription>Все сделки агентства</CardDescription>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="text-gray-600 text-center py-12">Нет сделок</p>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-4 border border-gray-300 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{deal.address}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Цена: {formatPrice(deal.price)} • Комиссия: {formatPrice(deal.commission_agent)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(deal.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
                        deal.status === 'closed'
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {deal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

