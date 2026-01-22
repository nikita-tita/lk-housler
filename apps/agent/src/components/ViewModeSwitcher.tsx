'use client';

export type ViewMode = 'cards' | 'clusters' | 'table' | 'map';

interface ViewModeSwitcherProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
}

const MODE_CONFIG: Record<ViewMode, { icon: React.ReactNode; label: string }> = {
  cards: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    label: 'Карточки',
  },
  clusters: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    label: 'По ЖК',
  },
  table: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    label: 'Таблица',
  },
  map: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'На карте',
  },
};

export function ViewModeSwitcher({
  mode,
  onChange,
  availableModes = ['cards', 'table', 'map'],
}: ViewModeSwitcherProps) {
  return (
    <div className="inline-flex border border-[var(--color-border)] rounded-lg overflow-hidden">
      {availableModes.map((m) => {
        const config = MODE_CONFIG[m];
        const isActive = mode === m;

        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`
              px-3 py-2 flex items-center gap-2 text-sm transition-colors
              ${isActive
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-900 hover:bg-gray-50'
              }
              ${m !== availableModes[0] ? 'border-l border-gray-300' : ''}
            `}
            title={config.label}
          >
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
