'use client';

import Link from 'next/link';
import type { ComplexDetail } from '@/types';
import { formatPrice } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';

interface ComplexSidebarProps {
  complex: ComplexDetail;
}

export function ComplexSidebar({ complex }: ComplexSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Price Card */}
      <div className="card p-6">
        <div className="text-sm text-[var(--color-text-light)] mb-1">Цены от</div>
        <div className="text-3xl font-semibold mb-4">
          {formatPrice(Number(complex.min_price))}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-light)]">Квартир в продаже</span>
            <span className="font-medium">{complex.offers_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-light)]">Площадь</span>
            <span className="font-medium">
              {Number(complex.min_area).toFixed(0)}–{Number(complex.max_area).toFixed(0)} м²
            </span>
          </div>
          {complex.completion_date && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-light)]">Срок сдачи</span>
              <span className="font-medium">{complex.completion_date}</span>
            </div>
          )}
        </div>

        <Link
          href={`/offers?complex_id=${complex.id}`}
          className="btn btn-primary w-full mt-6"
        >
          Смотреть квартиры
        </Link>
      </div>

      {/* Developer Card */}
      {isValidDeveloperName(complex.developer_name) && (
        <div className="card p-6">
          <div className="text-sm text-[var(--color-text-light)] mb-3">Застройщик</div>
          <div className="font-semibold text-lg mb-4">{complex.developer_name}</div>

          {complex.developer_id && (
            <Link
              href={`/developers/${complex.developer_id}`}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Все объекты застройщика →
            </Link>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="card p-6">
        <div className="text-sm text-[var(--color-text-light)] mb-4">Характеристики</div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${
              complex.building_state === 'hand-over' ? 'bg-[var(--gray-900)]' : 'bg-gray-400'
            }`} />
            <span>{complex.building_state === 'hand-over' ? 'Дом сдан' : 'Строится'}</span>
          </div>

          {complex.class && (
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Класс: {complex.class}</span>
            </div>
          )}

          {complex.floors_total && (
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{complex.floors_total} этажей</span>
            </div>
          )}

          {complex.parking && (
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              <span>{complex.parking}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Button */}
      <button
        className="w-full py-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        Получить консультацию
      </button>
    </div>
  );
}
