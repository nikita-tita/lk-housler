'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { OfferListItem } from '@/types';
import { formatPrice, formatArea, formatRooms } from '@/services/api';
import { FavoriteButton } from './FavoriteButton';
import { CompareButton } from './CompareButton';

interface PlansGridProps {
  offers: OfferListItem[];
}

interface LightboxProps {
  imageUrl: string;
  offer: OfferListItem;
  onClose: () => void;
}

function Lightbox({ imageUrl, offer, onClose }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-gray-100">
          <img
            src={imageUrl}
            alt="Планировка"
            className="max-h-[60vh] w-auto mx-auto object-contain"
          />
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-lg font-semibold">
                {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
              </div>
              <div className="text-[var(--color-text-light)]">
                {offer.complex_name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold">{formatPrice(offer.price)}</div>
              <div className="text-sm text-[var(--color-text-light)]">
                {formatPrice(offer.price_per_sqm)}/м²
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/offers/${offer.id}`}
              className="btn btn-primary flex-1 text-center"
            >
              Подробнее
            </Link>
            <FavoriteButton offerId={offer.id} />
            <CompareButton offerId={offer.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ offer }: { offer: OfferListItem }) {
  const [showLightbox, setShowLightbox] = useState(false);
  // Предпочитаем plan_image_url, иначе fallback на image_url
  const planImage = offer.plan_image_url || offer.image_url;

  return (
    <>
      <div
        className="card group cursor-pointer overflow-hidden"
        onClick={() => planImage && setShowLightbox(true)}
      >
        {/* Plan Image */}
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {planImage ? (
            <>
              <img
                src={planImage}
                alt="Планировка"
                className="w-full h-full object-contain p-4"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex justify-between items-start mb-1">
            <span className="font-medium text-sm">
              {formatRooms(offer.rooms, offer.is_studio)}
            </span>
            <span className="font-semibold">{formatPrice(offer.price)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-[var(--color-text-light)]">
            <span>{formatArea(offer.area_total)}</span>
            <span>{offer.floor}/{offer.floors_total} эт.</span>
          </div>
          <div className="text-xs text-[var(--color-text-light)] mt-1 truncate" title={offer.complex_name}>
            {offer.complex_name}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && planImage && (
        <Lightbox
          imageUrl={planImage}
          offer={offer}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
}

export function PlansGrid({ offers }: PlansGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {offers.map((offer) => (
        <PlanCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}
