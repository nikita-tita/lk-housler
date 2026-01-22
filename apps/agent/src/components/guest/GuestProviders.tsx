'use client';

import { ReactNode } from 'react';
import { GuestProvider } from '@/contexts/GuestContext';
import { GuestFavoritesProvider } from '@/contexts/GuestFavoritesContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ClientSelectionProvider } from '@/contexts/ClientSelectionContext';

export function GuestProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <GuestProvider>
        <GuestFavoritesProvider>
          <ClientSelectionProvider>
            {children}
          </ClientSelectionProvider>
        </GuestFavoritesProvider>
      </GuestProvider>
    </ToastProvider>
  );
}
