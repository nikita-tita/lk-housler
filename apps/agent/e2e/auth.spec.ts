import { test, expect } from '@playwright/test';

/**
 * E2E тесты авторизации
 * Тестовые аккаунты: client@test.housler.ru (111111), agent@test.housler.ru (333333)
 */

test.describe('Авторизация', () => {
  test.beforeEach(async ({ page }) => {
    // Очистить localStorage перед каждым тестом
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('TC-AUTH-001: Вход клиента', async ({ page }) => {
    await page.goto('/login');

    // Ввести email
    await page.fill('input[type="email"]', 'client@test.housler.ru');
    await page.click('button:has-text("Получить код")');

    // Дождаться появления поля кода или кнопки "постоянный код"
    await page.waitForSelector('text=постоянный код', { timeout: 5000 }).catch(() => {});

    // Клик на "постоянный код" если есть
    const permanentCodeBtn = page.locator('text=постоянный код');
    if (await permanentCodeBtn.isVisible()) {
      await permanentCodeBtn.click();
    }

    // Ввести код
    await page.fill('input[placeholder*="код"], input[name="code"], input[type="text"]', '111111');
    await page.click('button:has-text("Войти")');

    // Ждём редиректа с /login (авторизация прошла успешно)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Успешная авторизация подтверждается уходом со страницы login
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });

  test('TC-AUTH-002: Вход агента', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'agent@test.housler.ru');
    await page.click('button:has-text("Получить код")');

    await page.waitForSelector('text=постоянный код', { timeout: 5000 }).catch(() => {});
    const permanentCodeBtn = page.locator('text=постоянный код');
    if (await permanentCodeBtn.isVisible()) {
      await permanentCodeBtn.click();
    }

    await page.fill('input[placeholder*="код"], input[name="code"], input[type="text"]', '333333');
    await page.click('button:has-text("Войти")');

    // Ждём редиректа с /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Проверка что есть пункты меню агента (может быть на любой странице)
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Подборки').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-AUTH-003: Страница логина доступна', async ({ page }) => {
    await page.goto('/login');

    // Проверка элементов
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Получить код")')).toBeVisible();
  });
});
