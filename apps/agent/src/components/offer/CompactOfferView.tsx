'use client';

import { useState, useMemo } from 'react';
import { formatRooms, formatArea, formatFloor } from '@/services/api';
import type { OfferDetail } from '@/types';

import { OfferGalleryCompact } from './OfferGalleryCompact';
import { OfferPriceBlock } from './OfferPriceBlock';
import { OfferQuickActions } from './OfferQuickActions';
import { OfferSpecsTab } from './OfferSpecsTab';
import { OfferComplexTab } from './OfferComplexTab';
import { OfferMortgageTab } from './OfferMortgageTab';
import { OfferLocationTab } from './OfferLocationTab';
import { OfferBookingInline } from './OfferBookingInline';

interface CompactOfferViewProps {
  offer: OfferDetail;
}

type InfoTab = 'specs' | 'complex' | 'mortgage' | 'location';

export function CompactOfferView({ offer }: CompactOfferViewProps) {
  const [activeTab, setActiveTab] = useState<InfoTab>('specs');

  // Available tabs (location only if coordinates exist)
  const availableTabs = useMemo(() => {
    const tabs: { id: InfoTab; label: string }[] = [
      { id: 'specs', label: 'Характеристики' },
      { id: 'complex', label: 'О доме' },
      { id: 'mortgage', label: 'Ипотека' },
    ];
    if (offer.latitude && offer.longitude) {
      tabs.push({ id: 'location', label: 'На карте' });
    }
    return tabs;
  }, [offer.latitude, offer.longitude]);

  // Images for gallery
  const images = offer.images?.length
    ? offer.images
    : (offer.image_url ? [{ url: offer.image_url, tag: null }] : []);

  return (
    <div className="grid lg:grid-cols-[minmax(280px,400px)_1fr] gap-6">
      {/* Left Column: Gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <OfferGalleryCompact images={images} complexName={offer.complex_name} />
      </div>

      {/* Right Column: Info Panel */}
      <div className="card p-5 flex flex-col">
        {/* Price Block */}
        <OfferPriceBlock
          offerId={offer.id}
          price={offer.price}
          pricePerSqm={offer.price_per_sqm}
        />

        {/* Quick Info */}
        <div className="py-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-semibold">
            {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
          </h1>
          <p className="text-sm text-[var(--color-text-light)] mt-1">
            {formatFloor(offer.floor, offer.floors_total)} • {offer.complex_name}
            {offer.metro_station && (
              <span className="ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gray-900)] mr-1" />
                {offer.metro_station}
              </span>
            )}
          </p>
        </div>

        {/* Quick Actions */}
        <OfferQuickActions offer={offer} />

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] mt-4">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--color-text)] border-b-2 border-[var(--gray-900)] -mb-px'
                  : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 py-4 min-h-[200px]">
          {activeTab === 'specs' && <OfferSpecsTab offer={offer} />}
          {activeTab === 'complex' && <OfferComplexTab offer={offer} />}
          {activeTab === 'mortgage' && <OfferMortgageTab price={offer.price} />}
          {activeTab === 'location' && <OfferLocationTab offer={offer} />}
        </div>

        {/* CTA */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <OfferBookingInline offerId={offer.id} complexName={offer.complex_name} />
        </div>
      </div>
    </div>
  );
}
