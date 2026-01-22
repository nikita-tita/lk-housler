'use client';

import { useState } from 'react';
import { useClientSelection } from '@/contexts/ClientSelectionContext';

interface Props {
  offerId: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function AddToClientSelectionButton({ offerId, className = '', size = 'md' }: Props) {
  const { activeSelectionCode, addToSelection, removeFromSelection, isInSelection } = useClientSelection();
  const [isLoading, setIsLoading] = useState(false);

  const inSelection = isInSelection(offerId);

  // Не показываем кнопку если нет активной подборки
  if (!activeSelectionCode) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      if (inSelection) {
        await removeFromSelection(offerId);
      } else {
        // Добавляем в один клик без popup
        await addToSelection(offerId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'w-8 h-8 text-sm'
    : 'w-10 h-10';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        ${sizeClasses}
        rounded-full flex items-center justify-center
        transition-all duration-200
        ${inSelection
          ? 'bg-[var(--gray-900)] text-white hover:bg-black'
          : 'bg-white/90 text-[var(--color-text)] hover:bg-white border border-[var(--color-border)]'
        }
        ${isLoading ? 'opacity-50 cursor-wait' : ''}
        ${className}
      `}
      title={inSelection ? 'Удалить из подборки' : 'Добавить в подборку'}
    >
      {isLoading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : inSelection ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
}
