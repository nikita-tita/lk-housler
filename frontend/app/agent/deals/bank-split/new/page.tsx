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

const DEAL_TYPE_OPTIONS = [
  { value: 'secondary_sell', label: 'Продажа вторички' },
  { value: 'secondary_buy', label: 'Покупка вторички' },
  { value: 'newbuild_booking', label: 'Бронирование новостройки' },
];

// Комиссия платформы Housler (4%)
const PLATFORM_FEE_PERCENT = 4;

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
  commission_total: number;
  agent_split_percent: number;
  coagent_split_percent: number;
  coagent_user_id: number | null;
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
    agent_split_percent: 100,
    coagent_split_percent: 0,
    coagent_user_id: null,
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

  // Расчёт комиссии платформы
  const platformFee = Math.round(formData.commission_total * (PLATFORM_FEE_PERCENT / 100));
  const totalClientPayment = formData.commission_total + platformFee;

  const validateStep1 = (): boolean => {
    return formData.type && formData.property_address.length > 5;
  };

  const validateStep2 = (): boolean => {
    return formData.price > 0 && formData.commission_total > 0 && feeConsent;
  };

  const validateStep3 = (): boolean => {
    if (totalSplitPercent !== 100) return false;
    if (formData.coagent_split_percent > 0 && !formData.coagent_user_id) return false;
    return true;
  };

  const validateStep4 = (): boolean => {
    return (
      formData.client_name.length >= 2 && formData.client_phone.length >= 10
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

      // Add split data if enabled
      if (hasSplit) {
        if (formData.coagent_split_percent > 0 && formData.coagent_user_id) {
          dealData.coagent_user_id = formData.coagent_user_id;
          dealData.coagent_split_percent = formData.coagent_split_percent;
        }
        if (formData.agency_split_percent > 0) {
          dealData.agency_split_percent = formData.agency_split_percent;
        }
      }

      const deal = await createBankSplitDeal(dealData);
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

  const handleSplitToggle = (enabled: boolean) => {
    setHasSplit(enabled);
    if (!enabled) {
      setFormData({
        ...formData,
        agent_split_percent: 100,
        coagent_split_percent: 0,
        coagent_user_id: null,
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
                type="number"
                placeholder="15 000 000"
                value={formData.price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, price: Number(e.target.value) })
                }
                helperText="Цена объекта недвижимости в рублях"
              />

              <Input
                label="Общая комиссия"
                type="number"
                placeholder="450 000"
                value={formData.commission_total || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commission_total: Number(e.target.value),
                  })
                }
                helperText="Общая сумма комиссии по сделке в рублях"
              />

              {formData.price > 0 && formData.commission_total > 0 && (
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Комиссия составляет{' '}
                      <span className="font-medium text-gray-900">
                        {((formData.commission_total / formData.price) * 100).toFixed(2)}%
                      </span>{' '}
                      от стоимости объекта
                    </p>
                  </div>

                  {/* Комиссия платформы */}
                  <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Расчёт оплаты клиентом
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Комиссия агента:</span>
                        <span className="font-medium text-gray-900">
                          {formData.commission_total.toLocaleString('ru-RU')} руб.
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):
                        </span>
                        <span className="font-medium text-gray-900">
                          {platformFee.toLocaleString('ru-RU')} руб.
                        </span>
                      </div>
                      <div className="border-t border-gray-300 pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900">Итого к оплате:</span>
                          <span className="font-semibold text-gray-900">
                            {totalClientPayment.toLocaleString('ru-RU')} руб.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Согласие на комиссию */}
                  <label className="flex items-start gap-3 cursor-pointer p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={feeConsent}
                      onChange={(e) => setFeeConsent(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">
                      Я ознакомлен и согласен с тем, что комиссия сервиса Housler составляет{' '}
                      <span className="font-medium text-gray-900">{PLATFORM_FEE_PERCENT}%</span> от суммы
                      комиссии агента ({platformFee.toLocaleString('ru-RU')} руб.) и будет
                      удержана из платежа клиента.
                    </span>
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
                        <Input
                          label="ID со-агента"
                          type="number"
                          placeholder="Введите ID пользователя"
                          value={formData.coagent_user_id || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              coagent_user_id: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          error={
                            formData.coagent_split_percent > 0 &&
                            !formData.coagent_user_id
                              ? 'Укажите ID со-агента'
                              : undefined
                          }
                        />
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
              />

              <Input
                label="Телефон клиента"
                type="tel"
                placeholder="+7 (999) 123-45-67"
                value={formatPhone(formData.client_phone)}
                onChange={handlePhoneChange}
                helperText="На этот номер будет отправлена ссылка для оплаты"
              />

              <Input
                label="Email клиента (опционально)"
                type="email"
                placeholder="client@example.com"
                value={formData.client_email}
                onChange={(e) =>
                  setFormData({ ...formData, client_email: e.target.value })
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
                      {formData.price.toLocaleString('ru-RU')} руб.
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Комиссия агента:</span>
                    <span className="font-medium text-gray-900">
                      {formData.commission_total.toLocaleString('ru-RU')} руб.
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
                  Клиент оплачивает
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Комиссия агента:</span>
                    <span>{formData.commission_total.toLocaleString('ru-RU')} руб.</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Комиссия сервиса ({PLATFORM_FEE_PERCENT}%):</span>
                    <span>{platformFee.toLocaleString('ru-RU')} руб.</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Итого к оплате:</span>
                      <span className="font-semibold text-lg text-gray-900">
                        {totalClientPayment.toLocaleString('ru-RU')} руб.
                      </span>
                    </div>
                  </div>
                </div>
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
