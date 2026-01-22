'use client';

import Link from 'next/link';
import type { OfferDetail } from '@/types';
import { isValidDeveloperName } from '@/utils/developer';

interface OfferComplexTabProps {
  offer: OfferDetail;
}

export function OfferComplexTab({ offer }: OfferComplexTabProps) {
  return (
    <div className="space-y-4">
      {/* Complex name with link */}
      <div>
        <div className="text-xs text-[var(--color-text-light)] mb-1">Жилой комплекс</div>
        <div className="font-semibold text-base">{offer.complex_name}</div>
      </div>

      {/* Developer */}
      {isValidDeveloperName(offer.developer_name) && (
        <div>
          <div className="text-xs text-[var(--color-text-light)] mb-1">Застройщик</div>
          <div className="text-sm">{offer.developer_name}</div>
        </div>
      )}

      {/* Address */}
      <div>
        <div className="text-xs text-[var(--color-text-light)] mb-1">Адрес</div>
        <div className="text-sm">{offer.complex_address}</div>
      </div>

      {/* District */}
      <div>
        <div className="text-xs text-[var(--color-text-light)] mb-1">Район</div>
        <div className="text-sm">{offer.district_name}</div>
      </div>

      {/* Metro */}
      {offer.metro_station && (
        <div>
          <div className="text-xs text-[var(--color-text-light)] mb-1">Метро</div>
          <div className="text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gray-900)]" />
            {offer.metro_station}
            {offer.metro_distance && (
              <span className="text-[var(--color-text-light)]">
                {offer.metro_distance} мин пешком
              </span>
            )}
          </div>
        </div>
      )}

      {/* Completion date */}
      {offer.completion_date && (
        <div>
          <div className="text-xs text-[var(--color-text-light)] mb-1">Срок сдачи</div>
          <div className="text-sm">{offer.completion_date}</div>
        </div>
      )}

      {/* Link to complex page */}
      <Link
        href={`/complexes?search=${encodeURIComponent(offer.complex_name)}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline mt-2"
      >
        Все квартиры в этом ЖК
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
