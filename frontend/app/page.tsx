'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { getDashboardPath } from '@/lib/utils/redirect';

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        router.push(getDashboardPath(user.role));
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Show loading spinner while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-gray)]">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-sm text-[var(--color-text-light)]">Загрузка...</p>
      </div>
    </div>
  );
}
