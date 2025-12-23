export type UserRole =
  | 'client'
  | 'agent'
  | 'agency_admin'
  | 'operator'
  | 'admin';

export interface User {
  id: number;
  email: string;
  phone: string | null;
  name: string | null;
  role: UserRole;
  agency_id: number | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserProfile {
  user_id: number;
  full_name?: string;
  city?: string;
  tax_status?: 'npd' | 'ip' | 'ooo';
  verified_level: number;
  kyc_checked_at?: string;
}
