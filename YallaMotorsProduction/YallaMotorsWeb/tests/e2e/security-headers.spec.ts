import { expect, test, expectSameOriginBrowserTraffic, expectNoSensitiveBrowserStorage } from './fixtures';

const headerRoutes = ['/ar', '/en/search', '/en/profile', '/api/bff/session'];

function directive(csp: string, name: string): string {
  return csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? '';
}

test.describe('TASK-058 deployed security headers', () => {
  test('sends production security headers on pages and BFF responses', async ({ request }) => {
    for (const route of headerRoutes) {
      const response = await request.get(route);
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
      expect(headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');

      const csp = headers['content-security-policy'] ?? '';
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(directive(csp, 'script-src')).not.toContain('*');
      expect(directive(csp, 'img-src')).not.toContain('*');
      expect(directive(csp, 'media-src')).not.toContain('*');
    }
  });

  test('keeps browser traffic same-origin and excludes secrets from loaded JavaScript', async ({ page, audit }) => {
    await page.goto('/ar');
    expectSameOriginBrowserTraffic(audit);
    await expectNoSensitiveBrowserStorage(page);

    const scripts = await page.locator('script[src]').evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).src));
    const scriptBodies = await Promise.all(scripts.map(async (src) => page.evaluate(async (url) => fetch(url).then((response) => response.text()), src)));
    const bundle = scriptBodies.join('\n');
    expect(bundle).not.toContain('arabiyatmart-dev-access-secret');
    expect(bundle).not.toContain('arabiyatmart-dev-csrf-secret');
    expect(bundle).not.toContain('development-jwt-access-secret');
    expect(bundle).not.toContain('development-csrf-secret');
  });
});
