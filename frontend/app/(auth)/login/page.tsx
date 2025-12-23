'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
          LK Housler
        </h1>
        <p className="text-gray-600">
          Выберите способ входа
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link href="agent">
          <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardHeader>
              <CardTitle>Я агент</CardTitle>
              <CardDescription>
                Вход через SMS для частных риелторов
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="client">
          <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardHeader>
              <CardTitle>Я клиент</CardTitle>
              <CardDescription>
                Вход через Email для покупателей и продавцов
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="agency">
          <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardHeader>
              <CardTitle>Я из агентства</CardTitle>
              <CardDescription>
                Вход через Email и пароль для сотрудников
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}

