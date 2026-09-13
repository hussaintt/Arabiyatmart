import { expect, test } from './fixtures';

test.describe('TASK-056 SEO and PWA browser contracts', () => {
  test('serves robots, sitemap, and manifest without private route leakage', async ({ request }) => {
    const [robots, sitemap, manifest] = await Promise.all([
      request.get('/robots.txt'),
      request.get('/sitemap.xml'),
      request.get('/manifest.webmanifest'),
    ]);

    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('Disallow: /api/');
    const sitemapBody = await sitemap.text();
    expect(sitemap.ok()).toBeTruthy();
    expect(sitemapBody).toContain('/ar');
    expect(sitemapBody).toContain('hreflang="x-default"');
    expect(sitemapBody).not.toMatch(/\/(login|favorites|me|api)\b/);
    expect(manifest.ok()).toBeTruthy();
    await expect(manifest.json()).resolves.toMatchObject({ start_url: '/ar', dir: 'rtl' });
  });

  test('keeps canonical language alternates and OpenGraph on public home while noindexing auth', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/ar$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

    await page.goto('/ar/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
