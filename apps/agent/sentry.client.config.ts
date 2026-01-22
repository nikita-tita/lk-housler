import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay (optional, disabled by default)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Environment
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Ignore common non-actionable errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    /Loading chunk \d+ failed/,
  ],
});
