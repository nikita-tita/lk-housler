'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FilterOptions } from '@/types';

interface UseFilterOptionsResult {
  filterOptions: FilterOptions | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Кэш для хранения загруженных данных между компонентами
let cachedFilterOptions: FilterOptions | null = null;
let cachePromise: Promise<FilterOptions | null> | null = null;

/**
 * Хук для загрузки опций фильтров.
 * Использует кэширование, чтобы избежать дублирующих запросов.
 */
export function useFilterOptions(): UseFilterOptionsResult {
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(cachedFilterOptions);
  const [isLoading, setIsLoading] = useState(!cachedFilterOptions);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    // Если уже есть кэш, используем его
    if (cachedFilterOptions) {
      setFilterOptions(cachedFilterOptions);
      setIsLoading(false);
      return;
    }

    // Если уже есть запрос в процессе, ждём его
    if (cachePromise) {
      try {
        const result = await cachePromise;
        setFilterOptions(result);
        setIsLoading(false);
      } catch {
        setError('Ошибка загрузки фильтров');
        setIsLoading(false);
      }
      return;
    }

    // Создаём новый запрос
    setIsLoading(true);
    setError(null);

    cachePromise = api.getFilters()
      .then(res => {
        if (res.success && res.data) {
          cachedFilterOptions = res.data;
          return res.data;
        }
        return null;
      })
      .catch(() => {
        return null;
      })
      .finally(() => {
        cachePromise = null;
      });

    try {
      const result = await cachePromise;
      setFilterOptions(result);
      if (!result) {
        setError('Не удалось загрузить фильтры');
      }
    } catch {
      setError('Ошибка загрузки фильтров');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    cachedFilterOptions = null;
    cachePromise = null;
    await loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  return {
    filterOptions,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Сбросить кэш фильтров (например, при логауте или смене региона)
 */
export function clearFilterOptionsCache(): void {
  cachedFilterOptions = null;
  cachePromise = null;
}
