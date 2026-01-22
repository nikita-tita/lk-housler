'use client';

import type { ClientPriority } from '@/types';

interface PriorityBadgeProps {
  priority: ClientPriority;
  size?: 'sm' | 'md';
}

// Срочный/высокий приоритет - badge-filled (акцент)
// Остальные - badge (нейтральный)
const PRIORITY_CONFIG: Record<ClientPriority, { label: string; filled: boolean }> = {
  low: { label: 'Низкий', filled: false },
  medium: { label: 'Средний', filled: false },
  high: { label: 'Высокий', filled: true },
  urgent: { label: 'Срочный', filled: true },
};

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const baseClass = config.filled ? 'badge-filled' : 'badge';
  const sizeClass = size === 'md' ? 'badge-md' : '';

  return (
    <span className={`${baseClass} ${sizeClass}`}>
      {config.label}
    </span>
  );
}

export function getPriorityLabel(priority: ClientPriority): string {
  return PRIORITY_CONFIG[priority]?.label || priority;
}
