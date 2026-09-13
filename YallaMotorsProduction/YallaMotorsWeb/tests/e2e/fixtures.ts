import { createHmac, randomUUID } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';

type BrowserAudit = {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestUrls: string[];
  readonly requests: { readonly method: string; readonly url: string }[];
};

export type TestIdentity = 'buyer' | 'unverified' | 'seller' | 'staff' | 'manager' | 'suspended';
type LoginAs = (identity: TestIdentity, vendorPublicId?: string) => Promise<void>;

function signedVendorScope(vendorPublicId: string): string {
  const encodedId = Buffer.from(vendorPublicId, 'utf8').toString('base64url');
  const payload = `v1.${encodedId}`;
  const signature = createHmac('sha256', 'arabiyatmart-dev-csrf-secret-32chars-ok!!')
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

async function accessToken(identity: TestIdentity): Promise<string> {
  const { SignJWT } = await import('jose');
  const subject = String(['buyer', 'unverified', 'seller', 'staff', 'manager', 'suspended'].indexOf(identity) + 101);
  return new SignJWT({
    roles: identity === 'manager' ? ['CUSTOMER', 'VENDOR'] : ['CUSTOMER'],
    emailVerified: true,
    phoneVerified: identity !== 'unverified',
    e2eIdentity: `e2e_${identity}`,
    e2eSession: randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuer('arabiyatmart-backend')
    .setAudience('arabiyatmart-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode('arabiyatmart-dev-access-secret-32chars!!'));
}

export const test = base.extend<{ audit: BrowserAudit; loginAs: LoginAs }>({
  audit: async ({ page }, run) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestUrls: string[] = [];
    const requests: { method: string; url: string }[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        const source = message.location().url;
        consoleErrors.push(source ? `${message.text()} (${source})` : message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      requestUrls.push(request.url());
      requests.push({ method: request.method(), url: request.url() });
    });

    await run({ consoleErrors, pageErrors, requestUrls, requests });

    expect(pageErrors, 'page errors').toEqual([]);
    expect(consoleErrors, 'browser console errors').toEqual([]);
  },
  loginAs: async ({ context }, run) => {
    await run(async (identity, vendorPublicId) => {
      const cookies = [
        { name: 'am_at', value: await accessToken(identity), url: 'http://127.0.0.1:3100', httpOnly: true, secure: false, sameSite: 'Lax' as const },
        { name: 'am_csrf', value: `csrf_e2e_${identity}_0123456789`, url: 'http://127.0.0.1:3100', httpOnly: false, secure: false, sameSite: 'Lax' as const },
      ];
      if (vendorPublicId) {
        cookies.push({ name: 'am_vendor', value: signedVendorScope(vendorPublicId), url: 'http://127.0.0.1:3100', httpOnly: true, secure: false, sameSite: 'Lax' as const });
      }
      await context.addCookies(cookies);
    });
  },
});

export { expect };

export function expectNoHorizontalOverflow(page: Page) {
  return expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

export function expectSameOriginBrowserTraffic(audit: BrowserAudit) {
  const allowedOrigins = new Set(['http://127.0.0.1:3100', 'http://localhost:3100']);
  for (const rawUrl of audit.requestUrls) {
    const url = new URL(rawUrl);
    expect(allowedOrigins.has(url.origin), `direct external or Fastify browser request: ${rawUrl}`).toBe(true);
    expect(url.pathname, `browser must not call a Fastify versioned endpoint: ${rawUrl}`).not.toMatch(/^\/v1\//);
  }
}

export async function expectNoSensitiveBrowserStorage(page: Page) {
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect([...storage.local, ...storage.session].join(' ')).not.toMatch(/token|access|refresh|password|secret/i);
}
