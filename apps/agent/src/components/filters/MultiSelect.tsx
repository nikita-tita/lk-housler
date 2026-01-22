'use client';

import { useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxDisplayed?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  searchPlaceholder = 'Поиск...',
  emptyMessage = 'Ничего не найдено',
  maxDisplayed = 3,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options by search
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Toggle option selection
  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  // Remove single selected value
  const removeValue = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  // Clear all
  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Get display labels for selected values
  const getSelectedLabels = () => {
    return value
      .map(v => options.find(o => o.value === v)?.label || v)
      .slice(0, maxDisplayed);
  };

  const selectedLabels = getSelectedLabels();
  const hasMore = value.length > maxDisplayed;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className={`
          min-h-[42px] px-3 py-2 rounded-lg border cursor-pointer
          flex items-center gap-2 flex-wrap
          transition-colors
          ${isOpen
            ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
            : 'border-[var(--color-border)] hover:border-[var(--color-text-light)]'
          }
          bg-white
        `}
      >
        {value.length === 0 ? (
          <span className="text-[var(--color-text-light)]">{placeholder}</span>
        ) : (
          <>
            {selectedLabels.map(label => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-bg-gray)] rounded text-sm"
              >
                {label}
                <button
                  onClick={(e) => removeValue(options.find(o => o.label === label)?.value || label, e)}
                  className="text-[var(--color-text-light)] hover:text-[var(--color-text)] ml-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {hasMore && (
              <span className="text-sm text-[var(--color-text-light)]">
                +{value.length - maxDisplayed}
              </span>
            )}
          </>
        )}

        {/* Clear & Arrow */}
        <div className="ml-auto flex items-center gap-1">
          {value.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1 text-[var(--color-text-light)] hover:text-[var(--color-text)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-[var(--color-text-light)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[var(--color-border)] rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-[var(--color-text-light)]">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`
                      px-3 py-2 cursor-pointer flex items-center justify-between
                      hover:bg-[var(--color-bg-gray)]
                      ${isSelected ? 'bg-[var(--color-accent)]/10' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`
                        w-4 h-4 rounded border flex items-center justify-center
                        ${isSelected
                          ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                          : 'border-[var(--color-border)]'
                        }
                      `}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                        {option.label}
                      </span>
                    </div>
                    {option.count !== undefined && (
                      <span className="text-xs text-[var(--color-text-light)] tabular-nums">
                        ({option.count.toLocaleString('ru-RU')})
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with count */}
          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-light)]">
                Выбрано: {value.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Сбросить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
