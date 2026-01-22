import { apiClient } from './client';

// Types for admin API

export interface AdminDeal {
  id: string;
  property_address: string;
  status: string;
  agent_user_id: number;
  client_name?: string;
  commission: number;
  created_at: string;
}

export interface AdminDealsResponse {
  items: AdminDeal[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminDispute {
  id: string;
  deal_id: string;
  initiator_user_id: number;
  reason: string;
  status: string;
  refund_requested: boolean;
  refund_amount?: number;
  created_at: string;
}

export interface AdminDisputesResponse {
  items: AdminDispute[];
  total: number;
  limit: number;
  offset: number;
}

export interface PendingPayout {
  id: string;
  deal_id: string;
  user_id: number;
  role: string;
  amount: number;
  inn?: string;
  created_at: string;
}

export interface PendingPayoutsResponse {
  items: PendingPayout[];
  total: number;
  limit: number;
  offset: number;
}

export interface GlobalAnalytics {
  deals: {
    total: number;
    by_status: Record<string, number>;
    total_commission: number;
    avg_commission: number;
  };
  payouts: {
    total_paid: number;
    pending_count: number;
    pending_amount: number;
  };
  disputes: {
    total: number;
    open: number;
    resolved: number;
    refund_total: number;
  };
}

export interface LeaderboardEntry {
  user_id: number;
  user_name?: string;
  deals_count: number;
  total_commission: number;
  avg_commission: number;
}

// Admin API functions

// getGlobalAnalytics and getLeaderboard moved to analytics.ts

export async function getAdminDeals(
  status?: string,
  limit = 50,
  offset = 0
): Promise<AdminDealsResponse> {
  const params: Record<string, unknown> = { limit, offset };
  if (status) params.status = status;

  const { data } = await apiClient.get<AdminDealsResponse>('/admin/admin/deals', {
    params,
  });
  return data;
}

export async function getAdminDisputes(
  status?: string,
  limit = 50,
  offset = 0
): Promise<AdminDisputesResponse> {
  const params: Record<string, unknown> = { limit, offset };
  if (status) params.status = status;

  const { data } = await apiClient.get<AdminDisputesResponse>('/admin/admin/disputes', {
    params,
  });
  return data;
}

export async function resolveDispute(
  disputeId: string,
  resolution: string,
  notes?: string
): Promise<{ id: string; status: string; resolution: string; resolved_at: string }> {
  const params: Record<string, string> = { resolution };
  if (notes) params.notes = notes;

  const { data } = await apiClient.post(`/admin/admin/disputes/${disputeId}/resolve`, null, {
    params,
  });
  return data;
}

export async function getPendingPayouts(
  limit = 50,
  offset = 0
): Promise<PendingPayoutsResponse> {
  const { data } = await apiClient.get<PendingPayoutsResponse>('/admin/admin/payouts/pending', {
    params: { limit, offset },
  });
  return data;
}

export async function markPayoutPaid(
  recipientId: string
): Promise<{ id: string; payout_status: string; paid_at: string }> {
  const { data } = await apiClient.post(`/admin/admin/payouts/${recipientId}/mark-paid`);
  return data;
}

// Status labels
export const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  invoiced: 'Счет выставлен',
  payment_pending: 'Ожидает оплаты',
  payment_failed: 'Ошибка оплаты',
  hold_period: 'Период удержания',
  payout_ready: 'Готов к выплате',
  payout_in_progress: 'Выплата в процессе',
  closed: 'Закрыта',
  cancelled: 'Отменена',
  dispute: 'Спор',
  refunded: 'Возврат',
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: 'Открыт',
  agency_review: 'Рассмотрение агентством',
  platform_review: 'Эскалация на платформу',
  resolved: 'Решён',
  rejected: 'Отклонён',
  cancelled: 'Отменён',
};

export const DISPUTE_REASON_LABELS: Record<string, string> = {
  service_not_provided: 'Услуга не оказана',
  service_quality: 'Качество услуги',
  incorrect_amount: 'Неверная сумма',
  duplicate_payment: 'Дублирующий платеж',
  unauthorized_payment: 'Несанкционированный платеж',
  other: 'Другое',
};

export const ROLE_LABELS: Record<string, string> = {
  agent: 'Агент',
  coagent: 'Со-агент',
  agency: 'Агентство',
};

// Export formats
export type ExportFormat = 'csv' | 'xlsx';

// Export functions - download files directly

export async function exportDeals(
  format: ExportFormat = 'csv',
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/admin/export/deals?${params.toString()}`, `deals.${format}`);
}

export async function exportPayouts(
  format: ExportFormat = 'csv',
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/admin/export/payouts?${params.toString()}`, `payouts.${format}`);
}

export async function exportDisputes(
  format: ExportFormat = 'csv',
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/admin/export/disputes?${params.toString()}`, `disputes.${format}`);
}

export async function exportSummary(
  format: ExportFormat = 'csv',
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/admin/export/summary?${params.toString()}`, `summary.${format}`);
}

// Helper function to download export file
async function downloadExport(url: string, filename: string): Promise<void> {
  const response = await apiClient.get(url, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
