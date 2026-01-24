import { authClient, apiClient } from './client';
import { User } from '@/types/user';

// API response wrapper
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

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

const MOCK_USER: User = {
  id: 1,
  email: 'demo@housler.ru',
  phone: '+79990000000',
  name: 'Демо Пользователь',
  role: 'client',
  is_active: true,
  created_at: new Date().toISOString(),
  agency_id: null,
  agency: null,
  last_login_at: new Date().toISOString(),
};

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
  console.log('[DEBUG sendSMS] called with phone:', phone, 'IS_MOCK:', IS_MOCK);
  if (IS_MOCK) {
    console.log('[MOCK] sendSMS', phone);
    return {
      success: true,
      message: 'Код (MOCK): 111111',
      codeSentAt: new Date().toISOString(),
      canResendAt: new Date(Date.now() + 60000).toISOString(),
    };
  }

  try {
    console.log('[DEBUG sendSMS] making request to /auth/request-sms');
    const { data } = await authClient.post<ApiResponse<RequestSmsData>>('/auth/request-sms', { phone });
    console.log('[DEBUG sendSMS] response:', data);
    return {
      success: data.success,
      message: data.data?.message || data.error || '',
      existingCode: data.data?.existingCode,
      canResendAt: data.data?.canResendAt,
      codeSentAt: data.data?.codeSentAt
    };
  } catch (error) {
    console.error('[DEBUG sendSMS] error:', error);
    throw error;
  }
}

interface VerifySmsData {
  isNewUser: boolean;
  user?: User;
  token?: string;
  message: string;
}

export async function verifySMS(phone: string, code: string): Promise<AuthResponse> {
  if (IS_MOCK) {
    console.log('[MOCK] verifySMS', phone, code);
    if (code !== '111111') throw new Error('Неверный код (MOCK: используйте 111111)');
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'agent');
    return {
      access_token: 'mock_agent_token',
      user: { ...MOCK_USER, role: 'agent' },
    };
  }

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
  if (IS_MOCK) {
    console.log('[MOCK] sendEmail', email);
    return {
      success: true,
      message: 'Код (MOCK): 111111',
      codeSentAt: new Date().toISOString(),
      canResendAt: new Date(Date.now() + 60000).toISOString(),
    };
  }

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
  if (IS_MOCK) {
    console.log('[MOCK] verifyEmail', email, code);
    if (code !== '111111') throw new Error('Неверный код (MOCK: используйте 111111)');
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'client');
    return {
      access_token: 'mock_client_token',
      user: { ...MOCK_USER, email, role: 'client' },
    };
  }

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
  if (IS_MOCK) {
    console.log('[MOCK] loginAgency', email);
    if (password !== '123456') throw new Error('Неверный пароль (MOCK: 123456)');
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'agency_admin');
    return {
      access_token: 'mock_agency_token',
      user: { ...MOCK_USER, email, role: 'agency_admin', id: 99 },
    };
  }

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
  // В мок-режиме, если есть токен, возвращаем мок-юзера
  // Токен мы не проверяем на валидность, просто его наличие (обычно делается в axios interceptor)
  if (typeof window !== 'undefined') {
    const mockRole = localStorage.getItem('housler_mock_role');
    if (mockRole) {
      return { ...MOCK_USER, role: mockRole as any };
    }
  }
  return MOCK_USER;

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
  birthDate?: string; // YYYY-MM-DD (optional for agents)
  consents: ConsentInput;
  city?: string;
  isSelfEmployed?: boolean;
  personalInn?: string;
}

export interface ClientRegisterData {
  phone: string;
  name: string;
  email: string;
  birthDate: string; // YYYY-MM-DD (required for clients)
  consents: ConsentInput;
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
  if (IS_MOCK) {
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'agent');
    return {
      access_token: 'mock_agent_token',
      user: { ...MOCK_USER, ...data, role: 'agent' } as User,
    };
  }

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

export async function registerClient(data: ClientRegisterData): Promise<AuthResponse> {
  if (IS_MOCK) {
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'client');
    return {
      access_token: 'mock_client_token',
      user: { ...MOCK_USER, ...data, role: 'client' } as User,
    };
  }

  try {
    const { data: response } = await authClient.post<ApiResponse<RegisterData>>('/auth/register-client', data);

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
  if (IS_MOCK) {
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'agency_admin');
    return {
      access_token: 'mock_agency_token',
      user: { ...MOCK_USER, name: data.contactName, email: data.contactEmail, role: 'agency_admin' } as User,
    };
  }

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
