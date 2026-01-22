'use client';

import { useState } from 'react';
import { Button } from '@housler/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@housler/ui';
import {
  ClientPassportUpdate,
  ClientPassportStatus,
  updateClientPassport,
} from '@housler/lib';

interface ClientPassportFormProps {
  dealId: string;
  initialStatus?: ClientPassportStatus;
  onSave?: (status: ClientPassportStatus) => void;
  disabled?: boolean;
}

export function ClientPassportForm({
  dealId,
  initialStatus,
  onSave,
  disabled = false,
}: ClientPassportFormProps) {
  const [isExpanded, setIsExpanded] = useState(!initialStatus?.has_passport_data);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<ClientPassportUpdate>({
    passport_series: '',
    passport_number: '',
    passport_issued_by: '',
    passport_issued_date: '',
    passport_issued_code: '',
    birth_date: '',
    birth_place: '',
    registration_address: '',
  });

  const handleSeriesChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setFormData({ ...formData, passport_series: digits });
  };

  const handleNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setFormData({ ...formData, passport_number: digits });
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    let formatted = digits;
    if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setFormData({ ...formData, passport_issued_code: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate
    if (formData.passport_series.length !== 4) {
      setError('Серия паспорта должна содержать 4 цифры');
      return;
    }
    if (formData.passport_number.length !== 6) {
      setError('Номер паспорта должен содержать 6 цифр');
      return;
    }
    if (!formData.passport_issued_by || formData.passport_issued_by.length < 5) {
      setError('Укажите кем выдан паспорт');
      return;
    }
    if (!formData.passport_issued_date) {
      setError('Укажите дату выдачи паспорта');
      return;
    }
    if (formData.passport_issued_code.replace(/-/g, '').length !== 6) {
      setError('Код подразделения должен содержать 6 цифр');
      return;
    }
    if (!formData.birth_date) {
      setError('Укажите дату рождения');
      return;
    }
    if (!formData.birth_place || formData.birth_place.length < 2) {
      setError('Укажите место рождения');
      return;
    }
    if (!formData.registration_address || formData.registration_address.length < 10) {
      setError('Укажите адрес регистрации');
      return;
    }

    setLoading(true);

    try {
      const result = await updateClientPassport(dealId, formData);
      setSuccess(true);
      setIsExpanded(false);

      if (onSave) {
        onSave({
          deal_id: dealId,
          has_passport_data: result.has_passport_data,
          missing_fields: [],
          passport_series_masked: result.passport_series_masked,
          passport_number_masked: result.passport_number_masked,
          passport_issued_date: result.passport_issued_date,
          passport_issued_code: result.passport_issued_code,
          birth_date: result.birth_date,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения данных');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => !disabled && setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Паспортные данные клиента</CardTitle>
          <div className="flex items-center gap-2">
            {initialStatus?.has_passport_data && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                Заполнено
              </span>
            )}
            {!initialStatus?.has_passport_data && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                Требуется
              </span>
            )}
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {initialStatus?.has_passport_data && !success && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium mb-2">Текущие данные (замаскированы):</div>
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div>Серия: {initialStatus.passport_series_masked}</div>
                <div>Номер: {initialStatus.passport_number_masked}</div>
                <div>Код: {initialStatus.passport_issued_code}</div>
                <div>Выдан: {formatDate(initialStatus.passport_issued_date)}</div>
                <div>Дата рождения: {formatDate(initialStatus.birth_date)}</div>
              </div>
              {!disabled && (
                <p className="mt-2 text-xs text-gray-500">
                  Заполните форму ниже для обновления данных
                </p>
              )}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              Данные успешно сохранены
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700">
              {error}
            </div>
          )}

          {!disabled && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Серия паспорта</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.passport_series}
                    onChange={(e) => handleSeriesChange(e.target.value)}
                    placeholder="0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Номер паспорта</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.passport_number}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                    maxLength={6}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Кем выдан</label>
                <textarea
                  value={formData.passport_issued_by}
                  onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
                  placeholder="ГУ МВД России по г. Москве"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата выдачи</label>
                  <input
                    type="date"
                    value={formData.passport_issued_date}
                    onChange={(e) => setFormData({ ...formData, passport_issued_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Код подразделения</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.passport_issued_code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="000-000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Место рождения</label>
                  <input
                    type="text"
                    value={formData.birth_place}
                    onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                    placeholder="г. Москва"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Адрес регистрации</label>
                <textarea
                  value={formData.registration_address}
                  onChange={(e) => setFormData({ ...formData, registration_address: e.target.value })}
                  placeholder="123456, г. Москва, ул. Примерная, д. 1, кв. 1"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsExpanded(false)}
                  disabled={loading}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Данные паспорта шифруются и хранятся в соответствии с 152-ФЗ
              </p>
            </form>
          )}

          {disabled && !initialStatus?.has_passport_data && (
            <p className="text-sm text-gray-500">
              Паспортные данные необходимо заполнить для формирования договора
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
