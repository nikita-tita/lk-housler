# Frontend Dockerfile for lk.housler.ru (Monorepo support)
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
# Copy workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy shared packages structure (for install)
COPY packages ./packages
# Copy app package structure (for install)
COPY apps/lk/package.json ./apps/lk/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

WORKDIR /app/apps/lk
RUN pnpm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
# Standalone output includes necessary node_modules and files in a structure mirroring the project
COPY --from=builder --chown=nextjs:nodejs /app/apps/lk/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/lk/.next/static ./apps/lk/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/lk/public ./apps/lk/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/lk/server.js"]

