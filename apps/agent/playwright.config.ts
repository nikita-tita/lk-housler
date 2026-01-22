import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E конфигурация для Housler Новостройки
 * Тестирует против продакшн сервера agent.housler.ru
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // Базовый URL продакшна
    baseURL: 'https://agent.housler.ru',

    // Трассировка только при ошибках
    trace: 'on-first-retry',

    // Скриншот при ошибке
    screenshot: 'only-on-failure',

    // Таймауты
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Один браузер для CI/CD
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Таймаут теста
  timeout: 60000,

  // Ожидание между тестами
  expect: {
    timeout: 10000,
  },
});
