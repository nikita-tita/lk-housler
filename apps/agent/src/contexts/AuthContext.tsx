'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '@/services/api';
import type { User, AuthState } from '@/types';

// Типы для регистрации риелтора
interface RealtorRegistrationData {
  phone: string;
  name: string;
  email: string;
  city?: string;
  isSelfEmployed?: boolean;
  personalInn?: string;
  consents: {
    personalData: boolean;
    terms: boolean;
    realtorOffer: boolean;
    marketing?: boolean;
  };
}

// Результат верификации SMS - может быть новый или существующий пользователь
interface SmsVerifyResult {
  isNewUser: boolean;
  user?: User;
}

// Результат запроса кода - может быть новый или существующий
interface RequestCodeResult {
  existingCode: boolean;
  canResendAt?: string;
}

interface AuthContextType extends AuthState {
  // Email авторизация (клиенты)
  login: (email: string, code: string) => Promise<void>;
  requestCode: (email: string) => Promise<RequestCodeResult>;
  resendCode: (email: string) => Promise<void>;

  // SMS авторизация (риелторы)
  requestSmsCode: (phone: string) => Promise<RequestCodeResult>;
  resendSmsCode: (phone: string) => Promise<void>;
  verifySmsCode: (phone: string, code: string) => Promise<SmsVerifyResult>;
  registerRealtor: (data: RealtorRegistrationData) => Promise<void>;

  // Авторизация агентства (email + пароль)
  loginAgency: (email: string, password: string) => Promise<void>;

  // Общие методы
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check stored token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const response = await api.getMe();
      if (response.success && response.data) {
        const user = response.data;
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Токен невалидный (401) или другая ошибка — удаляем токен
        removeStoredToken();
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    };

    checkAuth();
  }, []);

  const requestCode = useCallback(async (email: string): Promise<RequestCodeResult> => {
    const response = await api.requestCode(email);
    if (!response.success) {
      throw new Error(response.error || 'Failed to send code');
    }
    return {
      existingCode: response.data?.existingCode ?? false,
      canResendAt: response.data?.canResendAt,
    };
  }, []);

  const resendCode = useCallback(async (email: string) => {
    const response = await api.resendCode(email);
    if (!response.success) {
      throw new Error(response.error || 'Ошибка повторной отправки кода');
    }
  }, []);

  const login = useCallback(async (email: string, code: string) => {
    const response = await api.verifyCode(email, code);
    if (!response.success || !response.data?.user || !response.data?.token) {
      throw new Error(response.error || 'Invalid code');
    }

    const { user, token } = response.data;
    setStoredToken(token);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    removeStoredToken();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const setUser = useCallback((user: User) => {
    const token = getStoredToken();
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ============ SMS авторизация (риелторы) ============

  const requestSmsCode = useCallback(async (phone: string): Promise<RequestCodeResult> => {
    const response = await api.requestSmsCode(phone);
    if (!response.success) {
      throw new Error(response.error || 'Ошибка отправки кода');
    }
    return {
      existingCode: response.data?.existingCode ?? false,
      canResendAt: response.data?.canResendAt,
    };
  }, []);

  const resendSmsCode = useCallback(async (phone: string) => {
    const response = await api.resendSmsCode(phone);
    if (!response.success) {
      throw new Error(response.error || 'Ошибка повторной отправки кода');
    }
  }, []);

  const verifySmsCode = useCallback(async (phone: string, code: string): Promise<SmsVerifyResult> => {
    const response = await api.verifySmsCode(phone, code);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Неверный код');
    }

    const { isNewUser, user, token } = response.data;

    // Если существующий пользователь - сразу логиним
    if (!isNewUser && token && user) {
      setStoredToken(token);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    }

    return { isNewUser, user };
  }, []);

  const registerRealtor = useCallback(async (data: RealtorRegistrationData) => {
    const response = await api.registerRealtor(data);
    if (!response.success || !response.data?.token || !response.data?.user) {
      throw new Error(response.error || 'Ошибка регистрации');
    }

    const { user, token } = response.data;
    setStoredToken(token);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ============ Авторизация агентства ============

  const loginAgency = useCallback(async (email: string, password: string) => {
    const response = await api.loginAgency(email, password);
    if (!response.success || !response.data?.token || !response.data?.user) {
      throw new Error(response.error || 'Ошибка авторизации');
    }

    const { user, token } = response.data;
    setStoredToken(token);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      requestCode,
      resendCode,
      setUser,
      requestSmsCode,
      resendSmsCode,
      verifySmsCode,
      registerRealtor,
      loginAgency,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
