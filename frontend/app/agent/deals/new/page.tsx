'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { createDeal, DealCreateSimple, DealType, AddressInput } from '@/lib/api/deals';

const DEAL_TYPE_OPTIONS = [
  { value: 'secondary_sell', label: 'Продажа вторички' },
  { value: 'secondary_buy', label: 'Покупка вторички' },
  { value: 'newbuild_booking', label: 'Бронирование новостройки' },
];

const CITY_OPTIONS = [
  { value: 'Москва', label: 'Москва' },
  { value: 'Санкт-Петербург', label: 'Санкт-Петербург' },
  { value: 'Казань', label: 'Казань' },
  { value: 'Новосибирск', label: 'Новосибирск' },
  { value: 'Екатеринбург', label: 'Екатеринбург' },
  { value: 'Нижний Новгород', label: 'Нижний Новгород' },
  { value: 'Краснодар', label: 'Краснодар' },
  { value: 'Сочи', label: 'Сочи' },
];

type Step = 1 | 2 | 3;

interface FormData {
  type: DealType;
  address: AddressInput;
  price: number;
  commission: number;
  client_name: string;
  client_phone: string;
}

const STEPS = [
  { number: 1, title: 'Объект' },
  { number: 2, title: 'Финансы' },
  { number: 3, title: 'Клиент' },
];

export default function CreateDealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    type: 'secondary_sell',
    address: {
      city: '',
      street: '',
      house: '',
      building: '',
      apartment: '',
    },
    price: 0,
    commission: 0,
    client_name: '',
    client_phone: '',
  });

  const updateAddress = (field: keyof AddressInput, value: string) => {
    setFormData({
      ...formData,
      address: { ...formData.address, [field]: value },
    });
  };

  const validateStep1 = (): boolean => {
    if (!formData.type) return false;
    if (!formData.address.city) return false;
    if (!formData.address.street) return false;
    if (!formData.address.house) return false;
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!formData.price || formData.price < 100000) return false;
    if (!formData.commission || formData.commission < 1000) return false;
    if (formData.commission > formData.price * 0.3) return false;
    return true;
  };

  const isValidPhone = (phone: string): boolean => {
    return phone.length === 11 && phone.startsWith('7');
  };

  const validateStep3 = (): boolean => {
    if (!formData.client_name || formData.client_name.length < 2) return false;
    if (!isValidPhone(formData.client_phone)) return false;
    return true;
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return validateStep1();
      case 2:
        return validateStep2();
      case 3:
        return validateStep3();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 3) {
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
      const dealData: DealCreateSimple = {
        type: formData.type,
        address: {
          city: formData.address.city,
          street: formData.address.street,
          house: formData.address.house,
          ...(formData.address.building && { building: formData.address.building }),
          ...(formData.address.apartment && { apartment: formData.address.apartment }),
        },
        price: formData.price,
        commission: formData.commission,
        client_name: formData.client_name,
        client_phone: formData.client_phone,
      };

      const deal = await createDeal(dealData);
      router.push(`/agent/deals/${deal.id}`);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
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
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/agent/deals" className="text-gray-600 hover:text-black text-sm">
          ← Назад к списку
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Создать сделку</h1>
        <p className="text-gray-600 mt-1">Шаг {step} из 3</p>
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
                  step >= s.number ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {s.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-24 h-0.5 mx-4 ${
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
            {step === 3 && 'Данные клиента'}
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
                  setFormData({ ...formData, type: e.target.value as DealType })
                }
              />

              <Select
                label="Город"
                options={CITY_OPTIONS}
                value={formData.address.city}
                onChange={(e) => updateAddress('city', e.target.value)}
                placeholder="Выберите город"
              />

              <Input
                label="Улица"
                placeholder="ул. Ленина"
                value={formData.address.street}
                onChange={(e) => updateAddress('street', e.target.value)}
              />

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Дом"
                  placeholder="12"
                  value={formData.address.house}
                  onChange={(e) => updateAddress('house', e.target.value)}
                />
                <Input
                  label="Корпус"
                  placeholder="2"
                  value={formData.address.building || ''}
                  onChange={(e) => updateAddress('building', e.target.value)}
                />
                <Input
                  label="Квартира"
                  placeholder="45"
                  value={formData.address.apartment || ''}
                  onChange={(e) => updateAddress('apartment', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Financials */}
          {step === 2 && (
            <div className="space-y-6">
              <Input
                label="Стоимость объекта"
                type="number"
                placeholder="5 000 000"
                value={formData.price || ''}
                onChange={(e) => {
                  const value = Math.max(0, Number(e.target.value));
                  setFormData({ ...formData, price: value });
                }}
                helperText="Цена объекта недвижимости в рублях"
                error={
                  formData.price > 0 && formData.price < 100000
                    ? 'Минимальная стоимость объекта 100 000 руб.'
                    : undefined
                }
              />

              <Input
                label="Комиссия агента"
                type="number"
                placeholder="150 000"
                value={formData.commission || ''}
                onChange={(e) => {
                  const value = Math.max(0, Number(e.target.value));
                  setFormData({ ...formData, commission: value });
                }}
                helperText="Ваше вознаграждение за сделку в рублях"
                error={
                  formData.commission > 0 && formData.commission < 1000
                    ? 'Минимальная комиссия 1 000 руб.'
                    : formData.price > 0 && formData.commission > formData.price * 0.3
                    ? 'Комиссия не может превышать 30% от стоимости объекта'
                    : undefined
                }
              />

              {formData.price > 0 && formData.commission > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Комиссия составляет{' '}
                    <span className="font-medium text-gray-900">
                      {((formData.commission / formData.price) * 100).toFixed(2)}%
                    </span>{' '}
                    от стоимости объекта
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Client */}
          {step === 3 && (
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
                helperText="На этот номер будет отправлена ссылка для подписания"
                error={
                  formData.client_phone.length > 0 && !isValidPhone(formData.client_phone)
                    ? 'Введите корректный номер телефона'
                    : undefined
                }
              />
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

            {step < 3 ? (
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
