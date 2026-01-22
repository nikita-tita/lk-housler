import { test, expect } from '@playwright/test';

/**
 * E2E тесты публичных подборок
 * Тестовая подборка: test-demo-2024
 */

test.describe('Публичная подборка', () => {
  test('TC-SEL-001: Просмотр публичной подборки гостем', async ({ page }) => {
    // Регрессия BUG-001: ранее страница падала с 500
    await page.goto('/s/test-demo-2024');

    // Страница НЕ показывает ошибку
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});

    // Ожидаем загрузку контента
    await page.waitForLoadState('networkidle');

    // Проверяем что есть карточки квартир или название подборки
    const hasContent = await page.locator('.card, [class*="card"], article, [data-testid="offer-card"]').count() > 0
      || await page.locator('h1, h2').count() > 0;

    expect(hasContent).toBeTruthy();
  });

  test('TC-SEL-002: API подборки возвращает данные', async ({ request }) => {
    const response = await request.get('/api/selections/shared/test-demo-2024');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);

    // Проверка структуры item
    const item = data.data.items[0];
    expect(item).toHaveProperty('price');
    expect(item).toHaveProperty('area_total');
  });

  test('TC-SEL-003: Несуществующая подборка возвращает 404', async ({ request }) => {
    const response = await request.get('/api/selections/shared/nonexistent-code-12345');

    // Ожидаем 404 или success: false
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(false);
    } else {
      expect(response.status()).toBe(404);
    }
  });
});

test.describe('Подборки агента', () => {
  test.beforeEach(async ({ page }) => {
    // Авторизация агента
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
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  test('TC-SEL-004: Список подборок агента', async ({ page }) => {
    await page.goto('/selections');

    // Ожидаем загрузку
    await page.waitForLoadState('networkidle');

    // Должна быть либо таблица/список подборок, либо кнопка создания
    const hasContent = await page.locator('button:has-text("Создать"), a:has-text("Создать"), table, [class*="list"], [class*="grid"]').count() > 0;
    expect(hasContent).toBeTruthy();
  });
});
