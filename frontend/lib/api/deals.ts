import { apiClient } from './client';

// Deal types matching backend
export type DealType = 'secondary_buy' | 'secondary_sell' | 'newbuild_booking';
export type DealStatus = 'draft' | 'awaiting_signatures' | 'signed' | 'payment_pending' | 'in_progress' | 'closed' | 'dispute' | 'cancelled';

// Address for structured input
export interface AddressInput {
  city: string;
  street: string;
  house: string;
  building?: string;
  apartment?: string;
}

// Simplified deal creation for MVP
export interface DealCreateSimple {
  type: DealType;
  address: AddressInput;
  price: number;
  commission: number;
  client_name: string;
  client_phone: string;
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
