'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { OfferListItem } from '@/types';
import { formatPrice, formatRooms } from '@/services/api';

interface ChessBoardProps {
  offers: OfferListItem[];
  floorsTotal: number;
}


export function ChessBoard({ offers }: ChessBoardProps) {
  const [hoveredOffer, setHoveredOffer] = useState<OfferListItem | null>(null);
  const [filterRooms, setFilterRooms] = useState<number | null>(null);

  // Group offers by floor and section/entrance
  const { grid, sections, floors } = useMemo(() => {
    // Extract unique sections (using building_name or a default)
    const sectionsSet = new Set<string>();
    const floorsSet = new Set<number>();

    offers.forEach(offer => {
      const section = offer.building_name || 'Секция 1';
      sectionsSet.add(section);
      floorsSet.add(offer.floor);
    });

    const sections = Array.from(sectionsSet).sort();
    // Только этажи с квартирами, отсортированные по убыванию
    const floors = Array.from(floorsSet).sort((a, b) => b - a);

    // Create grid
    const grid: Map<string, OfferListItem[]> = new Map();
    offers.forEach(offer => {
      const section = offer.building_name || 'Секция 1';
      const key = `${offer.floor}-${section}`;
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key)!.push(offer);
    });

    return { grid, sections, floors };
  }, [offers]);

  // Filter offers by rooms
  const { filteredGrid, filteredFloors } = useMemo(() => {
    if (filterRooms === null) {
      return { filteredGrid: grid, filteredFloors: floors };
    }

    const filtered = new Map<string, OfferListItem[]>();
    const floorsWithOffers = new Set<number>();

    grid.forEach((offers, key) => {
      const filteredOffers = offers.filter(o =>
        filterRooms === 0 ? o.is_studio : o.rooms === filterRooms
      );
      if (filteredOffers.length > 0) {
        filtered.set(key, filteredOffers);
        // Извлекаем этаж из ключа "floor-section"
        const floor = parseInt(key.split('-')[0]);
        floorsWithOffers.add(floor);
      }
    });

    return {
      filteredGrid: filtered,
      filteredFloors: Array.from(floorsWithOffers).sort((a, b) => b - a)
    };
  }, [grid, floors, filterRooms]);

  // Get available room types
  const roomTypes = useMemo(() => {
    const types = new Set<number>();
    offers.forEach(o => {
      if (o.is_studio) {
        types.add(0);
      } else if (o.rooms) {
        types.add(o.rooms);
      }
    });
    return Array.from(types).sort((a, b) => a - b);
  }, [offers]);

  const getCellColor = (offer: OfferListItem) => {
    // Используем разные оттенки серого для разных типов квартир
    if (offer.is_studio) return 'bg-gray-200 hover:bg-gray-300';
    switch (offer.rooms) {
      case 1: return 'bg-gray-100 hover:bg-gray-200';
      case 2: return 'bg-gray-200 hover:bg-gray-300';
      case 3: return 'bg-gray-300 hover:bg-gray-400';
      case 4: return 'bg-gray-400 hover:bg-gray-500 text-white';
      default: return 'bg-gray-100 hover:bg-gray-200';
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-[var(--color-text-light)]">Фильтр:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterRooms(null)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filterRooms === null
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            Все
          </button>
          {roomTypes.map(rooms => (
            <button
              key={rooms}
              onClick={() => setFilterRooms(rooms)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterRooms === rooms
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
            >
              {rooms === 0 ? 'Студия' : `${rooms}К`}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
          <span>Студия</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
          <span>1К</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
          <span>2К</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-300 border border-gray-400" />
          <span>3К</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-400" />
          <span>4К+</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-100 opacity-30" />
          <span>Продано</span>
        </div>
      </div>

      {/* Chess Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            {/* Floor labels */}
            <div className="flex-shrink-0 w-12 mr-2">
              <div className="h-8 mb-1" /> {/* Header spacer */}
              {filteredFloors.map(floor => (
                <div
                  key={floor}
                  className="h-10 flex items-center justify-end pr-2 text-sm text-[var(--color-text-light)]"
                >
                  {floor}
                </div>
              ))}
            </div>

            {/* Sections */}
            {sections.map((section) => (
              <div key={section} className="flex-shrink-0 mr-4">
                <div className="h-8 mb-1 text-sm font-medium text-center truncate max-w-[120px]">
                  {section}
                </div>
                {filteredFloors.map(floor => {
                  const key = `${floor}-${section}`;
                  const cellOffers = filteredGrid.get(key) || [];

                  return (
                    <div
                      key={floor}
                      className="h-10 flex gap-1 mb-1"
                    >
                      {cellOffers.length === 0 ? (
                        <div className="w-10 h-full" /> // Пустой spacer для выравнивания
                      ) : (
                        cellOffers.map(offer => (
                          <Link
                            key={offer.id}
                            href={`/offers/${offer.id}`}
                            onMouseEnter={() => setHoveredOffer(offer)}
                            onMouseLeave={() => setHoveredOffer(null)}
                            className={`
                              w-10 h-full rounded flex items-center justify-center
                              text-xs font-medium transition-all cursor-pointer
                              ${getCellColor(offer)}
                              ${hoveredOffer?.id === offer.id ? 'ring-2 ring-[var(--color-accent)] scale-110 z-10' : ''}
                            `}
                          >
                            {offer.is_studio ? 'С' : offer.rooms}
                          </Link>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Info */}
      {hoveredOffer && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl border border-[var(--color-border)] p-4 z-50 min-w-[280px]">
          <div className="flex justify-between items-start mb-2">
            <div className="font-semibold">
              {formatRooms(hoveredOffer.rooms, hoveredOffer.is_studio)}
            </div>
            <div className="text-lg font-semibold">
              {formatPrice(hoveredOffer.price)}
            </div>
          </div>
          <div className="text-sm text-[var(--color-text-light)]">
            {hoveredOffer.area_total} м² • {hoveredOffer.floor}/{hoveredOffer.floors_total} этаж
          </div>
          <div className="text-xs text-[var(--color-text-light)] mt-1">
            {formatPrice(hoveredOffer.price_per_sqm)}/м²
          </div>
        </div>
      )}
    </div>
  );
}
