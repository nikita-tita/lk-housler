'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthRedirectProps {
  to: string;
}

/**
 * Клиентский компонент для редиректа авторизованных пользователей.
 * Рендерится невидимым и не блокирует SSR основной страницы.
 */
export function AuthRedirect({ to }: AuthRedirectProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(to);
    }
  }, [isLoading, isAuthenticated, router, to]);

  return null;
}
