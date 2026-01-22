'use client';

import Link from 'next/link';
import type { OfferListItem } from '@/types';
import { formatPrice, formatArea, formatRooms, formatFloor } from '@/services/api';
import { FavoriteButtonGuest } from './FavoriteButtonGuest';
import { AddToClientSelectionButton } from '@/components/AddToClientSelectionButton';
import { MortgageBadge } from '@/components/MortgageBadge';

interface Props {
  offer: OfferListItem;
  selectionCode: string;
  highlighted?: boolean;
  compact?: boolean;
}

export function OfferCardGuest({ offer, selectionCode, highlighted, compact }: Props) {
  const offerUrl = `/s/${selectionCode}/offers/${offer.id}`;

  if (compact) {
    return (
      <Link
        href={offerUrl}
        className={`card block overflow-hidden group ${highlighted ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
      >
        <div className="flex gap-3">
          <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-bg-gray)] relative overflow-hidden rounded-lg">
            {offer.image_url ? (
              <img
                src={offer.image_url}
                alt={`${formatRooms(offer.rooms, offer.is_studio)}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 py-1 min-w-0">
            <div className="font-semibold text-base mb-0.5">{formatPrice(offer.price)}</div>
            <div className="text-sm text-[var(--color-text-light)] mb-1">
              {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}, {formatFloor(offer.floor, offer.floors_total)}
            </div>
            <div className="text-sm font-medium truncate">{offer.complex_name}</div>
            <div className="text-xs text-[var(--color-text-light)] truncate">
              {offer.district_name}
              {offer.metro_station && ` • м. ${offer.metro_station}`}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={offerUrl} className={`card block overflow-hidden group ${highlighted ? 'ring-2 ring-[var(--color-accent)]' : ''}`}>
      {/* Image */}
      <div className="aspect-[4/3] bg-[var(--color-bg-gray)] relative overflow-hidden">
        {offer.image_url ? (
          <img
            src={offer.image_url}
            alt={`${formatRooms(offer.rooms, offer.is_studio)} в ЖК ${offer.complex_name}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {offer.is_studio && (
            <span className="bg-black text-white text-xs font-medium px-2.5 py-1 rounded">
              Студия
            </span>
          )}
          {offer.has_finishing && (
            <span className="bg-white text-black text-xs font-medium px-2.5 py-1 rounded border border-[var(--color-border)]">
              С отделкой
            </span>
          )}
        </div>

        {/* Action buttons — гостевые версии */}
        <div className="absolute top-3 right-3 flex gap-2">
          <AddToClientSelectionButton offerId={offer.id} size="sm" />
          <FavoriteButtonGuest offerId={offer.id} size="sm" />
        </div>

        {/* Completion status badge */}
        {offer.completion_date && (
          <div className="absolute bottom-3 left-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded ${
              offer.completion_date === 'Сдан'
                ? 'bg-[var(--gray-900)] text-white'
                : 'bg-white/90 text-black border border-[var(--color-border)]'
            }`}>
              {offer.completion_date === 'Сдан' ? 'Сдан' : `Сдача: ${offer.completion_date}`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Price */}
        <div className="mb-3">
          <div className="price">{formatPrice(offer.price)}</div>
          <div className="flex items-center justify-between">
            <div className="price-per-sqm">
              {formatPrice(offer.price_per_sqm)}/м²
            </div>
            <MortgageBadge price={offer.price} />
          </div>
        </div>

        {/* Main Info */}
        <div className="mb-3">
          <div className="font-medium text-base mb-1">
            {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
          </div>
          <div className="text-sm text-[var(--color-text-light)]">
            {formatFloor(offer.floor, offer.floors_total)}
          </div>
        </div>

        {/* Complex & Location */}
        <div className="pt-3 border-t border-[var(--color-border)]">
          <div className="font-medium text-sm mb-1">{offer.complex_name}</div>
          <div className="text-sm text-[var(--color-text-light)]">
            {offer.district_name}
            {offer.metro_station && (
              <span>
                {' '}• м. {offer.metro_station}
                {offer.metro_distance && (
                  <span className="text-xs"> ({offer.metro_distance} мин)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
