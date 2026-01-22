'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import { PriorityBadge } from '@/components/clients/PriorityBadge';
import type { ClientListItem, ClientStage } from '@/types';

// Все колонки воронки используют черно-белую палитру
const STAGES: { value: ClientStage; label: string; color: string }[] = [
  { value: 'new', label: 'Новые', color: 'border-gray-300 bg-gray-50' },
  { value: 'in_progress', label: 'В работе', color: 'border-gray-300 bg-gray-50' },
  { value: 'fixation', label: 'Фиксация', color: 'border-gray-300 bg-gray-50' },
  { value: 'booking', label: 'Бронь', color: 'border-gray-300 bg-gray-50' },
  { value: 'deal', label: 'Сделка', color: 'border-gray-400 bg-gray-100' },
  { value: 'completed', label: 'Завершено', color: 'border-[var(--gray-900)] bg-gray-200' },
];

export default function FunnelPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedClient, setDraggedClient] = useState<ClientListItem | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const response = await api.getClients();
      if (response.success && response.data) {
        // Исключаем failed из воронки
        setClients(response.data.filter(c => c.stage !== 'failed'));
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleDragStart = (client: ClientListItem) => {
    setDraggedClient(client);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stage: ClientStage) => {
    if (!draggedClient || draggedClient.stage === stage) {
      setDraggedClient(null);
      return;
    }

    // Оптимистичное обновление UI
    setClients(prev =>
      prev.map(c =>
        c.id === draggedClient.id ? { ...c, stage } : c
      )
    );

    try {
      await api.updateClientStage(draggedClient.id, stage);
    } catch (error) {
      console.error('Failed to update stage:', error);
      // Откатываем при ошибке
      loadClients();
    }

    setDraggedClient(null);
  };

  const getClientsByStage = (stage: ClientStage) =>
    clients.filter(c => c.stage === stage);

  if (isLoading) {
    return (
      <div className="grid grid-cols-6 gap-4">
        {STAGES.map(s => (
          <div key={s.value} className="h-96 bg-gray-100 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {STAGES.map(stage => {
          const stageClients = getClientsByStage(stage.value);

          return (
            <div
              key={stage.value}
              className={`w-64 flex-shrink-0 rounded-lg border-2 ${stage.color}`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.value)}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{stage.label}</span>
                  <span className="text-sm text-[var(--color-text-light)] bg-white px-2 py-0.5 rounded">
                    {stageClients.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[300px]">
                {stageClients.map(client => (
                  <FunnelCard
                    key={client.id}
                    client={client}
                    onDragStart={() => handleDragStart(client)}
                    isDragging={draggedClient?.id === client.id}
                  />
                ))}

                {stageClients.length === 0 && (
                  <div className="text-center py-8 text-sm text-[var(--color-text-light)]">
                    Нет клиентов
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info about failed */}
      <div className="mt-6 text-sm text-[var(--color-text-light)]">
        <Link href="/clients?stage=failed" className="hover:text-[var(--color-text)]">
          Сорванные сделки показаны отдельно &rarr;
        </Link>
      </div>
    </div>
  );
}

interface FunnelCardProps {
  client: ClientListItem;
  onDragStart: () => void;
  isDragging: boolean;
}

function FunnelCard({ client, onDragStart, isDragging }: FunnelCardProps) {
  const displayName = client.name || client.phone || client.email || 'Без имени';

  return (
    <Link
      href={`/clients/${client.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      className={`block bg-white rounded-lg p-3 shadow-sm border border-[var(--color-border)] cursor-grab hover:shadow transition-shadow
        ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-medium text-sm truncate">{displayName}</div>
        <PriorityBadge priority={client.priority} size="sm" />
      </div>

      {client.phone && (
        <div className="text-xs text-[var(--color-text-light)] mb-1">{client.phone}</div>
      )}

      <div className="flex items-center gap-2 text-xs text-[var(--color-text-light)]">
        {client.selections_count > 0 && (
          <span>{client.selections_count} подб.</span>
        )}
        {client.bookings_count > 0 && (
          <span>{client.bookings_count} брон.</span>
        )}
      </div>
    </Link>
  );
}
