'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const MAX_COMPARE_ITEMS = 4;
const COMPARE_STORAGE_KEY = 'housler_compare';

interface CompareContextValue {
  compareIds: Set<number>;
  addToCompare: (offerId: number) => boolean;
  removeFromCompare: (offerId: number) => void;
  clearCompare: () => void;
  isInCompare: (offerId: number) => boolean;
  canAddMore: boolean;
  count: number;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  // Lazy initialization to avoid setState in useEffect
  const [compareIds, setCompareIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          return new Set(ids.slice(0, MAX_COMPARE_ITEMS));
        }
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  // Сохранение в localStorage
  useEffect(() => {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([...compareIds]));
  }, [compareIds]);

  const addToCompare = useCallback((offerId: number): boolean => {
    if (compareIds.size >= MAX_COMPARE_ITEMS) {
      return false;
    }
    setCompareIds(prev => new Set([...prev, offerId]));
    return true;
  }, [compareIds.size]);

  const removeFromCompare = useCallback((offerId: number) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      next.delete(offerId);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds(new Set());
  }, []);

  const isInCompare = useCallback((offerId: number): boolean => {
    return compareIds.has(offerId);
  }, [compareIds]);

  return (
    <CompareContext.Provider
      value={{
        compareIds,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        canAddMore: compareIds.size < MAX_COMPARE_ITEMS,
        count: compareIds.size,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within CompareProvider');
  }
  return context;
}
