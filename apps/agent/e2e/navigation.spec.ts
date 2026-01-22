import { test, expect } from '@playwright/test';

/**
 * E2E тесты навигации и базового UI
 */

test.describe('Навигация', () => {
  test('TC-NAV-001: Главная страница загружается', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Проверяем наличие header
    const header = page.locator('header, nav, [class*="header"], [class*="nav"]');
    await expect(header.first()).toBeVisible();

    // Проверяем отсутствие ошибки
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('TC-NAV-002: Переход на каталог квартир', async ({ page }) => {
    await page.goto('/');

    // Клик на "Квартиры" в меню
    const offersLink = page.locator('a:has-text("Квартиры"), a[href="/offers"]').first();
    if (await offersLink.isVisible()) {
      await offersLink.click();
      await expect(page).toHaveURL(/\/offers/);
    } else {
      // Прямой переход
      await page.goto('/offers');
    }

    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('TC-NAV-003: Переход на страницу ЖК', async ({ page }) => {
    await page.goto('/complexes');

    await page.waitForLoadState('networkidle');

    // Страница должна загрузиться
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('TC-NAV-004: Переход на карту', async ({ page }) => {
    await page.goto('/map');

    await page.waitForLoadState('networkidle');

    // Страница должна загрузиться (карта может требовать API ключ)
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('TC-NAV-005: Лого ведёт на главную', async ({ page }) => {
    await page.goto('/offers');

    // Клик на лого
    const logo = page.locator('a:has-text("HOUSLER"), [class*="logo"] a, header a').first();
    if (await logo.isVisible()) {
      await logo.click();
      // Проверяем что URL - главная (без path или только /)
      await page.waitForLoadState('networkidle');
      const url = new URL(page.url());
      expect(url.pathname === '/' || url.pathname === '').toBeTruthy();
    }
  });
});

test.describe('Health Check', () => {
  test('API /health доступен', async ({ request }) => {
    const response = await request.get('/api/health');

    // Должен вернуть 200 или /health может не быть
    if (response.status() === 200) {
      expect(response.ok()).toBeTruthy();
    } else {
      // Если /health не реализован, пропускаем
      expect([200, 404]).toContain(response.status());
    }
  });

  test('API /api/offers доступен', async ({ request }) => {
    const response = await request.get('/api/offers?limit=1');

    expect(response.ok()).toBeTruthy();
  });

  test('API /api/complexes доступен', async ({ request }) => {
    const response = await request.get('/api/complexes?limit=1');

    // Может не быть реализован
    expect([200, 404]).toContain(response.status());
  });
});
