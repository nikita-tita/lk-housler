'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CompactComplexView } from '@/components/complex/CompactComplexView';
import type { ComplexDetail, OfferListItem } from '@/types';

// Mock data для разных сценариев
const mockOffers: OfferListItem[] = [
  { id: 1, rooms: 1, is_studio: false, floor: 5, floors_total: 25, area_total: 38.5, price: 8500000, price_per_sqm: 220779, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: true, image_url: 'https://cdn.housler.ru/images/plan1.jpg', plan_image_url: 'https://cdn.housler.ru/images/plan1.jpg' },
  { id: 2, rooms: 2, is_studio: false, floor: 12, floors_total: 25, area_total: 55.2, price: 12800000, price_per_sqm: 231884, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: false, image_url: 'https://cdn.housler.ru/images/plan2.jpg', plan_image_url: 'https://cdn.housler.ru/images/plan2.jpg' },
  { id: 3, rooms: null, is_studio: true, floor: 3, floors_total: 25, area_total: 28.0, price: 6200000, price_per_sqm: 221428, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: true, image_url: null, plan_image_url: null },
  { id: 4, rooms: 3, is_studio: false, floor: 18, floors_total: 25, area_total: 78.3, price: 18500000, price_per_sqm: 236270, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: true, image_url: 'https://cdn.housler.ru/images/plan3.jpg', plan_image_url: 'https://cdn.housler.ru/images/plan3.jpg' },
  { id: 5, rooms: 1, is_studio: false, floor: 7, floors_total: 25, area_total: 42.1, price: 9200000, price_per_sqm: 218527, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: false, image_url: 'https://cdn.housler.ru/images/plan4.jpg', plan_image_url: null },
  { id: 6, rooms: 2, is_studio: false, floor: 21, floors_total: 25, area_total: 62.8, price: 14200000, price_per_sqm: 226114, complex_name: 'ЖК Тест', district_name: 'Приморский', metro_station: 'Комендантский', metro_distance: 10, has_finishing: true, image_url: null, plan_image_url: 'https://cdn.housler.ru/images/plan5.jpg' },
];

// Сценарий 1: Полный набор данных (всё есть)
const fullComplex: ComplexDetail = {
  id: 1,
  name: 'ЖК Граф Орлов',
  district: 'Московский',
  address: 'Пулковское шоссе, д. 14',
  offers_count: 156,
  min_price: '6200000',
  max_price: '24500000',
  min_area: '28',
  max_area: '95',
  building_state: 'unfinished',
  image_url: null,
  metro_station: 'Московская',
  metro_distance: 15,
  developer_name: 'Setl City',
  developer_id: 1,
  description: 'Жилой комплекс бизнес-класса с развитой инфраструктурой. На территории расположены детские площадки, спортивные зоны, подземный паркинг на 500 машиномест.\n\nВ шаговой доступности метро, торговые центры, школы и детские сады.',
  main_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
  images: [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
    'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=800',
  ],
  latitude: 59.8365,
  longitude: 30.3174,
  floors_total: 25,
  completion_date: '2 кв. 2025',
  class: 'Бизнес',
  parking: 'Подземный паркинг',
};

// Сценарий 2: Минимальный набор (только обязательные данные)
const minimalComplex: ComplexDetail = {
  id: 2,
  name: 'ЖК Северная Долина',
  district: 'Выборгский',
  address: 'пр. Просвещения, д. 99',
  offers_count: 42,
  min_price: '4800000',
  max_price: '12000000',
  min_area: '22',
  max_area: '68',
  building_state: 'hand-over',
  image_url: null,
  metro_station: null,
  metro_distance: null,
  developer_name: null,
  developer_id: null,
  description: null,
  main_image: null,
  images: [],
  latitude: null,
  longitude: null,
  floors_total: null,
  completion_date: null,
  class: null,
  parking: null,
};

// Сценарий 3: Есть координаты, нет метро и застройщика
const withLocationComplex: ComplexDetail = {
  id: 3,
  name: 'ЖК Лахта Парк',
  district: 'Приморский',
  address: 'Лахтинский пр., д. 85',
  offers_count: 78,
  min_price: '9500000',
  max_price: '32000000',
  min_area: '35',
  max_area: '120',
  building_state: 'unfinished',
  image_url: null,
  metro_station: null,
  metro_distance: null,
  developer_name: null,
  developer_id: null,
  description: 'Современный жилой комплекс премиум-класса с видом на Финский залив.',
  main_image: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800',
  images: ['https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800'],
  latitude: 60.0082,
  longitude: 30.1586,
  floors_total: 18,
  completion_date: '4 кв. 2025',
  class: 'Премиум',
  parking: null,
};

// Сценарий 4: Есть застройщик и метро, нет координат и фото
const withDeveloperComplex: ComplexDetail = {
  id: 4,
  name: 'ЖК Цветной Город',
  district: 'Красногвардейский',
  address: 'Индустриальный пр., д. 40',
  offers_count: 234,
  min_price: '5200000',
  max_price: '15800000',
  min_area: '25',
  max_area: '85',
  building_state: 'hand-over',
  image_url: null,
  metro_station: 'Ладожская',
  metro_distance: 8,
  developer_name: 'ЛСР. Недвижимость',
  developer_id: 2,
  description: null,
  main_image: null,
  images: [],
  latitude: null,
  longitude: null,
  floors_total: 20,
  completion_date: 'Сдан',
  class: 'Комфорт',
  parking: 'Наземный паркинг',
};

type ScenarioKey = 'full' | 'minimal' | 'location' | 'developer';

const scenarios: { key: ScenarioKey; label: string; description: string; complex: ComplexDetail }[] = [
  { key: 'full', label: 'Полный набор', description: 'Все данные заполнены: фото, карта, застройщик, метро, характеристики', complex: fullComplex },
  { key: 'minimal', label: 'Минимальный', description: 'Только базовые данные: название, адрес, цены', complex: minimalComplex },
  { key: 'location', label: 'С картой', description: 'Есть координаты и фото, нет метро и застройщика', complex: withLocationComplex },
  { key: 'developer', label: 'С застройщиком', description: 'Есть метро и застройщик, нет фото и координат', complex: withDeveloperComplex },
];

export default function DemoCompactViewPage() {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('full');
  const currentScenario = scenarios.find(s => s.key === activeScenario)!;

  return (
    <div className="min-h-screen bg-[var(--color-bg-gray)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--color-border)] sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Link href="/" className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] mb-1 block">
                ← На главную
              </Link>
              <h1 className="text-xl font-semibold">Demo: Компактный вид карточки ЖК</h1>
            </div>
          </div>

          {/* Scenario Selector */}
          <div className="flex flex-wrap gap-2">
            {scenarios.map(scenario => (
              <button
                key={scenario.key}
                onClick={() => setActiveScenario(scenario.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeScenario === scenario.key
                    ? 'bg-[var(--gray-900)] text-white'
                    : 'bg-[var(--color-bg-gray)] text-[var(--color-text)] hover:bg-gray-200'
                }`}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          {/* Scenario Description */}
          <div className="mt-3 text-sm text-[var(--color-text-light)]">
            {currentScenario.description}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <CompactComplexView
          complex={currentScenario.complex}
          offers={mockOffers}
          isLoading={false}
        />
      </div>

      {/* Legend */}
      <div className="container pb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Что изменилось в UX:</h3>
          <ul className="space-y-2 text-sm text-[var(--color-text-light)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Информационная панель с табами</strong> — вместо пустых мест переключаемся между блоками: Цены, Застройщик, Характеристики, Карта</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Адаптивные табы</strong> — показываются только те, для которых есть данные (нет застройщика = нет таба)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Переключатели вида квартир</strong> — Карточки / Список / Планировки в одном месте</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Компактная галерея</strong> — точки-индикаторы вместо миниатюр, лайтбокс по клику</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Описание в аккордеоне</strong> — сворачиваемый блок, не занимает место если не нужен</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--gray-900)]">✓</span>
              <span><strong>Карта лениво загружается</strong> — только при переключении на таб &quot;На карте&quot;</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
