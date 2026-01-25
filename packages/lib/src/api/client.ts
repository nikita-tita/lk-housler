import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://agent.housler.ru/api';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 504];

// Token refresh state (prevent multiple simultaneous refresh attempts)
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Main API client for lk.housler.ru
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies with requests
});

// Auth API client - uses agent.housler.ru for unified auth
export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  timeout: 60000, // 60 seconds for auth (SMS delivery can be slow)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies with requests
});

// Retry logic for failed requests
const retryRequest = async (error: AxiosError, client: typeof axios): Promise<unknown> => {
  const config = error.config;
  if (!config) return Promise.reject(error);

  // Initialize retry count
  const retryCount = (config as unknown as { _retryCount?: number })._retryCount || 0;

  // Check if we should retry
  const isRetryable =
    retryCount < MAX_RETRIES &&
    (error.code === 'ECONNABORTED' || // timeout
     error.code === 'ERR_NETWORK' || // network error
     (error.response && RETRYABLE_STATUS_CODES.includes(error.response.status)));

  // Don't retry non-idempotent requests (POST/PUT/DELETE) unless it's a network error before request was sent
  const isIdempotent = config.method?.toUpperCase() === 'GET';
  const requestNotSent = !error.response;

  if (isRetryable && (isIdempotent || requestNotSent)) {
    (config as unknown as { _retryCount: number })._retryCount = retryCount + 1;

    // Exponential backoff: 1s, 2s, 4s
    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    return client.request(config);
  }

  return Promise.reject(error);
};

// Generate unique request ID for distributed tracing
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Attempt to refresh access token using httpOnly refresh_token cookie.
 * Uses raw axios to avoid interceptor loops.
 */
const attemptTokenRefresh = async (): Promise<string | null> => {
  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Use raw axios to avoid triggering our interceptors
      const response = await axios.post<{ access_token: string }>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken = response.data.access_token;

      // Store for backward compatibility
      if (typeof window !== 'undefined' && newToken) {
        localStorage.setItem('housler_token', newToken);
      }

      return newToken;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Get redirect URL based on user role stored in localStorage.
 */
const getAuthRedirectUrl = (): string => {
  if (typeof window === 'undefined') return '/';

  const role = localStorage.getItem('housler_user_role');

  switch (role) {
    case 'agent':
      return '/realtor';
    case 'client':
      return '/client';
    case 'agency':
    case 'agency_owner':
    case 'agency_admin':
      return '/agency';
    default:
      return '/';
  }
};

/**
 * Clear auth state and redirect to login.
 */
const handleAuthFailure = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('housler_token');
    window.location.href = getAuthRedirectUrl();
  }
};

// Add token and request ID to both clients
const addAuthToken = (config: InternalAxiosRequestConfig) => {
  // Add X-Request-ID for distributed tracing
  config.headers['X-Request-ID'] = generateRequestId();

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('housler_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
};

// Request interceptor for authClient
authClient.interceptors.request.use(addAuthToken, (error) => Promise.reject(error));

// Response interceptor for authClient - retry + обработка 401 ошибок
authClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await attemptTokenRefresh();
      if (newToken) {
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return authClient.request(originalRequest);
      }

      // Refresh failed - clear auth but don't redirect (authClient is for login flows)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('housler_token');
      }
      return Promise.reject(error);
    }

    // Try to retry the request for other errors
    try {
      return await retryRequest(error, authClient as typeof axios);
    } catch {
      return Promise.reject(error);
    }
  }
);

// Request interceptor - добавляем JWT token и X-Request-ID
apiClient.interceptors.request.use(addAuthToken, (error) => Promise.reject(error));

// Response interceptor - retry + auto-refresh + обработка ошибок
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - try to refresh token first
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for the refresh endpoint itself
      if (originalRequest.url?.includes('/auth/refresh')) {
        handleAuthFailure();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const newToken = await attemptTokenRefresh();
      if (newToken) {
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(originalRequest);
      }

      // Refresh failed - redirect to login
      handleAuthFailure();
      return Promise.reject(error);
    }

    // Try to retry the request for other errors
    try {
      return await retryRequest(error, apiClient as typeof axios);
    } catch {
      return Promise.reject(error);
    }
  }
);

export default apiClient;

