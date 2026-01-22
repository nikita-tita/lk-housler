'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { api, formatPrice } from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import type { FixationWithOffer, FixationStatus } from '@/types';

const STATUSES: { value: FixationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'approved', label: 'Одобрены' },
  { value: 'rejected', label: 'Отклонены' },
  { value: 'expired', label: 'Истекли' },
  { value: 'converted', label: 'В бронь' },
];

// Используем badge/badge-filled вместо цветов
const STATUS_COLORS: Record<FixationStatus, string> = {
  pending: 'badge',
  approved: 'badge-filled',
  rejected: 'badge',
  expired: 'badge',
  converted: 'badge-filled',
};

const STATUS_LABELS: Record<FixationStatus, string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  expired: 'Истекло',
  converted: 'В бронь',
};

export default function FixationsPage() {
  const { showToast } = useToast();
  const [fixations, setFixations] = useState<FixationWithOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FixationStatus | 'all'>('all');

  // Modal states
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFixations = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const response = await api.getFixations(filters);
      if (response.success && response.data) {
        setFixations(response.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadFixations();
  }, [loadFixations]);

  const openConvertModal = (id: number) => {
    setConvertingId(id);
    setShowConvertModal(true);
  };

  const handleConvert = async () => {
    if (!convertingId) return;

    setIsConverting(true);
    try {
      const response = await api.convertFixationToBooking(convertingId);
      if (response.success) {
        loadFixations();
        showToast('Фиксация конвертирована в бронь', 'success');
      }
    } catch {
      showToast('Не удалось конвертировать фиксацию', 'error');
    } finally {
      setIsConverting(false);
      setShowConvertModal(false);
      setConvertingId(null);
    }
  };

  const openDeleteModal = (id: number) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      const response = await api.deleteFixation(deletingId);
      if (response.success) {
        loadFixations();
        showToast('Фиксация удалена', 'success');
      }
    } catch {
      showToast('Не удалось удалить фиксацию', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletingId(null);
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

  const getDaysLeft = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
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
      {fixations.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-light)]">
          <p className="mb-4">Нет фиксаций</p>
          <Link href="/offers" className="text-[var(--color-accent)]">
            Перейти к объектам
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {fixations.map(f => {
            const daysLeft = getDaysLeft(f.expires_at);

            return (
              <div key={f.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-medium text-lg">{f.lock_number}</div>
                    <div className="text-sm text-[var(--color-text-light)]">
                      {f.client_name} • {f.client_phone}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[f.status]}`}>
                    {STATUS_LABELS[f.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-[var(--color-text-light)]">Объект</div>
                    <div className="font-medium">{f.complex_name || 'Не указан'}</div>
                    <div className="text-[var(--color-text-light)]">
                      {f.offer_rooms ? `${f.offer_rooms} комн` : '—'}, {f.offer_area ? `${f.offer_area} м²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-light)]">Зафиксированная цена</div>
                    <div className="font-medium">{formatPrice(f.locked_price)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-light)]">Срок</div>
                    <div className="font-medium">{f.requested_days} дней</div>
                    {f.status === 'approved' && f.expires_at && (
                      <div className={`text-sm ${daysLeft && daysLeft <= 2 ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-light)]'}`}>
                        {daysLeft !== null ? (daysLeft > 0 ? `Осталось ${daysLeft} дн.` : 'Истекает сегодня') : ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--color-text-light)]">Создана</div>
                    <div className="font-medium">{formatDate(f.created_at)}</div>
                  </div>
                </div>

                {f.agent_comment && (
                  <div className="text-sm text-[var(--color-text-light)] mb-4 p-3 bg-[var(--color-bg-gray)] rounded">
                    {f.agent_comment}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/offers/${f.offer_id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    Объект
                  </Link>

                  {f.status === 'approved' && (
                    <button
                      onClick={() => openConvertModal(f.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Конвертировать в бронь
                    </button>
                  )}

                  {f.status === 'pending' && (
                    <button
                      onClick={() => openDeleteModal(f.id)}
                      className="btn btn-sm btn-secondary"
                    >
                      Удалить
                    </button>
                  )}

                  {f.booking_id && (
                    <span className="text-sm text-[var(--color-text-light)] self-center">
                      Бронь #{f.booking_id}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Convert Confirmation Modal */}
      <ConfirmModal
        isOpen={showConvertModal}
        onClose={() => {
          setShowConvertModal(false);
          setConvertingId(null);
        }}
        onConfirm={handleConvert}
        title="Конвертировать в бронь"
        message="Вы уверены, что хотите конвертировать эту фиксацию в бронь?"
        confirmText="Конвертировать"
        cancelText="Отмена"
        isLoading={isConverting}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        title="Удалить фиксацию"
        message="Вы уверены, что хотите удалить эту фиксацию?"
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
