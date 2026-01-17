import { apiClient } from './client';

// Bank-split deal types
export type BankSplitDealType = 'secondary_buy' | 'secondary_sell' | 'newbuild_booking';

export type BankSplitStatus =
  | 'draft'
  | 'awaiting_signatures'
  | 'signed'
  | 'invoiced'
  | 'payment_pending'
  | 'hold_period'
  | 'payout_ready'
  | 'payout_in_progress'
  | 'closed'
  | 'cancelled'
  | 'dispute'
  | 'refunded';

export type PaymentModel = 'instant_split';

export type RecipientRole = 'agent' | 'coagent' | 'agency';

// Recipient input for deal creation
export interface RecipientInput {
  role: RecipientRole;
  user_id?: number;
  agency_id?: string;
  split_value: number; // Percentage (0-100)
}

// Recipient in deal response
export interface Recipient {
  id: string;
  deal_id: string;
  role: RecipientRole;
  user_id?: number;
  agency_id?: string;
  split_value: number;
  calculated_amount?: number;
  external_beneficiary_id?: string;
  payout_status: 'pending' | 'ready' | 'processing' | 'completed' | 'failed';
  payout_at?: string;
  created_at: string;
}

// Create bank-split deal request
export interface BankSplitDealCreate {
  type: BankSplitDealType;
  property_address: string;
  price: string; // Decimal as string
  commission_total: string; // Decimal as string
  description?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  agent_split_percent?: number; // 0-100, default 100
  coagent_user_id?: number;
  coagent_split_percent?: number;
  agency_split_percent?: number;
}

// Bank-split deal response
export interface BankSplitDeal {
  id: string;
  type: BankSplitDealType;
  status: BankSplitStatus;
  payment_model: PaymentModel;
  property_address: string;
  price: number;
  commission_total: number;
  commission_agent: number;
  description?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  agent_user_id: number;
  external_deal_id?: string;
  payment_link_url?: string;
  payment_link_expires_at?: string;
  paid_at?: string;
  hold_until?: string;
  recipients: Recipient[];
  created_at: string;
  updated_at: string;
}

// Invoice creation response
export interface InvoiceResponse {
  deal_id: string;
  external_deal_id: string;
  payment_url: string;
  qr_code?: string;
  amount: number;
  expires_at: string;
}

// Status transition response
export interface StatusTransitionResponse {
  deal_id: string;
  old_status: BankSplitStatus;
  new_status: BankSplitStatus;
  timestamp: string;
}

// List response
export interface BankSplitDealsListResponse {
  items: BankSplitDeal[];
  total: number;
  page: number;
  size: number;
}

// Timeline event
export interface TimelineEvent {
  id: string;
  deal_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  created_at: string;
  created_by_user_id?: number;
}

// API functions

export async function createBankSplitDeal(
  deal: BankSplitDealCreate
): Promise<BankSplitDeal> {
  const { data } = await apiClient.post<BankSplitDeal>('/bank-split', deal);
  return data;
}

export async function getBankSplitDeal(id: string): Promise<BankSplitDeal> {
  const { data } = await apiClient.get<BankSplitDeal>(`/bank-split/${id}`);
  return data;
}

export async function getBankSplitDeals(
  page = 1,
  size = 20,
  status?: BankSplitStatus
): Promise<BankSplitDealsListResponse> {
  const params: Record<string, unknown> = { page, size };
  if (status) params.status = status;

  const { data } = await apiClient.get<BankSplitDealsListResponse>('/bank-split', {
    params,
  });
  return data;
}

export async function submitForSigning(
  id: string
): Promise<StatusTransitionResponse> {
  const { data } = await apiClient.post<StatusTransitionResponse>(
    `/bank-split/${id}/submit-for-signing`
  );
  return data;
}

export async function markSigned(id: string): Promise<StatusTransitionResponse> {
  const { data } = await apiClient.post<StatusTransitionResponse>(
    `/bank-split/${id}/mark-signed`
  );
  return data;
}

export async function createInvoice(
  id: string,
  returnUrl?: string
): Promise<InvoiceResponse> {
  const { data } = await apiClient.post<InvoiceResponse>(
    `/bank-split/${id}/create-invoice`,
    returnUrl ? { return_url: returnUrl } : undefined
  );
  return data;
}

export async function releaseDeal(id: string): Promise<StatusTransitionResponse> {
  const { data } = await apiClient.post<StatusTransitionResponse>(
    `/bank-split/${id}/release`
  );
  return data;
}

export async function cancelBankSplitDeal(
  id: string,
  reason?: string
): Promise<StatusTransitionResponse> {
  const { data } = await apiClient.post<StatusTransitionResponse>(
    `/bank-split/${id}/cancel`,
    reason ? { reason } : undefined
  );
  return data;
}

export async function getDealTimeline(id: string): Promise<TimelineEvent[]> {
  const { data } = await apiClient.get<TimelineEvent[]>(
    `/bank-split/${id}/timeline`
  );
  return data;
}

// Status labels for UI
export const BANK_SPLIT_STATUS_LABELS: Record<BankSplitStatus, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  invoiced: 'Счет выставлен',
  payment_pending: 'Ожидает оплаты',
  hold_period: 'Период удержания',
  payout_ready: 'Готов к выплате',
  payout_in_progress: 'Выплата в процессе',
  closed: 'Закрыта',
  cancelled: 'Отменена',
  dispute: 'Спор',
  refunded: 'Возврат',
};

// Status styles for UI (black/white theme)
export const BANK_SPLIT_STATUS_STYLES: Record<BankSplitStatus, string> = {
  draft: 'bg-gray-100 text-gray-900',
  awaiting_signatures: 'bg-gray-200 text-gray-900',
  signed: 'bg-gray-300 text-gray-900',
  invoiced: 'bg-gray-200 text-gray-900',
  payment_pending: 'bg-gray-300 text-gray-900',
  hold_period: 'bg-gray-400 text-white',
  payout_ready: 'bg-gray-500 text-white',
  payout_in_progress: 'bg-gray-600 text-white',
  closed: 'bg-black text-white',
  cancelled: 'bg-gray-100 text-gray-500',
  dispute: 'bg-gray-900 text-white',
  refunded: 'bg-gray-200 text-gray-600',
};

// Recipient role labels
export const RECIPIENT_ROLE_LABELS: Record<RecipientRole, string> = {
  agent: 'Агент',
  coagent: 'Со-агент',
  agency: 'Агентство',
};
