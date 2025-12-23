import { authClient, apiClient } from './client';

// User type matching agent.housler.ru
export interface User {
  id: number;
  email: string;
  phone: string | null;
  name: string | null;
  role: 'client' | 'agent' | 'agency_admin' | 'operator' | 'admin';
  agency_id: number | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// Response format from agent.housler.ru
interface AgentAuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  isNewUser?: boolean;
  message: string;
}

// Unified auth response for frontend
export interface AuthResponse {
  access_token: string;
  user: User;
}

// ==========================================
// 1. SMS Auth (Agent) - uses agent.housler.ru
// ==========================================

export async function sendSMS(phone: string): Promise<{ success: boolean; message: string }> {
  const { data } = await authClient.post<AgentAuthResponse>('/auth/request-sms', { phone });
  return { success: data.success, message: data.message };
}

export async function verifySMS(phone: string, code: string): Promise<AuthResponse> {
  const { data } = await authClient.post<AgentAuthResponse>('/auth/verify-sms', { phone, code });

  if (!data.success || !data.token || !data.user) {
    throw new Error(data.message || 'Authentication failed');
  }

  // If new user, they need to register first
  if (data.isNewUser) {
    throw new Error('NEW_USER_NEEDS_REGISTRATION');
  }

  return {
    access_token: data.token,
    user: data.user,
  };
}

// ==========================================
// 2. Email Auth (Client) - uses agent.housler.ru
// ==========================================

export async function sendEmail(email: string): Promise<{ success: boolean; message: string }> {
  const { data } = await authClient.post<AgentAuthResponse>('/auth/request-code', { email });
  return { success: data.success, message: data.message };
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const { data } = await authClient.post<AgentAuthResponse>('/auth/verify-code', { email, code });

  if (!data.success || !data.token || !data.user) {
    throw new Error(data.message || 'Authentication failed');
  }

  return {
    access_token: data.token,
    user: data.user,
  };
}

// ==========================================
// 3. Agency Auth (Email + Password)
// ==========================================

export async function loginAgency(email: string, password: string): Promise<AuthResponse> {
  const { data } = await authClient.post<AgentAuthResponse>('/auth/login-agency', { email, password });

  if (!data.success || !data.token || !data.user) {
    throw new Error(data.message || 'Invalid credentials');
  }

  return {
    access_token: data.token,
    user: data.user,
  };
}

// ==========================================
// Current User - uses agent.housler.ru
// ==========================================

export async function getCurrentUser(): Promise<User> {
  const { data } = await authClient.get<User>('/auth/me');
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
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  password: string;
  consents: ConsentInput;
}

export async function registerAgent(data: AgentRegisterData): Promise<AuthResponse> {
  const { data: response } = await authClient.post<AgentAuthResponse>('/auth/register-realtor', data);

  if (!response.success || !response.token || !response.user) {
    throw new Error(response.message || 'Registration failed');
  }

  return {
    access_token: response.token,
    user: response.user,
  };
}

export async function registerAgency(data: AgencyRegisterData): Promise<AuthResponse> {
  const { data: response } = await authClient.post<AgentAuthResponse>('/auth/register-agency', data);

  if (!response.success || !response.token || !response.user) {
    throw new Error(response.message || 'Registration failed');
  }

  return {
    access_token: response.token,
    user: response.user,
  };
}
