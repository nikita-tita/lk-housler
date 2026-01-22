'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/services/api';
import { Modal } from '@/components/ui';
import type { Selection } from '@/types';

interface AddToSelectionButtonProps {
  offerId: number;
}

export function AddToSelectionButton({ offerId }: AddToSelectionButtonProps) {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Only show for agents
  if (!isAuthenticated || (user?.role !== 'agent' && user?.role !== 'admin')) {
    return null;
  }

  const loadSelections = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSelections();
      if (response.success && response.data) {
        setSelections(response.data);
      }
    } catch {
      // silently fail - UI will show empty state
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    loadSelections();
  };

  const handleAdd = async () => {
    if (!selectedId) return;

    setIsAdding(true);
    try {
      await api.addSelectionItem(selectedId, offerId, comment || undefined);
      showToast('Объект добавлен в подборку', 'success');
      setIsOpen(false);
      setComment('');
      setSelectedId(null);
    } catch {
      showToast('Ошибка добавления в подборку', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
      >
        Добавить в подборку
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setComment('');
          setSelectedId(null);
        }}
        title="Добавить в подборку"
      >
        {isLoading ? (
          <div className="py-8 text-center text-[var(--color-text-light)]">
            Загрузка...
          </div>
        ) : selections.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-[var(--color-text-light)] mb-4">
              У вас пока нет подборок
            </div>
            <Link
              href="/selections"
              className="text-[var(--color-accent)] hover:underline"
            >
              Создать подборку
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Выберите подборку</label>
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(Number(e.target.value) || null)}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">Выберите...</option>
                {selections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.items_count} объектов)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Комментарий (необязательно)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Заметка для клиента..."
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
              />
            </div>

            <Modal.Footer>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setComment('');
                  setSelectedId(null);
                }}
                className="btn btn-secondary flex-1"
              >
                Отмена
              </button>
              <button
                onClick={handleAdd}
                disabled={isAdding || !selectedId}
                className="btn btn-primary flex-1"
              >
                {isAdding ? 'Добавление...' : 'Добавить'}
              </button>
            </Modal.Footer>
          </div>
        )}
      </Modal>
    </>
  );
}
