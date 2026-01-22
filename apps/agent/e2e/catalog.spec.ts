import { test, expect } from '@playwright/test';

/**
 * E2E тесты каталога квартир
 */

test.describe('Каталог', () => {
  test('TC-CAT-001: Открытие каталога', async ({ page }) => {
    await page.goto('/offers');

    // Ожидаем загрузку
    await page.waitForLoadState('networkidle');

    // Проверяем наличие карточек квартир
    const cards = page.locator('.card, [class*="card"], article, [data-testid="offer-card"], [class*="offer"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Должно быть несколько карточек
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('TC-CAT-002: API каталога возвращает данные', async ({ request }) => {
    const response = await request.get('/api/offers?limit=10');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data.items) || Array.isArray(data.data)).toBeTruthy();
  });

  test('TC-CAT-003: Фильтрация по комнатности (API)', async ({ request }) => {
    const response = await request.get('/api/offers?rooms=2&limit=5');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);

    // Все результаты должны быть 2-комнатными
    const items = data.data.items || data.data;
    if (items.length > 0) {
      items.forEach((item: { rooms: number }) => {
        expect(item.rooms).toBe(2);
      });
    }
  });

  test('TC-CAT-004: Пагинация (API)', async ({ request }) => {
    const page1 = await request.get('/api/offers?page=1&limit=5');
    const page2 = await request.get('/api/offers?page=2&limit=5');

    expect(page1.ok()).toBeTruthy();
    expect(page2.ok()).toBeTruthy();

    const data1 = await page1.json();
    const data2 = await page2.json();

    // Разные страницы должны возвращать разные данные
    const items1 = data1.data.items || data1.data;
    const items2 = data2.data.items || data2.data;

    if (items1.length > 0 && items2.length > 0) {
      expect(items1[0].id).not.toBe(items2[0].id);
    }
  });
});

test.describe('Детальная страница квартиры', () => {
  test('TC-DET-001: Открытие карточки квартиры', async ({ page, request }) => {
    // Получаем ID существующей квартиры
    const response = await request.get('/api/offers?limit=1');
    const data = await response.json();
    const items = data.data.items || data.data;

    if (items.length === 0) {
      test.skip();
      return;
    }

    const offerId = items[0].id;

    await page.goto(`/offers/${offerId}`);
    await page.waitForLoadState('networkidle');

    // Проверяем наличие информации о квартире
    // Цена, площадь, ЖК — хотя бы что-то должно быть
    const hasPrice = await page.locator('text=/\\d+.*млн|\\d+.*₽|\\d{1,3}[\\s,]\\d{3}/').count() > 0;
    const hasArea = await page.locator('text=/\\d+.*м²|\\d+.*кв/').count() > 0;

    expect(hasPrice || hasArea).toBeTruthy();
  });
});
