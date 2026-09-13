import { expect, test, expectNoHorizontalOverflow, expectNoSensitiveBrowserStorage, expectSameOriginBrowserTraffic } from './fixtures';

test.describe('TASK-056 public marketplace journeys', () => {
  test('redirects the root to Arabic discovery with a server-rendered search route', async ({ page, audit }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('سيارتك القادمة.');
    await expect.poll(() => page.locator('script[type="application/ld+json"]').first().evaluate((node) => node.textContent)).toContain('SearchAction');
    await expectNoHorizontalOverflow(page);
    await expectNoSensitiveBrowserStorage(page);
    expectSameOriginBrowserTraffic(audit);
  });

  test('serves English LTR discovery and preserves canonical public navigation', async ({ page, audit }) => {
    await page.goto('/en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your next car.');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en$/);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });

  test('keeps public discovery usable without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/ar');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('سيارتك القادمة.');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await context.close();
  });
});
