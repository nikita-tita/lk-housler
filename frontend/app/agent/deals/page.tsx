'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getDeals, Deal } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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

  const filteredDeals = deals.filter((deal) => {
    if (filter === 'all') return true;
    return deal.status === filter;
  });

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
          <h1 className="text-3xl font-semibold text-gray-900">Сделки</h1>
          <p className="text-gray-600 mt-1">Управление вашими сделками</p>
        </div>
        <Link href="/deals/new">
          <Button>Создать сделку</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2">
            {['all', 'draft', 'awaiting_signatures', 'signed', 'paid', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  filter === status
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Все' : status}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список сделок ({filteredDeals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="mb-4">Сделок не найдено</p>
              <Link href="/deals/new">
                <Button>Создать сделку</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="block p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{deal.address}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Цена: {formatPrice(deal.price)} • Комиссия: {formatPrice(deal.commission_agent)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Создано {formatDate(deal.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
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

