export type UserRole =
  | 'client'
  | 'agent'
  | 'agency_admin'
  | 'operator'
  | 'admin';

export type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'banned';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  full_name?: string;
  city?: string;
  tax_status?: 'npd' | 'ip' | 'ooo';
  verified_level: number;
  kyc_checked_at?: string;
}

