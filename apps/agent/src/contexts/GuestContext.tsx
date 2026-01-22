'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';
import type { GuestState, SelectionGuestContext } from '@/types';

// Ключи localStorage
const GUEST_STATE_KEY = 'housler_guest_state';
const GUEST_TTL_DAYS = 7;

// Генерация UUID для гостя
function generateGuestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface GuestContextType {
  // Состояние
  isGuest: boolean;
  guestClientId: string | null;
  selectionCode: string | null;
  context: SelectionGuestContext | null;
  isLoading: boolean;

  // Методы
  activateGuestMode: (shareCode: string) => Promise<boolean>;
  deactivateGuestMode: () => void;
  getGuestClientId: () => string;
}

const GuestContext = createContext<GuestContextType | null>(null);

// Валидация структуры состояния гостя
const isValidGuestState = (data: unknown): data is GuestState => {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.isGuest === 'boolean' &&
    (obj.guestClientId === null || (typeof obj.guestClientId === 'string' && obj.guestClientId.length <= 100)) &&
    (obj.selectionCode === null || (typeof obj.selectionCode === 'string' && obj.selectionCode.length <= 100)) &&
    (obj.expiresAt === null || (typeof obj.expiresAt === 'number' && obj.expiresAt > 0))
  );
};

// Загрузка состояния из localStorage при инициализации
const loadGuestStateFromStorage = (): GuestState => {
  const defaultState: GuestState = {
    isGuest: false,
    guestClientId: null,
    selectionCode: null,
    context: null,
    expiresAt: null,
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(GUEST_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Валидация структуры
      if (!isValidGuestState(parsed)) {
        console.warn('Invalid guest state data, clearing');
        localStorage.removeItem(GUEST_STATE_KEY);
        return defaultState;
      }

      // Проверяем срок действия
      if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
        return parsed;
      } else {
        // Истёк срок - очищаем
        localStorage.removeItem(GUEST_STATE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to parse guest state:', e);
    localStorage.removeItem(GUEST_STATE_KEY);
  }

  return defaultState;
};

export function GuestProvider({ children }: { children: ReactNode }) {
  // Ленивая инициализация состояния из localStorage
  const [state, setState] = useState<GuestState>(loadGuestStateFromStorage);
  const [isLoading, setIsLoading] = useState(false);

  // Сохранение состояния в localStorage
  const saveState = useCallback((newState: GuestState) => {
    if (typeof window === 'undefined') return;

    if (newState.isGuest) {
      localStorage.setItem(GUEST_STATE_KEY, JSON.stringify(newState));
    } else {
      localStorage.removeItem(GUEST_STATE_KEY);
    }
  }, []);

  // Активация гостевого режима
  const activateGuestMode = useCallback(async (shareCode: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Получаем контекст подборки (информация об агенте)
      const response = await api.getSelectionGuestContext(shareCode);

      if (!response.success || !response.data) {
        console.error('Failed to get selection context:', response.error);
        setIsLoading(false);
        return false;
      }

      // Генерируем или используем существующий guestClientId
      let guestClientId = state.guestClientId;
      if (!guestClientId) {
        guestClientId = generateGuestId();
      }

      const newState: GuestState = {
        isGuest: true,
        guestClientId,
        selectionCode: shareCode,
        context: response.data,
        expiresAt: Date.now() + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
      };

      setState(newState);
      saveState(newState);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to activate guest mode:', error);
      setIsLoading(false);
      return false;
    }
  }, [state.guestClientId, saveState]);

  // Деактивация гостевого режима
  const deactivateGuestMode = useCallback(() => {
    const newState: GuestState = {
      isGuest: false,
      guestClientId: null,
      selectionCode: null,
      context: null,
      expiresAt: null,
    };

    setState(newState);
    saveState(newState);
  }, [saveState]);

  // Получить guestClientId (создаёт новый если нет)
  const getGuestClientId = useCallback((): string => {
    if (state.guestClientId) {
      return state.guestClientId;
    }

    const newId = generateGuestId();

    // Сохраняем новый ID в состояние
    const newState = { ...state, guestClientId: newId };
    setState(newState);
    if (newState.isGuest) {
      saveState(newState);
    }

    return newId;
  }, [state, saveState]);

  const value: GuestContextType = {
    isGuest: state.isGuest,
    guestClientId: state.guestClientId,
    selectionCode: state.selectionCode,
    context: state.context,
    isLoading,
    activateGuestMode,
    deactivateGuestMode,
    getGuestClientId,
  };

  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest(): GuestContextType {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
}
