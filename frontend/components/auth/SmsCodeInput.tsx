'use client';

import { forwardRef, useState, useEffect, useRef } from 'react';

interface SmsCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
}

export const SmsCodeInput = forwardRef<HTMLInputElement, SmsCodeInputProps>(
  ({ value, onChange, length = 6, error, disabled }, ref) => {
    const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
      const valueDigits = value.split('').slice(0, length);
      const paddedDigits = [...valueDigits, ...Array(length - valueDigits.length).fill('')];
      const timer = setTimeout(() => {
        setDigits(paddedDigits);
      }, 0);
      return () => clearTimeout(timer);
    }, [value, length]);

    const focusInput = (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
      }
    };

    const handleChange = (index: number, newValue: string) => {
      const pastedDigits = newValue.replace(/\D/g, '').split('').slice(0, length);

      if (pastedDigits.length > 1) {
        const newDigits = [...digits];
        pastedDigits.forEach((digit, i) => {
          if (index + i < length) {
            newDigits[index + i] = digit;
          }
        });
        setDigits(newDigits);
        onChange(newDigits.join(''));

        const nextEmpty = newDigits.findIndex((d) => !d);
        focusInput(nextEmpty === -1 ? length - 1 : nextEmpty);
      } else {
        const digit = newValue.replace(/\D/g, '').slice(-1);
        const newDigits = [...digits];
        newDigits[index] = digit;
        setDigits(newDigits);
        onChange(newDigits.join(''));

        if (digit && index < length - 1) {
          focusInput(index + 1);
        }
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const newDigits = [...digits];

        if (digits[index]) {
          newDigits[index] = '';
        } else if (index > 0) {
          newDigits[index - 1] = '';
          focusInput(index - 1);
        }

        setDigits(newDigits);
        onChange(newDigits.join(''));
      } else if (e.key === 'ArrowLeft' && index > 0) {
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        focusInput(index + 1);
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      const newDigits = pastedData.split('');
      const paddedDigits = [...newDigits, ...Array(length - newDigits.length).fill('')];
      setDigits(paddedDigits);
      onChange(paddedDigits.join(''));

      focusInput(Math.min(pastedData.length, length - 1));
    };

    const baseClass =
      'w-12 h-14 text-center text-2xl font-medium border rounded-lg focus:outline-none focus:ring-2 transition-colors';
    const borderClass = error
      ? 'border-[var(--gray-900)] focus:ring-[var(--gray-900)] focus:border-[var(--gray-900)]'
      : 'border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';
    const disabledClass = disabled ? 'bg-gray-100 cursor-not-allowed' : '';

    return (
      <div className="flex justify-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
              if (index === 0 && ref) {
                if (typeof ref === 'function') {
                  ref(el);
                } else {
                  ref.current = el;
                }
              }
            }}
            type="text"
            inputMode="numeric"
            maxLength={length}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`${baseClass} ${borderClass} ${disabledClass}`}
          />
        ))}
      </div>
    );
  }
);

SmsCodeInput.displayName = 'SmsCodeInput';
