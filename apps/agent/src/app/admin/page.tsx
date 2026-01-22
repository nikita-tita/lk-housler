'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { PlatformStats } from '@/types';

// Все карточки используют черно-белую палитру
function StatCard({
  title,
  value,
  subtitle,
  icon,
  highlighted = false
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-light)]">{title}</p>
          <p className="text-2xl font-bold mt-1">{value.toLocaleString('ru-RU')}</p>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-light)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${highlighted ? 'bg-[var(--gray-900)] text-white' : 'bg-gray-100 text-[var(--color-text)]'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatsSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.adminGetStats();
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setError('Не удалось загрузить статистику');
      }
    } catch {
      setError('Ошибка при загрузке статистики');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[var(--color-text)] mb-4">{error}</p>
        <button onClick={loadStats} className="btn btn-primary btn-sm">
          Повторить
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      {/* Users Section */}
      <StatsSection title="Пользователи">
        <StatCard
          title="Всего пользователей"
          value={stats.users.total}
          subtitle={`Активных сегодня: ${stats.users.active_today}`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          title="Клиентов"
          value={stats.users.clients}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          title="Агентов"
          value={stats.users.agents}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Активных за неделю"
          value={stats.users.active_week}
                    icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </StatsSection>

      {/* Agencies Section */}
      <StatsSection title="Агентства">
        <StatCard
          title="Всего агентств"
          value={stats.agencies.total}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          title="Активных"
          value={stats.agencies.active}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="На модерации"
          value={stats.agencies.pending}
                    icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Отклонённых"
          value={stats.agencies.rejected}
                    icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </StatsSection>

      {/* Offers & Bookings Section */}
      <StatsSection title="Объекты и бронирования">
        <StatCard
          title="Всего объектов"
          value={stats.offers.total}
          subtitle={`Активных: ${stats.offers.active}`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        />
        <StatCard
          title="Бронирований"
          value={stats.bookings.total}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          title="Ожидают подтверждения"
          value={stats.bookings.pending}
                    icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Подтверждённых"
          value={stats.bookings.approved}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
      </StatsSection>

      {/* Selections Section */}
      <StatsSection title="Подборки">
        <StatCard
          title="Всего подборок"
          value={stats.selections.total}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          title="Публичных"
          value={stats.selections.public}
          highlighted
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          }
        />
      </StatsSection>

      {/* Quick Stats */}
      <div className="card p-5 mt-8">
        <h3 className="font-semibold mb-4">Быстрая статистика по ролям</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.users.clients}</p>
            <p className="text-sm text-[var(--color-text-light)]">Клиентов</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.users.agents}</p>
            <p className="text-sm text-[var(--color-text-light)]">Агентов</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.users.agency_admins}</p>
            <p className="text-sm text-[var(--color-text-light)]">Админов АН</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.users.operators}</p>
            <p className="text-sm text-[var(--color-text-light)]">Операторов</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.users.admins}</p>
            <p className="text-sm text-[var(--color-text-light)]">Админов</p>
          </div>
        </div>
      </div>
    </div>
  );
}
