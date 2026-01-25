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
  contactPhone: string;  // Admin's verified phone (used for SMS auth)
  contactEmail: string;
  password?: string;     // Optional - not needed with SMS auth
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

// ==========================================
// 4. Employee Registration (via invite token)
// ==========================================

export interface EmployeeInviteInfo {
  token: string;
  agencyName: string;
  agencyId: number;
  phone: string;
  position?: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface EmployeeRegisterData {
  token: string;
  name: string;
  email: string;
  consents: ConsentInput;
}

export async function getEmployeeInvite(token: string): Promise<EmployeeInviteInfo> {
  if (IS_MOCK) {
    console.log('[MOCK] getEmployeeInvite', token);
    return {
      token,
      agencyName: 'ООО "Недвижимость Плюс"',
      agencyId: 1,
      phone: '79999000001',
      position: 'Риелтор',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isExpired: false,
    };
  }

  try {
    // Uses lk.housler.ru API (apiClient), not agent.housler.ru
    const { data } = await apiClient.get<EmployeeInviteInfo>(`/auth/employee-invite/${token}`);
    return data;
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { detail?: string } } };
    if (axiosError.response?.data?.detail) {
      throw new Error(axiosError.response.data.detail);
    }
    throw err;
  }
}

// lk.housler.ru returns tokens directly (not wrapped in ApiResponse)
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function registerEmployee(data: EmployeeRegisterData): Promise<AuthResponse> {
  if (IS_MOCK) {
    console.log('[MOCK] registerEmployee', data);
    if (typeof window !== 'undefined') localStorage.setItem('housler_mock_role', 'agent');
    return {
      access_token: 'mock_employee_token',
      user: { ...MOCK_USER, name: data.name, email: data.email, role: 'agent', agency_id: 1, agency: { id: '1', legal_name: 'ООО "Недвижимость Плюс"', short_name: 'Недвижимость Плюс' } } as User,
    };
  }

  try {
    // Uses lk.housler.ru API (apiClient), not agent.housler.ru
    // Convert consents from camelCase to snake_case for backend
    const backendData = {
      token: data.token,
      name: data.name,
      email: data.email,
      consents: {
        personal_data: data.consents.personalData,
        terms: data.consents.terms,
        marketing: data.consents.marketing,
        agency_offer: data.consents.agencyOffer,
      },
    };

    const { data: response } = await apiClient.post<TokenResponse>('/auth/register-employee', backendData);

    // Decode user info from token (basic info only)
    // Full user info will be fetched by getCurrentUser
    const user: User = {
      id: 0, // Will be updated when fetching full user
      name: data.name,
      email: data.email,
      phone: '',
      role: 'agent',
      is_active: true,
      created_at: new Date().toISOString(),
      agency_id: null,
      agency: null,
      last_login_at: new Date().toISOString(),
    };

    return {
      access_token: response.access_token,
      user,
    };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { detail?: string } } };
    if (axiosError.response?.data?.detail) {
      throw new Error(axiosError.response.data.detail);
    }
    throw err;
  }
}

// ==========================================
// Token Refresh
// ==========================================

interface RefreshResponse {
  access_token: string;
}

/**
 * Refresh access token using httpOnly refresh_token cookie.
 * Called automatically by axios interceptor on 401.
 *
 * @returns new access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (IS_MOCK) {
    console.log('[MOCK] refreshAccessToken');
    return 'mock_refreshed_token';
  }

  try {
    // POST to /auth/refresh - refresh_token is sent automatically via httpOnly cookie
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh');

    // Store new access token for backward compatibility
    if (typeof window !== 'undefined' && data.access_token) {
      localStorage.setItem('housler_token', data.access_token);
    }

    return data.access_token;
  } catch {
    // Refresh failed - token expired or invalid
    return null;
  }
}

/**
 * Get redirect URL based on user role stored in localStorage.
 * Falls back to landing page if role unknown.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '/';

  // Try to get role from localStorage (set during login)
  const role = localStorage.getItem('housler_user_role');

  switch (role) {
    case 'agent':
      return '/realtor';
    case 'client':
      return '/client';
    case 'agency':
    case 'agency_owner':
    case 'agency_admin':
      return '/agency';
    default:
      // Landing page with role selection
      return '/';
  }
}
