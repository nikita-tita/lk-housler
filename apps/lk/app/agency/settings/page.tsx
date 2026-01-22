'use client';

import { useAuth } from '@housler/lib';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@housler/ui';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Настройки</h1>
        <p className="text-gray-600 mt-1">Управление настройками агентства</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Информация об агентстве</CardTitle>
            <CardDescription>Основные данные</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-600">Email администратора</dt>
                <dd className="text-base text-gray-900 mt-1">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Роль</dt>
                <dd className="text-base text-gray-900 mt-1 capitalize">{user?.role}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Реквизиты</CardTitle>
            <CardDescription>Юридические данные агентства</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-12">
              Функция управления реквизитами будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Шаблоны документов</CardTitle>
            <CardDescription>Настройка шаблонов договоров</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-12">
              Функция управления шаблонами будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

