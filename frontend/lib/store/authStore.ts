import { create } from 'zustand';
import { User } from '@/types/user';
import { getCurrentUser } from '@/lib/api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('housler_token', token);
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
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });

    try {
      if (typeof window === 'undefined') {
        set({ isLoading: false });
        return;
      }

      const token = localStorage.getItem('housler_token');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await getCurrentUser();
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('housler_token');
      }
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateUser: (user) => {
    set({ user });
  },
}));

