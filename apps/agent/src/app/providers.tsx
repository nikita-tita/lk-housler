'use client';

import { ReactNode, Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { ClientSelectionProvider } from '@/contexts/ClientSelectionContext';
import { CompareProvider } from '@/contexts/CompareContext';
import { AgencyProvider } from '@/contexts/AgencyContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AgencyRefTracker } from '@/components/AgencyRefTracker';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AgencyProvider>
        <AuthProvider>
          <FavoritesProvider>
            <ClientSelectionProvider>
              <CompareProvider>
                {/* Отслеживание ref-параметра для привязки к агентству */}
                <Suspense fallback={null}>
                  <AgencyRefTracker />
                </Suspense>
                {children}
              </CompareProvider>
            </ClientSelectionProvider>
          </FavoritesProvider>
        </AuthProvider>
      </AgencyProvider>
    </ToastProvider>
  );
}
