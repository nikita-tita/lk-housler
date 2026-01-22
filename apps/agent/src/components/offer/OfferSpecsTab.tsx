'use client';

import { formatArea } from '@/services/api';
import type { OfferDetail } from '@/types';

interface OfferSpecsTabProps {
  offer: OfferDetail;
}

export function OfferSpecsTab({ offer }: OfferSpecsTabProps) {
  const specs = [
    { label: 'Общая площадь', value: formatArea(offer.area_total) },
    offer.area_living && { label: 'Жилая площадь', value: formatArea(offer.area_living) },
    offer.area_kitchen && { label: 'Кухня', value: formatArea(offer.area_kitchen) },
    { label: 'Этаж', value: `${offer.floor} из ${offer.floors_total}` },
    offer.ceiling_height && { label: 'Высота потолков', value: `${offer.ceiling_height} м` },
    offer.balcony && { label: 'Балкон/лоджия', value: offer.balcony },
    offer.bathroom && { label: 'Санузел', value: offer.bathroom },
    { label: 'Отделка', value: offer.has_finishing ? 'Чистовая' : 'Без отделки' },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-3">
      {specs.map((spec, idx) => (
        <div key={idx} className="flex justify-between text-sm">
          <span className="text-[var(--color-text-light)]">{spec.label}</span>
          <span className="font-medium">{spec.value}</span>
        </div>
      ))}
    </div>
  );
}
