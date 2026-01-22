'use client';

interface CeilingHeightFilterProps {
  value?: number;
  onChange: (value?: number) => void;
}

const CEILING_OPTIONS = [
  { value: 2.5, label: 'от 2.5м' },
  { value: 2.7, label: 'от 2.7м' },
  { value: 3.0, label: 'от 3м' },
  { value: 3.5, label: 'от 3.5м' },
];

export function CeilingHeightFilter({ value, onChange }: CeilingHeightFilterProps) {
  return (
    <div>
      <div className="text-sm font-medium mb-3">Высота потолков</div>
      <div className="flex flex-wrap gap-2">
        {CEILING_OPTIONS.map(opt => (
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
