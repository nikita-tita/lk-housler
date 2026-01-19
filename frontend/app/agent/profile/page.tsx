'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Агент',
  agency: 'Агентство',
  client: 'Клиент',
  admin: 'Администратор',
};

function formatPhone(phone: string | undefined): string {
  if (!phone) return '';
  // Format: +7 (999) 123-45-67
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
  }
  return phone;
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Профиль</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Управление вашим профилем</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Ваши основные данные</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 sm:space-y-4">
              <div>
                <dt className="text-xs sm:text-sm text-gray-600">ID пользователя</dt>
                <dd className="text-sm sm:text-base text-gray-900 mt-1 font-mono truncate">
                  {user?.id}
                </dd>
              </div>
              {user?.email && (
                <div>
                  <dt className="text-xs sm:text-sm text-gray-600">Email</dt>
                  <dd className="text-sm sm:text-base text-gray-900 mt-1">{user.email}</dd>
                </div>
              )}
              {user?.phone && (
                <div>
                  <dt className="text-xs sm:text-sm text-gray-600">Телефон</dt>
                  <dd className="text-sm sm:text-base text-gray-900 mt-1">{formatPhone(user.phone)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs sm:text-sm text-gray-600">Роль</dt>
                <dd className="text-sm sm:text-base text-gray-900 mt-1">{ROLE_LABELS[user?.role || ''] || user?.role}</dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm text-gray-600">Статус</dt>
                <dd className="text-sm sm:text-base text-gray-900 mt-1 capitalize">
                  {user?.is_active ? 'Активен' : 'Неактивен'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KYC Верификация</CardTitle>
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

