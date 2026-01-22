'use client';

import { DebouncedNumberInput } from './DebouncedNumberInput';

interface FloorFilterProps {
  floorMin?: number;
  floorMax?: number;
  notFirstFloor?: boolean;
  notLastFloor?: boolean;
  onChange: (values: {
    floor_min?: number;
    floor_max?: number;
    not_first_floor?: boolean;
    not_last_floor?: boolean;
  }) => void;
}

export function FloorFilter({
  floorMin,
  floorMax,
  notFirstFloor,
  notLastFloor,
  onChange,
}: FloorFilterProps) {
  return (
    <div>
      <div className="text-sm font-medium mb-3">Этаж</div>

      {/* Range inputs */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <DebouncedNumberInput
          value={floorMin}
          onChange={(val) => onChange({
            floor_min: val,
            floor_max: floorMax,
            not_first_floor: notFirstFloor,
            not_last_floor: notLastFloor,
          })}
          placeholder="от"
          formatThousands={false}
          delay={600}
          min={1}
        />
        <DebouncedNumberInput
          value={floorMax}
          onChange={(val) => onChange({
            floor_min: floorMin,
            floor_max: val,
            not_first_floor: notFirstFloor,
            not_last_floor: notLastFloor,
          })}
          placeholder="до"
          formatThousands={false}
          delay={600}
          min={1}
        />
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={notFirstFloor || false}
            onChange={e => onChange({
              floor_min: floorMin,
              floor_max: floorMax,
              not_first_floor: e.target.checked ? true : undefined,
              not_last_floor: notLastFloor,
            })}
            className="w-4 h-4 rounded border-[var(--color-border)]"
          />
          <span>Не первый</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={notLastFloor || false}
            onChange={e => onChange({
              floor_min: floorMin,
              floor_max: floorMax,
              not_first_floor: notFirstFloor,
              not_last_floor: e.target.checked ? true : undefined,
            })}
            className="w-4 h-4 rounded border-[var(--color-border)]"
          />
          <span>Не последний</span>
        </label>
      </div>
    </div>
  );
}
