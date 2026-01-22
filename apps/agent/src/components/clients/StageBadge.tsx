'use client';

import type { ClientStage } from '@/types';

interface StageBadgeProps {
  stage: ClientStage;
  size?: 'sm' | 'md';
}

// Завершённые/важные состояния используют badge-filled (тёмный)
// Остальные - badge (светлый)
const STAGE_CONFIG: Record<ClientStage, { label: string; filled: boolean }> = {
  new: { label: 'Новый', filled: false },
  in_progress: { label: 'В работе', filled: false },
  fixation: { label: 'Фиксация', filled: false },
  booking: { label: 'Бронь', filled: false },
  deal: { label: 'Сделка', filled: true },
  completed: { label: 'Завершено', filled: true },
  failed: { label: 'Сорвано', filled: true },
};

export function StageBadge({ stage, size = 'sm' }: StageBadgeProps) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.new;
  const baseClass = config.filled ? 'badge-filled' : 'badge';
  const sizeClass = size === 'md' ? 'badge-md' : '';

  return (
    <span className={`${baseClass} ${sizeClass}`}>
      {config.label}
    </span>
  );
}

export function getStageLabel(stage: ClientStage): string {
  return STAGE_CONFIG[stage]?.label || stage;
}
