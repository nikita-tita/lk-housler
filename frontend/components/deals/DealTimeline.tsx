'use client';

import { clsx } from 'clsx';
import { TimelineEvent } from '@/lib/api/bank-split';
import { formatDateTime } from '@/lib/utils/format';

interface DealTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  deal_created: 'Сделка создана',
  status_changed: 'Статус изменен',
  submitted_for_signing: 'Отправлено на подписание',
  document_signed: 'Документ подписан',
  invoice_created: 'Счет создан',
  payment_received: 'Платеж получен',
  hold_started: 'Начат период удержания',
  hold_released: 'Период удержания завершен',
  payout_initiated: 'Выплата инициирована',
  payout_completed: 'Выплата завершена',
  deal_cancelled: 'Сделка отменена',
  deal_closed: 'Сделка закрыта',
  dispute_opened: 'Открыт спор',
  refund_initiated: 'Инициирован возврат',
};

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  deal_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  status_changed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  submitted_for_signing: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  document_signed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  invoice_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  payment_received: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  hold_started: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  payout_completed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  deal_cancelled: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  deal_closed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

function getEventIcon(eventType: string): React.ReactNode {
  return (
    EVENT_TYPE_ICONS[eventType] || (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  );
}

function getEventDescription(event: TimelineEvent): string {
  const data = event.event_data || {};

  if (event.event_type === 'status_changed' && data.old_status && data.new_status) {
    return `${data.old_status} -> ${data.new_status}`;
  }

  if (event.event_type === 'payment_received' && data.amount) {
    return `Сумма: ${Number(data.amount).toLocaleString('ru-RU')} руб.`;
  }

  if (event.event_type === 'deal_cancelled' && data.reason) {
    return `Причина: ${data.reason}`;
  }

  return '';
}

export function DealTimeline({ events, loading }: DealTimelineProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        История событий пуста
      </div>
    );
  }

  // Sort events by date descending (newest first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {sortedEvents.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== sortedEvents.length - 1 ? (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={clsx(
                      'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                      event.event_type === 'deal_cancelled'
                        ? 'bg-gray-300 text-gray-600'
                        : event.event_type === 'deal_closed' ||
                          event.event_type === 'payout_completed'
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {getEventIcon(event.event_type)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-gray-900">
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </p>
                    {getEventDescription(event) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {getEventDescription(event)}
                      </p>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-gray-500">
                    {formatDateTime(event.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Compact timeline for sidebar
export function DealTimelineCompact({
  events,
  maxItems = 3,
}: {
  events: TimelineEvent[];
  maxItems?: number;
}) {
  if (!events || events.length === 0) {
    return null;
  }

  const sortedEvents = [...events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  return (
    <div className="space-y-2">
      {sortedEvents.map((event) => (
        <div key={event.id} className="flex items-center gap-2 text-sm">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0" />
          <span className="text-gray-600 truncate">
            {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
          </span>
        </div>
      ))}
      {events.length > maxItems && (
        <div className="text-xs text-gray-400">
          +{events.length - maxItems} событий
        </div>
      )}
    </div>
  );
}
