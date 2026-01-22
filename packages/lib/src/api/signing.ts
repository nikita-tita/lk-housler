/**
 * Signing API client (public, no auth required)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SigningInfo {
  document_id: string;
  document_hash: string;
  document_url: string | null;
  deal_type: string;
  property_address: string;
  commission_total: string | null;
  party_role: string;
  party_name: string;
  phone_masked: string;
  already_signed: boolean;
  expires_at: string;
  executor_name: string;
  executor_inn: string | null;
}

export interface RequestOTPResponse {
  message: string;
  phone_masked: string;
  expires_in_seconds: number;
}

export interface VerifySignatureResponse {
  success: boolean;
  message: string;
  signed_at: string;
  document_url: string | null;
}

/**
 * Get signing info by token (public)
 */
export async function getSigningInfo(token: string): Promise<SigningInfo> {
  const response = await fetch(`${API_BASE}/api/v1/sign/${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to get signing info');
  }

  return response.json();
}

/**
 * Request OTP for signing
 */
export async function requestSigningOTP(
  token: string,
  consentPersonalData: boolean,
  consentPep: boolean
): Promise<RequestOTPResponse> {
  const response = await fetch(`${API_BASE}/api/v1/sign/${token}/request-otp`, {
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
    throw new Error(error.detail || 'Failed to request OTP');
  }

  return response.json();
}

/**
 * Verify OTP and sign document
 */
export async function verifyAndSign(
  token: string,
  code: string
): Promise<VerifySignatureResponse> {
  const response = await fetch(`${API_BASE}/api/v1/sign/${token}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to verify signature');
  }

  return response.json();
}

/**
 * Format deal type for display
 */
export function formatDealType(type: string): string {
  const types: Record<string, string> = {
    secondary_buy: 'Покупка вторичной недвижимости',
    secondary_sell: 'Продажа вторичной недвижимости',
    newbuild_booking: 'Бронирование новостройки',
  };
  return types[type] || type;
}

/**
 * Format party role for display
 */
export function formatPartyRole(role: string): string {
  const roles: Record<string, string> = {
    client: 'Заказчик',
    executor: 'Исполнитель',
    agent: 'Агент',
    agency: 'Агентство',
  };
  return roles[role] || role;
}
