'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { getDeals, Deal } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

export default function ClientDashboard() {
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
            <Link key={deal.id} href={`/client/deals/${deal.id}`}>
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
                      className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
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
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

