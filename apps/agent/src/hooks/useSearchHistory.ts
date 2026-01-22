'use client';

import { useState, useCallback } from 'react';

export interface SearchHistoryItem {
  type: 'complex' | 'district' | 'metro' | 'text';
  value: string;
  timestamp: number;
}

const STORAGE_KEY = 'housler_search_history';
const MAX_HISTORY_ITEMS = 10;

export function useSearchHistory() {
  // Lazy initialization to avoid setState in useEffect
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as SearchHistoryItem[];
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  // Save to localStorage
  const saveHistory = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, []);

  // Add item to history
  const addToHistory = useCallback((type: SearchHistoryItem['type'], value: string) => {
    if (!value.trim()) return;

    setHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(
        item => !(item.type === type && item.value.toLowerCase() === value.toLowerCase())
      );

      // Add new item at the beginning
      const newItem: SearchHistoryItem = {
        type,
        value: value.trim(),
        timestamp: Date.now()
      };

      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // Remove item from history
  const removeFromHistory = useCallback((type: SearchHistoryItem['type'], value: string) => {
    setHistory(prev => {
      const updated = prev.filter(
        item => !(item.type === type && item.value === value)
      );
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  };
}
