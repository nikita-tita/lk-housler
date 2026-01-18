'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  createBankSplitDeal,
  BankSplitDealCreate,
  BankSplitDealType,
} from '@/lib/api/bank-split';
import { createInvitation } from '@/lib/api/invitations';

const DEAL_TYPE_OPTIONS = [
  { value: 'secondary_sell', label: 'Продажа вторички' },
  { value: 'secondary_buy', label: 'Покупка вторички' },
  { value: 'newbuild_booking', label: 'Бронирование новостройки' },
];

// Комиссия платформы Housler (4%) - удерживается ИЗ комиссии агента
const PLATFORM_FEE_PERCENT = 4;

// Форматирование числа с разделителями тысяч
const formatNumber = (value: number): string => {
  return value.toLocaleString('ru-RU');
};

// Парсинг числа из строки с разделителями
const parseFormattedNumber = (value: string): number => {
  const cleaned = value.replace(/\s/g, '').replace(/,/g, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1, title: 'Объект' },
  { number: 2, title: 'Финансы' },
  { number: 3, title: 'Распределение' },
  { number: 4, title: 'Клиент' },
];

interface FormData {
  type: BankSplitDealType;
  property_address: string;
  price: number;
  // Спред для комиссии: если commission_max > 0, используется диапазон
  commission_total: number; // или min при использовании спреда
  commission_max: number; // max при использовании спреда (0 = без спреда)
  commission_percent: number; // процент от стоимости (для расчёта)
  use_spread: boolean; // использовать спред
  agent_split_percent: number;
  coagent_split_percent: number;
  coagent_phone: string; // Телефон со-агента для приглашения
  agency_split_percent: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  description: string;
}

export default function CreateBankSplitDealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSplit, setHasSplit] = useState(false);
  const [feeConsent, setFeeConsent] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    type: 'secondary_sell',
    property_address: '',
    price: 0,
    commission_total: 0,
    commission_max: 0,
    commission_percent: 0,
    use_spread: false,
    agent_split_percent: 100,
    coagent_split_percent: 0,
    coagent_phone: '',
    agency_split_percent: 0,
    client_name: '',
    client_phone: '',
    client_email: '',
    description: '',
  });

  const totalSplitPercent =
    formData.agent_split_percent +
    formData.coagent_split_percent +
    formData.agency_split_percent;

  // Расчёт комиссии платформы (удерживается ИЗ доли агента, а не добавляется сверху)
  // Клиент платит: commission_total
  // Платформа берёт: 4% от commission_total
  // Агент получает: commission_total - platformFee
  const platformFee = Math.round(formData.commission_total * (PLATFORM_FEE_PERCENT / 100));
  const agentReceives = formData.commission_total - platformFee;

  const validateStep1 = (): boolean => {
    return formData.type && formData.property_address.length > 5;
  };

  const validateStep2 = (): boolean => {
    if (formData.price < 100000) return false;
    if (formData.commission_total < 1000) return false;
    if (!feeConsent) return false;

    if (formData.use_spread) {
      // Для спреда: проверяем что max > min и оба в пределах 30%
      if (formData.commission_max <= formData.commission_total) return false;
      if (formData.commission_max > formData.price * 0.3) return false;
    } else {
      // Без спреда: обычная проверка
      if (formData.commission_total > formData.price * 0.3) return false;
    }

    return true;
  };

  const validateStep3 = (): boolean => {
    if (totalSplitPercent !== 100) return false;
    // Если есть доля со-агента, нужен валидный телефон для приглашения
    if (formData.coagent_split_percent > 0) {
      const phone = formData.coagent_phone.replace(/\D/g, '');
      if (phone.length !== 11 || !phone.startsWith('7')) return false;
    }
    return true;
  };

  const isValidEmail = (email: string): boolean => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string): boolean => {
    return phone.length === 11 && phone.startsWith('7');
  };

  const validateStep4 = (): boolean => {
    return (
      formData.client_name.length >= 2 &&
      isValidPhone(formData.client_phone) &&
      isValidEmail(formData.client_email)
    );
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return validateStep1();
      case 2:
        return validateStep2();
      case 3:
        return validateStep3();
      case 4:
        return validateStep4();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setError('');
    setLoading(true);

    try {
      const dealData: BankSplitDealCreate = {
        type: formData.type,
        property_address: formData.property_address,
        price: String(formData.price),
        commission_total: String(formData.commission_total),
        client_name: formData.client_name || undefined,
        client_phone: formData.client_phone || undefined,
        client_email: formData.client_email || undefined,
        description: formData.description || undefined,
        agent_split_percent: formData.agent_split_percent,
      };

      // Add split data if enabled (percentages only, coagent will be invited)
      if (hasSplit) {
        if (formData.coagent_split_percent > 0) {
          dealData.coagent_split_percent = formData.coagent_split_percent;
        }
        if (formData.agency_split_percent > 0) {
          dealData.agency_split_percent = formData.agency_split_percent;
        }
      }

      const deal = await createBankSplitDeal(dealData);

      // Send invitation to co-agent if phone provided
      if (hasSplit && formData.coagent_split_percent > 0 && formData.coagent_phone) {
        const phone = formData.coagent_phone.replace(/\D/g, '');
        try {
          await createInvitation(deal.id, {
            invited_phone: phone,
            role: 'coagent',
            split_percent: formData.coagent_split_percent,
          });
        } catch {
          // Invitation failed but deal was created - show warning on deal page
          console.warn('Failed to send invitation, but deal was created');
        }
      }

      router.push(`/agent/deals/bank-split/${deal.id}`);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setError(errorMessage || 'Ошибка создания сделки');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7)
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9)
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0 && value[0] === '8') {
      value = '7' + value.slice(1);
    }
    if (value.length === 0) {
      value = '7';
    }
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    setFormData({ ...formData, client_phone: value });
  };

  // Coagent phone handling
  const formatCoagentPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7)
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9)
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  const handleCoagentPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0 && value[0] === '8') {
      value = '7' + value.slice(1);
    }
    if (value.length === 0) {
      value = '7';
    }
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    setFormData({ ...formData, coagent_phone: value });
  };

  const isValidCoagentPhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('7');
  };

  const handleSplitToggle = (enabled: boolean) => {
    setHasSplit(enabled);
    if (!enabled) {
      setFormData({
        ...formData,
        agent_split_percent: 100,
        coagent_split_percent: 0,
        coagent_phone: '',
        agency_split_percent: 0,
      });
    }
  };

  const updateSplit = (
    field: 'agent_split_percent' | 'coagent_split_percent' | 'agency_split_percent',
    value: number
  ) => {
    const clamped = Math.max(0, Math.min(100, value));
    setFormData({ ...formData, [field]: clamped });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/agent/deals"
          className="text-gray-600 hover:text-black text-sm"
        >
          ← Назад к списку
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">
          Создать сделку (Instant Split)
        </h1>
        <p className="text-gray-600 mt-1">Шаг {step} из 4</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  step >= s.number
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-400 border-gray-300'
                }`}
              >
                {s.number}
              </div>
              <span
                className={`mt-2 text-sm ${
                  step >= s.number
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {s.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  step > s.number ? 'bg-black' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Информация об объекте'}
            {step === 2 && 'Финансовые условия'}
            {step === 3 && 'Распределение комиссии'}
            {step === 4 && 'Данные клиента'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: Property */}
          {step === 1 && (
            <div className="space-y-6">
              <Select
                label="Тип сделки"
                options={DEAL_TYPE_OPTIONS}
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as BankSplitDealType,
                  })
                }
              />

              <Input
                label="Адрес объекта"
                placeholder="Москва, ул. Ленина, д. 12, кв. 45"
                value={formData.property_address}
                onChange={(e) =>
                  setFormData({ ...formData, property_address: e.target.value })
                }
                helperText="Полный адрес объекта недвижимости"
                error={
                  formData.property_address.length > 0 && formData.property_address.length <= 5
                    ? 'Введите полный адрес объекта'
                    : undefined
                }
              />

              <Input
                label="Описание (опционально)"
                placeholder="Дополнительная информация о сделке"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          )}

          {/* Step 2: Financials */}
          {step === 2 && (
            <div className="space-y-6">
              <Input
                label="Стоимость объекта"
                type="text"
                inputMode="numeric"
                placeholder="15 000 000"
                value={formData.price ? formatNumber(formData.price) : ''}
                onChange={(e) => {
                  const value = parseFormattedNumber(e.target.value);
                  setFormData({ ...formData, price: value });
                }}
                helperText="Цена объекта недвижимости в рублях"
                error={
                  formData.price > 0 && formData.price < 100000
                    ? 'Минимальная стоимость объекта 100 000 руб.'
                    : undefined
                }
              />

              {/* Переключатель спреда */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Диапазон комиссии (спред)
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Используйте, если финальная сумма ещё неизвестна
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, use_spread: !formData.use_spread })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
                    formData.use_spread ? 'bg-black' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.use_spread ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {formData.use_spread ? (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Комиссия от"
                    type="text"
                    inputMode="numeric"
                    placeholder="300 000"
                    value={formData.commission_total ? formatNumber(formData.commission_total) : ''}
                    onChange={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setFormData({ ...formData, commission_total: value });
                    }}
                    helperText="Минимальная сумма"
                    error={
                      formData.commission_total > 0 && formData.commission_total < 1000
                        ? 'Мин. 1 000 руб.'
                        : undefined
                    }
                  />
                  <Input
                    label="Комиссия до"
                    type="text"
                    inputMode="numeric"
                    placeholder="500 000"
                    value={formData.commission_max ? formatNumber(formData.commission_max) : ''}
                    onChange={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setFormData({ ...formData, commission_max: value });
                    }}
                    helperText="Максимальная сумма"
                    error={
                      formData.commission_max > 0 && formData.commission_max <= formData.commission_total
                        ? 'Должна быть больше минимальной'
                        : undefined
                    }
                  />
                </div>
              ) : (
                <Input
                  label="Комиссия"
                  type="text"
                  inputMode="numeric"
                  placeholder="450 000"
                  value={formData.commission_total ? formatNumber(formData.commission_total) : ''}
                  onChange={(e) => {
                    const value = parseFormattedNumber(e.target.value);
                    setFormData({
                      ...formData,
                      commission_total: value,
                      commission_max: 0,
                    });
                  }}
                  helperText="Сумма комиссии по сделке в рублях"
                  error={
                    formData.commission_total > 0 && formData.commission_total < 1000
                      ? 'Минимальная комиссия 1 000 руб.'
                      : formData.price > 0 && formData.commission_total > formData.price * 0.3
                      ? 'Комиссия не может превышать 30% от стоимости объекта'
                      : undefined
                  }
                />
              )}

              {formData.price > 0 && formData.commission_total > 0 && (
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    {formData.use_spread && formData.commission_max > 0 ? (
                      <p className="text-sm text-gray-600">
                        Комиссия составляет{' '}
                        <span className="font-medium text-gray-900">
                          {((formData.commission_total / formData.price) * 100).toFixed(2)}% - {((formData.commission_max / formData.price) * 100).toFixed(2)}%
                        </span>{' '}
                        от стоимости объекта
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Комиссия составляет{' '}
                        <span className="font-medium text-gray-900">
                          {((formData.commission_total / formData.price) * 100).toFixed(2)}%
                        </span>{' '}
                        от стоимости объекта
                      </p>
                    )}
                  </div>

                  {/* Расчёт комиссии */}
                  <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      {formData.use_spread && formData.commission_max > 0
                        ? 'Расчёт комиссии (диапазон)'
                        : 'Расчёт комиссии'}
                    </h4>
                    {formData.use_spread && formData.commission_max > 0 ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Клиент платит:</span>
                          <span className="font-medium text-gray-900">
                            {formatNumber(formData.commission_total)} - {formatNumber(formData.commission_max)} руб.
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):
                          </span>
                          <span className="font-medium text-gray-500">
                            -{formatNumber(Math.round(formData.commission_total * PLATFORM_FEE_PERCENT / 100))} - {formatNumber(Math.round(formData.commission_max * PLATFORM_FEE_PERCENT / 100))} руб.
                          </span>
                        </div>
                        <div className="border-t border-gray-300 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-900">Агент получает:</span>
                            <span className="font-semibold text-gray-900">
                              {formatNumber(Math.round(formData.commission_total * (100 - PLATFORM_FEE_PERCENT) / 100))} - {formatNumber(Math.round(formData.commission_max * (100 - PLATFORM_FEE_PERCENT) / 100))} руб.
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Точная сумма будет определена при выставлении счёта
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Клиент платит:</span>
                          <span className="font-medium text-gray-900">
                            {formatNumber(formData.commission_total)} руб.
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):
                          </span>
                          <span className="font-medium text-gray-500">
                            -{formatNumber(platformFee)} руб.
                          </span>
                        </div>
                        <div className="border-t border-gray-300 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-900">Агент получает:</span>
                            <span className="font-semibold text-gray-900">
                              {formatNumber(agentReceives)} руб.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Согласие на комиссию */}
                  <label className="flex items-start gap-3 cursor-pointer p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={feeConsent}
                      onChange={(e) => setFeeConsent(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                    {formData.use_spread && formData.commission_max > 0 ? (
                      <span className="text-sm text-gray-700">
                        Я ознакомлен и согласен с тем, что комиссия сервиса Housler составляет{' '}
                        <span className="font-medium text-gray-900">{PLATFORM_FEE_PERCENT}%</span>{' '}
                        и будет удержана из моей комиссии. Диапазон комиссии:{' '}
                        <span className="font-medium text-gray-900">
                          {formatNumber(formData.commission_total)} - {formatNumber(formData.commission_max)} руб.
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-700">
                        Я ознакомлен и согласен с тем, что комиссия сервиса Housler составляет{' '}
                        <span className="font-medium text-gray-900">{PLATFORM_FEE_PERCENT}%</span>{' '}
                        ({formatNumber(platformFee)} руб.) и будет удержана из моей комиссии.
                        После удержания я получу{' '}
                        <span className="font-medium text-gray-900">{formatNumber(agentReceives)} руб.</span>
                      </span>
                    )}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Split */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Разделить комиссию
                </span>
                <button
                  type="button"
                  onClick={() => handleSplitToggle(!hasSplit)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
                    hasSplit ? 'bg-black' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hasSplit ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {!hasSplit ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    100% комиссии получит основной агент
                  </p>
                  {formData.commission_total > 0 && (
                    <p className="text-lg font-semibold text-gray-900 mt-2">
                      {formData.commission_total.toLocaleString('ru-RU')} руб.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <Input
                      label="Доля агента (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.agent_split_percent}
                      onChange={(e) =>
                        updateSplit('agent_split_percent', Number(e.target.value))
                      }
                      helperText={
                        formData.commission_total > 0
                          ? `${Math.round(formData.commission_total * (formData.agent_split_percent / 100)).toLocaleString('ru-RU')} руб.`
                          : undefined
                      }
                    />

                    <div className="space-y-2">
                      <Input
                        label="Доля со-агента (%)"
                        type="number"
                        min={0}
                        max={100}
                        value={formData.coagent_split_percent}
                        onChange={(e) =>
                          updateSplit(
                            'coagent_split_percent',
                            Number(e.target.value)
                          )
                        }
                        helperText={
                          formData.commission_total > 0
                            ? `${Math.round(formData.commission_total * (formData.coagent_split_percent / 100)).toLocaleString('ru-RU')} руб.`
                            : undefined
                        }
                      />
                      {formData.coagent_split_percent > 0 && (
                        <div className="space-y-2">
                          <Input
                            label="Телефон со-агента"
                            type="tel"
                            placeholder="+7 (999) 123-45-67"
                            value={formatCoagentPhone(formData.coagent_phone)}
                            onChange={handleCoagentPhoneChange}
                            helperText="На этот номер будет отправлено приглашение"
                            error={
                              formData.coagent_phone.length > 0 &&
                              !isValidCoagentPhone(formData.coagent_phone)
                                ? 'Введите корректный номер телефона'
                                : undefined
                            }
                          />
                          <p className="text-xs text-gray-500">
                            После создания сделки со-агент получит SMS с приглашением
                          </p>
                        </div>
                      )}
                    </div>

                    <Input
                      label="Доля агентства (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.agency_split_percent}
                      onChange={(e) =>
                        updateSplit('agency_split_percent', Number(e.target.value))
                      }
                      helperText={
                        formData.commission_total > 0
                          ? `${Math.round(formData.commission_total * (formData.agency_split_percent / 100)).toLocaleString('ru-RU')} руб.`
                          : undefined
                      }
                    />
                  </div>

                  <div
                    className={`p-4 rounded-lg ${
                      totalSplitPercent === 100 ? 'bg-gray-50' : 'bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Общий процент:
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          totalSplitPercent === 100
                            ? 'text-gray-900'
                            : 'text-gray-900'
                        }`}
                      >
                        {totalSplitPercent}%
                      </span>
                    </div>
                    {totalSplitPercent !== 100 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Сумма долей должна быть равна 100%
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Client */}
          {step === 4 && (
            <div className="space-y-6">
              <Input
                label="ФИО клиента"
                placeholder="Иванов Иван Иванович"
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
                error={
                  formData.client_name.length > 0 && formData.client_name.length < 2
                    ? 'Введите имя клиента'
                    : undefined
                }
              />

              <Input
                label="Телефон клиента"
                type="tel"
                placeholder="+7 (999) 123-45-67"
                value={formatPhone(formData.client_phone)}
                onChange={handlePhoneChange}
                helperText="На этот номер будет отправлена ссылка для оплаты"
                error={
                  formData.client_phone.length > 0 && !isValidPhone(formData.client_phone)
                    ? 'Введите корректный номер телефона'
                    : undefined
                }
              />

              <Input
                label="Email клиента (опционально)"
                type="email"
                placeholder="client@example.com"
                value={formData.client_email}
                onChange={(e) =>
                  setFormData({ ...formData, client_email: e.target.value })
                }
                error={
                  formData.client_email.length > 0 && !isValidEmail(formData.client_email)
                    ? 'Введите корректный email'
                    : undefined
                }
              />

              {/* Summary */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-gray-900">
                  Итого по сделке
                </h4>
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Стоимость объекта:</span>
                    <span className="font-medium text-gray-900">
                      {formatNumber(formData.price)} руб.
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Комиссия:</span>
                    <span className="font-medium text-gray-900">
                      {formData.use_spread && formData.commission_max > 0
                        ? `${formatNumber(formData.commission_total)} - ${formatNumber(formData.commission_max)} руб.`
                        : `${formatNumber(formData.commission_total)} руб.`}
                    </span>
                  </div>
                  {hasSplit && (
                    <>
                      <div className="border-t border-gray-200 my-2" />
                      <div className="flex justify-between">
                        <span>Агент ({formData.agent_split_percent}%):</span>
                        <span>
                          {Math.round(
                            formData.commission_total *
                              (formData.agent_split_percent / 100)
                          ).toLocaleString('ru-RU')}{' '}
                          руб.
                        </span>
                      </div>
                      {formData.coagent_split_percent > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Со-агент ({formData.coagent_split_percent}%):
                          </span>
                          <span>
                            {Math.round(
                              formData.commission_total *
                                (formData.coagent_split_percent / 100)
                            ).toLocaleString('ru-RU')}{' '}
                            руб.
                          </span>
                        </div>
                      )}
                      {formData.agency_split_percent > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Агентство ({formData.agency_split_percent}%):
                          </span>
                          <span>
                            {Math.round(
                              formData.commission_total *
                                (formData.agency_split_percent / 100)
                            ).toLocaleString('ru-RU')}{' '}
                            руб.
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Итого к оплате клиентом */}
              <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Расчёт платежа
                </h4>
                {formData.use_spread && formData.commission_max > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Клиент платит:</span>
                      <span className="font-semibold text-lg text-gray-900">
                        {formatNumber(formData.commission_total)} - {formatNumber(formData.commission_max)} руб.
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):</span>
                      <span className="text-gray-500">
                        -{formatNumber(Math.round(formData.commission_total * PLATFORM_FEE_PERCENT / 100))} - {formatNumber(Math.round(formData.commission_max * PLATFORM_FEE_PERCENT / 100))} руб.
                      </span>
                    </div>
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">Агент получает:</span>
                        <span className="font-semibold text-gray-900">
                          {formatNumber(Math.round(formData.commission_total * (100 - PLATFORM_FEE_PERCENT) / 100))} - {formatNumber(Math.round(formData.commission_max * (100 - PLATFORM_FEE_PERCENT) / 100))} руб.
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Точная сумма будет определена при выставлении счёта
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Клиент платит:</span>
                      <span className="font-semibold text-lg text-gray-900">
                        {formatNumber(formData.commission_total)} руб.
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):</span>
                      <span className="text-gray-500">-{formatNumber(platformFee)} руб.</span>
                    </div>
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">Агент получает:</span>
                        <span className="font-semibold text-gray-900">
                          {formatNumber(agentReceives)} руб.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
              <p className="text-sm text-gray-900">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <Button type="button" variant="secondary" onClick={handleBack}>
                Назад
              </Button>
            )}

            {step < 4 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                fullWidth={step === 1}
              >
                Далее
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                loading={loading}
                disabled={!canProceed()}
                fullWidth
              >
                Создать сделку
              </Button>
            )}

            {step === 1 && (
              <Link href="/agent/deals" className="flex-1">
                <Button type="button" variant="secondary" fullWidth>
                  Отмена
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
