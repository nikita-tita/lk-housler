'use client';

import { FavoriteButton } from '@/components/FavoriteButton';
import { AddToSelectionButton } from '@/components/AddToSelectionButton';
import { OfferPdfButton } from '@/components/OfferPdfButton';
import type { OfferDetail } from '@/types';

interface OfferQuickActionsProps {
  offer: OfferDetail;
}

export function OfferQuickActions({ offer }: OfferQuickActionsProps) {
  return (
    <div className="flex items-center gap-2 py-3 border-b border-[var(--color-border)]">
      {/* Favorite - using existing component with custom wrapper */}
      <FavoriteButton offerId={offer.id} size="md" className="!shadow-none !bg-[var(--color-bg-gray)] hover:!bg-gray-200" />

      {/* Add to selection - reusing existing component */}
      <div className="flex-1">
        <AddToSelectionButton offerId={offer.id} />
      </div>

      {/* PDF button - reusing existing component with compact styling */}
      <OfferPdfButton offer={offer} variant="compact" />

      {/* Share button */}
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: `${offer.rooms ? `${offer.rooms}-комн.` : 'Студия'} ${offer.area_total} м²`,
              text: `Квартира в ${offer.complex_name}`,
              url: window.location.href,
            });
          } else {
            navigator.clipboard.writeText(window.location.href);
          }
        }}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-bg-gray)] hover:bg-gray-200 transition-colors"
        title="Поделиться"
      >
        <svg className="w-5 h-5 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>
    </div>
  );
}
