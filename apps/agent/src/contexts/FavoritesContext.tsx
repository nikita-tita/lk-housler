'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favoriteIds: Set<number>;
  isLoading: boolean;
  toggleFavorite: (offerId: number) => Promise<void>;
  isFavorite: (offerId: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Load favorites when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      return;
    }

    const loadFavorites = async () => {
      setIsLoading(true);
      try {
        const response = await api.getFavoriteIds();
        if (response.success && response.data) {
          setFavoriteIds(new Set(response.data));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [isAuthenticated]);

  const toggleFavorite = useCallback(async (offerId: number) => {
    if (!isAuthenticated) return;

    const isFav = favoriteIds.has(offerId);

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });

    try {
      if (isFav) {
        await api.removeFavorite(offerId);
      } else {
        await api.addFavorite(offerId);
      }
    } catch (error) {
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) {
          next.add(offerId);
        } else {
          next.delete(offerId);
        }
        return next;
      });
      console.error('Failed to toggle favorite:', error);
    }
  }, [isAuthenticated, favoriteIds]);

  const isFavorite = useCallback((offerId: number) => {
    return favoriteIds.has(offerId);
  }, [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isLoading, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}
