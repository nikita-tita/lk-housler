'use client';

import { useState, useRef, ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface AuthRequiredOverlayProps {
  children: ReactNode;
  message?: string;
}

/**
 * Обёртка для элементов, требующих авторизации.
 * Для неавторизованных: показывает детей с пониженной непрозрачностью,
 * блокирует клики и показывает модалку по центру при наведении.
 */
export function AuthRequiredOverlay({
  children,
  message = 'Войдите, чтобы использовать расширенные фильтры'
}: AuthRequiredOverlayProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Пока загружается или пользователь авторизован — показываем как есть
  if (isLoading || isAuthenticated) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    // Отменяем скрытие если было запланировано
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowModal(true);
  };

  const handleMouseLeave = () => {
    // Задержка перед скрытием, чтобы можно было навести на модалку
    hideTimeoutRef.current = setTimeout(() => {
      setShowModal(false);
    }, 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <div className="relative">
      {/* Заблокированный контент */}
      <div
        className="opacity-50 pointer-events-none select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {/* Невидимый оверлей для перехвата событий мыши */}
      <div
        className="absolute inset-0 cursor-not-allowed"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* Модалка по центру блока */}
      {showModal && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-[var(--color-border)] p-5 max-w-[280px] text-center pointer-events-auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-text)] mb-4">
              {message}
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="btn btn-primary btn-sm w-full">
                Войти
              </Link>
              <Link href="/login/realtor" className="btn btn-secondary btn-sm w-full">
                Регистрация
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
