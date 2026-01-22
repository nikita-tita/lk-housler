'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setAgencyRef, getAgencyRef } from '@/contexts/AgencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

/**
 * Компонент для отслеживания ref-параметра в URL
 * При наличии ?ref=AGENCY_SLUG:
 * 1. Сохраняет slug в localStorage (через setAgencyRef)
 * 2. После авторизации — привязывает пользователя к агентству
 */
export function AgencyRefTracker() {
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();

  // 1. Сохраняем ref из URL в localStorage
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setAgencyRef(ref);
    }
  }, [searchParams]);

  // 2. После авторизации — привязываем к агентству
  useEffect(() => {
    const linkToSavedAgency = async () => {
      if (!isAuthenticated || !user) return;

      const savedRef = getAgencyRef();
      if (!savedRef) return;

      // Только для клиентов
      if (user.role !== 'client') return;

      try {
        const response = await api.linkToAgency(savedRef, 'referral');
        if (response.success) {
          // Очищаем сохранённый ref
          localStorage.removeItem('housler_agency_ref');
        }
      } catch (error) {
        // Игнорируем если API не доступен
        console.warn('Agency link API not available:', error);
      }
    };

    linkToSavedAgency();
  }, [isAuthenticated, user]);

  return null; // Компонент не рендерит ничего
}
