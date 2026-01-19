'use client';

import { forwardRef, useCallback } from 'react';
import { Input, type InputProps } from './Input';

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number | undefined;
  onChange: (value: number) => void;
  currency?: string;
}

/**
 * Форматирует число с разделителями тысяч (100000 -> "100 000")
 */
const formatNumber = (value: number): string => {
  if (!value && value !== 0) return '';
  return value.toLocaleString('ru-RU');
};

/**
 * Парсит строку с разделителями обратно в число ("100 000" -> 100000)
 */
const parseFormattedNumber = (value: string): number => {
  const cleaned = value.replace(/\s/g, '').replace(/,/g, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.floor(parsed);
};

/**
 * Компонент ввода денежных сумм с автоматическим форматированием.
 * Отображает "100 000" вместо "100000" при вводе.
 */
const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, currency = 'руб.', placeholder = '0', ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFormattedNumber(e.target.value);
        onChange(newValue);
      },
      [onChange]
    );

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={value ? formatNumber(value) : ''}
          onChange={handleChange}
          {...props}
        />
        {currency && value !== undefined && value > 0 && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {currency}
          </span>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput, formatNumber, parseFormattedNumber };
