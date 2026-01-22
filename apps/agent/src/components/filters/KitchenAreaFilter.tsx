'use client';

import { DebouncedNumberInput } from './DebouncedNumberInput';

interface KitchenAreaFilterProps {
  min?: number;
  max?: number;
  onChange: (values: { kitchen_area_min?: number; kitchen_area_max?: number }) => void;
}

export function KitchenAreaFilter({ min, max, onChange }: KitchenAreaFilterProps) {
  return (
    <div>
      <div className="text-sm font-medium mb-3">Площадь кухни, м²</div>
      <div className="grid grid-cols-2 gap-3">
        <DebouncedNumberInput
          value={min}
          onChange={(val) => onChange({
            kitchen_area_min: val,
            kitchen_area_max: max,
          })}
          placeholder="от 8"
          formatThousands={false}
          delay={600}
          min={0}
        />
        <DebouncedNumberInput
          value={max}
          onChange={(val) => onChange({
            kitchen_area_min: min,
            kitchen_area_max: val,
          })}
          placeholder="до 30"
          formatThousands={false}
          delay={600}
          min={0}
        />
      </div>
    </div>
  );
}
