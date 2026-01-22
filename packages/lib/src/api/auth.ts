import { authClient, apiClient } from './client';
import { User } from '@/types/user';

// API response wrapper from agent.housler.ru
// All responses have structure: { success: boolean, data?: T, error?: string }
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Unified auth response for frontend
export interface AuthResponse {
  access_token: string;
  user: User;
}

// ==========================================
// 1. SMS Auth (Agent) - uses agent.housler.ru
// ==========================================

interface RequestSmsData {
  message: string;
  existingCode?: boolean;
  canResendAt?: string;
  codeSentAt?: string;
}

export interface SendSmsResult {
  success: boolean;
  message: string;
  existingCode?: boolean;
  canResendAt?: string;
  codeSentAt?: string;
}

export async function sendSMS(phone: string): Promise<SendSmsResult> {
  const { data } = await authClient.post<ApiResponse<RequestSmsData>>('/auth/request-sms', { phone });
  return {
    success: data.success,
    message: data.data?.message || data.error || '',
    existingCode: data.data?.existingCode,
    canResendAt: data.data?.canResendAt,
    codeSentAt: data.data?.codeSentAt
  };
}

interface VerifySmsData {
  isNewUser: boolean;
  user?: User;
  token?: string;
  message: string;
}

export async function verifySMS(phone: string, code: string): Promise<AuthResponse> {
  try {
    const { data } = await authClient.post<ApiResponse<VerifySmsData>>('/auth/verify-sms', { phone, code });

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Ошибка авторизации');
    }

    const { isNewUser, user, token } = data.data;

    // If new user, they need to register first
    if (isNewUser) {
      throw new Error('NEW_USER_NEEDS_REGISTRATION');
    }

    if (!token || !user) {
      throw new Error('Ошибка авторизации');
    }

    return {
      access_token: token,
      user: user,
    };
  } catch (err: unknown) {
    // Re-throw with proper error message from API response
    const axiosError = err as { response?: { data?: { error?: string } } };
    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }
    throw err;
  }
}

// ==========================================
// 2. Email Auth (Client) - uses agent.housler.ru
// ==========================================

interface RequestCodeData {
  message: string;
  existingCode?: boolean;
  canResendAt?: string;
  codeSentAt?: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  existingCode?: boolean;
  canResendAt?: string;
  codeSentAt?: string;
}

export async function sendEmail(email: string): Promise<SendEmailResult> {
  const { data } = await authClient.post<ApiResponse<RequestCodeData>>('/auth/request-code', { email });
  return {
    success: data.success,
    message: data.data?.message || data.error || '',
    existingCode: data.data?.existingCode,
    canResendAt: data.data?.canResendAt,
    codeSentAt: data.data?.codeSentAt
  };
}

interface VerifyCodeData {
  user: User;
  token: string;
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  try {
    const { data } = await authClient.post<ApiResponse<VerifyCodeData>>('/auth/verify-code', { email, code });

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Ошибка авторизации');
    }

    return {
      access_token: data.data.token,
      user: data.data.user,
    };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string } } };
    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }
    throw err;
  }
}

// ==========================================
// 3. Agency Auth (Email + Password)
// ==========================================

interface LoginAgencyData {
  user: User;
  token: string;
}

export async function loginAgency(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await authClient.post<ApiResponse<LoginAgencyData>>('/auth/login-agency', { email, password });

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Неверные данные');
    }

    return {
      access_token: data.data.token,
      user: data.data.user,
    };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string } } };
    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }
    throw err;
  }
}

// ==========================================
// Current User - uses lk.housler.ru for full user info with agency
// ==========================================

export async function getCurrentUser(): Promise<User> {
  // Use lk.housler.ru API to get user with organization info
  const { data } = await apiClient.get<User>('/users/me');
  return data;
}

// ==========================================
// Registration - uses agent.housler.ru
// ==========================================

export interface ConsentInput {
  personalData: boolean;
  terms: boolean;
  marketing?: boolean;
  realtorOffer?: boolean;
  agencyOffer?: boolean;
}

export interface AgentRegisterData {
  phone: string;
  name: string;
  email: string;
  consents: ConsentInput;
  city?: string;
  isSelfEmployed?: boolean;
  personalInn?: string;
}

export interface AgencyRegisterData {
  inn: string;
  name: string;
  legalAddress: string;
  phone?: string;        // Company phone
  companyEmail?: string; // Company email
  contactName: string;
  contactPosition?: string;
  contactPhone: string;
  contactEmail: string;
  password: string;
  consents: ConsentInput;
}

interface RegisterData {
  user: User;
  token: string;
  message: string;
}

export async function registerAgent(data: AgentRegisterData): Promise<AuthResponse> {
  try {
    const { data: response } = await authClient.post<ApiResponse<RegisterData>>('/auth/register-realtor', data);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Ошибка регистрации');
    }

    return {
      access_token: response.data.token,
      user: response.data.user,
    };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string } } };
    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }
    throw err;
  }
}

export async function registerAgency(data: AgencyRegisterData): Promise<AuthResponse> {
  try {
    const { data: response } = await authClient.post<ApiResponse<RegisterData>>('/auth/register-agency', data);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Ошибка регистрации');
    }

    return {
      access_token: response.data.token,
      user: response.data.user,
    };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string } } };
    if (axiosError.response?.data?.error) {
      throw new Error(axiosError.response.data.error);
    }
    throw err;
  }
}
