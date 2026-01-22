'use client';

import type { OfferDetail } from '@/types';
import { YandexMap } from '@/components/YandexMap';
import { OfferGalleryV2 } from './OfferGalleryV2';
import { OfferInfoPanel } from './OfferInfoPanel';

interface CompactOfferViewV2Props {
  offer: OfferDetail;
}

/**
 * CompactOfferViewV2 - улучшенный компактный вид карточки квартиры
 *
 * Variant B: Split 60/40 layout
 * - Слева: галерея с видимыми стрелками, контрастными dots, миниатюрами
 * - Справа: sticky панель с ценой, характеристиками, CTA
 */
export function CompactOfferViewV2({ offer }: CompactOfferViewV2Props) {
  // Prepare images array
  const images = offer.images?.length
    ? offer.images
    : (offer.image_url ? [{ url: offer.image_url, tag: null }] : []);

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-8">
      {/* Left Column: Gallery + Map */}
      <div className="space-y-6">
        <OfferGalleryV2 images={images} complexName={offer.complex_name} />

        {/* Map */}
        {offer.latitude && offer.longitude && (
          <div>
            <h2 className="font-semibold mb-3">Расположение</h2>
            <YandexMap
              latitude={offer.latitude}
              longitude={offer.longitude}
              address={offer.complex_address}
            />
          </div>
        )}
      </div>

      {/* Right Column: Info Panel (sticky) */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <OfferInfoPanel offer={offer} />
      </div>
    </div>
  );
}
