'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { api, formatPrice } from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import type { DealWithOffer, DealStatus, DealStats } from '@/types';

const STATUSES: { value: DealStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают ДДУ' },
  { value: 'signed', label: 'ДДУ подписан' },
  { value: 'registered', label: 'Зарегистрировано' },
  { value: 'completed', label: 'Завершено' },
  { value: 'cancelled', label: 'Отменено' },
];

// Статусы: filled для завершённых, обычный для остальных
const STATUS_COLORS: Record<DealStatus, string> = {
  pending: 'badge',
  signed: 'badge',
  registered: 'badge',
  completed: 'badge-filled',
  cancelled: 'badge-filled',
};

const STATUS_LABELS: Record<DealStatus, string> = {
  pending: 'Ожидает ДДУ',
  signed: 'ДДУ подписан',
  registered: 'Зарегистрировано',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

export default function DealsPage() {
  const { showToast } = useToast();
  const [deals, setDeals] = useState<DealWithOffer[]>([]);
  const [stats, setStats] = useState<DealStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingDealId, setCancellingDealId] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadDeals = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const [dealsRes, statsRes] = await Promise.all([
        api.getDeals(filters),
        api.getDealsStats()
      ]);

      if (dealsRes.success && dealsRes.data) {
        setDeals(dealsRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const handleUpdateStatus = async (id: number, status: DealStatus) => {
    try {
      const response = await api.updateDealStatus(id, status);
      if (response.success) {
        loadDeals();
        showToast('Статус сделки обновлён', 'success');
      }
    } catch {
      showToast('Не удалось обновить статус', 'error');
    }
  };

  const openCancelModal = (id: number) => {
    setCancellingDealId(id);
    setShowCancelModal(true);
  };

  const handleCancelDeal = async () => {
    if (!cancellingDealId) return;

    setIsCancelling(true);
    try {
      const response = await api.updateDealStatus(cancellingDealId, 'cancelled');
      if (response.success) {
        loadDeals();
        showToast('Сделка отменена', 'success');
      }
    } catch {
      showToast('Не удалось отменить сделку', 'error');
    } finally {
      setIsCancelling(false);
      setShowCancelModal(false);
      setCancellingDealId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
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
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-sm text-[var(--color-text-light)]">Завершено</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{formatPrice(stats.totalValue)}</div>
            <div className="text-sm text-[var(--color-text-light)]">Общий объём</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{formatPrice(stats.totalCommission)}</div>
            <div className="text-sm text-[var(--color-text-light)]">Комиссия</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold">{formatPrice(stats.pendingCommission)}</div>
            <div className="text-sm text-[var(--color-text-light)]">К выплате</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`tab-btn ${statusFilter === s.value ? 'tab-btn-active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {deals.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-light)]">
          <p>Нет сделок</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map(d => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="font-medium text-lg">{d.deal_number}</div>
                  <div className="text-sm text-[var(--color-text-light)]">
                    {d.client_name || 'Без клиента'} • {d.client_phone || '—'}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <div className="text-[var(--color-text-light)]">Объект</div>
                  <div className="font-medium">{d.complex_name || 'Не указан'}</div>
                  <div className="text-[var(--color-text-light)]">
                    {d.offer_rooms ? `${d.offer_rooms} комн` : '—'}, {d.offer_area ? `${d.offer_area} м²` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-text-light)]">Цена</div>
                  <div className="font-medium">{formatPrice(d.final_price)}</div>
                  {d.discount_amount > 0 && (
                    <div className="text-[var(--color-text-light)] text-sm">Скидка: {formatPrice(d.discount_amount)}</div>
                  )}
                </div>
                <div>
                  <div className="text-[var(--color-text-light)]">Комиссия</div>
                  <div className="font-medium">
                    {d.commission_amount ? formatPrice(d.commission_amount) : '—'}
                  </div>
                  {d.commission_percent && (
                    <div className="text-sm text-[var(--color-text-light)]">{d.commission_percent}%</div>
                  )}
                </div>
                <div>
                  <div className="text-[var(--color-text-light)]">Дата</div>
                  <div className="font-medium">{formatDate(d.created_at)}</div>
                  {d.contract_number && (
                    <div className="text-sm text-[var(--color-text-light)]">ДДУ: {d.contract_number}</div>
                  )}
                </div>
              </div>

              {d.notes && (
                <div className="text-sm text-[var(--color-text-light)] mb-4 p-3 bg-[var(--color-bg-gray)] rounded">
                  {d.notes}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/offers/${d.offer_id}`}
                  className="btn btn-sm btn-secondary"
                >
                  Объект
                </Link>

                {d.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus(d.id, 'signed')}
                    className="btn btn-sm btn-primary"
                  >
                    ДДУ подписан
                  </button>
                )}

                {d.status === 'signed' && (
                  <button
                    onClick={() => handleUpdateStatus(d.id, 'registered')}
                    className="btn btn-sm btn-primary"
                  >
                    Зарегистрировано
                  </button>
                )}

                {d.status === 'registered' && (
                  <button
                    onClick={() => handleUpdateStatus(d.id, 'completed')}
                    className="btn btn-sm btn-primary"
                  >
                    Завершить сделку
                  </button>
                )}

                {['pending', 'signed'].includes(d.status) && (
                  <button
                    onClick={() => openCancelModal(d.id)}
                    className="btn btn-sm btn-secondary"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancellingDealId(null);
        }}
        onConfirm={handleCancelDeal}
        title="Отменить сделку"
        message="Вы уверены, что хотите отменить эту сделку? Это действие нельзя отменить."
        confirmText="Отменить сделку"
        cancelText="Назад"
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
}
