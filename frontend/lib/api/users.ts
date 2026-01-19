import { apiClient } from './client';

// User search result
export interface UserSearchResult {
  id: number;
  name: string | null;
  phone_masked: string | null;
  role: string;
  is_registered: boolean;
}

// User search response
export interface UserSearchResponse {
  found: boolean;
  user: UserSearchResult | null;
}

/**
 * Search for existing user by phone number.
 * Used when adding co-agent to deal - checks if user already registered.
 */
export async function searchUserByPhone(phone: string): Promise<UserSearchResponse> {
  // Normalize phone for API
  const digits = phone.replace(/\D/g, '');
  const { data } = await apiClient.get<UserSearchResponse>('/users/search', {
    params: { phone: digits },
  });
  return data;
}
