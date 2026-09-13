import { expect, test } from './fixtures';

async function token(identity: 'buyer' | 'manager', subject: string) {
  const { SignJWT } = await import('jose');
  return new SignJWT({ roles: ['CUSTOMER'], emailVerified: true, phoneVerified: true, e2eIdentity: `e2e_${identity}` })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(subject).setIssuer('arabiyatmart-backend')
    .setAudience('arabiyatmart-web').setIssuedAt().setExpirationTime('15m')
    .sign(new TextEncoder().encode('arabiyatmart-dev-access-secret-32chars!!'));
}

test.describe('TASK-057 cross-user and mutation isolation', () => {
  test('keeps two authenticated browser contexts isolated', async ({ browser }) => {
    const buyer = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    const manager = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    await buyer.addCookies([{ name: 'am_at', value: await token('buyer', '201'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' }]);
    await manager.addCookies([{ name: 'am_at', value: await token('manager', '202'), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' }]);
    const buyerPage = await buyer.newPage();
    const managerPage = await manager.newPage();
    await Promise.all([buyerPage.goto('/en/profile'), managerPage.goto('/en/profile')]);
    await expect(buyerPage.getByTestId('profile-page').getByText('e2e_buyer@arabiyatmart.test').first()).toBeVisible();
    await expect(managerPage.getByTestId('profile-page').getByText('e2e_manager@arabiyatmart.test').first()).toBeVisible();
    await expect(buyerPage.getByText('e2e_manager@arabiyatmart.test')).toHaveCount(0);
    await buyer.close();
    await manager.close();
  });

  test('rejects a protected BFF mutation without CSRF and ignores forged vendor scope', async ({ page, loginAs }) => {
    await loginAs('manager');
    const mutation = await page.request.patch('/api/bff/me/leads/lead_alpha/status', {
      data: { status: 'CONTACTED', note: null },
      headers: { 'idempotency-key': 'idem_e2e_missing_csrf_0001' },
    });
    expect(mutation.status()).toBe(403);

    await page.context().addCookies([{ name: 'am_vendor', value: 'v1.forged.bad-signature', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' }]);
    await page.goto('/en/me/dashboard?vendorPublicId=vnd_alpha');
    await expect(page.locator('#main-content').getByRole('heading', { name: 'Select a seller account to view performance' })).toBeVisible();
    await expect(page.getByText('1,240')).toHaveCount(0);
  });
});
