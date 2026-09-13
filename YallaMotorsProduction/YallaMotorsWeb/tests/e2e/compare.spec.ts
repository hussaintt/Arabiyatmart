import { expect, test, expectNoHorizontalOverflow, expectSameOriginBrowserTraffic } from './fixtures';

test.describe('TASK-056 compare journey', () => {
  test('canonicalizes a mixed, duplicate compare selection without exposing an indexable route', async ({ page, audit }) => {
    await page.goto('/en/compare?item=listing:first&item=listing:first&item=trim:ignored&item=listing:second&item=listing:third&item=listing:fourth');

    await expect(page).toHaveURL(/item=listing%3Afirst.*item=listing%3Asecond/);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /item=listing%3Afirst/);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });

  test('shows the safe empty state and offers only local marketplace navigation', async ({ page, audit }) => {
    await page.goto('/ar/compare');

    await expect(page.getByTestId('compare-empty-state')).toBeVisible();
    await expect(page.getByTestId('compare-empty-state').getByRole('link')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });
});
