'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export default function FinancePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Финансы</h1>
        <p className="text-gray-600 mt-1">Финансовая аналитика агентства</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Бухгалтерия</CardTitle>
            <CardDescription>Учет доходов и расходов</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-12">
              Функция бухгалтерии будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Выплаты агентам</CardTitle>
            <CardDescription>История выплат</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-12">
              Функция выплат будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Настройка сплитов</CardTitle>
            <CardDescription>Распределение комиссий</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-12">
              Функция настройки сплитов будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

