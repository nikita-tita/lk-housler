import { create } from 'zustand';
import { User } from '@/types/user';
import { getCurrentUser } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null; // Kept for backward compatibility, may be null with httpOnly cookies
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

// Singleton promise для предотвращения race condition
let checkAuthPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (token, user) => {
    // Store token and role in localStorage for backward compatibility
    // New auth flow uses httpOnly cookies (set by server)
    if (typeof window !== 'undefined') {
      localStorage.setItem('housler_token', token);
      // Store role for redirect after session expiry
      if (user.role) {
        localStorage.setItem('housler_user_role', user.role);
      }
    }
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('housler_token');
      localStorage.removeItem('housler_user_role');
    }
    checkAuthPromise = null;
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    // Если уже авторизован и есть user - не перепроверяем
    const state = get();
    if (state.isAuthenticated && state.user && !state.isLoading) {
      return;
    }

    // Если проверка уже выполняется - возвращаем существующий промис
    if (checkAuthPromise) {
      return checkAuthPromise;
    }

    // Создаём новый промис для проверки
    checkAuthPromise = (async () => {
      set({ isLoading: true });

      try {
        if (typeof window === 'undefined') {
          set({ isLoading: false });
          return;
        }

        // Try to get current user from server
        // Server validates auth via:
        // 1. httpOnly cookies (preferred, XSS-safe)
        // 2. Authorization header from localStorage (backward compatibility)
        const user = await getCurrentUser();

        // Get token from localStorage if available (backward compatibility)
        const token = localStorage.getItem('housler_token');

        // Store role for redirect after session expiry
        if (user.role) {
          localStorage.setItem('housler_user_role', user.role);
        }

        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        // Auth failed - clear local state
        if (typeof window !== 'undefined') {
          localStorage.removeItem('housler_token');
          localStorage.removeItem('housler_user_role');
        }
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } finally {
        checkAuthPromise = null;
      }
    })();

    return checkAuthPromise;
  },

  updateUser: (user) => {
    set({ user });
  },
}));

