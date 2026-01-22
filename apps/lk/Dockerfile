# Frontend Dockerfile для lk.housler.ru
# Multi-stage build для оптимизации размера образа

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Копируем package files
COPY package.json package-lock.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для build)
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем зависимости из deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Переменные окружения для build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

# Build Next.js приложения
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Создаем non-root пользователя
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем необходимые файлы
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Переключаемся на non-root пользователя
USER nextjs

# Открываем порт
EXPOSE 3000

# Переменные окружения
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем приложение
CMD ["node", "server.js"]

