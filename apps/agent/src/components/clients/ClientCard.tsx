'use client';

import Link from 'next/link';
import type { ClientListItem } from '@/types';
import { StageBadge } from './StageBadge';
import { PriorityBadge } from './PriorityBadge';

interface ClientCardProps {
  client: ClientListItem;
}

export function ClientCard({ client }: ClientCardProps) {
  const displayName = client.name || client.phone || client.email || 'Без имени';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <Link href={`/clients/${client.id}`} className="card block p-5 hover:border-[var(--color-accent)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-base truncate">{displayName}</h3>
        <PriorityBadge priority={client.priority} />
      </div>

      {/* Contact info */}
      <div className="space-y-1 mb-4">
        {client.phone && (
          <div className="text-sm text-[var(--color-text-light)] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {client.phone}
          </div>
        )}
        {client.email && (
          <div className="text-sm text-[var(--color-text-light)] flex items-center gap-2 truncate">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{client.email}</span>
          </div>
        )}
      </div>

      {/* Stage */}
      <div className="mb-4">
        <StageBadge stage={client.stage} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-[var(--color-text-light)] border-t border-[var(--color-border)] pt-3">
        {client.selections_count > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {client.selections_count}
          </span>
        )}
        {client.bookings_count > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {client.bookings_count}
          </span>
        )}
        {client.next_contact_date && (
          <span className="flex items-center gap-1 ml-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(client.next_contact_date)}
          </span>
        )}
      </div>
    </Link>
  );
}
