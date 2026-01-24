export type UserRole =
  | 'client'
  | 'agent'
  | 'agency_admin'
  | 'agency_employee'
  | 'operator'
  | 'admin';

export interface AgencyInfo {
  id: string;
  legal_name: string;
  short_name: string | null;
}

export interface User {
  id: number;
  email: string;
  phone: string | null;
  name: string | null;
  role: UserRole;
  agency_id: number | null;
  agency: AgencyInfo | null;  // Populated if user is member of an organization
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

// Preferred contact method
export type PreferredContact = 'phone' | 'telegram' | 'whatsapp' | 'email';

// Extended profile (includes all user data + settings)
export interface ExtendedProfile extends User {
  preferred_contact: PreferredContact;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  avatar_url: string | null;
  // Agent-specific fields
  city: string | null;
  specialization: string[] | null;
  experience_years: number | null;
  about: string | null;
}

// Update profile DTO
export interface UpdateProfileDto {
  name?: string;
  preferred_contact?: PreferredContact;
  telegram_username?: string | null;
  whatsapp_phone?: string | null;
  city?: string | null;
  specialization?: string[] | null;
  experience_years?: number | null;
  about?: string | null;
}
