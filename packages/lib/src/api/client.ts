import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://agent.housler.ru/api';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 504];

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
    // Try to retry the request
    try {
      return await retryRequest(error, authClient as typeof axios);
    } catch {
      // Retry failed or not retryable
      if (error.response?.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('housler_token');
        }
      }
      return Promise.reject(error);
    }
  }
);

// Request interceptor - добавляем JWT token и X-Request-ID
apiClient.interceptors.request.use(addAuthToken, (error) => Promise.reject(error));

// Response interceptor - retry + обработка ошибок
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Try to retry the request
    try {
      return await retryRequest(error, apiClient as typeof axios);
    } catch {
      // Retry failed or not retryable
      if (error.response?.status === 401) {
        // Unauthorized - очистить токен и редирект на login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('housler_token');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  }
);

export default apiClient;

