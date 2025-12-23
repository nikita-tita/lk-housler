import type { UserRole } from '@/types/user';

/**
 * Get dashboard path based on user role
 */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'agent':
      return '/agent/dashboard';
    case 'client':
      return '/client/dashboard';
    case 'agency_admin':
      return '/agency/dashboard';
    case 'operator':
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/';
  }
}
