'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api, formatPrice, formatArea, formatRooms } from '@/services/api';
import { ShareSelectionModal } from '@/components/ShareSelectionModal';
import { SelectionItemStatus, type ItemStatus } from '@/components/SelectionItemStatus';
import { SelectionActivityLog } from '@/components/SelectionActivityLog';
import type { SelectionDetail } from '@/types';

export default function SelectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [selection, setSelection] = useState<SelectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  const id = Number(params.id);

  const loadSelection = useCallback(async () => {
    try {
      const response = await api.getSelection(id);
      if (response.success && response.data) {
        setSelection(response.data);
      }
    } catch (error) {
      console.error('Failed to load selection:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || (user?.role !== 'agent' && user?.role !== 'admin')) {
      router.push('/login');
      return;
    }

    loadSelection();
  }, [isAuthenticated, authLoading, user, router, loadSelection]);

  const handleRemoveItem = async (offerId: number) => {
    if (!selection) return;

    try {
      await api.removeSelectionItem(selection.id, offerId);
      setSelection({
        ...selection,
        items: selection.items.filter(item => item.offer_id !== offerId),
      });
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="container py-12 text-center">
        <div className="text-xl mb-4">Подборка не найдена</div>
        <Link href="/selections" className="text-[var(--color-accent)]">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/selections" className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] mb-2 inline-block">
            &larr; К списку подборок
          </Link>
          <h1 className="text-2xl font-semibold">{selection.name}</h1>
          {selection.client_name && (
            <div className="text-[var(--color-text-light)] mt-1">
              Для: {selection.client_name}
              {selection.client_email && ` (${selection.client_email})`}
            </div>
          )}
          {/* View statistics */}
          {(selection.view_count > 0 || selection.last_viewed_at) && (
            <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-text-light)]">
              {selection.view_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {selection.view_count} {selection.view_count === 1 ? 'просмотр' : selection.view_count < 5 ? 'просмотра' : 'просмотров'}
                </span>
              )}
              {selection.last_viewed_at && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Последний просмотр: {new Date(selection.last_viewed_at).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowShareModal(true)}
          className="btn btn-primary btn-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Поделиться
        </button>
      </div>

      {selection.items.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-[var(--color-text-light)] mb-4">
            В подборке пока нет объектов
          </div>
          <Link
            href="/offers"
            className="btn btn-primary"
          >
            Добавить из каталога
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {selection.items.map((item) => (
            <div
              key={item.id}
              className="card overflow-hidden relative"
            >
              {/* Badge for client-added items */}
              {item.added_by === 'client' && (
                <div className="absolute top-3 left-3 z-10 bg-[var(--gray-900)] text-white text-xs px-2 py-1 rounded font-medium">
                  Добавлено клиентом
                </div>
              )}

              {/* Проверяем доступность оффера */}
              {item.offer || item.price ? (
                <>
                  <Link href={`/offers/${item.offer_id}`}>
                    <div className="aspect-[4/3] bg-gray-100">
                      {(item.offer?.image_url || item.main_image) ? (
                        <img
                          src={item.offer?.image_url || item.main_image || ''}
                          alt={item.offer?.complex_name || item.complex_name || item.building_name || 'Квартира'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Нет фото
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/offers/${item.offer_id}`}>
                      <div className="text-lg font-semibold mb-1 hover:text-[var(--color-accent)]">
                        {formatPrice(item.offer?.price ?? item.price ?? 0)}
                      </div>
                    </Link>
                    <div className="text-sm text-[var(--color-text-light)] mb-2">
                      {formatRooms(item.offer?.rooms ?? item.rooms, item.offer?.is_studio ?? item.is_studio)} · {formatArea(item.offer?.area_total ?? item.area_total ?? 0)} · {item.offer?.floor ?? item.floor}/{item.offer?.floors_total ?? item.floors_total} эт.
                    </div>
                    <div className="text-sm font-medium">{item.offer?.complex_name || item.complex_name || item.building_name}</div>
                    {(item.offer?.district_name || item.district) && (
                      <div className="text-sm text-[var(--color-text-light)]">
                        {item.offer?.district_name || item.district}
                        {(item.offer?.metro_station || item.metro_name) && ` · м. ${item.offer?.metro_station || item.metro_name}`}
                      </div>
                    )}
                    {item.comment && (
                      <div className="mt-2 text-sm text-[var(--color-text-light)] italic">
                        {item.comment}
                      </div>
                    )}

                    {/* Status & Actions */}
                    <div className="mt-3 flex items-center justify-between">
                      <SelectionItemStatus
                        selectionId={selection.id}
                        offerId={item.offer_id}
                        currentStatus={(item.status as ItemStatus) || 'pending'}
                      />
                      <button
                        onClick={() => handleRemoveItem(item.offer_id)}
                        className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Объект недоступен */
                <>
                  <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span className="text-sm">Объект недоступен</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-sm text-gray-500 mb-2">
                      Этот объект был удалён или снят с продажи
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleRemoveItem(item.offer_id)}
                        className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
                      >
                        Удалить из подборки
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Client Activity Log */}
      <div className="mt-12">
        <div className="card card-lg">
          <SelectionActivityLog selectionId={selection.id} />
        </div>
      </div>

      {/* Share Modal */}
      <ShareSelectionModal
        selection={selection}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onUpdate={(updated) => setSelection({ ...selection, ...updated })}
      />
    </div>
  );
}
