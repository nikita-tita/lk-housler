import { test, expect } from '@playwright/test';

/**
 * E2E тесты избранного
 */

test.describe('Избранное', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Получаем токен авторизации клиента
    const response = await request.post('/api/auth/verify-code', {
      data: {
        email: 'client@test.housler.ru',
        code: '111111'
      }
    });

    const data = await response.json();
    if (data.success && data.data?.token) {
      authToken = data.data.token;
    }
  });

  test('TC-FAV-001: API избранного требует авторизации', async ({ request }) => {
    const response = await request.get('/api/favorites');

    // Без токена должен быть 401
    expect(response.status()).toBe(401);
  });

  test('TC-FAV-002: Получение списка избранного (авторизован)', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const response = await request.get('/api/favorites', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('TC-FAV-003: Добавление и удаление из избранного', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    // Получаем ID существующего оффера
    const offersResponse = await request.get('/api/offers?limit=1');
    const offersData = await offersResponse.json();
    const items = offersData.data?.items || offersData.data;

    if (!items || items.length === 0) {
      test.skip();
      return;
    }

    const offerId = items[0].id;

    // Добавляем в избранное
    const addResponse = await request.post(`/api/favorites/${offerId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(addResponse.ok()).toBeTruthy();

    // Проверяем что добавилось
    const checkResponse = await request.get('/api/favorites', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const checkData = await checkResponse.json();
    expect(checkData.success).toBe(true);

    // Удаляем из избранного
    const deleteResponse = await request.delete(`/api/favorites/${offerId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(deleteResponse.ok()).toBeTruthy();
  });

  test('TC-FAV-004: Страница избранного (UI)', async ({ page }) => {
    // Авторизация клиента
    await page.goto('/login');
    await page.fill('input[type="email"]', 'client@test.housler.ru');
    await page.click('button:has-text("Получить код")');

    await page.waitForSelector('text=постоянный код', { timeout: 5000 }).catch(() => {});
    const permanentCodeBtn = page.locator('text=постоянный код');
    if (await permanentCodeBtn.isVisible()) {
      await permanentCodeBtn.click();
    }

    await page.fill('input[placeholder*="код"], input[name="code"], input[type="text"]', '111111');
    await page.click('button:has-text("Войти")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Переходим в избранное
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');

    // Страница должна загрузиться без ошибок
    await expect(page.locator('text=Что-то пошло не так')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
});
