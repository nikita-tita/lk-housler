import { apiClient } from './client';
import type { User } from '@/types/user';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type { User };

// ==========================================
// 1. SMS Auth (Agent)
// ==========================================

export async function sendSMS(phone: string): Promise<void> {
  await apiClient.post('/auth/agent/sms/send', { phone });
}

export async function verifySMS(
  phone: string,
  code: string
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/auth/agent/sms/verify',
    {
      phone,
      code,
    }
  );
  return data;
}

// ==========================================
// 2. Email Auth (Client)
// ==========================================

export async function sendEmail(email: string): Promise<void> {
  await apiClient.post('/auth/client/email/send', { email });
}

export async function verifyEmail(
  email: string,
  code: string
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/auth/client/email/verify',
    {
      email,
      code,
    }
  );
  return data;
}

// ==========================================
// 3. Agency Auth (Email + Password)
// ==========================================

export async function loginAgency(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data} = await apiClient.post<AuthResponse>('/auth/agency/login', {
    email,
    password,
  });
  return data;
}

// ==========================================
// Current User
// ==========================================

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/users/me');
  return data;
}

// ==========================================
// Registration
// ==========================================

export interface ConsentInput {
  personal_data: boolean;
  terms: boolean;
  marketing?: boolean;
  realtor_offer?: boolean;
  agency_offer?: boolean;
}

export interface AgentRegisterData {
  phone: string;
  name: string;
  email: string;
  consents: ConsentInput;
  city?: string;
  is_self_employed?: boolean;
  personal_inn?: string;
}

export interface AgencyRegisterData {
  inn: string;
  name: string;
  legal_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  password: string;
  consents: ConsentInput;
}

export async function registerAgent(data: AgentRegisterData): Promise<{ id: string; message: string }> {
  const { data: response } = await apiClient.post('/auth/register/agent', data);
  return response;
}

export async function registerAgency(data: AgencyRegisterData): Promise<{ id: string; message: string }> {
  const { data: response } = await apiClient.post('/auth/register/agency', data);
  return response;
}

