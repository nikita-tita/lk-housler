'use client';

import { forwardRef, useState, useEffect, useRef } from 'react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

// Formats number to +7 (999) 123-45-67
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';

  let result = '+7';

  if (digits.length > 1) {
    result += ' (' + digits.slice(1, 4);
  }
  if (digits.length >= 4) {
    result += ') ' + digits.slice(4, 7);
  }
  if (digits.length >= 7) {
    result += '-' + digits.slice(7, 9);
  }
  if (digits.length >= 9) {
    result += '-' + digits.slice(9, 11);
  }

  return result;
}

// Calculate cursor position after formatting
function getCursorPosition(digits: string, cursorInDigits: number): number {
  const positions = [2, 4, 5, 6, 9, 10, 11, 13, 14, 16, 17];

  if (cursorInDigits <= 0) return 2;
  if (cursorInDigits >= digits.length) {
    return formatPhone(digits).length;
  }

  if (cursorInDigits <= positions.length) {
    return positions[cursorInDigits - 1] + 1;
  }

  return formatPhone(digits).length;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, className = '', ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(formatPhone(value));
    const inputRef = useRef<HTMLInputElement | null>(null);
    const cursorPosRef = useRef<number | null>(null);

    useEffect(() => {
      setDisplayValue(formatPhone(value));
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

      const digitsBeforeCursor = newValue.slice(0, cursorPos).replace(/\D/g, '').length;

      let digits = newValue.replace(/\D/g, '');

      if (digits.startsWith('8') && digits.length > 1) {
        digits = '7' + digits.slice(1);
      } else if (digits.length > 0 && !digits.startsWith('7')) {
        digits = '7' + digits;
      }

      digits = digits.slice(0, 11);

      const formatted = formatPhone(digits);
      setDisplayValue(formatted);
      onChange(digits);

      cursorPosRef.current = getCursorPosition(digits, digitsBeforeCursor);
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

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (!displayValue) {
        setDisplayValue('+7');
        onChange('7');
      }
      props.onFocus?.(e);
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
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder="+7 (___) ___-__-__"
        className={`${baseClass} ${borderClass} ${className}`}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
