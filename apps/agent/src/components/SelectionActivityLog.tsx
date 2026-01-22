'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, formatPrice } from '@/services/api';
import type { SelectionActivity } from '@/types';

interface SelectionActivityLogProps {
  selectionId: number;
}

const ACTION_LABELS: Record<string, string> = {
  viewed: 'Просмотрел подборку',
  item_added: 'Добавил объект',
  item_removed: 'Удалил объект',
};

export function SelectionActivityLog({ selectionId }: SelectionActivityLogProps) {
  const [activity, setActivity] = useState<SelectionActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      const response = await api.getSelectionActivity(selectionId);
      if (response.success && response.data) {
        setActivity(response.data);
      }
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectionId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Фильтруем только действия клиента
  const clientActivity = activity.filter(a => a.actor_type === 'client');

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-3"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (clientActivity.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-light)] py-4">
        Клиент ещё не взаимодействовал с подборкой
      </div>
    );
  }

  const displayedActivity = isExpanded ? clientActivity : clientActivity.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Действия клиента</h3>
        <span className="text-xs bg-gray-200 text-[var(--color-text)] px-2 py-0.5 rounded-full">
          {clientActivity.length}
        </span>
      </div>

      <div className="space-y-2">
        {displayedActivity.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg text-sm"
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.action === 'viewed'
                ? 'bg-gray-200 text-[var(--color-text)]'
                : item.action === 'item_added'
                ? 'bg-[var(--gray-900)] text-white'
                : 'bg-gray-300 text-[var(--color-text)]'
            }`}>
              {item.action === 'viewed' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              {item.action === 'item_added' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
              {item.action === 'item_removed' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[var(--color-text)]">
                {ACTION_LABELS[item.action] || item.action}
              </div>
              {item.offer_id && item.offer_name && (
                <Link
                  href={`/offers/${item.offer_id}`}
                  className="text-[var(--color-text-light)] hover:text-[var(--color-accent)] truncate block"
                >
                  {item.offer_name}
                  {item.price && ` — ${formatPrice(item.price)}`}
                </Link>
              )}
              <div className="text-xs text-[var(--color-text-light)] mt-0.5">
                {formatDateTime(item.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {clientActivity.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-sm text-[var(--color-accent)] hover:underline"
        >
          {isExpanded ? 'Свернуть' : `Показать ещё ${clientActivity.length - 5}`}
        </button>
      )}
    </div>
  );
}
