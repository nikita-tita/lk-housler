import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['@housler/auth', '@housler/lib', '@housler/types', '@housler/ui'],
  /* config options here */
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Suppress logs during build
  silent: true,

  // Organization and project for source maps
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Disable source map uploads if no auth token
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,

  // Hide source maps from browser
  hideSourceMaps: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
