'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface DebouncedNumberInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  delay?: number;
  /** Форматировать число с разделителями тысяч (для цены) */
  formatThousands?: boolean;
  /** Суффикс для отображения (например "₽" или "м²") */
  suffix?: string;
  className?: string;
  min?: number;
  max?: number;
}

/**
 * Инпут с debounce для числовых фильтров.
 * Поддерживает форматирование с разделением тысяч пробелами.
 *
 * Использование:
 * - Для цены: formatThousands={true} placeholder="от 5 000 000"
 * - Для площади: formatThousands={false} placeholder="от 30"
 */
export function DebouncedNumberInput({
  value,
  onChange,
  placeholder,
  delay = 800,
  formatThousands = false,
  suffix,
  className = 'input',
  min,
  max,
}: DebouncedNumberInputProps) {
  // Локальное состояние для отображения (строка)
  const [displayValue, setDisplayValue] = useState<string>('');

  // Флаг для предотвращения срабатывания debounce при инициализации
  const isInitialMount = useRef(true);
  // Флаг что изменение пришло извне (из props), а не от пользователя
  const isExternalChange = useRef(false);
  // Предыдущее значение из props для сравнения
  const prevValueRef = useRef(value);

  // Форматирование числа с пробелами
  const formatNumber = useCallback((num: number): string => {
    if (formatThousands) {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    return num.toString();
  }, [formatThousands]);

  // Парсинг строки в число (убираем пробелы)
  const parseNumber = useCallback((str: string): number | undefined => {
    const cleaned = str.replace(/\s/g, '');
    if (!cleaned) return undefined;
    const num = Number(cleaned);
    return isNaN(num) ? undefined : num;
  }, []);

  // Синхронизация с внешним value (при изменении URL или сбросе фильтров)
  useEffect(() => {
    // Если значение изменилось извне
    if (value !== prevValueRef.current) {
      isExternalChange.current = true;
      // Используем setTimeout чтобы избежать setState во время рендера
      const timer = setTimeout(() => {
        if (value === undefined) {
          setDisplayValue('');
        } else {
          setDisplayValue(formatNumber(value));
        }
        prevValueRef.current = value;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [value, formatNumber]);

  // Debounced отправка значения
  useEffect(() => {
    // Пропускаем первый рендер
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Пропускаем если изменение пришло извне (не от пользователя)
    if (isExternalChange.current) {
      isExternalChange.current = false;
      return;
    }

    const parsed = parseNumber(displayValue);

    // Не вызываем onChange если значение не изменилось
    if (parsed === value) return;

    const timeout = setTimeout(() => {
      onChange(parsed);
    }, delay);

    return () => clearTimeout(timeout);
  }, [displayValue, delay, onChange, parseNumber, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (formatThousands) {
      // Для цены: разрешаем только цифры и пробелы
      const cleaned = raw.replace(/[^\d\s]/g, '');
      const digits = cleaned.replace(/\s/g, '');
      // Форматируем с пробелами каждые 3 цифры
      const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      setDisplayValue(formatted);
    } else {
      // Для площади: разрешаем цифры и точку
      const cleaned = raw.replace(/[^\d.]/g, '');
      setDisplayValue(cleaned);
    }
  };

  // При потере фокуса — сразу применить значение (не ждать debounce)
  const handleBlur = () => {
    const parsed = parseNumber(displayValue);
    if (parsed !== value) {
      onChange(parsed);
    }
  };

  // При нажатии Enter — сразу применить
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseNumber(displayValue);
      if (parsed !== value) {
        onChange(parsed);
      }
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        min={min}
        max={max}
      />
      {suffix && displayValue && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-light)] text-sm pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
