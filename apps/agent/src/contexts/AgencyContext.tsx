'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';

export interface Agency {
  id: number;
  name: string;
  slug: string;
  is_default: boolean;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
}

interface AgencyContextValue {
  // Текущее агентство (из URL или ref)
  currentAgency: Agency | null;
  setCurrentAgency: (agency: Agency | null) => void;

  // Slug текущего агентства (сохраняется в cookie)
  agencySlug: string | null;
  setAgencySlug: (slug: string | null) => void;

  // Привязка к агентству (после авторизации)
  linkToAgency: (slug: string, source?: string) => Promise<boolean>;

  // Загрузка
  isLoading: boolean;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

const AGENCY_SLUG_KEY = 'housler_agency_slug';
const AGENCY_REF_KEY = 'housler_agency_ref';

function getStoredAgencySlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AGENCY_SLUG_KEY);
}

function setStoredAgencySlug(slug: string | null): void {
  if (typeof window === 'undefined') return;
  if (slug) {
    localStorage.setItem(AGENCY_SLUG_KEY, slug);
  } else {
    localStorage.removeItem(AGENCY_SLUG_KEY);
  }
}

// Хранение ref из URL (для привязки после авторизации)
export function setAgencyRef(ref: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AGENCY_REF_KEY, ref);
}

export function getAgencyRef(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AGENCY_REF_KEY);
}

export function clearAgencyRef(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AGENCY_REF_KEY);
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [currentAgency, setCurrentAgency] = useState<Agency | null>(null);
  const [agencySlug, setAgencySlugState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Инициализация из localStorage
  useEffect(() => {
    const loadAgency = async () => {
      const storedSlug = getStoredAgencySlug();

      if (storedSlug) {
        try {
          const response = await api.getAgencyBySlug(storedSlug);
          if (response.success && response.data) {
            setCurrentAgency(response.data);
            setAgencySlugState(storedSlug);
          }
        } catch (error) {
          // Игнорируем ошибку если API agencies не доступен
          console.warn('Agency API not available:', error);
        }
      }

      setIsLoading(false);
    };

    loadAgency();
  }, []);

  const setAgencySlug = useCallback(async (slug: string | null) => {
    setAgencySlugState(slug);
    setStoredAgencySlug(slug);

    if (slug) {
      try {
        const response = await api.getAgencyBySlug(slug);
        if (response.success && response.data) {
          setCurrentAgency(response.data);
        }
      } catch (error) {
        console.warn('Agency API not available:', error);
      }
    } else {
      setCurrentAgency(null);
    }
  }, []);

  const linkToAgency = useCallback(async (slug: string, source: string = 'direct'): Promise<boolean> => {
    try {
      const response = await api.linkToAgency(slug, source);
      if (response.success) {
        // Обновляем текущее агентство
        await setAgencySlug(slug);
        // Очищаем ref
        clearAgencyRef();
        return true;
      }
    } catch (error) {
      console.error('Error linking to agency:', error);
    }
    return false;
  }, [setAgencySlug]);

  return (
    <AgencyContext.Provider
      value={{
        currentAgency,
        setCurrentAgency,
        agencySlug,
        setAgencySlug,
        linkToAgency,
        isLoading,
      }}
    >
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const context = useContext(AgencyContext);
  if (!context) {
    throw new Error('useAgency must be used within AgencyProvider');
  }
  return context;
}
