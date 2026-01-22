'use client';

interface MetroTimeFilterProps {
  value?: number;
  onChange: (value?: number) => void;
}

const METRO_TIME_OPTIONS = [
  { value: 5, label: 'до 5 мин' },
  { value: 10, label: 'до 10 мин' },
  { value: 15, label: 'до 15 мин' },
  { value: 20, label: 'до 20 мин' },
];

export function MetroTimeFilter({ value, onChange }: MetroTimeFilterProps) {
  return (
    <div>
      <div className="text-sm font-medium mb-3">Время до метро пешком</div>
      <div className="flex flex-wrap gap-2">
        {METRO_TIME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(value === opt.value ? undefined : opt.value)}
            className={`btn btn-sm ${
              value === opt.value ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
