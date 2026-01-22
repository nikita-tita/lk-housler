'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, formatPrice } from '@/services/api';
import type { FailureWithDetails, FailureStats, CancellationStage } from '@/types';

const STAGES: { value: CancellationStage | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'at_fixation', label: 'На фиксации' },
  { value: 'at_booking', label: 'На брони' },
  { value: 'at_deal', label: 'На сделке' },
];

// Используем badge вместо цветов
const STAGE_COLORS: Record<CancellationStage, string> = {
  at_fixation: 'badge',
  at_booking: 'badge',
  at_deal: 'badge-filled',
};

const STAGE_LABELS: Record<CancellationStage, string> = {
  at_fixation: 'На фиксации',
  at_booking: 'На брони',
  at_deal: 'На сделке',
};

const INITIATOR_LABELS: Record<string, string> = {
  client: 'Клиент',
  developer: 'Застройщик',
  agent: 'Агент',
  bank: 'Банк',
};

export default function FailuresPage() {
  const [failures, setFailures] = useState<FailureWithDetails[]>([]);
  const [stats, setStats] = useState<FailureStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<CancellationStage | 'all'>('all');

  const loadFailures = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = stageFilter !== 'all' ? { stage: stageFilter } : undefined;
      const [failuresRes, statsRes] = await Promise.all([
        api.getFailures(filters),
        api.getFailuresStats()
      ]);

      if (failuresRes.success && failuresRes.data) {
        setFailures(failuresRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to load failures:', error);
    } finally {
      setIsLoading(false);
    }
  }, [stageFilter]);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-[var(--color-text-light)]">Всего срывов</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{stats.atFixation}</div>
            <div className="text-sm text-[var(--color-text-light)]">На фиксации</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{stats.atBooking}</div>
            <div className="text-sm text-[var(--color-text-light)]">На брони</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{stats.atDeal}</div>
            <div className="text-sm text-[var(--color-text-light)]">На сделке</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{formatPrice(stats.totalPenalty)}</div>
            <div className="text-sm text-[var(--color-text-light)]">Штрафы</div>
          </div>
        </div>
      )}

      {/* Top reasons */}
      {stats && stats.topReasons.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="text-sm font-medium mb-3">Частые причины срывов</div>
          <div className="flex flex-wrap gap-2">
            {stats.topReasons.map((r, idx) => (
              <span key={idx} className="px-3 py-1 bg-[var(--color-bg-gray)] rounded text-sm">
                {r.reason} ({r.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STAGES.map(s => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={`tab-btn ${stageFilter === s.value ? 'tab-btn-active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {failures.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-light)]">
          <p>Нет срывов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {failures.map(f => (
            <div key={f.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[f.stage]}`}>
                      {STAGE_LABELS[f.stage]}
                    </span>
                    <span className="text-sm text-[var(--color-text-light)]">
                      Инициатор: {INITIATOR_LABELS[f.initiated_by] || f.initiated_by}
                    </span>
                  </div>
                  <div className="font-medium">{f.reason_name || f.reason}</div>
                </div>
                <div className="text-sm text-[var(--color-text-light)]">
                  {formatDate(f.created_at)}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {f.client_name && (
                  <div>
                    <div className="text-[var(--color-text-light)]">Клиент</div>
                    <div className="font-medium">{f.client_name}</div>
                    {f.client_phone && (
                      <div className="text-[var(--color-text-light)]">{f.client_phone}</div>
                    )}
                  </div>
                )}
                {f.complex_name && (
                  <div>
                    <div className="text-[var(--color-text-light)]">Объект</div>
                    <div className="font-medium">{f.complex_name}</div>
                    <div className="text-[var(--color-text-light)]">
                      {f.offer_rooms ? `${f.offer_rooms} комн` : ''}
                    </div>
                  </div>
                )}
                {f.penalty_amount > 0 && (
                  <div>
                    <div className="text-[var(--color-text-light)]">Штраф</div>
                    <div className="font-medium">{formatPrice(f.penalty_amount)}</div>
                  </div>
                )}
              </div>

              {f.reason_details && (
                <div className="mt-3 text-sm text-[var(--color-text-light)] p-3 bg-[var(--color-bg-gray)] rounded">
                  {f.reason_details}
                </div>
              )}

              {f.offer_id && (
                <div className="mt-3">
                  <Link
                    href={`/offers/${f.offer_id}`}
                    className="text-sm text-[var(--color-accent)]"
                  >
                    Смотреть объект
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
