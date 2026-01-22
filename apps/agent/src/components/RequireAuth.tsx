'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'client' | 'agent' | 'admin';

interface RequireAuthProps {
  children: ReactNode;
  /** Разрешённые роли. Если не указано — разрешены все авторизованные */
  allowedRoles?: UserRole[];
  /** Кастомный loading skeleton */
  fallback?: ReactNode;
  /** URL для редиректа неавторизованных (по умолчанию /login) */
  redirectTo?: string;
}

/**
 * Компонент защиты маршрутов.
 *
 * Решает проблему race condition между проверкой авторизации и рендером:
 * - Никогда НЕ возвращает null (предотвращает DOM mismatch)
 * - Использует replace вместо push (нет дублирования в history)
 * - Единственная точка проверки (нет двойной логики useEffect + return null)
 * - Редирект происходит ТОЛЬКО после завершения загрузки auth
 *
 * Использование:
 * ```tsx
 * <RequireAuth allowedRoles={['agent', 'admin']}>
 *   <ProtectedContent />
 * </RequireAuth>
 * ```
 */
export function RequireAuth({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/login'
}: RequireAuthProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const hasRedirected = useRef(false);

  // Проверяем роль пользователя
  const hasRequiredRole = !allowedRoles || (user?.role && allowedRoles.includes(user.role as UserRole));
  const shouldRedirect = !isLoading && (!isAuthenticated || !hasRequiredRole);

  useEffect(() => {
    // Редиректим только один раз и только после завершения загрузки
    if (shouldRedirect && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(redirectTo);
    }
  }, [shouldRedirect, router, redirectTo]);

  // Показываем loading пока идёт проверка авторизации
  if (isLoading) {
    return fallback ?? <DefaultLoadingSkeleton />;
  }

  // Если нужен редирект — показываем loading (НЕ null!)
  // Это предотвращает race condition и DOM mismatch
  if (shouldRedirect) {
    return fallback ?? <DefaultLoadingSkeleton />;
  }

  // Всё OK — показываем контент
  return <>{children}</>;
}

/**
 * Дефолтный loading skeleton.
 * Используется если не передан кастомный fallback.
 */
function DefaultLoadingSkeleton() {
  return (
    <div className="section">
      <div className="container">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="h-10 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
