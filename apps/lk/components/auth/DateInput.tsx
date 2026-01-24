'use client';

import { forwardRef, useState, useEffect, useRef } from 'react';

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  error?: boolean;
}

// Formats date to DD.MM.YYYY for display
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';

  const digits = isoDate.replace(/\D/g, '');
  if (digits.length === 0) return '';

  // If input is in YYYYMMDD format (from ISO), convert to DDMMYYYY
  let displayDigits = digits;
  if (digits.length === 8 && digits.startsWith('19') || digits.startsWith('20')) {
    displayDigits = digits.slice(6, 8) + digits.slice(4, 6) + digits.slice(0, 4);
  }

  let result = '';
  if (displayDigits.length > 0) {
    result = displayDigits.slice(0, 2);
  }
  if (displayDigits.length > 2) {
    result += '.' + displayDigits.slice(2, 4);
  }
  if (displayDigits.length > 4) {
    result += '.' + displayDigits.slice(4, 8);
  }

  return result;
}

// Convert display format (DD.MM.YYYY) to ISO format (YYYY-MM-DD)
function toISODate(displayDate: string): string {
  const digits = displayDate.replace(/\D/g, '');
  if (digits.length !== 8) return '';

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return `${year}-${month}-${day}`;
}

// Convert ISO date (YYYY-MM-DD) to display digits (DDMMYYYY)
function isoToDisplayDigits(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  return parts[2] + parts[1] + parts[0];
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, error, className = '', ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const cursorPosRef = useRef<number | null>(null);

    useEffect(() => {
      if (value) {
        const digits = isoToDisplayDigits(value);
        setDisplayValue(formatDateDisplay(digits));
      } else {
        setDisplayValue('');
      }
    }, [value]);

    useEffect(() => {
      if (cursorPosRef.current !== null && inputRef.current) {
        inputRef.current.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
        cursorPosRef.current = null;
      }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const newValue = input.value;
      const cursorPos = input.selectionStart || 0;

      // Count digits before cursor
      const digitsBeforeCursor = newValue.slice(0, cursorPos).replace(/\D/g, '').length;

      // Extract only digits
      let digits = newValue.replace(/\D/g, '').slice(0, 8);

      // Format for display
      let formatted = '';
      if (digits.length > 0) {
        formatted = digits.slice(0, 2);
      }
      if (digits.length > 2) {
        formatted += '.' + digits.slice(2, 4);
      }
      if (digits.length > 4) {
        formatted += '.' + digits.slice(4, 8);
      }

      setDisplayValue(formatted);

      // Convert to ISO format if complete
      if (digits.length === 8) {
        const isoDate = toISODate(formatted);
        onChange(isoDate);
      } else {
        // Store partial as-is (won't be valid ISO)
        onChange('');
      }

      // Calculate new cursor position
      let newCursorPos = digitsBeforeCursor;
      if (digitsBeforeCursor > 2) newCursorPos += 1; // After first dot
      if (digitsBeforeCursor > 4) newCursorPos += 1; // After second dot
      cursorPosRef.current = Math.min(newCursorPos, formatted.length);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key.startsWith('Arrow')
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        return;
      }

      if (!/\d/.test(e.key)) {
        e.preventDefault();
      }
    };

    const setRefs = (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        ref.current = el;
      }
    };

    const baseClass =
      'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors';
    const borderClass = error
      ? 'border-[var(--gray-900)] focus:ring-[var(--gray-900)] focus:border-[var(--gray-900)]'
      : 'border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';

    return (
      <input
        ref={setRefs}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="ДД.ММ.ГГГГ"
        className={`${baseClass} ${borderClass} ${className}`}
        {...props}
      />
    );
  }
);

DateInput.displayName = 'DateInput';
