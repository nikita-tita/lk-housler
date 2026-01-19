import { apiClient } from './client';

// Тип сделки
export type DealType =
  | 'sale_buy'       // Покупка
  | 'sale_sell'      // Продажа
  | 'rent_tenant'    // Аренда (арендатор)
  | 'rent_landlord'  // Аренда (арендодатель)
  // Legacy (обратная совместимость)
  | 'secondary_buy'
  | 'secondary_sell'
  | 'newbuild_booking';

// Тип объекта недвижимости
export type PropertyType =
  | 'apartment'   // Квартира
  | 'room'        // Комната
  | 'house'       // Дом / Коттедж
  | 'townhouse'   // Таунхаус
  | 'land'        // Земельный участок
  | 'commercial'  // Коммерческая
  | 'parking';    // Машиноместо / Гараж

// Тип оплаты
export type PaymentType = 'percent' | 'fixed' | 'mixed';

// Тип аванса
export type AdvanceType = 'none' | 'advance_fixed' | 'advance_percent';

export type DealStatus =
  | 'draft'
  | 'awaiting_signatures'
  | 'signed'
  | 'payment_pending'
  | 'in_progress'
  | 'invoiced'              // Bank-split: счет создан
  | 'hold_period'           // Bank-split: платеж на удержании
  | 'payment_failed'        // Bank-split: ошибка оплаты
  | 'payout_ready'          // Bank-split: готов к выплате
  | 'payout_in_progress'    // Bank-split: выплата в процессе
  | 'refunded'              // Возврат средств
  | 'closed'
  | 'dispute'
  | 'cancelled';

// Address for structured input
export interface AddressInput {
  city: string;
  street: string;
  house: string;
  building?: string;
  apartment?: string;
}

// Расширенное создание сделки с новыми полями
export interface DealCreateSimple {
  type: DealType;
  property_type?: PropertyType;
  address: AddressInput;
  price: number;
  commission: number;  // Для обратной совместимости

  // Расширенные поля оплаты
  payment_type?: PaymentType;
  commission_percent?: number;
  commission_fixed?: number;

  // Аванс
  advance_type?: AdvanceType;
  advance_amount?: number;
  advance_percent?: number;

  // Эксклюзив
  is_exclusive?: boolean;
  exclusive_until?: string;

  // Клиент
  client_name: string;
  client_phone: string;
}

// Запрос на расчет комиссии
export interface CommissionCalculateRequest {
  property_price: number;
  payment_type: PaymentType;
  commission_percent?: number;
  commission_fixed?: number;
  advance_type?: AdvanceType;
  advance_amount?: number;
  advance_percent?: number;
}

// Шаг плана платежей
export interface PaymentStep {
  type: 'advance' | 'final' | 'full';
  amount: number;
  when: string;
  is_paid: boolean;
}

// Результат расчета комиссии
export interface CommissionCalculateResponse {
  property_price: number;
  total_commission: number;
  platform_fee: number;
  agent_receives: number;
  advance_amount: number;
  final_payment: number;
  payment_steps: PaymentStep[];
}

// Deal response from API
export interface Deal {
  id: string;
  type: DealType;
  status: DealStatus;
  address: string;
  price: number;
  commission_agent: number;
  client_name?: string;
  agent_user_id: number;  // Integer - compatible with agent.housler.ru users table
  created_at: string;
  updated_at: string;
}

export interface DealsListResponse {
  items: Deal[];
  total: number;
  page: number;
  size: number;
}

export async function getDeals(page = 1, size = 20): Promise<DealsListResponse> {
  const { data } = await apiClient.get<DealsListResponse>('/deals', {
    params: { page, size },
  });
  return data;
}

export async function getDeal(id: string): Promise<Deal> {
  const { data } = await apiClient.get<Deal>(`/deals/${id}`);
  return data;
}

export async function createDeal(deal: DealCreateSimple): Promise<Deal> {
  const { data } = await apiClient.post<Deal>('/deals', deal);
  return data;
}

export async function updateDeal(id: string, deal: Partial<DealCreateSimple>): Promise<Deal> {
  const { data } = await apiClient.put<Deal>(`/deals/${id}`, deal);
  return data;
}

export async function submitDeal(id: string): Promise<void> {
  await apiClient.post(`/deals/${id}/submit`);
}

export async function cancelDeal(id: string): Promise<void> {
  await apiClient.post(`/deals/${id}/cancel`);
}

// Send for signing response
export interface SendForSigningResponse {
  success: boolean;
  document_id: string;
  signing_token: string;
  signing_url: string;
  sms_sent: boolean;
  message: string;
}

export async function sendForSigning(id: string): Promise<SendForSigningResponse> {
  const { data } = await apiClient.post<SendForSigningResponse>(`/deals/${id}/send-for-signing`);
  return data;
}

// Расчет комиссии без создания сделки
export async function calculateCommission(
  request: CommissionCalculateRequest
): Promise<CommissionCalculateResponse> {
  const { data } = await apiClient.post<CommissionCalculateResponse>('/deals/calculate', request);
  return data;
}

// Лейблы для типов сделок
export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  sale_buy: 'Покупка',
  sale_sell: 'Продажа',
  rent_tenant: 'Аренда (ищу жилье)',
  rent_landlord: 'Аренда (сдаю жилье)',
  secondary_buy: 'Покупка вторички',
  secondary_sell: 'Продажа вторички',
  newbuild_booking: 'Бронирование новостройки',
};

// Лейблы для типов объектов
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Квартира',
  room: 'Комната',
  house: 'Дом / Коттедж',
  townhouse: 'Таунхаус',
  land: 'Земельный участок',
  commercial: 'Коммерческая',
  parking: 'Машиноместо / Гараж',
};

// Лейблы для типов оплаты
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  percent: 'Процент от сделки',
  fixed: 'Фиксированная сумма',
  mixed: 'Фикс + процент',
};

// Лейблы для типов аванса
export const ADVANCE_TYPE_LABELS: Record<AdvanceType, string> = {
  none: 'Без аванса',
  advance_fixed: 'Фиксированный аванс',
  advance_percent: 'Процент от комиссии',
};
