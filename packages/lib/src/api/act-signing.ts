/**
 * Act Signing API client (UC-3.2 client confirmation)
 *
 * Public endpoints for client to sign Act of Completed Services
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ActInfo {
  document_id: string;
  document_hash: string;
  document_url: string | null;

  // Deal info
  deal_id: string;
  property_address: string;
  deal_type: string;

  // Financial
  commission_total: string | null;

  // Client info (masked)
  client_name: string;
  phone_masked: string;

  // Status
  already_signed: boolean;
  expires_at: string;
  deadline: string | null;
  days_until_auto_release: number | null;

  // Executor info (for Act header)
  executor_name: string;
  executor_inn: string;

  // Dispute
  can_open_dispute: boolean;
}

export interface ActRequestOTPResponse {
  message: string;
  phone_masked: string;
  expires_in_seconds: number;
}

export interface ActSignResponse {
  success: boolean;
  message: string;
  signed_at: string;
  document_url: string | null;
  deal_status: string;
}

export interface GeoLocation {
  lat: number;
  lon: number;
  accuracy?: number;
}

/**
 * Get Act info by token (public)
 */
export async function getActInfo(token: string): Promise<ActInfo> {
  const response = await fetch(`${API_BASE}/api/v1/act/${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Не удалось получить информацию об акте');
  }

  return response.json();
}

/**
 * Request OTP for Act signing
 */
export async function requestActOTP(
  token: string,
  consentPersonalData: boolean,
  consentPep: boolean
): Promise<ActRequestOTPResponse> {
  const response = await fetch(`${API_BASE}/api/v1/act/${token}/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consent_personal_data: consentPersonalData,
      consent_pep: consentPep,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Не удалось отправить код подтверждения');
  }

  return response.json();
}

/**
 * Sign Act with OTP code
 */
export async function signAct(
  token: string,
  code: string,
  geolocation?: GeoLocation
): Promise<ActSignResponse> {
  const response = await fetch(`${API_BASE}/api/v1/act/${token}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      geolocation: geolocation || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Не удалось подписать акт');
  }

  return response.json();
}

/**
 * Format days until auto-release for display
 */
export function formatDaysRemaining(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days <= 4) return `через ${days} дня`;
  return `через ${days} дней`;
}

/**
 * Get auto-release warning message
 */
export function getAutoReleaseWarning(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 1) {
    return 'Если вы не подпишете акт или не откроете спор, завтра средства будут выплачены автоматически.';
  }
  if (days <= 3) {
    return `Осталось ${days} дня для подписания акта или открытия спора. После этого средства будут выплачены автоматически.`;
  }
  return null;
}

// =============================================================================
// Dispute (UC-3.2)
// =============================================================================

export type DisputeReason =
  | 'service_not_provided'
  | 'service_quality'
  | 'incorrect_amount'
  | 'other';

export interface CreateDisputeRequest {
  reason: DisputeReason;
  description?: string;
}

export interface CreateDisputeResponse {
  success: boolean;
  message: string;
  dispute_id: string;
  deal_status: string;
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  service_not_provided: 'Услуга не оказана',
  service_quality: 'Качество услуги не соответствует',
  incorrect_amount: 'Неверная сумма',
  other: 'Другое',
};

/**
 * Create a dispute from the act signing page (public)
 */
export async function createActDispute(
  token: string,
  request: CreateDisputeRequest
): Promise<CreateDisputeResponse> {
  const response = await fetch(`${API_BASE}/api/v1/act/${token}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Не удалось открыть спор');
  }

  return response.json();
}
