'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';

interface ClientSelectionContextValue {
  // Активная подборка (из URL /s/[code])
  activeSelectionCode: string | null;
  setActiveSelectionCode: (code: string | null) => void;

  // ID объектов в текущей подборке
  selectionOfferIds: Set<number>;

  // Добавить объект в подборку
  addToSelection: (offerId: number, comment?: string) => Promise<boolean>;

  // Удалить объект из подборки (только свои)
  removeFromSelection: (offerId: number) => Promise<boolean>;

  // Проверить есть ли объект в подборке
  isInSelection: (offerId: number) => boolean;

  // Клиентский идентификатор
  clientId: string;

  // Загрузка
  isLoading: boolean;
}

const ClientSelectionContext = createContext<ClientSelectionContextValue | null>(null);

const CLIENT_ID_KEY = 'housler_client_id';
const SELECTION_CODE_KEY = 'housler_active_selection';

function generateClientId(): string {
  return 'client_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return '';

  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = generateClientId();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

export function ClientSelectionProvider({ children }: { children: ReactNode }) {
  const [activeSelectionCode, setActiveSelectionCodeState] = useState<string | null>(null);
  const [selectionOfferIds, setSelectionOfferIds] = useState<Set<number>>(new Set());
  const [clientId, setClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Инициализация clientId
  useEffect(() => {
    setClientId(getOrCreateClientId());

    // Восстанавливаем активную подборку из localStorage
    const savedCode = localStorage.getItem(SELECTION_CODE_KEY);
    if (savedCode) {
      setActiveSelectionCodeState(savedCode);
    }
  }, []);

  // Загрузка данных подборки при изменении кода
  useEffect(() => {
    if (!activeSelectionCode) {
      setSelectionOfferIds(new Set());
      return;
    }

    const loadSelection = async () => {
      setIsLoading(true);
      try {
        const response = await api.getSharedSelection(activeSelectionCode);
        if (response.success && response.data) {
          // Защита от undefined items
          const items = response.data.items ?? [];
          const ids = new Set(items.map(item => item.offer_id));
          setSelectionOfferIds(ids);

          // Записываем просмотр
          api.recordSelectionView(activeSelectionCode, clientId).catch(() => {});
        }
      } catch (error) {
        console.error('Error loading selection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSelection();
  }, [activeSelectionCode, clientId]);

  const setActiveSelectionCode = useCallback((code: string | null) => {
    setActiveSelectionCodeState(code);
    if (code) {
      localStorage.setItem(SELECTION_CODE_KEY, code);
    } else {
      localStorage.removeItem(SELECTION_CODE_KEY);
    }
  }, []);

  const addToSelection = useCallback(async (offerId: number, comment?: string): Promise<boolean> => {
    if (!activeSelectionCode || !clientId) return false;

    try {
      const response = await api.addToSharedSelection(activeSelectionCode, offerId, clientId, comment);
      if (response.success) {
        setSelectionOfferIds(prev => new Set([...prev, offerId]));
        return true;
      }
    } catch (error) {
      console.error('Error adding to selection:', error);
    }
    return false;
  }, [activeSelectionCode, clientId]);

  const removeFromSelection = useCallback(async (offerId: number): Promise<boolean> => {
    if (!activeSelectionCode || !clientId) return false;

    try {
      const response = await api.removeFromSharedSelection(activeSelectionCode, offerId, clientId);
      if (response.success) {
        setSelectionOfferIds(prev => {
          const next = new Set(prev);
          next.delete(offerId);
          return next;
        });
        return true;
      }
    } catch (error) {
      console.error('Error removing from selection:', error);
    }
    return false;
  }, [activeSelectionCode, clientId]);

  const isInSelection = useCallback((offerId: number): boolean => {
    return selectionOfferIds.has(offerId);
  }, [selectionOfferIds]);

  return (
    <ClientSelectionContext.Provider
      value={{
        activeSelectionCode,
        setActiveSelectionCode,
        selectionOfferIds,
        addToSelection,
        removeFromSelection,
        isInSelection,
        clientId,
        isLoading,
      }}
    >
      {children}
    </ClientSelectionContext.Provider>
  );
}

export function useClientSelection() {
  const context = useContext(ClientSelectionContext);
  if (!context) {
    throw new Error('useClientSelection must be used within ClientSelectionProvider');
  }
  return context;
}
