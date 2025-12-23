import { apiClient } from './client';

export interface Deal {
  id: string;
  type: 'resale_sale' | 'resale_purchase' | 'newbuild_booking';
  status: 'draft' | 'awaiting_signatures' | 'signed' | 'paid' | 'closed' | 'cancelled';
  address: string;
  price: number;
  commission_agent: number;
  commission_split_percent?: number;
  agent_user_id?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DealCreate {
  type: 'resale_sale' | 'resale_purchase' | 'newbuild_booking';
  address: string;
  price: number;
  commission_agent: number;
  commission_split_percent?: number;
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

export async function createDeal(deal: DealCreate): Promise<Deal> {
  const { data } = await apiClient.post<Deal>('/deals', deal);
  return data;
}

export async function updateDeal(id: string, deal: Partial<DealCreate>): Promise<Deal> {
  const { data } = await apiClient.patch<Deal>(`/deals/${id}`, deal);
  return data;
}

export async function submitDeal(id: string): Promise<void> {
  await apiClient.post(`/deals/${id}/submit`);
}

export async function cancelDeal(id: string): Promise<void> {
  await apiClient.post(`/deals/${id}/cancel`);
}

