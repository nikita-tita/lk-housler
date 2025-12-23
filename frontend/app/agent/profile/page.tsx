'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Профиль</h1>
        <p className="text-gray-600 mt-1">Управление вашим профилем</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Ваши основные данные</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-600">ID пользователя</dt>
                <dd className="text-base text-gray-900 mt-1 font-mono text-sm">
                  {user?.id}
                </dd>
              </div>
              {user?.email && (
                <div>
                  <dt className="text-sm text-gray-600">Email</dt>
                  <dd className="text-base text-gray-900 mt-1">{user.email}</dd>
                </div>
              )}
              {user?.phone && (
                <div>
                  <dt className="text-sm text-gray-600">Телефон</dt>
                  <dd className="text-base text-gray-900 mt-1">{user.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-600">Роль</dt>
                <dd className="text-base text-gray-900 mt-1 capitalize">{user?.role}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Статус</dt>
                <dd className="text-base text-gray-900 mt-1 capitalize">
                  {user?.is_active ? 'Активен' : 'Неактивен'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>КYC Верификация</CardTitle>
            <CardDescription>Статус проверки личности</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Функция верификации будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Реквизиты для выплат</CardTitle>
            <CardDescription>Настройка способа получения выплат</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Функция управления реквизитами будет доступна в следующем обновлении
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

