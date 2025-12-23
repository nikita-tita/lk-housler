'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { createDeal, DealCreate } from '@/lib/api/deals';

export default function CreateDealPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<DealCreate>({
    type: 'resale_sale',
    address: '',
    price: 0,
    commission_agent: 0,
    commission_split_percent: 60,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deal = await createDeal(formData);
      router.push(`/deals/${deal.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания сделки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/deals" className="text-gray-600 hover:text-black text-sm">
          ← Назад к списку
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Создать сделку</h1>
        <p className="text-gray-600 mt-1">Заполните данные новой сделки</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о сделке</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Тип сделки
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as DealCreate['type'],
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                required
              >
                <option value="resale_sale">Продажа вторички</option>
                <option value="resale_purchase">Покупка вторички</option>
                <option value="newbuild_booking">Бронирование новостройки</option>
              </select>
            </div>

            <Input
              label="Адрес объекта"
              placeholder="г. Москва, ул. Примерная, д. 1, кв. 1"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />

            <Input
              label="Цена объекта (₽)"
              type="number"
              placeholder="5000000"
              value={formData.price || ''}
              onChange={(e) =>
                setFormData({ ...formData, price: Number(e.target.value) })
              }
              required
            />

            <Input
              label="Комиссия агента (₽)"
              type="number"
              placeholder="150000"
              value={formData.commission_agent || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commission_agent: Number(e.target.value),
                })
              }
              required
            />

            <Input
              label="Процент агента от комиссии (%)"
              type="number"
              placeholder="60"
              value={formData.commission_split_percent || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commission_split_percent: Number(e.target.value),
                })
              }
              helperText="Сколько процентов от комиссии получит агент"
            />

            {error && (
              <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-900">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" loading={loading} fullWidth>
                Создать сделку
              </Button>
              <Link href="/deals" className="flex-1">
                <Button type="button" variant="secondary" fullWidth>
                  Отмена
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

