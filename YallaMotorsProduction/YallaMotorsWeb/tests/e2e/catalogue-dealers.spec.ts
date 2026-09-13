import { expect, test, expectNoHorizontalOverflow, expectSameOriginBrowserTraffic } from './fixtures';

test.describe('TASK-056 catalogue and dealer public journeys', () => {
  test('renders the catalogue route with public, indexable metadata during an upstream outage', async ({ page, audit }) => {
    const response = await page.goto('/en/catalogue/makes');

    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/catalogue\/makes$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });

  test('renders the dealer directory route with Arabic RTL metadata', async ({ page, audit }) => {
    const response = await page.goto('/ar/dealers');

    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });
});
