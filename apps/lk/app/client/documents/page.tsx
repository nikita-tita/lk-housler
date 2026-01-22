'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';

export default function ClientDocumentsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Документы</h1>
        <p className="text-gray-600 mt-1">Ваши документы и подписи</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список документов</CardTitle>
          <CardDescription>Документы по вашим сделкам</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center py-12">
            Функция работы с документами будет доступна в следующем обновлении
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

