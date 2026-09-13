import { expect, test, expectNoHorizontalOverflow, expectNoSensitiveBrowserStorage, expectSameOriginBrowserTraffic } from './fixtures';

test.describe('TASK-056 authentication entry and recovery journeys', () => {
  test('rejects an unsafe return target while retaining the guest login form', async ({ page, audit }) => {
    await page.goto('/en/login?returnTo=https%3A%2F%2Fattacker.example%2Fsession');

    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/login$/);
    await expectNoSensitiveBrowserStorage(page);
    await expectNoHorizontalOverflow(page);
    expectSameOriginBrowserTraffic(audit);
  });

  test('validates password-recovery input locally and keeps reset flow confidential', async ({ page, audit }) => {
    await page.goto('/en/forgot-password');
    await page.getByTestId('forgot-email-input').fill('not-an-email');
    await page.getByTestId('forgot-password-submit-button').click();
    await expect(page.getByTestId('forgot-email-error')).toBeVisible();

    await page.goto('/en/reset-password');
    await expect(page.getByTestId('reset-flow-expired-card')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expectNoSensitiveBrowserStorage(page);
    expectSameOriginBrowserTraffic(audit);
  });
});
