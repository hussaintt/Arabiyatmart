import { test, expect } from '@playwright/test';

test.describe('Smoke E2E Suite', () => {
  test('smoke: redirects root to the Arabic localized marketplace', async ({ page }) => {
    await page.goto('/');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('عربيات مارت');
    await expect(page).toHaveURL(/\/ar(?:\?.*)?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('smoke: verifies viewport dimensions according to project tier', async ({ page }) => {
    await page.goto('/');

    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();

    if (viewport) {
      if (viewport.width < 640) {
        expect(viewport.width).toBe(390);
      } else if (viewport.width >= 640 && viewport.width <= 1024) {
        expect(viewport.width).toBe(768);
      } else {
        expect(viewport.width).toBe(1280);
      }
    }
  });
});
