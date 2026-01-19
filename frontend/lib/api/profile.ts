import { apiClient } from './client';

// Legal entity types
export type LegalType = 'se' | 'ip' | 'ooo';

export const LEGAL_TYPE_LABELS: Record<LegalType, string> = {
  se: 'Самозанятый (НПД)',
  ip: 'Индивидуальный предприниматель',
  ooo: 'ООО',
};

// Onboarding status
export type OnboardingStatus =
  | 'not_started'
  | 'documents_required'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_started: 'Не начато',
  documents_required: 'Требуются документы',
  pending_review: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

// KYC status
export type KYCStatus =
  | 'not_started'
  | 'documents_uploaded'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  not_started: 'Не начато',
  documents_uploaded: 'Документы загружены',
  in_review: 'На проверке',
  approved: 'Верифицирован',
  rejected: 'Отклонено',
  expired: 'Истекло',
};

// Payment profile response
export interface PaymentProfile {
  id: string;
  user_id: number | null;
  organization_id: string | null;
  legal_type: LegalType;
  legal_name: string;
  inn_masked: string;
  bank_name: string;
  bank_bik: string;
  bank_onboarding_status: OnboardingStatus;
  bank_merchant_id: string | null;
  bank_onboarded_at: string | null;
  kyc_status: KYCStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentProfileListResponse {
  items: PaymentProfile[];
  total: number;
}

// Onboarding request
export interface OnboardingStartRequest {
  legal_type: LegalType;
  legal_name: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  bank_account: string;
  bank_bik: string;
  bank_name: string;
  bank_corr_account: string;
  phone: string;
  email?: string;
  organization_id?: string;
}

export interface OnboardingStartResponse {
  profile_id: string;
  session_id: string;
  status: string;
  onboarding_url: string | null;
  required_documents: string[];
  message: string;
}

export interface OnboardingStatusResponse {
  profile_id: string;
  profile_status: string;
  session_status: string | null;
  progress_percent: number | null;
  current_step: string | null;
  required_documents: string[];
  submitted_documents: string[];
  is_complete: boolean;
  merchant_id: string | null;
  rejection_reason: string | null;
  estimated_completion_hours: number | null;
}

// API functions

export async function getPaymentProfiles(): Promise<PaymentProfileListResponse> {
  const { data } = await apiClient.get<PaymentProfileListResponse>('/onboarding/profiles');
  return data;
}

export async function getPaymentProfile(profileId: string): Promise<PaymentProfile> {
  const { data } = await apiClient.get<PaymentProfile>(`/onboarding/profiles/${profileId}`);
  return data;
}

export async function startOnboarding(request: OnboardingStartRequest): Promise<OnboardingStartResponse> {
  const { data } = await apiClient.post<OnboardingStartResponse>('/onboarding/start', request);
  return data;
}

export async function getOnboardingStatus(profileId?: string): Promise<OnboardingStatusResponse> {
  const params = profileId ? { profile_id: profileId } : {};
  const { data } = await apiClient.get<OnboardingStatusResponse>('/onboarding/status', { params });
  return data;
}

// INN validation
export interface INNValidationResponse {
  valid: boolean;
  inn: string;
  inn_type: 'individual' | 'legal_entity' | null;
  errors: string[];
  warnings: string[];
  npd_registered: boolean | null;
  npd_check_error: string | null;
}

export async function validateINN(inn: string): Promise<INNValidationResponse> {
  const { data } = await apiClient.post<INNValidationResponse>('/inn/validate', { inn });
  return data;
}

// Bank info by BIK
export interface BankAutofillResponse {
  bank_name: string | null;
  bank_full_name: string | null;
  bank_bik: string;
  bank_corr_account: string | null;
  bank_address: string | null;
  bank_swift: string | null;
  bank_inn: string | null;
  bank_kpp: string | null;
  error: string | null;
}

export async function autofillBankByBIK(bik: string): Promise<BankAutofillResponse | null> {
  try {
    const { data } = await apiClient.get<BankAutofillResponse>(`/inn/bik/autofill`, {
      params: { bik },
    });
    return data;
  } catch {
    return null;
  }
}

// Company info by INN (autofill)
export interface CompanyAutofillResponse {
  company_name: string | null;
  company_full_name: string | null;
  company_inn: string;
  company_kpp: string | null;
  company_ogrn: string | null;
  company_address: string | null;
  is_individual: boolean | null;
  status: string | null;
  is_active: boolean | null;
  management_name: string | null;
  management_post: string | null;
  error: string | null;
}

export async function autofillCompanyByINN(inn: string): Promise<CompanyAutofillResponse | null> {
  try {
    const { data } = await apiClient.get<CompanyAutofillResponse>(`/inn/autofill`, {
      params: { inn },
    });
    return data;
  } catch {
    return null;
  }
}
