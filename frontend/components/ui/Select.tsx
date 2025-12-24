import { SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      className,
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    const selectStyles = clsx(
      'w-full px-4 py-3 text-base',
      'border rounded-lg',
      'transition-all duration-200',
      'bg-white appearance-none',
      'bg-no-repeat bg-right',
      'focus:outline-none focus:ring-2',
      hasError
        ? 'border-gray-900 focus:border-gray-900 focus:ring-gray-900'
        : 'border-gray-300 focus:border-black focus:ring-black',
      disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
      !value && placeholder && 'text-gray-500',
      className
    );

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-gray-900">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            className={selectStyles}
            disabled={disabled}
            value={value}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundPosition: 'right 12px center',
              backgroundSize: '20px',
              paddingRight: '44px',
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

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

Select.displayName = 'Select';

export { Select, type SelectProps, type SelectOption };
