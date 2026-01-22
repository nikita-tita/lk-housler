'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import { ClientCard } from '@/components/clients/ClientCard';
import type { ClientListItem, ClientStage, ClientPriority, FunnelStats } from '@/types';

const STAGES: { value: ClientStage | ''; label: string }[] = [
  { value: '', label: 'Все этапы' },
  { value: 'new', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'fixation', label: 'Фиксация' },
  { value: 'booking', label: 'Бронь' },
  { value: 'deal', label: 'Сделка' },
  { value: 'completed', label: 'Завершено' },
  { value: 'failed', label: 'Сорвано' },
];

const PRIORITIES: { value: ClientPriority | ''; label: string }[] = [
  { value: '', label: 'Все приоритеты' },
  { value: 'urgent', label: 'Срочный' },
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
];

export default function ClientsListPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ClientStage | ''>('');
  const [priority, setPriority] = useState<ClientPriority | ''>('');

  const loadClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getClients({
        search: search || undefined,
        stage: stage || undefined,
        priority: priority || undefined,
      });

      if (response.success && response.data) {
        setClients(response.data);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search, stage, priority]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getClientsStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadClients]);

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard label="Всего" value={stats.total} highlighted />
          <StatCard label="Новые" value={stats.new} />
          <StatCard label="В работе" value={stats.in_progress} />
          <StatCard label="Фиксация" value={stats.fixation} />
          <StatCard label="Бронь" value={stats.booking} />
          <StatCard label="Сделка" value={stats.deal} />
          <StatCard label="Завершено" value={stats.completed} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-light)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по имени, телефону или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as ClientStage | '')}
            className="select"
          >
            {STAGES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ClientPriority | '')}
            className="select"
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-bg-gray)] rounded-lg">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-light)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-[var(--color-text-light)] mb-4">
            {search || stage || priority
              ? 'Клиенты не найдены'
              : 'У вас пока нет клиентов'
            }
          </p>
          {!search && !stage && !priority && (
            <Link href="/clients/new" className="btn btn-primary btn-sm">
              Добавить первого клиента
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}

// Компонент статистики
// Все карточки используют черно-белую палитру
function StatCard({ label, value, highlighted }: { label: string; value: number; highlighted?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlighted ? 'border-[var(--gray-900)] bg-gray-100' : 'border-[var(--color-border)] bg-white'}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-text-light)]">{label}</div>
    </div>
  );
}
