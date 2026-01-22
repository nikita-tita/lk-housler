'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '@/types/user';
import { getDashboardPath } from '../utils/redirect';

/**
 * Хук для доступа к данным авторизации.
 * НЕ вызывает checkAuth() - используйте только внутри защищённых роутов,
 * где layout уже вызвал useRequireAuth().
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, logout, updateUser } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    updateUser,
  };
}

/**
 * Хук для защищённых роутов (layouts).
 * Вызывает checkAuth() и делает редирект если не авторизован.
 */
export function useRequireAuth(requiredRole?: UserRole) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Редирект на правильный dashboard если роль не совпадает
    if (requiredRole && user?.role !== requiredRole) {
      const correctPath = getDashboardPath(user?.role || 'client');
      router.push(correctPath);
    }
  }, [isAuthenticated, isLoading, user, requiredRole, router]);

  return { user, isAuthenticated, isLoading };
}

