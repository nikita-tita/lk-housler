'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui';
import { api } from '@/services/api';
import type { SelectionDetail } from '@/types';

interface ShareSelectionModalProps {
  selection: SelectionDetail;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (selection: SelectionDetail) => void;
}

export function ShareSelectionModal({ selection, isOpen, onClose, onUpdate }: ShareSelectionModalProps) {
  const { showToast } = useToast();
  const [email, setEmail] = useState(selection.client_email || '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(selection.is_public);
  const [isUpdating, setIsUpdating] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/s/${selection.share_code}`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    showToast('Ссылка скопирована!', 'success');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Введите email');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // В реальном приложении здесь был бы вызов API для отправки email
      // Пока симулируем отправку через mailto:
      const subject = encodeURIComponent(`Подборка квартир: ${selection.name}`);
      const body = encodeURIComponent(
        `Здравствуйте!\n\n` +
        `Специально для вас подготовлена подборка квартир "${selection.name}".\n\n` +
        (message ? `${message}\n\n` : '') +
        `Посмотреть подборку: ${shareUrl}\n\n` +
        `В подборке ${selection.items.length} объектов.\n\n` +
        `---\n` +
        `Отправлено через housler.ru`
      );

      // Открываем почтовый клиент
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);

      setIsSent(true);
      setTimeout(() => {
        setIsSent(false);
        onClose();
      }, 2000);
    } catch {
      setError('Не удалось отправить письмо');
    } finally {
      setIsSending(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Подборка квартир "${selection.name}"\n\n` +
      (message ? `${message}\n\n` : '') +
      `Посмотреть: ${shareUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Подборка квартир "${selection.name}"\n\n` +
      (message ? `${message}\n\n` : '') +
      `Посмотреть: ${shareUrl}`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
  };

  const handleTogglePublic = async () => {
    setIsUpdating(true);
    try {
      const response = await api.updateSelection(selection.id, { isPublic: !isPublic });
      if (response.success) {
        setIsPublic(!isPublic);
        showToast(
          !isPublic ? 'Подборка опубликована' : 'Подборка скрыта',
          'success'
        );
        if (onUpdate && response.data) {
          onUpdate({ ...selection, is_public: !isPublic });
        }
      } else {
        showToast(response.error || 'Ошибка обновления', 'error');
      }
    } catch {
      showToast('Ошибка обновления', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Поделиться подборкой"
      size="lg"
    >
      <div>
          {/* Publish Toggle */}
          <div className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Публичный доступ</div>
                <div className="text-sm text-[var(--color-text-light)]">
                  {isPublic
                    ? 'Клиенты могут открыть подборку по ссылке'
                    : 'Ссылка не будет работать пока подборка не опубликована'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleTogglePublic}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 ${
                  isPublic ? 'bg-[var(--gray-900)]' : 'bg-gray-200'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {!isPublic && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Включите публичный доступ, чтобы клиент мог открыть ссылку
              </div>
            )}
          </div>

          {/* Share Link */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Ссылка на подборку</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="btn btn-primary btn-sm"
              >
                Копировать
              </button>
            </div>
          </div>

          {/* Messengers */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Мессенджеры</label>
            <div className="flex gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 hover:border-[var(--gray-900)] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-[var(--color-text)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
              <button
                onClick={handleShareTelegram}
                className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 hover:border-[var(--gray-900)] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-[var(--color-text)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 1 0 24 12.056A12 12 0 0 0 11.944 0Zm5.252 7.54-1.879 8.865c-.14.637-.506.793-.028.494l-2.83-2.087-1.365 1.313c-.15.15-.278.278-.57.278l.202-2.879 5.23-4.726c.228-.2-.05-.313-.352-.113l-6.466 4.073-2.786-.87c-.605-.19-.617-.605.127-.896l10.88-4.192c.503-.181.944.124.78.896Z"/>
                </svg>
                Telegram
              </button>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSendEmail}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email клиента</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Сообщение (опционально)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Добрый день! Подготовил для вас подборку квартир..."
                rows={3}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-gray-100 text-[var(--color-text)] rounded-lg text-sm border border-[var(--color-border)]">
                {error}
              </div>
            )}

            {isSent && (
              <div className="mb-4 p-3 bg-[var(--gray-900)] text-white rounded-lg text-sm">
                Письмо отправлено!
              </div>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="btn btn-primary btn-block"
            >
              {isSending ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Отправка...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Отправить по Email
                </>
              )}
            </button>
          </form>
      </div>
    </Modal>
  );
}
