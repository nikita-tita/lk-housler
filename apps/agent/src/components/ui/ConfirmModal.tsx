'use client';

import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  // variant зарезервирован для будущего использования (danger стиль)
  variant: _v,
  isLoading = false,
}: ConfirmModalProps) {
  void _v; // Suppress unused variable warning

  const handleConfirm = () => {
    onConfirm();
  };

  // Все варианты используют btn-primary (чёрный)
  // Опасность передаётся через текст кнопки, а не цвет
  const confirmButtonClass = 'btn-primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdropClick={!isLoading}
    >
      <p className="text-[var(--color-text-light)]">{message}</p>

      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="btn btn-secondary flex-1"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          className={`btn flex-1 ${confirmButtonClass}`}
        >
          {isLoading ? 'Загрузка...' : confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
