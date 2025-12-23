'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { getDeal, Deal } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

export default function ClientDealDetailPage() {
  const params = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadDeal(params.id as string);
    }
  }, [params.id]);

  async function loadDeal(id: string) {
    try {
      const data = await getDeal(id);
      setDeal(data);
    } catch (error) {
      console.error('Failed to load deal:', error);
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

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Сделка не найдена</p>
        <Link href="/dashboard">
          <Button>Вернуться к списку</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-gray-600 hover:text-black text-sm">
          ← Назад к списку
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{deal.address}</h1>
          <p className="text-gray-600 mt-1">
            Создано {formatDate(deal.created_at)}
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-lg ${
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Информация о сделке</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-600">Адрес</dt>
                <dd className="text-base text-gray-900 mt-1">{deal.address}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Цена</dt>
                <dd className="text-base text-gray-900 mt-1 font-semibold">
                  {formatPrice(deal.price)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Статус</dt>
                <dd className="text-base text-gray-900 mt-1 capitalize">{deal.status}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Документы</CardTitle>
            <CardDescription>Документы для подписания</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Функция работы с документами будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Платежи</CardTitle>
            <CardDescription>Информация об оплате</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Функция оплаты будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

