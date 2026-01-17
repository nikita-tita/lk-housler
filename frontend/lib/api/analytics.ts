/**
 * Analytics API client
 */

import { api } from './client';

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
  const response = await api.get('/dashboard');
  return response.data;
}

/**
 * Get deal analytics
 */
export async function getDealAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<DealStatistics> {
  const response = await api.get('/analytics/deals', { params });
  return response.data;
}

/**
 * Get payout analytics
 */
export async function getPayoutAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<PayoutStatistics> {
  const response = await api.get('/analytics/payouts', { params });
  return response.data;
}

/**
 * Get time series data for charts
 */
export async function getTimeSeries(days = 30): Promise<TimeSeriesPoint[]> {
  const response = await api.get('/analytics/time-series', {
    params: { days },
  });
  return response.data;
}

/**
 * Admin: Get global analytics
 */
export async function getGlobalAnalytics(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<{
  deals: DealStatistics;
  payouts: PayoutStatistics;
  disputes: {
    total_disputes: number;
    disputes_by_status: Record<string, number>;
    disputes_by_reason: Record<string, number>;
    total_refund_amount: number;
    open_disputes: number;
  };
}> {
  const response = await api.get('/admin/analytics/global', { params });
  return response.data;
}

/**
 * Admin: Get agent leaderboard
 */
export async function getLeaderboard(
  limit = 10,
  params?: { start_date?: string; end_date?: string }
): Promise<
  {
    agent_user_id: number;
    deals_count: number;
    total_commission: number;
  }[]
> {
  const response = await api.get('/admin/analytics/leaderboard', {
    params: { limit, ...params },
  });
  return response.data;
}
