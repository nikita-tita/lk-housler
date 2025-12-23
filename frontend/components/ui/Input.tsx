import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    const inputStyles = clsx(
      'w-full px-4 py-3 text-base',
      'border rounded-lg',
      'transition-all duration-200',
      'placeholder:text-gray-500',
      'focus:outline-none focus:ring-2',
      hasError
        ? 'border-gray-900 focus:border-gray-900 focus:ring-gray-900'
        : 'border-gray-300 focus:border-black focus:ring-black',
      disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
      className
    );

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-gray-900">
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          className={inputStyles}
          disabled={disabled}
          {...props}
        />
        
        {error && (
          <p className="text-sm text-gray-900 font-medium">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="text-sm text-gray-600">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, type InputProps };

