'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, formatPrice, formatArea, formatRooms, formatFloor } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';
import { useGuest } from '@/contexts/GuestContext';
import { BookingFormGuest, FavoriteButtonGuest } from '@/components/guest';
import { MortgageCalculator } from '@/components/MortgageCalculator';
import { YandexMap } from '@/components/YandexMap';
import { ImageGallery } from '@/components/ImageGallery';
import { OfferDescription } from '@/components/OfferDescription';
import type { OfferDetail } from '@/types';

export default function GuestOfferDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const id = Number(params.id);

  const { activateGuestMode, isLoading: guestLoading, context } = useGuest();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Активируем гостевой режим
  useEffect(() => {
    if (code) {
      activateGuestMode(code);
    }
  }, [code, activateGuestMode]);

  // Загружаем данные объекта
  useEffect(() => {
    if (!id) return;

    api.getOfferById(id)
      .then(res => {
        if (res.success && res.data) {
          setOffer(res.data);
        } else {
          setError(res.error || 'Объявление не найдено');
        }
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading || guestLoading) {
    return (
      <div className="section">
        <div className="container">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--color-bg-gray)] rounded w-1/4 mb-8"></div>
            <div className="grid lg:grid-cols-[1fr_400px] gap-8">
              <div className="aspect-[4/3] bg-[var(--color-bg-gray)] rounded-lg"></div>
              <div>
                <div className="h-10 bg-[var(--color-bg-gray)] rounded mb-4"></div>
                <div className="h-6 bg-[var(--color-bg-gray)] rounded w-2/3 mb-8"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-5 bg-[var(--color-bg-gray)] rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="section">
        <div className="container text-center">
          <div className="text-xl font-medium mb-4">
            {error || 'Объявление не найдено'}
          </div>
          <Link href={`/s/${code}/offers`} className="btn btn-primary">
            Вернуться к поиску
          </Link>
        </div>
      </div>
    );
  }

  const images = offer.images?.length
    ? offer.images
    : (offer.image_url ? [{ url: offer.image_url, tag: null }] : []);

  const agentName = context?.agent?.name;
  const agentPhone = context?.agent?.phone;

  return (
    <div className="section">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm">
          <Link href={`/s/${code}`} className="text-[var(--color-text-light)] hover:text-[var(--color-text)]">
            Подборка
          </Link>
          <span className="mx-2 text-[var(--color-text-light)]">/</span>
          <Link href={`/s/${code}/offers`} className="text-[var(--color-text-light)] hover:text-[var(--color-text)]">
            Поиск
          </Link>
          <span className="mx-2 text-[var(--color-text-light)]">/</span>
          <span>{offer.complex_name}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12">
          {/* Gallery */}
          <div>
            <ImageGallery images={images} complexName={offer.complex_name} />
          </div>

          {/* Info */}
          <div>
            {/* Price & Favorite */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
                  {formatPrice(offer.price)}
                </div>
                <div className="text-[var(--color-text-light)]">
                  {formatPrice(offer.price_per_sqm)}/м²
                </div>
              </div>
              <FavoriteButtonGuest offerId={offer.id} size="lg" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold mb-2">
              {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
            </h1>
            <p className="text-[var(--color-text-light)] mb-8">
              {formatFloor(offer.floor, offer.floors_total)}
            </p>

            {/* Details Grid */}
            <div className="card p-6 mb-6">
              <h2 className="font-semibold mb-4">Характеристики</h2>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <span className="text-[var(--color-text-light)]">Общая площадь</span>
                  <div className="font-medium">{formatArea(offer.area_total)}</div>
                </div>
                {offer.area_living && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Жилая площадь</span>
                    <div className="font-medium">{formatArea(offer.area_living)}</div>
                  </div>
                )}
                {offer.area_kitchen && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Кухня</span>
                    <div className="font-medium">{formatArea(offer.area_kitchen)}</div>
                  </div>
                )}
                <div>
                  <span className="text-[var(--color-text-light)]">Этаж</span>
                  <div className="font-medium">{formatFloor(offer.floor, offer.floors_total)}</div>
                </div>
                {offer.ceiling_height && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Высота потолков</span>
                    <div className="font-medium">{offer.ceiling_height} м</div>
                  </div>
                )}
                {offer.balcony && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Балкон/лоджия</span>
                    <div className="font-medium">{offer.balcony}</div>
                  </div>
                )}
                {offer.bathroom && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Санузел</span>
                    <div className="font-medium">{offer.bathroom}</div>
                  </div>
                )}
                <div>
                  <span className="text-[var(--color-text-light)]">Отделка</span>
                  <div className="font-medium">{offer.has_finishing ? 'Да' : 'Без отделки'}</div>
                </div>
              </div>
            </div>

            {/* Complex Info */}
            <div className="card p-6 mb-6">
              <h2 className="font-semibold mb-4">Жилой комплекс</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-[var(--color-text-light)]">Название</span>
                  <div className="font-medium">{offer.complex_name}</div>
                </div>
                {isValidDeveloperName(offer.developer_name) && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Застройщик</span>
                    <div className="font-medium">{offer.developer_name}</div>
                  </div>
                )}
                <div>
                  <span className="text-[var(--color-text-light)]">Адрес</span>
                  <div className="font-medium">{offer.complex_address}</div>
                </div>
                <div>
                  <span className="text-[var(--color-text-light)]">Район</span>
                  <div className="font-medium">{offer.district_name}</div>
                </div>
                {offer.metro_station && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Метро</span>
                    <div className="font-medium">
                      {offer.metro_station}
                      {offer.metro_distance && ` (${offer.metro_distance} мин пешком)`}
                    </div>
                  </div>
                )}
                {offer.completion_date && (
                  <div>
                    <span className="text-[var(--color-text-light)]">Срок сдачи</span>
                    <div className="font-medium">{offer.completion_date}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Contact Card */}
            {(agentName || agentPhone) && (
              <div className="card p-6 mb-6 bg-gray-50 border-[var(--color-border)]">
                <h2 className="font-semibold mb-3">Ваш персональный агент</h2>
                {agentName && <div className="font-medium mb-2">{agentName}</div>}
                {agentPhone && (
                  <a
                    href={`tel:${agentPhone}`}
                    className="btn btn-primary btn-sm inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Позвонить агенту
                  </a>
                )}
              </div>
            )}

            {/* Booking Form */}
            <BookingFormGuest offerId={offer.id} complexName={offer.complex_name} />

            {/* Mortgage Calculator */}
            <MortgageCalculator price={offer.price} className="mt-6" />
          </div>
        </div>

        {/* Description */}
        <OfferDescription description={offer.description} />

        {/* Map */}
        {offer.latitude && offer.longitude && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Расположение</h2>
            <YandexMap
              latitude={offer.latitude}
              longitude={offer.longitude}
              address={offer.complex_address}
            />
          </div>
        )}
      </div>
    </div>
  );
}
