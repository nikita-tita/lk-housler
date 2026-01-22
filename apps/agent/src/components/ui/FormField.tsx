'use client';

import { forwardRef } from 'react';

// ============ Label ============
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = '', ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium mb-1.5 ${className}`} {...props}>
      {children}
      {required && <span className="text-[var(--color-text)] ml-0.5">*</span>}
    </label>
  );
}

// ============ Input ============
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, icon, className = '', ...props }, ref) => {
    const baseClass =
      'w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors';
    const borderClass = error
      ? 'border-[var(--gray-900)] focus:ring-[var(--gray-900)] focus:border-[var(--gray-900)]'
      : 'border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';

    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-light)]">
            {icon}
          </div>
          <input ref={ref} className={`${baseClass} ${borderClass} pl-10 ${className}`} {...props} />
        </div>
      );
    }

    return <input ref={ref} className={`${baseClass} ${borderClass} ${className}`} {...props} />;
  }
);
Input.displayName = 'Input';

// ============ Textarea ============
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    const baseClass =
      'w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-none';
    const borderClass = error
      ? 'border-[var(--gray-900)] focus:ring-[var(--gray-900)] focus:border-[var(--gray-900)]'
      : 'border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';

    return <textarea ref={ref} className={`${baseClass} ${borderClass} ${className}`} {...props} />;
  }
);
Textarea.displayName = 'Textarea';

// ============ Select ============
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => {
    const baseClass =
      'w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors appearance-none bg-white cursor-pointer';
    const borderClass = error
      ? 'border-[var(--gray-900)] focus:ring-[var(--gray-900)] focus:border-[var(--gray-900)]'
      : 'border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';

    return (
      <div className="relative">
        <select ref={ref} className={`${baseClass} ${borderClass} pr-10 ${className}`} {...props}>
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-light)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

// ============ Error Message ============
interface ErrorMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function ErrorMessage({ children, className = '' }: ErrorMessageProps) {
  if (!children) return null;
  return <p className={`text-sm text-[var(--color-text)] mt-1.5 ${className}`}>{children}</p>;
}

// ============ Success Message ============
interface SuccessMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function SuccessMessage({ children, className = '' }: SuccessMessageProps) {
  if (!children) return null;
  return (
    <div className={`p-3 bg-gray-100 text-[var(--color-text)] rounded-lg text-sm ${className}`}>{children}</div>
  );
}

// ============ Field Wrapper ============
interface FieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, required, error, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
