'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { AgentLegalData, LegalType, UpdateLegalDataDto, UpdatePassportDataDto } from '@/types';

const LEGAL_TYPE_OPTIONS: { value: LegalType; label: string; description: string }[] = [
  { value: 'self_employed', label: 'Самозанятый', description: 'Работаете как физлицо по НПД' },
  { value: 'ip', label: 'ИП', description: 'Индивидуальный предприниматель' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_verified: { label: 'Не заполнено', color: 'text-gray-500 bg-gray-100' },
  pending: { label: 'На проверке', color: 'text-yellow-700 bg-yellow-100' },
  verified: { label: 'Проверено', color: 'text-green-700 bg-green-100' },
  rejected: { label: 'Отклонено', color: 'text-red-700 bg-red-100' },
};

export default function LegalSettingsPage() {
  const { user } = useAuth();
  const [legalData, setLegalData] = useState<AgentLegalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state - основные данные
  const [legalType, setLegalType] = useState<LegalType>('self_employed');
  const [inn, setInn] = useState('');
  const [ogrnip, setOgrnip] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBik, setBankBik] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankCorrespondentAccount, setBankCorrespondentAccount] = useState('');

  // Form state - паспорт (только для СМЗ)
  const [passportSeries, setPassportSeries] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportIssuedBy, setPassportIssuedBy] = useState('');
  const [passportIssuedDate, setPassportIssuedDate] = useState('');
  const [passportDepartmentCode, setPassportDepartmentCode] = useState('');
  const [registrationAddress, setRegistrationAddress] = useState('');

  const [showPassportForm, setShowPassportForm] = useState(false);

  const isAgent = user?.role === 'agent' || user?.role === 'agency_admin' || user?.role === 'operator';

  const loadData = useCallback(async () => {
    try {
      const res = await api.getLegalData();
      if (res.success && res.data) {
        setLegalData(res.data);
        setLegalType(res.data.legal_type);
        // ИНН и ОГРНИП храним только для отображения (маскированные)
      }
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAgent) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAgent, loadData]);

  const handleSubmitLegalData = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    const data: UpdateLegalDataDto = {};

    if (legalType) data.legal_type = legalType;
    if (inn) data.inn = inn;
    if (legalType === 'ip' && ogrnip) data.ogrnip = ogrnip;
    if (bankName) data.bank_name = bankName;
    if (bankBik) data.bank_bik = bankBik;
    if (bankAccount) data.bank_account = bankAccount;
    if (bankCorrespondentAccount) data.bank_correspondent_account = bankCorrespondentAccount;

    try {
      const res = await api.updateLegalData(data);
      if (res.success && res.data) {
        setLegalData(res.data);
        setSuccess('Данные сохранены');
        // Очищаем поля ввода (они показываются маскированными из legalData)
        setInn('');
        setOgrnip('');
        setBankAccount('');
      } else {
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitPassportData = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    const data: UpdatePassportDataDto = {};

    if (passportSeries) data.passport_series = passportSeries;
    if (passportNumber) data.passport_number = passportNumber;
    if (passportIssuedBy) data.passport_issued_by = passportIssuedBy;
    if (passportIssuedDate) data.passport_issued_date = passportIssuedDate;
    if (passportDepartmentCode) data.passport_department_code = passportDepartmentCode;
    if (registrationAddress) data.registration_address = registrationAddress;

    try {
      const res = await api.updatePassportData(data);
      if (res.success && res.data) {
        setLegalData(res.data);
        setSuccess('Паспортные данные сохранены');
        setShowPassportForm(false);
        // Очищаем поля
        setPassportSeries('');
        setPassportNumber('');
        setPassportIssuedBy('');
        setPassportIssuedDate('');
        setPassportDepartmentCode('');
        setRegistrationAddress('');
      } else {
        setError(res.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAgent) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <p className="text-[var(--color-text-light)]">
          Юридические данные доступны только для риелторов
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[legalData?.verification_status || 'not_verified'];

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Статус верификации */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Статус проверки</h2>
            <p className="text-sm text-[var(--color-text-light)] mt-1">
              Для получения комиссий необходимо заполнить и верифицировать юридические данные
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        {legalData?.verification_comment && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-[var(--color-text-light)]">
              <span className="font-medium">Комментарий:</span> {legalData.verification_comment}
            </p>
          </div>
        )}
      </div>

      {/* Тип деятельности */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Тип деятельности</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LEGAL_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLegalType(opt.value)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                legalType === opt.value
                  ? 'border-[var(--color-accent)] bg-blue-50'
                  : 'border-[var(--color-border)] hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-sm text-[var(--color-text-light)] mt-1">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Основные данные */}
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Реквизиты</h2>

        <form onSubmit={handleSubmitLegalData} className="space-y-5">
          {/* ИНН */}
          <div>
            <label htmlFor="inn" className="block text-sm font-medium mb-2">
              ИНН <span className="text-red-500">*</span>
            </label>
            {legalData?.inn_masked ? (
              <div className="flex items-center gap-4">
                <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg flex-1">
                  {legalData.inn_masked}
                </div>
                <button
                  type="button"
                  onClick={() => setInn('')}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  Изменить
                </button>
              </div>
            ) : (
              <input
                type="text"
                id="inn"
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="123456789012"
                maxLength={12}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
            )}
            <p className="text-xs text-[var(--color-text-light)] mt-1">12 цифр для физлица</p>
          </div>

          {/* ОГРНИП (только для ИП) */}
          {legalType === 'ip' && (
            <div>
              <label htmlFor="ogrnip" className="block text-sm font-medium mb-2">
                ОГРНИП <span className="text-red-500">*</span>
              </label>
              {legalData?.ogrnip ? (
                <div className="flex items-center gap-4">
                  <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg flex-1">
                    {legalData.ogrnip}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOgrnip('')}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    Изменить
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  id="ogrnip"
                  value={ogrnip}
                  onChange={(e) => setOgrnip(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="123456789012345"
                  maxLength={15}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              )}
              <p className="text-xs text-[var(--color-text-light)] mt-1">15 цифр</p>
            </div>
          )}

          <hr className="my-6" />
          <h3 className="text-md font-semibold">Банковские реквизиты</h3>

          {/* Название банка */}
          <div>
            <label htmlFor="bankName" className="block text-sm font-medium mb-2">
              Название банка
            </label>
            <input
              type="text"
              id="bankName"
              value={bankName || legalData?.bank_name || ''}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Сбербанк"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
          </div>

          {/* БИК */}
          <div>
            <label htmlFor="bankBik" className="block text-sm font-medium mb-2">
              БИК банка
            </label>
            <input
              type="text"
              id="bankBik"
              value={bankBik || legalData?.bank_bik || ''}
              onChange={(e) => setBankBik(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="044525225"
              maxLength={9}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            />
            <p className="text-xs text-[var(--color-text-light)] mt-1">9 цифр, начинается с 04</p>
          </div>

          {/* Расчётный счёт */}
          <div>
            <label htmlFor="bankAccount" className="block text-sm font-medium mb-2">
              Расчётный счёт
            </label>
            {legalData?.bank_account_masked ? (
              <div className="flex items-center gap-4">
                <div className="px-4 py-3 bg-gray-50 border border-[var(--color-border)] rounded-lg flex-1 font-mono">
                  {legalData.bank_account_masked}
                </div>
                <button
                  type="button"
                  onClick={() => setBankAccount('')}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  Изменить
                </button>
              </div>
            ) : (
              <input
                type="text"
                id="bankAccount"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, '').slice(0, 20))}
                placeholder="40817810099910000001"
                maxLength={20}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent font-mono"
              />
            )}
            <p className="text-xs text-[var(--color-text-light)] mt-1">20 цифр</p>
          </div>

          {/* Корр. счёт */}
          <div>
            <label htmlFor="bankCorrespondentAccount" className="block text-sm font-medium mb-2">
              Корреспондентский счёт
            </label>
            <input
              type="text"
              id="bankCorrespondentAccount"
              value={bankCorrespondentAccount || legalData?.bank_correspondent_account || ''}
              onChange={(e) => setBankCorrespondentAccount(e.target.value.replace(/\D/g, '').slice(0, 20))}
              placeholder="30101810400000000225"
              maxLength={20}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить реквизиты'}
          </button>
        </form>
      </div>

      {/* Паспортные данные (только для СМЗ) */}
      {legalType === 'self_employed' && (
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Паспортные данные</h2>
              <p className="text-sm text-[var(--color-text-light)]">
                Требуются для заключения договора с самозанятым
              </p>
            </div>
            {legalData?.has_passport_data && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                Заполнено
              </span>
            )}
          </div>

          {!showPassportForm && !legalData?.has_passport_data && (
            <button
              type="button"
              onClick={() => setShowPassportForm(true)}
              className="btn btn-secondary"
            >
              Заполнить паспортные данные
            </button>
          )}

          {legalData?.has_passport_data && !showPassportForm && (
            <div className="space-y-2">
              <p className="text-sm">
                Дата выдачи: {legalData.passport_issued_date || '—'}
              </p>
              <button
                type="button"
                onClick={() => setShowPassportForm(true)}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Изменить паспортные данные
              </button>
            </div>
          )}

          {showPassportForm && (
            <form onSubmit={handleSubmitPassportData} className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="passportSeries" className="block text-sm font-medium mb-2">
                    Серия
                  </label>
                  <input
                    type="text"
                    id="passportSeries"
                    value={passportSeries}
                    onChange={(e) => setPassportSeries(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="passportNumber" className="block text-sm font-medium mb-2">
                    Номер
                  </label>
                  <input
                    type="text"
                    id="passportNumber"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="567890"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="passportIssuedBy" className="block text-sm font-medium mb-2">
                  Кем выдан
                </label>
                <input
                  type="text"
                  id="passportIssuedBy"
                  value={passportIssuedBy}
                  onChange={(e) => setPassportIssuedBy(e.target.value)}
                  placeholder="ОВД района Таганский г. Москвы"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="passportIssuedDate" className="block text-sm font-medium mb-2">
                    Дата выдачи
                  </label>
                  <input
                    type="date"
                    id="passportIssuedDate"
                    value={passportIssuedDate}
                    onChange={(e) => setPassportIssuedDate(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="passportDepartmentCode" className="block text-sm font-medium mb-2">
                    Код подразделения
                  </label>
                  <input
                    type="text"
                    id="passportDepartmentCode"
                    value={passportDepartmentCode}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
                      setPassportDepartmentCode(v);
                    }}
                    placeholder="770-001"
                    maxLength={7}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="registrationAddress" className="block text-sm font-medium mb-2">
                  Адрес регистрации
                </label>
                <input
                  type="text"
                  id="registrationAddress"
                  value={registrationAddress}
                  onChange={(e) => setRegistrationAddress(e.target.value)}
                  placeholder="г. Москва, ул. Примерная, д. 1, кв. 1"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassportForm(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Информация о безопасности */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-blue-800">Защита данных</h3>
            <p className="text-sm text-blue-700 mt-1">
              Ваши персональные данные надёжно защищены шифрованием AES-256 и хранятся в соответствии с 152-ФЗ.
              Доступ к полным данным имеют только операторы для проверки.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
