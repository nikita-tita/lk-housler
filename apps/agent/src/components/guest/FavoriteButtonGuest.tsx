'use client';

import { useGuestFavorites } from '@/contexts/GuestFavoritesContext';
import { useToast } from '@/contexts/ToastContext';

interface Props {
  offerId: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function FavoriteButtonGuest({ offerId, className = '', size = 'md' }: Props) {
  const { isFavorite, toggleFavorite } = useGuestFavorites();
  const { showToast } = useToast();

  const isFav = isFavorite(offerId);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleFavorite(offerId);
    showToast(isFav ? 'Удалено из избранного' : 'Добавлено в избранное', 'success');
  };

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-sm transition-all ${className}`}
      title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
    >
      <svg
        className={`${iconSizes[size]} transition-colors ${isFav ? 'text-[var(--gray-900)] fill-current' : 'text-gray-400'}`}
        viewBox="0 0 24 24"
        fill={isFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
