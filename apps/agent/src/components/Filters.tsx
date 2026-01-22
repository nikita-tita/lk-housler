'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OfferFilters } from '@/types';
import { SearchAutocomplete } from './SearchAutocomplete';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useAuth } from '@/contexts/AuthContext';
import { AuthRequiredOverlay } from './AuthRequiredOverlay';
import { MultiSelect } from './filters/MultiSelect';
import { FloorFilter } from './filters/FloorFilter';
import { KitchenAreaFilter } from './filters/KitchenAreaFilter';
import { CeilingHeightFilter } from './filters/CeilingHeightFilter';
import { MetroTimeFilter } from './filters/MetroTimeFilter';
import { DebouncedNumberInput } from './filters/DebouncedNumberInput';
import { AiBrokerChat } from './AiBrokerChat';

type FilterTab = 'filters' | 'ai-broker';

interface FiltersProps {
  onFiltersChange?: (filters: OfferFilters) => void;
  totalOffers?: number;
}

export function Filters({ onFiltersChange, totalOffers = 0 }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filterOptions, isLoading } = useFilterOptions();
  useAuth(); // Verify user is authenticated
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('filters');

  // Current filter state from URL
  const [filters, setFilters] = useState<OfferFilters>({});

  // Parse URL params to filters
  useEffect(() => {
    const newFilters: OfferFilters = {};

    const rooms = searchParams.getAll('rooms');
    if (rooms.length) newFilters.rooms = rooms.map(Number);

    const isStudio = searchParams.get('is_studio');
    if (isStudio) newFilters.is_studio = isStudio === 'true';

    const priceMin = searchParams.get('price_min');
    if (priceMin) newFilters.price_min = Number(priceMin);

    const priceMax = searchParams.get('price_max');
    if (priceMax) newFilters.price_max = Number(priceMax);

    const areaMin = searchParams.get('area_min');
    if (areaMin) newFilters.area_min = Number(areaMin);

    const areaMax = searchParams.get('area_max');
    if (areaMax) newFilters.area_max = Number(areaMax);

    const districts = searchParams.getAll('districts');
    if (districts.length) newFilters.districts = districts;

    const metros = searchParams.getAll('metro_stations');
    if (metros.length) newFilters.metro_stations = metros;

    const metroTimeMax = searchParams.get('metro_time_max');
    if (metroTimeMax) newFilters.metro_time_max = Number(metroTimeMax);

    const buildingTypes = searchParams.getAll('building_type');
    if (buildingTypes.length) newFilters.building_type = buildingTypes;

    const hasFinishing = searchParams.get('has_finishing');
    if (hasFinishing) newFilters.has_finishing = hasFinishing === 'true';

    const search = searchParams.get('search');
    if (search) newFilters.search = search;

    const semanticSearch = searchParams.get('semantic_search');
    if (semanticSearch) newFilters.semantic_search = semanticSearch;

    const completionYears = searchParams.getAll('completion_years');
    if (completionYears.length) newFilters.completion_years = completionYears.map(Number);

    const developers = searchParams.getAll('developers');
    if (developers.length) newFilters.developers = developers;

    const floorMin = searchParams.get('floor_min');
    if (floorMin) newFilters.floor_min = Number(floorMin);

    const floorMax = searchParams.get('floor_max');
    if (floorMax) newFilters.floor_max = Number(floorMax);

    const notFirstFloor = searchParams.get('not_first_floor');
    if (notFirstFloor) newFilters.not_first_floor = notFirstFloor === 'true';

    const notLastFloor = searchParams.get('not_last_floor');
    if (notLastFloor) newFilters.not_last_floor = notLastFloor === 'true';

    const kitchenAreaMin = searchParams.get('kitchen_area_min');
    if (kitchenAreaMin) newFilters.kitchen_area_min = Number(kitchenAreaMin);

    const kitchenAreaMax = searchParams.get('kitchen_area_max');
    if (kitchenAreaMax) newFilters.kitchen_area_max = Number(kitchenAreaMax);

    const ceilingHeightMin = searchParams.get('ceiling_height_min');
    if (ceilingHeightMin) newFilters.ceiling_height_min = Number(ceilingHeightMin);

    setFilters(newFilters);
    onFiltersChange?.(newFilters);
    // Намеренно исключаем onFiltersChange из deps:
    // - Эффект должен срабатывать только при изменении URL (searchParams)
    // - onFiltersChange может меняться при каждом рендере родителя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Update URL with new filters (preserving sort)
  const applyFilters = (newFilters: OfferFilters) => {
    const params = new URLSearchParams();

    // Preserve sort param
    const currentSort = searchParams.get('sort');
    if (currentSort) params.set('sort', currentSort);

    if (newFilters.rooms?.length) {
      newFilters.rooms.forEach(r => params.append('rooms', r.toString()));
    }
    if (newFilters.is_studio !== undefined) {
      params.set('is_studio', newFilters.is_studio.toString());
    }
    if (newFilters.price_min) params.set('price_min', newFilters.price_min.toString());
    if (newFilters.price_max) params.set('price_max', newFilters.price_max.toString());
    if (newFilters.area_min) params.set('area_min', newFilters.area_min.toString());
    if (newFilters.area_max) params.set('area_max', newFilters.area_max.toString());
    if (newFilters.districts?.length) {
      newFilters.districts.forEach(d => params.append('districts', d));
    }
    if (newFilters.metro_stations?.length) {
      newFilters.metro_stations.forEach(m => params.append('metro_stations', m));
    }
    if (newFilters.metro_time_max) params.set('metro_time_max', newFilters.metro_time_max.toString());
    if (newFilters.building_type?.length) {
      newFilters.building_type.forEach(t => params.append('building_type', t));
    }
    if (newFilters.has_finishing !== undefined) {
      params.set('has_finishing', newFilters.has_finishing.toString());
    }
    if (newFilters.search) {
      params.set('search', newFilters.search);
    }
    if (newFilters.semantic_search) {
      params.set('semantic_search', newFilters.semantic_search);
    }
    if (newFilters.completion_years?.length) {
      newFilters.completion_years.forEach(y => params.append('completion_years', y.toString()));
    }
    if (newFilters.developers?.length) {
      newFilters.developers.forEach(d => params.append('developers', d));
    }
    if (newFilters.floor_min) params.set('floor_min', newFilters.floor_min.toString());
    if (newFilters.floor_max) params.set('floor_max', newFilters.floor_max.toString());
    if (newFilters.not_first_floor) params.set('not_first_floor', 'true');
    if (newFilters.not_last_floor) params.set('not_last_floor', 'true');
    if (newFilters.kitchen_area_min) params.set('kitchen_area_min', newFilters.kitchen_area_min.toString());
    if (newFilters.kitchen_area_max) params.set('kitchen_area_max', newFilters.kitchen_area_max.toString());
    if (newFilters.ceiling_height_min) params.set('ceiling_height_min', newFilters.ceiling_height_min.toString());

    // Reset page to 1 when filters change
    const query = params.toString();
    router.push(`/offers${query ? `?${query}` : ''}`);
  };

  const toggleRoom = (room: number) => {
    const currentRooms = filters.rooms || [];
    const newRooms = currentRooms.includes(room)
      ? currentRooms.filter(r => r !== room)
      : [...currentRooms, room];
    applyFilters({ ...filters, rooms: newRooms.length ? newRooms : undefined });
  };

  const toggleStudio = () => {
    applyFilters({
      ...filters,
      is_studio: filters.is_studio ? undefined : true,
    });
  };

  const clearFilters = () => {
    router.push('/offers');
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  // Подсчёт количества активных фильтров для отображения в кнопке
  const countActiveFilters = (): number => {
    let count = 0;
    if (filters.rooms?.length) count++;
    if (filters.is_studio) count++;
    if (filters.price_min || filters.price_max) count++;
    if (filters.area_min || filters.area_max) count++;
    if (filters.districts?.length) count++;
    if (filters.metro_stations?.length) count++;
    if (filters.metro_time_max) count++;
    if (filters.building_type?.length) count++;
    if (filters.completion_years?.length) count++;
    if (filters.developers?.length) count++;
    if (filters.floor_min || filters.floor_max || filters.not_first_floor || filters.not_last_floor) count++;
    if (filters.kitchen_area_min || filters.kitchen_area_max) count++;
    if (filters.ceiling_height_min) count++;
    if (filters.has_finishing) count++;
    if (filters.search) count++;
    if (filters.semantic_search) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Search input with debounce - must be before any conditional returns
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const { addToHistory } = useSearchHistory();

  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        // Save text search to history when user types
        if (searchInput && searchInput.length >= 2) {
          addToHistory('text', searchInput);
        }
        applyFilters({ ...filters, search: searchInput || undefined });
      }
    }, 500);
    return () => clearTimeout(timeout);
    // Намеренно исключаем filters, applyFilters, addToHistory из deps:
    // - Это debounce эффект, должен срабатывать только при изменении searchInput
    // - filters/applyFilters используют актуальные значения через замыкание
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Обработчик фильтров от AI-брокера - должен быть ДО early return!
  const handleAiFiltersChange = useCallback((aiFilters: Partial<OfferFilters>) => {
    // Merge AI filters with existing filters and apply to URL
    const mergedFilters = { ...filters, ...aiFilters };
    applyFilters(mergedFilters);
  }, [filters, applyFilters]);

  if (isLoading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-4 bg-[var(--color-bg-gray)] rounded w-1/4 mb-4"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 w-16 bg-[var(--color-bg-gray)] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="card overflow-hidden">
      {/* Tabs Header */}
      <div className="border-b border-[var(--color-border)]">
        <nav className="flex -mb-px">
          <button
            onClick={() => handleTabChange('filters')}
            className={`
              flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors
              ${activeTab === 'filters'
                ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Фильтры
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--color-bg-gray)]">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('ai-broker')}
            className={`
              flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors
              ${activeTab === 'ai-broker'
                ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            ИИ-брокер
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'filters' ? (
          <>
            {/* Search with Autocomplete */}
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Поиск по ЖК или адресу</div>
              <SearchAutocomplete
                value={searchInput}
                onChange={setSearchInput}
                onSelect={(suggestion) => {
                  if (suggestion.type === 'complex') {
                    setSearchInput(suggestion.name);
                  } else if (suggestion.type === 'district') {
                    applyFilters({ ...filters, districts: [suggestion.name], search: undefined });
                    setSearchInput('');
                  } else if (suggestion.type === 'metro') {
                    applyFilters({ ...filters, metro_stations: [suggestion.name], search: undefined });
                    setSearchInput('');
                  }
                }}
                suggestions={filterOptions}
                placeholder="Название ЖК, район или метро..."
              />
            </div>

            {/* Rooms Filter */}
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Комнатность</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleStudio}
                  className={`btn btn-sm ${filters.is_studio ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Студия
                </button>
                {[1, 2, 3, 4].map(room => (
                  <button
                    key={room}
                    onClick={() => toggleRoom(room)}
                    className={`btn btn-sm ${filters.rooms?.includes(room) ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {room}
                  </button>
                ))}
              </div>
            </div>

            {/* Expanded Filters */}
            {isExpanded && (
        <AuthRequiredOverlay message="Войдите для использования расширенных фильтров">
          {/* Price Range */}
          <div className="mb-6">
            <div className="text-sm font-medium mb-3">Цена, ₽</div>
            <div className="grid grid-cols-2 gap-3">
              <DebouncedNumberInput
                value={filters.price_min}
                onChange={(val) => applyFilters({ ...filters, price_min: val })}
                placeholder="от 5 000 000"
                formatThousands={true}
                delay={800}
              />
              <DebouncedNumberInput
                value={filters.price_max}
                onChange={(val) => applyFilters({ ...filters, price_max: val })}
                placeholder="до 50 000 000"
                formatThousands={true}
                delay={800}
              />
            </div>
          </div>

          {/* Area Range */}
          <div className="mb-6">
            <div className="text-sm font-medium mb-3">Площадь, м²</div>
            <div className="grid grid-cols-2 gap-3">
              <DebouncedNumberInput
                value={filters.area_min}
                onChange={(val) => applyFilters({ ...filters, area_min: val })}
                placeholder="от 20"
                formatThousands={false}
                delay={600}
              />
              <DebouncedNumberInput
                value={filters.area_max}
                onChange={(val) => applyFilters({ ...filters, area_max: val })}
                placeholder="до 150"
                formatThousands={false}
                delay={600}
              />
            </div>
          </div>

          {/* District MultiSelect */}
          {filterOptions?.districts && filterOptions.districts.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Район</div>
              <MultiSelect
                options={filterOptions.districts.map(d => ({
                  value: d.name,
                  label: d.name,
                  count: d.count
                }))}
                value={filters.districts || []}
                onChange={(values) => applyFilters({
                  ...filters,
                  districts: values.length ? values : undefined,
                })}
                placeholder="Выберите район"
                searchPlaceholder="Поиск района..."
              />
            </div>
          )}

          {/* Metro MultiSelect */}
          {filterOptions?.metro_stations && filterOptions.metro_stations.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Метро</div>
              <MultiSelect
                options={filterOptions.metro_stations.map(m => ({
                  value: m.name,
                  label: m.name,
                  count: m.count
                }))}
                value={filters.metro_stations || []}
                onChange={(values) => applyFilters({
                  ...filters,
                  metro_stations: values.length ? values : undefined,
                })}
                placeholder="Выберите метро"
                searchPlaceholder="Поиск станции..."
              />
            </div>
          )}

          {/* Metro Time Filter */}
          <div className="mb-6">
            <MetroTimeFilter
              value={filters.metro_time_max}
              onChange={(value) => applyFilters({
                ...filters,
                metro_time_max: value,
              })}
            />
          </div>

          {/* Completion Year MultiSelect */}
          {filterOptions?.completion_years && filterOptions.completion_years.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Срок сдачи</div>
              <MultiSelect
                options={filterOptions.completion_years.map(y => ({
                  value: y.year.toString(),
                  label: y.year.toString(),
                  count: y.count
                }))}
                value={(filters.completion_years || []).map(String)}
                onChange={(values) => applyFilters({
                  ...filters,
                  completion_years: values.length ? values.map(Number) : undefined,
                })}
                placeholder="Выберите год"
                searchPlaceholder="Поиск года..."
              />
            </div>
          )}

          {/* Developer MultiSelect */}
          {filterOptions?.developers && filterOptions.developers.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Застройщик</div>
              <MultiSelect
                options={filterOptions.developers.map(d => ({
                  value: d.name,
                  label: d.name,
                  count: d.count
                }))}
                value={filters.developers || []}
                onChange={(values) => applyFilters({
                  ...filters,
                  developers: values.length ? values : undefined,
                })}
                placeholder="Выберите застройщика"
                searchPlaceholder="Поиск застройщика..."
              />
            </div>
          )}

          {/* Building Type MultiSelect */}
          {filterOptions?.building_types && filterOptions.building_types.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-3">Тип дома</div>
              <MultiSelect
                options={filterOptions.building_types.map(t => ({
                  value: t.name,
                  label: t.name,
                  count: t.count
                }))}
                value={filters.building_type || []}
                onChange={(values) => applyFilters({
                  ...filters,
                  building_type: values.length ? values : undefined,
                })}
                placeholder="Выберите тип дома"
                searchPlaceholder="Поиск типа..."
              />
            </div>
          )}

          {/* Floor Filter */}
          <div className="mb-6">
            <FloorFilter
              floorMin={filters.floor_min}
              floorMax={filters.floor_max}
              notFirstFloor={filters.not_first_floor}
              notLastFloor={filters.not_last_floor}
              onChange={(floorFilters) => applyFilters({
                ...filters,
                floor_min: floorFilters.floor_min,
                floor_max: floorFilters.floor_max,
                not_first_floor: floorFilters.not_first_floor,
                not_last_floor: floorFilters.not_last_floor,
              })}
            />
          </div>

          {/* Kitchen Area Filter */}
          <div className="mb-6">
            <KitchenAreaFilter
              min={filters.kitchen_area_min}
              max={filters.kitchen_area_max}
              onChange={(kitchenFilters) => applyFilters({
                ...filters,
                kitchen_area_min: kitchenFilters.kitchen_area_min,
                kitchen_area_max: kitchenFilters.kitchen_area_max,
              })}
            />
          </div>

          {/* Ceiling Height Filter */}
          <div className="mb-6">
            <CeilingHeightFilter
              value={filters.ceiling_height_min}
              onChange={(value) => applyFilters({
                ...filters,
                ceiling_height_min: value,
              })}
            />
          </div>

          {/* Finishing Checkbox */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.has_finishing || false}
                onChange={e => applyFilters({
                  ...filters,
                  has_finishing: e.target.checked ? true : undefined,
                })}
                className="w-5 h-5 rounded border-[var(--color-border)]"
              />
              <span className="text-sm">Только с отделкой</span>
            </label>
          </div>
        </AuthRequiredOverlay>
      )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="btn btn-secondary flex-1"
              >
                {isExpanded ? 'Свернуть' : `Все фильтры${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn btn-secondary"
                >
                  Сбросить
                </button>
              )}
            </div>
          </>
        ) : (
          /* AI Broker Tab Content */
          <AiBrokerChat
            currentFilters={filters}
            totalOffers={totalOffers}
            onFiltersChange={handleAiFiltersChange}
          />
        )}
      </div>
    </div>
  );
}

// Simple wrapper for compatibility with existing code
export function FiltersWithSmartSearch(props: FiltersProps) {
  return <Filters {...props} />;
}
