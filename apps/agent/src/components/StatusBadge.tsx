'use client';

interface StatusBadgeProps {
  buildingState?: string | null;
  completionDate?: string | null;
  className?: string;
}

export function StatusBadge({ buildingState, completionDate, className = '' }: StatusBadgeProps) {
  const isCompleted = buildingState === 'hand-over';

  // Сдан - badge-filled (акцент на завершённости)
  if (isCompleted) {
    return (
      <span className={`badge-filled ${className}`}>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Сдан
      </span>
    );
  }

  // С датой сдачи - badge (нейтральный)
  if (completionDate) {
    return (
      <span className={`badge ${className}`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {completionDate}
      </span>
    );
  }

  // Строится - badge (нейтральный)
  return (
    <span className={`badge ${className}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      Строится
    </span>
  );
}
