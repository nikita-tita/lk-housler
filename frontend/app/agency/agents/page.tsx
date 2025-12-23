'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AgentsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Агенты</h1>
          <p className="text-gray-600 mt-1">Управление агентами агентства</p>
        </div>
        <Button>Добавить агента</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список агентов</CardTitle>
          <CardDescription>Все агенты вашего агентства</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center py-12">
            Функция управления агентами будет доступна в следующем обновлении
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

