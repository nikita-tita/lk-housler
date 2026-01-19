'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SplitSlider, SplitParticipant } from '@/components/deals';
import {
  createDeal,
  calculateCommission,
  DealCreateSimple,
  DealType,
  PropertyType,
  PaymentType,
  AdvanceType,
  AddressInput,
  CommissionCalculateResponse,
  DEAL_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  ADVANCE_TYPE_LABELS,
} from '@/lib/api/deals';
import { createInvitation } from '@/lib/api/invitations';
import { searchUserByPhone, UserSearchResult } from '@/lib/api/users';

// Опции для типов сделок (основные)
const DEAL_TYPE_OPTIONS = [
  { value: 'sale_buy', label: 'Покупка недвижимости' },
  { value: 'sale_sell', label: 'Продажа недвижимости' },
  { value: 'rent_tenant', label: 'Аренда (ищу жилье)' },
  { value: 'rent_landlord', label: 'Аренда (сдаю жилье)' },
];

// Опции для типов объектов
const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'room', label: 'Комната' },
  { value: 'house', label: 'Дом / Коттедж' },
  { value: 'townhouse', label: 'Таунхаус' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'parking', label: 'Машиноместо / Гараж' },
];

// Опции для типов оплаты
const PAYMENT_TYPE_OPTIONS = [
  { value: 'percent', label: 'Процент от суммы сделки' },
  { value: 'fixed', label: 'Фиксированная сумма' },
  { value: 'mixed', label: 'Фикс + процент' },
];

// Опции для аванса
const ADVANCE_TYPE_OPTIONS = [
  { value: 'none', label: 'Без аванса' },
  { value: 'advance_fixed', label: 'Фиксированный аванс' },
  { value: 'advance_percent', label: 'Процент от комиссии' },
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

type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  // Шаг 1
  deal_type: DealType;
  // Шаг 2
  property_type: PropertyType;
  // Шаг 3
  payment_type: PaymentType;
  commission_percent: number;
  commission_fixed: number;
  advance_type: AdvanceType;
  advance_amount: number;
  advance_percent: number;
  is_exclusive: boolean;
  exclusive_until: string;
  // Шаг 4
  address: AddressInput;
  price: number;
  // Шаг 5 (клиент)
  client_name: string;
  client_phone: string;
  // Паспортные данные клиента
  client_passport_series: string;
  client_passport_number: string;
  client_passport_issued_by: string;
  client_passport_issued_date: string;
  client_passport_issued_code: string;
  client_birth_date: string;
  client_birth_place: string;
  client_registration_address: string;
  // Разделение комиссии
  agent_split_percent: number;
  coagent_split_percent: number;
  coagent_phone: string;
  agency_split_percent: number;
}

const STEPS = [
  { number: 1, title: 'Тип сделки' },
  { number: 2, title: 'Объект' },
  { number: 3, title: 'Оплата' },
  { number: 4, title: 'Адрес' },
  { number: 5, title: 'Клиент' },
];

// Комиссия платформы Housler (4%)
const PLATFORM_FEE_PERCENT = 4;

export default function CreateDealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calculation, setCalculation] = useState<CommissionCalculateResponse | null>(null);
  const [hasSplit, setHasSplit] = useState(false);

  // Co-agent search state
  const [coagentSearching, setCoagentSearching] = useState(false);
  const [coagentFound, setCoagentFound] = useState<UserSearchResult | null>(null);
  const [coagentSearchDone, setCoagentSearchDone] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    deal_type: 'sale_buy',
    property_type: 'apartment',
    payment_type: 'percent',
    commission_percent: 3,
    commission_fixed: 0,
    advance_type: 'none',
    advance_amount: 0,
    advance_percent: 0,
    is_exclusive: false,
    exclusive_until: '',
    address: {
      city: '',
      street: '',
      house: '',
      building: '',
      apartment: '',
    },
    price: 0,
    client_name: '',
    client_phone: '',
    // Паспортные данные клиента
    client_passport_series: '',
    client_passport_number: '',
    client_passport_issued_by: '',
    client_passport_issued_date: '',
    client_passport_issued_code: '',
    client_birth_date: '',
    client_birth_place: '',
    client_registration_address: '',
    // Разделение комиссии
    agent_split_percent: 100,
    coagent_split_percent: 0,
    coagent_phone: '',
    agency_split_percent: 0,
  });

  const updateAddress = (field: keyof AddressInput, value: string) => {
    setFormData({
      ...formData,
      address: { ...formData.address, [field]: value },
    });
  };

  // Расчет комиссии
  const doCalculation = useCallback(async () => {
    if (formData.price <= 0) return;

    try {
      const result = await calculateCommission({
        property_price: formData.price,
        payment_type: formData.payment_type,
        commission_percent: formData.payment_type !== 'fixed' ? formData.commission_percent : undefined,
        commission_fixed: formData.payment_type !== 'percent' ? formData.commission_fixed : undefined,
        advance_type: formData.advance_type,
        advance_amount: formData.advance_type === 'advance_fixed' ? formData.advance_amount : undefined,
        advance_percent: formData.advance_type === 'advance_percent' ? formData.advance_percent : undefined,
      });
      setCalculation(result);
    } catch {
      // Игнорируем ошибки расчета
    }
  }, [formData.price, formData.payment_type, formData.commission_percent, formData.commission_fixed, formData.advance_type, formData.advance_amount, formData.advance_percent]);

  useEffect(() => {
    if (step === 5 && formData.price > 0) {
      doCalculation();
    }
  }, [step, doCalculation, formData.price]);

  // Search for co-agent when phone changes
  useEffect(() => {
    const phone = formData.coagent_phone;
    const digits = phone.replace(/\D/g, '');

    // Only search if we have a complete phone
    if (digits.length !== 11) {
      setCoagentFound(null);
      setCoagentSearchDone(false);
      return;
    }

    // Debounce search
    const timeoutId = setTimeout(async () => {
      setCoagentSearching(true);
      try {
        const result = await searchUserByPhone(digits);
        setCoagentFound(result.found ? result.user : null);
        setCoagentSearchDone(true);
      } catch {
        setCoagentFound(null);
        setCoagentSearchDone(true);
      } finally {
        setCoagentSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.coagent_phone]);

  const validateStep1 = (): boolean => !!formData.deal_type;
  const validateStep2 = (): boolean => !!formData.property_type;

  const validateStep3 = (): boolean => {
    if (!formData.payment_type) return false;
    if (formData.payment_type === 'percent' && (!formData.commission_percent || formData.commission_percent <= 0)) return false;
    if (formData.payment_type === 'fixed' && (!formData.commission_fixed || formData.commission_fixed <= 0)) return false;
    if (formData.payment_type === 'mixed') {
      if (!formData.commission_percent || formData.commission_percent <= 0) return false;
      if (!formData.commission_fixed || formData.commission_fixed < 0) return false;
    }
    if (formData.advance_type === 'advance_fixed' && formData.advance_amount <= 0) return false;
    if (formData.advance_type === 'advance_percent' && (formData.advance_percent <= 0 || formData.advance_percent > 100)) return false;

    // Validate split if enabled
    if (hasSplit) {
      const totalSplit = formData.agent_split_percent + formData.coagent_split_percent + formData.agency_split_percent;
      if (totalSplit !== 100) return false;
      // If coagent has a share, phone is required
      if (formData.coagent_split_percent > 0) {
        if (!isValidCoagentPhone(formData.coagent_phone)) return false;
      }
    }

    return true;
  };

  const validateStep4 = (): boolean => {
    if (!formData.address.city) return false;
    if (!formData.address.street) return false;
    if (!formData.address.house) return false;
    if (!formData.price || formData.price < 1000) return false;
    return true;
  };

  const isValidPhone = (phone: string): boolean => {
    return phone.length === 11 && phone.startsWith('7');
  };

  const validateStep5 = (): boolean => {
    if (!formData.client_name || formData.client_name.length < 2) return false;
    if (!isValidPhone(formData.client_phone)) return false;
    return true;
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return validateStep1();
      case 2: return validateStep2();
      case 3: return validateStep3();
      case 4: return validateStep4();
      case 5: return validateStep5();
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 5) {
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
      // Рассчитываем комиссию для передачи на бэкенд (округляем до целого)
      let commission = 0;
      if (formData.payment_type === 'percent') {
        commission = Math.round(formData.price * (formData.commission_percent / 100));
      } else if (formData.payment_type === 'fixed') {
        commission = Math.round(formData.commission_fixed);
      } else {
        commission = Math.round(formData.commission_fixed + formData.price * (formData.commission_percent / 100));
      }

      const dealData: DealCreateSimple = {
        type: formData.deal_type,
        property_type: formData.property_type,
        address: {
          city: formData.address.city,
          street: formData.address.street,
          house: formData.address.house,
          ...(formData.address.building && { building: formData.address.building }),
          ...(formData.address.apartment && { apartment: formData.address.apartment }),
        },
        price: Math.round(formData.price),
        commission: commission,
        payment_type: formData.payment_type,
        commission_percent: formData.payment_type !== 'fixed' ? formData.commission_percent : undefined,
        commission_fixed: formData.payment_type !== 'percent' ? formData.commission_fixed : undefined,
        advance_type: formData.advance_type,
        advance_amount: formData.advance_type === 'advance_fixed' ? formData.advance_amount : undefined,
        advance_percent: formData.advance_type === 'advance_percent' ? formData.advance_percent : undefined,
        is_exclusive: formData.is_exclusive,
        exclusive_until: formData.is_exclusive && formData.exclusive_until ? formData.exclusive_until : undefined,
        client_name: formData.client_name,
        client_phone: formData.client_phone,
        // Паспортные данные (опционально)
        ...(formData.client_passport_series && { client_passport_series: formData.client_passport_series }),
        ...(formData.client_passport_number && { client_passport_number: formData.client_passport_number }),
        ...(formData.client_passport_issued_by && { client_passport_issued_by: formData.client_passport_issued_by }),
        ...(formData.client_passport_issued_date && { client_passport_issued_date: formData.client_passport_issued_date }),
        ...(formData.client_passport_issued_code && { client_passport_issued_code: formData.client_passport_issued_code }),
        ...(formData.client_birth_date && { client_birth_date: formData.client_birth_date }),
        ...(formData.client_birth_place && { client_birth_place: formData.client_birth_place }),
        ...(formData.client_registration_address && { client_registration_address: formData.client_registration_address }),
        // Add split data if enabled
        ...(hasSplit && {
          agent_split_percent: formData.agent_split_percent,
          coagent_split_percent: formData.coagent_split_percent > 0 ? formData.coagent_split_percent : undefined,
          // If co-agent is found in system, pass their user_id
          coagent_user_id: coagentFound ? coagentFound.id : undefined,
          // Pass co-agent phone for invitation
          coagent_phone: formData.coagent_split_percent > 0 && formData.coagent_phone ? formData.coagent_phone.replace(/\D/g, '') : undefined,
          agency_split_percent: formData.agency_split_percent > 0 ? formData.agency_split_percent : undefined,
        }),
      };

      const deal = await createDeal(dealData);

      // Send invitation to co-agent if phone provided AND user not found in system
      if (hasSplit && formData.coagent_split_percent > 0 && formData.coagent_phone && !coagentFound) {
        const phone = formData.coagent_phone.replace(/\D/g, '');
        try {
          await createInvitation(deal.id, {
            invited_phone: phone,
            role: 'coagent',
            split_percent: formData.coagent_split_percent,
          });
        } catch {
          // Invitation failed but deal was created - warning will be shown on deal page
          console.warn('Failed to send invitation, but deal was created');
        }
      }

      router.push(`/agent/deals/${deal.id}`);
    } catch (err: unknown) {
      let errorMessage = 'Ошибка создания сделки';

      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { detail?: unknown; errors?: unknown } } }).response;
        const detail = response?.data?.detail;
        const errors = response?.data?.errors;

        // Check errors field first (FastAPI validation errors format)
        if (Array.isArray(errors) && errors.length > 0) {
          errorMessage = errors
            .map((e: { loc?: string[]; msg?: string; type?: string }) => {
              const field = e.loc?.slice(-1)[0] || 'поле';
              return `${field}: ${e.msg || 'ошибка'}`;
            })
            .join('; ');
        } else if (typeof detail === 'string' && detail !== 'Validation error') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Alternative format
          errorMessage = detail
            .map((e: { loc?: string[]; msg?: string }) => {
              const field = e.loc?.slice(-1)[0] || 'поле';
              return `${field}: ${e.msg || 'ошибка'}`;
            })
            .join('; ');
        }
      }

      setError(errorMessage);
      console.error('Deal creation error:', err);
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

  const formatMoney = (value: number): string => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  // Split handling functions
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

  const handleSplitSliderChange = (participants: SplitParticipant[]) => {
    const agent = participants.find((p) => p.role === 'agent');
    const coagent = participants.find((p) => p.role === 'coagent');
    const agency = participants.find((p) => p.role === 'agency');

    setFormData((prev) => ({
      ...prev,
      agent_split_percent: agent?.percent ?? 100,
      coagent_split_percent: coagent?.percent ?? 0,
      agency_split_percent: agency?.percent ?? 0,
    }));
  };

  const buildSplitParticipants = (): SplitParticipant[] => {
    const participants: SplitParticipant[] = [
      {
        id: 'agent',
        name: 'Вы',
        role: 'agent',
        percent: formData.agent_split_percent,
      },
    ];

    if (hasSplit) {
      participants.push({
        id: 'coagent',
        name: 'Со-агент',
        role: 'coagent',
        percent: formData.coagent_split_percent,
      });
      participants.push({
        id: 'agency',
        name: 'Агентство',
        role: 'agency',
        percent: formData.agency_split_percent,
      });
    }

    return participants;
  };

  const formatCoagentPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return digits;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
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

  // Get calculated commission for display
  const calculatedCommission = formData.price > 0 && calculation
    ? calculation.total_commission
    : formData.price > 0
      ? formData.payment_type === 'percent'
        ? formData.price * (formData.commission_percent / 100)
        : formData.payment_type === 'fixed'
          ? formData.commission_fixed
          : formData.commission_fixed + formData.price * (formData.commission_percent / 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/agent/deals" className="text-gray-600 hover:text-black text-sm">
          ← Назад к списку
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Создать сделку</h1>
        <p className="text-gray-600 mt-1">Шаг {step} из 5</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, index) => (
          <div key={s.number} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  step >= s.number
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-400 border-gray-300'
                }`}
              >
                {s.number}
              </div>
              <span
                className={`mt-2 text-xs whitespace-nowrap ${
                  step >= s.number ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {s.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
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
            {step === 1 && 'Выберите тип сделки'}
            {step === 2 && 'Выберите тип объекта'}
            {step === 3 && 'Условия оплаты'}
            {step === 4 && 'Данные объекта'}
            {step === 5 && 'Данные клиента и подтверждение'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Шаг 1: Тип сделки */}
          {step === 1 && (
            <div className="space-y-4">
              {DEAL_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.deal_type === option.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deal_type"
                    value={option.value}
                    checked={formData.deal_type === option.value}
                    onChange={(e) => setFormData({ ...formData, deal_type: e.target.value as DealType })}
                    className="sr-only"
                  />
                  <span className="text-gray-900 font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Шаг 2: Тип объекта */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              {PROPERTY_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.property_type === option.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="property_type"
                    value={option.value}
                    checked={formData.property_type === option.value}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value as PropertyType })}
                    className="sr-only"
                  />
                  <span className="text-gray-900 font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Шаг 3: Условия оплаты */}
          {step === 3 && (
            <div className="space-y-6">
              <Select
                label="Тип оплаты"
                options={PAYMENT_TYPE_OPTIONS}
                value={formData.payment_type}
                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as PaymentType })}
              />

              {(formData.payment_type === 'percent' || formData.payment_type === 'mixed') && (
                <Input
                  label="Процент от суммы сделки"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  placeholder="3"
                  value={formData.commission_percent || ''}
                  onChange={(e) => setFormData({ ...formData, commission_percent: Number(e.target.value) })}
                  helperText="Обычно 2-5% от стоимости объекта"
                />
              )}

              {(formData.payment_type === 'fixed' || formData.payment_type === 'mixed') && (
                <CurrencyInput
                  label="Фиксированная сумма"
                  placeholder="100 000"
                  value={formData.commission_fixed || undefined}
                  onChange={(value) => setFormData({ ...formData, commission_fixed: value })}
                  helperText="Сумма комиссии"
                />
              )}

              <div className="border-t pt-6">
                <Select
                  label="Аванс"
                  options={ADVANCE_TYPE_OPTIONS}
                  value={formData.advance_type}
                  onChange={(e) => setFormData({ ...formData, advance_type: e.target.value as AdvanceType })}
                />

                {formData.advance_type === 'advance_fixed' && (
                  <div className="mt-4">
                    <CurrencyInput
                      label="Сумма аванса"
                      placeholder="50 000"
                      value={formData.advance_amount || undefined}
                      onChange={(value) => setFormData({ ...formData, advance_amount: value })}
                      helperText="Сумма аванса"
                    />
                  </div>
                )}

                {formData.advance_type === 'advance_percent' && (
                  <div className="mt-4">
                    <Input
                      label="Процент аванса"
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      placeholder="30"
                      value={formData.advance_percent || ''}
                      onChange={(e) => setFormData({ ...formData, advance_percent: Number(e.target.value) })}
                      helperText="Процент от комиссии"
                    />
                  </div>
                )}
              </div>

              <div className="border-t pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_exclusive}
                    onChange={(e) => setFormData({ ...formData, is_exclusive: e.target.checked })}
                    className="w-5 h-5 border-gray-300 rounded"
                  />
                  <span className="text-gray-900 font-medium">Эксклюзивный договор</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-8">
                  Только вы имеете право продавать этот объект
                </p>

                {formData.is_exclusive && (
                  <div className="mt-4">
                    <Input
                      label="Срок эксклюзива до"
                      type="date"
                      value={formData.exclusive_until}
                      onChange={(e) => setFormData({ ...formData, exclusive_until: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Разделение комиссии */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-gray-900 font-medium">Разделить комиссию</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Распределите комиссию между участниками сделки
                    </p>
                  </div>
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
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Split Slider */}
                    <SplitSlider
                      totalAmount={calculatedCommission}
                      platformFeePercent={PLATFORM_FEE_PERCENT}
                      participants={buildSplitParticipants()}
                      onChange={handleSplitSliderChange}
                      minPercent={0}
                      showAmounts={calculatedCommission > 0}
                    />

                    {/* Co-agent phone input */}
                    {formData.coagent_split_percent > 0 && (
                      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <Input
                          label="Телефон со-агента"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          value={formatCoagentPhone(formData.coagent_phone)}
                          onChange={handleCoagentPhoneChange}
                          helperText={coagentSearching ? "Поиск..." : undefined}
                          error={
                            formData.coagent_phone.length > 0 &&
                            !isValidCoagentPhone(formData.coagent_phone)
                              ? 'Введите корректный номер телефона'
                              : undefined
                          }
                        />

                        {/* Search result */}
                        {coagentSearchDone && isValidCoagentPhone(formData.coagent_phone) && (
                          coagentFound ? (
                            <div className="p-3 bg-white border border-gray-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                                  {coagentFound.name?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {coagentFound.name || 'Агент'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {coagentFound.phone_masked} — зарегистрирован в системе
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">
                              Пользователь не найден. После создания сделки ему будет отправлено SMS-приглашение.
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Шаг 4: Данные объекта */}
          {step === 4 && (
            <div className="space-y-6">
              <CurrencyInput
                label="Стоимость объекта"
                placeholder="5 000 000"
                value={formData.price || undefined}
                onChange={(value) => setFormData({ ...formData, price: value })}
                helperText="Цена объекта недвижимости"
                error={
                  formData.price > 0 && formData.price < 1000
                    ? 'Минимальная стоимость 1 000 руб.'
                    : undefined
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

          {/* Шаг 5: Клиент и подтверждение */}
          {step === 5 && (
            <div className="space-y-6">
              <Input
                label="ФИО клиента"
                placeholder="Иванов Иван Иванович"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
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

              {/* Паспортные данные клиента */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Паспортные данные клиента</h3>
                <p className="text-sm text-gray-500 mb-4">Необходимы для формирования договора. Можно заполнить позже.</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Серия паспорта"
                    placeholder="4500"
                    maxLength={4}
                    value={formData.client_passport_series}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setFormData({ ...formData, client_passport_series: value });
                    }}
                    error={
                      formData.client_passport_series.length > 0 && formData.client_passport_series.length !== 4
                        ? '4 цифры'
                        : undefined
                    }
                  />
                  <Input
                    label="Номер паспорта"
                    placeholder="123456"
                    maxLength={6}
                    value={formData.client_passport_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData({ ...formData, client_passport_number: value });
                    }}
                    error={
                      formData.client_passport_number.length > 0 && formData.client_passport_number.length !== 6
                        ? '6 цифр'
                        : undefined
                    }
                  />
                </div>

                <Input
                  label="Кем выдан"
                  placeholder="ГУ МВД России по г. Москве"
                  value={formData.client_passport_issued_by}
                  onChange={(e) => setFormData({ ...formData, client_passport_issued_by: e.target.value })}
                  className="mb-4"
                />

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Дата выдачи"
                    type="date"
                    value={formData.client_passport_issued_date}
                    onChange={(e) => setFormData({ ...formData, client_passport_issued_date: e.target.value })}
                  />
                  <Input
                    label="Код подразделения"
                    placeholder="770-001"
                    value={formData.client_passport_issued_code}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^0-9-]/g, '');
                      // Auto-format: XXX-XXX
                      if (value.length === 3 && !value.includes('-')) {
                        value = value + '-';
                      }
                      if (value.length > 7) value = value.slice(0, 7);
                      setFormData({ ...formData, client_passport_issued_code: value });
                    }}
                    error={
                      formData.client_passport_issued_code.length > 0 &&
                      !/^\d{3}-\d{3}$/.test(formData.client_passport_issued_code)
                        ? 'Формат: XXX-XXX'
                        : undefined
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Дата рождения"
                    type="date"
                    value={formData.client_birth_date}
                    onChange={(e) => setFormData({ ...formData, client_birth_date: e.target.value })}
                  />
                  <Input
                    label="Место рождения"
                    placeholder="г. Москва"
                    value={formData.client_birth_place}
                    onChange={(e) => setFormData({ ...formData, client_birth_place: e.target.value })}
                  />
                </div>

                <Input
                  label="Адрес регистрации"
                  placeholder="г. Москва, ул. Ленина, д. 1, кв. 1"
                  value={formData.client_registration_address}
                  onChange={(e) => setFormData({ ...formData, client_registration_address: e.target.value })}
                />
              </div>

              {/* Сводка */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Сводка сделки</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Тип сделки:</span>
                    <span className="text-gray-900 font-medium">{DEAL_TYPE_LABELS[formData.deal_type]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Тип объекта:</span>
                    <span className="text-gray-900 font-medium">{PROPERTY_TYPE_LABELS[formData.property_type]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Адрес:</span>
                    <span className="text-gray-900 font-medium text-right">
                      {formData.address.city}, {formData.address.street}, д. {formData.address.house}
                      {formData.address.building && `, корп. ${formData.address.building}`}
                      {formData.address.apartment && `, кв. ${formData.address.apartment}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Стоимость:</span>
                    <span className="text-gray-900 font-medium">{formatMoney(formData.price)} руб.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Тип оплаты:</span>
                    <span className="text-gray-900 font-medium">{PAYMENT_TYPE_LABELS[formData.payment_type]}</span>
                  </div>

                  {calculation && (
                    <>
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Комиссия:</span>
                          <span className="text-gray-900 font-medium">{formatMoney(calculation.total_commission)} руб.</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Комиссия платформы (4%):</span>
                          <span className="text-gray-600">-{formatMoney(calculation.platform_fee)} руб.</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold mt-2">
                          <span className="text-gray-900">К получению:</span>
                          <span className="text-gray-900">{formatMoney(calculation.agent_receives)} руб.</span>
                        </div>
                        {calculation.advance_amount > 0 && (
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-gray-500">Аванс:</span>
                            <span className="text-gray-600">{formatMoney(calculation.advance_amount)} руб.</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {formData.advance_type !== 'none' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Аванс:</span>
                      <span className="text-gray-900 font-medium">{ADVANCE_TYPE_LABELS[formData.advance_type]}</span>
                    </div>
                  )}
                  {formData.is_exclusive && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Эксклюзив:</span>
                      <span className="text-gray-900 font-medium">
                        До {formData.exclusive_until || 'не указано'}
                      </span>
                    </div>
                  )}

                  {/* Split info */}
                  {hasSplit && (
                    <>
                      <div className="border-t pt-3 mt-3">
                        <div className="text-sm font-medium text-gray-900 mb-2">Распределение комиссии:</div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Агент ({formData.agent_split_percent}%):</span>
                          <span className="text-gray-900">
                            {formatMoney(Math.round(calculatedCommission * (formData.agent_split_percent / 100)))} руб.
                          </span>
                        </div>
                        {formData.coagent_split_percent > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Со-агент ({formData.coagent_split_percent}%):</span>
                            <span className="text-gray-900">
                              {formatMoney(Math.round(calculatedCommission * (formData.coagent_split_percent / 100)))} руб.
                            </span>
                          </div>
                        )}
                        {formData.agency_split_percent > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Агентство ({formData.agency_split_percent}%):</span>
                            <span className="text-gray-900">
                              {formatMoney(Math.round(calculatedCommission * (formData.agency_split_percent / 100)))} руб.
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
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

            {step < 5 ? (
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
