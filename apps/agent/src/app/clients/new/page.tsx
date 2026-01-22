'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/services/api';
import type { ClientPriority, CreateClientDto } from '@/types';

const PRIORITIES: { value: ClientPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' },
];

export default function NewClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateClientDto>({
    name: '',
    phone: '',
    email: '',
    telegram: '',
    whatsapp: '',
    priority: 'medium',
    comment: '',
    budget_min: undefined,
    budget_max: undefined,
    desired_rooms: [],
    next_contact_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Валидация
    if (!form.name && !form.phone && !form.email) {
      setError('Укажите имя, телефон или email клиента');
      return;
    }

    setIsSubmitting(true);

    try {
      const dataToSend: CreateClientDto = {
        ...form,
        budget_min: form.budget_min || undefined,
        budget_max: form.budget_max || undefined,
        desired_rooms: form.desired_rooms?.length ? form.desired_rooms : undefined,
        next_contact_date: form.next_contact_date || undefined,
      };

      const response = await api.createClient(dataToSend);

      if (response.success && response.data) {
        router.push(`/clients/${response.data.id}`);
      } else {
        setError(response.error || 'Не удалось создать клиента');
      }
    } catch (err) {
      console.error('Failed to create client:', err);
      setError('Произошла ошибка при создании клиента');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoomsChange = (room: number) => {
    const current = form.desired_rooms || [];
    const updated = current.includes(room)
      ? current.filter(r => r !== room)
      : [...current, room].sort();
    setForm({ ...form, desired_rooms: updated });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]">
          &larr; К списку клиентов
        </Link>
      </div>

      <h2 className="text-2xl font-semibold mb-8">Новый клиент</h2>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {error && (
          <div className="mb-6 p-4 bg-gray-100 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm">
            {error}
          </div>
        )}

        {/* Контактная информация */}
        <section className="mb-8">
          <h3 className="text-lg font-medium mb-4">Контактная информация</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Имя</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Иван Петров"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Телефон</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 911 123-45-67"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="client@email.com"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Telegram</label>
              <input
                type="text"
                value={form.telegram || ''}
                onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                placeholder="@username"
                className="input"
              />
            </div>
          </div>
        </section>

        {/* Приоритет и дата контакта */}
        <section className="mb-8">
          <h3 className="text-lg font-medium mb-4">Управление</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Приоритет</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as ClientPriority })}
                className="select"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Дата следующего контакта</label>
              <input
                type="date"
                value={form.next_contact_date || ''}
                onChange={(e) => setForm({ ...form, next_contact_date: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </section>

        {/* Пожелания по недвижимости */}
        <section className="mb-8">
          <h3 className="text-lg font-medium mb-4">Пожелания по недвижимости</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Бюджет от</label>
              <input
                type="number"
                value={form.budget_min || ''}
                onChange={(e) => setForm({ ...form, budget_min: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="5 000 000"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Бюджет до</label>
              <input
                type="number"
                value={form.budget_max || ''}
                onChange={(e) => setForm({ ...form, budget_max: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="10 000 000"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Количество комнат</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4].map(room => (
                <button
                  key={room}
                  type="button"
                  onClick={() => handleRoomsChange(room)}
                  className={`tab-btn border ${
                    form.desired_rooms?.includes(room)
                      ? 'tab-btn-active border-gray-900'
                      : 'border-gray-300 hover:border-gray-900'
                  }`}
                >
                  {room === 0 ? 'Студия' : room}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Комментарий */}
        <section className="mb-8">
          <h3 className="text-lg font-medium mb-4">Комментарий</h3>
          <textarea
            value={form.comment || ''}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="Заметки о клиенте..."
            rows={4}
            className="input resize-none"
          />
        </section>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Сохранение...' : 'Создать клиента'}
          </button>
          <Link href="/clients" className="btn btn-secondary">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
