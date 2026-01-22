'use client';

import { useRouter } from 'next/navigation';
import type { OfferListItem } from '@/types';
import { formatPrice, formatArea, formatRooms } from '@/services/api';
import { FavoriteButton } from './FavoriteButton';
import { CompareButton } from './CompareButton';
import { StatusBadge } from './StatusBadge';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (offer: OfferListItem) => React.ReactNode;
}

interface OffersTableProps {
  offers: OfferListItem[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  selectedIds?: Set<number>;
  onSelectChange?: (id: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

const COLUMNS: Column[] = [
  {
    key: 'plan',
    label: '',
    width: '50px',
    render: (o) => (
      <div className="w-10 h-10 bg-[var(--color-bg-gray)] rounded overflow-hidden flex-shrink-0">
        {(o.plan_image_url || o.image_url) ? (
          <img
            src={o.plan_image_url || o.image_url || ''}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'complex_name',
    label: 'ЖК',
    sortable: true,
    width: '180px',
    render: (o) => (
      <div className="font-medium text-[var(--color-text)] truncate max-w-[180px]" title={o.complex_name}>
        {o.complex_name}
      </div>
    ),
  },
  {
    key: 'district_name',
    label: 'Район',
    sortable: true,
    width: '140px',
    render: (o) => (
      <span className="truncate max-w-[140px]" title={o.district_name}>
        {o.district_name}
      </span>
    ),
  },
  {
    key: 'metro_station',
    label: 'Метро',
    width: '140px',
    render: (o) => o.metro_station ? (
      <span className="truncate max-w-[140px]" title={o.metro_station}>
        {o.metro_station}
        {o.metro_distance && (
          <span className="text-[var(--color-text-light)] text-xs ml-1">
            {o.metro_distance}м
          </span>
        )}
      </span>
    ) : '—',
  },
  {
    key: 'rooms',
    label: 'Тип',
    sortable: true,
    width: '90px',
    render: (o) => formatRooms(o.rooms, o.is_studio),
  },
  {
    key: 'area_total',
    label: 'Площадь',
    sortable: true,
    width: '90px',
    align: 'right',
    render: (o) => formatArea(o.area_total),
  },
  {
    key: 'floor',
    label: 'Этаж',
    sortable: true,
    width: '80px',
    align: 'center',
    render: (o) => `${o.floor}/${o.floors_total}`,
  },
  {
    key: 'price',
    label: 'Цена',
    sortable: true,
    width: '120px',
    align: 'right',
    render: (o) => (
      <span className="font-semibold text-[var(--color-text)]">
        {formatPrice(o.price)}
      </span>
    ),
  },
  {
    key: 'price_per_sqm',
    label: '₽/м²',
    sortable: true,
    width: '100px',
    align: 'right',
    render: (o) => (
      <span className="text-[var(--color-text-light)]">
        {formatPrice(o.price_per_sqm)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Статус',
    width: '100px',
    align: 'center',
    render: (o) => <StatusBadge buildingState={o.has_finishing ? 'hand-over' : undefined} />,
  },
];

export function OffersTable({
  offers,
  sortBy,
  sortOrder,
  onSort,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: OffersTableProps) {
  const router = useRouter();
  const showCheckboxes = selectedIds !== undefined && onSelectChange !== undefined;
  const allSelected = showCheckboxes && selectedIds.size === offers.length && offers.length > 0;

  const handleRowClick = (offerId: number, e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or buttons
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) {
      return;
    }
    router.push(`/offers/${offerId}`);
  };

  const handleSort = (column: string) => {
    if (onSort) {
      onSort(column);
    }
  };

  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-gray-50">
            {showCheckboxes && (
              <th className="w-10 p-3 border-b border-[var(--color-border)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)]"
                />
              </th>
            )}
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`
                  p-3 text-xs font-medium text-[var(--color-text-light)] uppercase tracking-wider
                  border-b border-[var(--color-border)]
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  ${col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
                `}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortBy === col.key && (
                    <span className="text-[var(--color-accent)]">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th className="w-20 p-3 border-b border-[var(--color-border)]"></th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer, idx) => {
            const isSelected = selectedIds?.has(offer.id);
            return (
              <tr
                key={offer.id}
                onClick={(e) => handleRowClick(offer.id, e)}
                className={`
                  cursor-pointer transition-colors
                  ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  ${isSelected ? 'bg-gray-100' : ''}
                  hover:bg-gray-100
                `}
              >
                {showCheckboxes && (
                  <td className="p-3 border-b border-[var(--color-border)]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectChange?.(offer.id, e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--color-border)]"
                    />
                  </td>
                )}
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      p-3 text-sm border-b border-[var(--color-border)]
                      ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                  >
                    {col.render ? col.render(offer) : (offer as unknown as Record<string, unknown>)[col.key]?.toString() || '—'}
                  </td>
                ))}
                <td className="p-3 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-1">
                    <FavoriteButton offerId={offer.id} size="sm" />
                    <CompareButton offerId={offer.id} size="sm" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
