'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ExportFormat } from '@/lib/api/admin';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({
  onExport,
  label = 'Экспорт',
  disabled = false,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleExport(format: ExportFormat) {
    setIsExporting(true);
    setExportFormat(format);
    setIsOpen(false);

    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
      >
        {isExporting ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2" />
            {exportFormat === 'csv' ? 'CSV...' : 'Excel...'}
          </>
        ) : (
          label
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
          >
            Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
