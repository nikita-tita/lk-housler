'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { api, formatPrice, formatArea, formatRooms } from '@/services/api';
import { useGuest } from '@/contexts/GuestContext';
import type { SelectionDetail } from '@/types';

export default function GuestSelectionPage() {
  const params = useParams();
  const code = params.code as string;

  const { activateGuestMode, isLoading: guestLoading, context } = useGuest();
  const [selection, setSelection] = useState<SelectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Активируем гостевой режим при загрузке
  useEffect(() => {
    if (code) {
      activateGuestMode(code);
    }
  }, [code, activateGuestMode]);

  // Загружаем данные подборки
  useEffect(() => {
    if (!code) return;

    const loadSelection = async () => {
      try {
        const response = await api.getSharedSelection(code);
        if (response.success && response.data) {
          setSelection(response.data);
          // Записываем просмотр (используем code как clientId для простоты)
          api.recordSelectionView(code, 'guest');
        } else {
          setError(response.error || 'Подборка не найдена');
        }
      } catch {
        setError('Ошибка загрузки подборки');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelection();
  }, [code]);

  if (isLoading || guestLoading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !selection) {
    const isNotPublic = error === 'Подборка не опубликована';
    return (
      <div className="container py-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {isNotPublic ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-3">
            {isNotPublic ? 'Подборка закрыта' : 'Подборка не найдена'}
          </h1>
          <p className="text-[var(--color-text-light)]">
            {isNotPublic
              ? 'Агент ещё не открыл доступ к этой подборке. Попросите его опубликовать её.'
              : 'Возможно, ссылка устарела или подборка была удалена'}
          </p>
        </div>
      </div>
    );
  }

  const agent = context?.agent;
  const agency = context?.agency;

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold mb-3">{selection.name}</h1>
        {selection.client_name && (
          <p className="text-lg text-[var(--color-text-light)]">
            Специально для вас, {selection.client_name}
          </p>
        )}

        {/* Agent & Agency Info */}
        {(agent?.name || agent?.avatar_url || agency) && (
          <div className="mt-6 flex items-center justify-center gap-4">
            {/* Agent Avatar */}
            {agent?.avatar_url ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-[var(--color-border)] flex-shrink-0">
                <Image
                  src={agent.avatar_url}
                  alt={agent.name || 'Агент'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : agent?.name ? (
              <div className="w-12 h-12 rounded-full bg-gray-100 border border-[var(--color-border)] flex items-center justify-center text-gray-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            ) : null}

            <div className="text-left">
              {agent?.name && (
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {agent.name}
                </p>
              )}
              {agency && (
                <div className="flex items-center gap-2 mt-0.5">
                  {agency.logo_url && (
                    <div className="relative w-4 h-4 flex-shrink-0">
                      <Image
                        src={agency.logo_url}
                        alt={agency.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-text-light)]">
                    {agency.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-sm text-[var(--color-text-light)] mt-4">
          {selection.items.length} {selection.items.length === 1 ? 'объект' : selection.items.length < 5 ? 'объекта' : 'объектов'}
        </p>
      </div>

      {/* CTA: Search more */}
      <div className="mb-8 p-4 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
        <p className="text-sm text-[var(--color-text)] mb-3">
          Хотите найти ещё варианты? Ищите по всей базе новостроек!
        </p>
        <Link
          href={`/s/${code}/offers`}
          className="btn btn-primary btn-sm inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Искать квартиры
        </Link>
      </div>

      {/* Items */}
      {selection.items.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-[var(--color-text-light)] mb-4">
            В подборке пока нет объектов
          </div>
          <Link
            href={`/s/${code}/offers`}
            className="btn btn-primary btn-sm"
          >
            Найти квартиры
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selection.items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg overflow-hidden border border-[var(--color-border)] hover:shadow-lg transition-shadow relative"
            >
              {item.price !== null && item.price !== undefined ? (
                <>
                  {/* Added by badge */}
                  {item.added_by === 'client' && (
                    <div className="absolute top-3 left-3 z-10 bg-[var(--gray-900)] text-white text-xs px-2 py-1 rounded">
                      Вы добавили
                    </div>
                  )}

                  <Link href={`/s/${code}/offers/${item.offer_id}`}>
                    <div className="aspect-[4/3] bg-gray-100">
                      {item.main_image ? (
                        <img
                          src={item.main_image}
                          alt={item.building_name || item.complex_name || 'Квартира'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="text-lg font-semibold mb-1">
                        {formatPrice(item.price)}
                      </div>
                      <div className="text-sm text-[var(--color-text-light)] mb-2">
                        {formatRooms(item.rooms, item.is_studio)} · {formatArea(item.area_total ?? 0)} · {item.floor}/{item.floors_total} эт.
                      </div>
                      <div className="text-sm font-medium">{item.complex_name || item.building_name}</div>
                      {item.district && (
                        <div className="text-sm text-[var(--color-text-light)]">
                          {item.district}
                          {item.metro_name && ` · м. ${item.metro_name}`}
                        </div>
                      )}

                      {item.comment && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-[var(--color-text-light)] italic">
                          Комментарий: {item.comment}
                        </div>
                      )}
                    </div>
                  </Link>
                </>
              ) : (
                <div className="p-4">
                  <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center mb-4 rounded">
                    <div className="text-center text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span className="text-sm">Объект недоступен</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Этот объект был снят с продажи
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-[var(--color-text-light)] mb-4">
          Понравился объект? Свяжитесь с агентом для получения дополнительной информации
        </p>
        <Link
          href={`/s/${code}/offers`}
          className="inline-flex items-center gap-2 text-[var(--color-accent)] hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Искать ещё квартиры
        </Link>
      </div>
    </div>
  );
}
