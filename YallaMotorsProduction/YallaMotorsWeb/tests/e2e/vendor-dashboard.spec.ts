import { expect, test, expectNoHorizontalOverflow } from './fixtures';

test.describe('TASK-057 vendor role and dashboard journeys', () => {
  test('allows staff to manage vendor leads but not manager analytics', async ({ page, loginAs }) => {
    await loginAs('staff', 'vnd_alpha');
    await page.goto('/en/me/leads');
    const main = page.locator('#main-content');
    await expect(main.getByTestId('vendor-switcher')).toBeVisible();
    await expect(main.getByTestId('lead-list')).toBeVisible();

    await page.goto('/en/me/dashboard');
    await expect(page.locator('#main-content').getByRole('heading', { name: 'A store manager role is required' })).toBeVisible();
  });

  test('scopes manager analytics to the signed active vendor and selected range', async ({ page, loginAs, audit }) => {
    await loginAs('manager', 'vnd_alpha');
    await page.goto('/en/me/dashboard?range=7d&vendorPublicId=vnd_beta');

    const dashboard = page.locator('#main-content').getByTestId('seller-dashboard-page');
    await expect(dashboard).toBeVisible();
    await expect(dashboard.locator('#active-vendor')).toHaveValue('vnd_alpha');
    await expect(dashboard.getByText('1,240')).toBeVisible();
    await expect(dashboard.getByText('91.5%')).toBeVisible();
    expect(audit.requestUrls.some((url) => url.includes('/v1/'))).toBe(false);
    await expectNoHorizontalOverflow(page);
  });

  test('switches a multi-vendor manager using the signed server-owned scope', async ({ page, loginAs }) => {
    await loginAs('manager', 'vnd_alpha');
    await page.goto('/en/me/dashboard');
    const dashboard = page.locator('#main-content').getByTestId('seller-dashboard-page');
    const selector = dashboard.locator('#active-vendor');
    await expect(selector).toHaveValue('vnd_alpha');
    await selector.selectOption('vnd_beta');
    await expect(selector).toHaveValue('vnd_beta');
    const vendorCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'am_vendor');
    expect(vendorCookie?.value).toMatch(/^v1\.[^.]+\.[A-Za-z0-9_-]+$/);
    expect(vendorCookie?.value).not.toContain('vnd_beta');
  });

  test('blocks a suspended vendor from lead and analytics scope', async ({ page, loginAs }) => {
    await loginAs('suspended', 'vnd_suspended');
    await page.goto('/en/me/dashboard');
    await expect(page.locator('#main-content').getByRole('heading', { name: 'A store manager role is required' })).toBeVisible();
    await page.goto('/en/me/leads');
    await expect(page.getByRole('alert').getByRole('heading', { name: 'The selected vendor is unavailable' })).toBeVisible();
    await expect(page.getByText('+201112223333')).toHaveCount(0);
  });
});
