'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const GUEST_FAVORITES_KEY = 'housler_guest_favorites';

interface GuestFavoritesContextType {
  favoriteIds: Set<number>;
  toggleFavorite: (offerId: number) => void;
  isFavorite: (offerId: number) => boolean;
  favoritesCount: number;
  clearFavorites: () => void;
}

const GuestFavoritesContext = createContext<GuestFavoritesContextType | null>(null);

// Валидация массива ID
const isValidFavoritesArray = (data: unknown): data is number[] => {
  return Array.isArray(data) &&
    data.length <= 500 && // Максимум 500 избранных
    data.every(item => typeof item === 'number' && Number.isInteger(item) && item > 0);
};

// Загрузка из localStorage при инициализации
const loadFavoritesFromStorage = (): Set<number> => {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(GUEST_FAVORITES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidFavoritesArray(parsed)) {
        return new Set(parsed);
      } else {
        console.warn('Invalid guest favorites data, clearing');
        localStorage.removeItem(GUEST_FAVORITES_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to parse guest favorites:', e);
    localStorage.removeItem(GUEST_FAVORITES_KEY);
  }
  return new Set();
};

export function GuestFavoritesProvider({ children }: { children: ReactNode }) {
  // Ленивая инициализация состояния из localStorage
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(loadFavoritesFromStorage);

  // Сохранение в localStorage
  const saveToStorage = useCallback((ids: Set<number>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify([...ids]));
  }, []);

  const toggleFavorite = useCallback((offerId: number) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const isFavorite = useCallback((offerId: number): boolean => {
    return favoriteIds.has(offerId);
  }, [favoriteIds]);

  const clearFavorites = useCallback(() => {
    setFavoriteIds(new Set());
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_FAVORITES_KEY);
    }
  }, []);

  return (
    <GuestFavoritesContext.Provider
      value={{
        favoriteIds,
        toggleFavorite,
        isFavorite,
        favoritesCount: favoriteIds.size,
        clearFavorites,
      }}
    >
      {children}
    </GuestFavoritesContext.Provider>
  );
}

export function useGuestFavorites(): GuestFavoritesContextType {
  const context = useContext(GuestFavoritesContext);
  if (!context) {
    throw new Error('useGuestFavorites must be used within a GuestFavoritesProvider');
  }
  return context;
}
