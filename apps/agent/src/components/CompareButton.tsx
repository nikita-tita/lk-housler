'use client';

import { useCompare } from '@/contexts/CompareContext';

interface Props {
  offerId: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function CompareButton({ offerId, className = '', size = 'md' }: Props) {
  const { addToCompare, removeFromCompare, isInCompare, canAddMore } = useCompare();

  const inCompare = isInCompare(offerId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inCompare) {
      removeFromCompare(offerId);
    } else if (canAddMore) {
      addToCompare(offerId);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'w-8 h-8 text-sm'
    : 'w-10 h-10';

  return (
    <button
      onClick={handleClick}
      disabled={!inCompare && !canAddMore}
      className={`
        ${sizeClasses}
        rounded-full flex items-center justify-center
        transition-all duration-200
        ${inCompare
          ? 'bg-[var(--gray-900)] text-white hover:bg-black'
          : canAddMore
            ? 'bg-white/90 text-[var(--color-text)] hover:bg-white border border-[var(--color-border)]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }
        ${className}
      `}
      title={inCompare ? 'Убрать из сравнения' : canAddMore ? 'Добавить к сравнению' : 'Максимум 4 объекта'}
    >
      {inCompare ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )}
    </button>
  );
}
