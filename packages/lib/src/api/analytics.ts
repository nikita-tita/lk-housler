/**
 * Analytics API client
 */

import { apiClient } from './client';
import { ExportFormat, LeaderboardEntry } from './admin';

export interface DealStatistics {
  total_deals: number;
  deals_by_status: Record<string, number>;
  total_volume: number;
  total_commission: number;
  avg_deal_size: number;
  avg_commission: number;
}

export interface PayoutStatistics {
  total_pending: number;
  total_paid: number;
  payout_by_status: Record<string, number>;
  recipients_count: number;
}

export interface TimeSeriesPoint {
  date: string;
  deals_count: number;
  volume: number;
  commission: number;
}

export interface RecentDeal {
  id: string;
  property_address: string;
  status: string;
  commission: number;
  created_at: string;
  deal_type?: 'legacy' | 'bank_split';
}

export interface DashboardSummary {
  month_stats: DealStatistics;
  payouts: PayoutStatistics;
  recent_deals: RecentDeal[];
}

/**
 * Get agent dashboard summary
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get('/dashboard');
  return response.data;
}

/**
 * Get deal analytics
 */
export async function getDealAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<DealStatistics> {
  const response = await apiClient.get('/analytics/deals', { params });
  return response.data;
}

/**
 * Get payout analytics
 */
export async function getPayoutAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<PayoutStatistics> {
  const response = await apiClient.get('/analytics/payouts', { params });
  return response.data;
}

/**
 * Get time series data for charts
 */
export async function getTimeSeries(days = 30): Promise<TimeSeriesPoint[]> {
  const response = await apiClient.get('/analytics/time-series', {
    params: { days },
  });
  return response.data;
}

export interface GlobalAnalytics {
  deals: DealStatistics;
  payouts: PayoutStatistics;
  disputes: {
    total_disputes: number;
    disputes_by_status: Record<string, number>;
    disputes_by_reason: Record<string, number>;
    total_refund_amount: number;
    open_disputes: number;
  };
}

/**
 * Admin: Get global analytics
 */
export async function getGlobalAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<GlobalAnalytics> {
  const response = await apiClient.get('/admin/analytics/global', { params });
  return response.data;
}

/**
 * Admin: Get agent leaderboard
 */
export async function getLeaderboard(
  limit = 10,
  params?: { start_date?: string; end_date?: string }
): Promise<LeaderboardEntry[]> {
  const response = await apiClient.get('/admin/analytics/leaderboard', {
    params: { limit, ...params },
  });
  return response.data;
}

// ===================================
// Export functions for agents
// ===================================

export async function exportAgentDeals(
  format: ExportFormat = 'csv',
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/analytics/export/deals?${params.toString()}`, `my_deals.${format}`);
}

/**
 * Export agent payouts to CSV or Excel
 */
export async function exportAgentPayouts(
  format: ExportFormat = 'csv',
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/analytics/export/payouts?${params.toString()}`, `my_payouts.${format}`);
}

/**
 * Export agent summary to CSV or Excel
 */
export async function exportAgentSummary(
  format: ExportFormat = 'csv',
  startDate?: string,
  endDate?: string
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  await downloadExport(`/admin/analytics/export/summary?${params.toString()}`, `my_summary.${format}`);
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
