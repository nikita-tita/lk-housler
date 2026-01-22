'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchHistory, SearchHistoryItem } from '@/hooks/useSearchHistory';

interface Suggestion {
  type: 'complex' | 'district' | 'metro';
  name: string;
  count: number;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  suggestions: {
    complexes: { name: string; count: number }[];
    districts: { name: string; count: number }[];
    metro_stations: { name: string; count: number }[];
  } | null;
  placeholder?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = 'Поиск...'
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, removeFromHistory } = useSearchHistory();

  // Filter suggestions based on input using useMemo instead of effect
  const computedSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions) {
      return [];
    }

    const query = value.toLowerCase();
    const results: Suggestion[] = [];

    // Search in complexes
    suggestions.complexes
      .filter(c => c.name.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach(c => results.push({ type: 'complex', name: c.name, count: c.count }));

    // Search in districts
    suggestions.districts
      .filter(d => d.name.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach(d => results.push({ type: 'district', name: d.name, count: d.count }));

    // Search in metro
    suggestions.metro_stations
      .filter(m => m.name.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach(m => results.push({ type: 'metro', name: m.name, count: m.count }));

    return results;
  }, [value, suggestions]);

  // Sync computed suggestions with state
  useEffect(() => {
    setFilteredSuggestions(computedSuggestions);
  }, [computedSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypeLabel = (type: Suggestion['type'] | 'text') => {
    switch (type) {
      case 'complex': return 'ЖК';
      case 'district': return 'Район';
      case 'metro': return 'Метро';
      case 'text': return 'Поиск';
    }
  };

  const getTypeColor = (type: Suggestion['type'] | 'text') => {
    switch (type) {
      case 'complex': return 'bg-[var(--gray-900)] text-white';
      case 'district': return 'bg-gray-200 text-[var(--color-text)]';
      case 'metro': return 'bg-gray-300 text-[var(--color-text)]';
      case 'text': return 'bg-gray-100 text-[var(--color-text)]';
    }
  };

  // Handle selection with history tracking
  const handleSelect = (suggestion: Suggestion) => {
    addToHistory(suggestion.type, suggestion.name);
    onSelect(suggestion);
    setIsOpen(false);
  };

  // Handle history item selection
  const handleHistorySelect = (item: SearchHistoryItem) => {
    if (item.type === 'text') {
      onChange(item.value);
    } else {
      onSelect({ type: item.type, name: item.value, count: 0 });
    }
    setIsOpen(false);
  };

  // Show history when input is empty and focused
  const showHistory = !value.trim() && history.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      {/* Dropdown */}
      {isOpen && (filteredSuggestions.length > 0 || showHistory) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* Show history when input is empty */}
          {showHistory && (
            <>
              <div className="px-4 py-2 text-xs text-[var(--color-text-light)] bg-[var(--color-bg-gray)] border-b border-[var(--color-border)] flex justify-between items-center">
                <span>Недавние поиски</span>
              </div>
              {history.slice(0, 5).map((item, index) => (
                <button
                  key={`history-${item.type}-${item.value}-${index}`}
                  onClick={() => handleHistorySelect(item)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg-gray)] flex items-center justify-between gap-2 border-b border-[var(--color-border)] last:border-b-0 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
                    <span className="truncate">{item.value}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.type, item.value);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-border)] rounded transition-opacity"
                    title="Удалить из истории"
                  >
                    <svg className="w-4 h-4 text-[var(--color-text-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}
            </>
          )}

          {/* Show suggestions when user is typing */}
          {filteredSuggestions.length > 0 && (
            <>
              {showHistory && (
                <div className="px-4 py-2 text-xs text-[var(--color-text-light)] bg-[var(--color-bg-gray)] border-b border-[var(--color-border)]">
                  Подсказки
                </div>
              )}
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.name}-${index}`}
                  onClick={() => handleSelect(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg-gray)] flex items-center justify-between gap-2 border-b border-[var(--color-border)] last:border-b-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(suggestion.type)}`}>
                      {getTypeLabel(suggestion.type)}
                    </span>
                    <span className="truncate">{suggestion.name}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-light)] whitespace-nowrap">
                    {suggestion.count} шт.
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
