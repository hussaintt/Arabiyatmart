import { expect, test, expectNoHorizontalOverflow, expectNoSensitiveBrowserStorage } from './fixtures';

test.describe('TASK-057 protected account journeys', () => {
  test('redirects an anonymous account request to the localized login safely', async ({ page }) => {
    await page.goto('/en/profile');
    await expect(page).toHaveURL(/\/en\/login\?returnTo=%2Fen%2Fprofile$/);
  });

  test('renders a token-free private profile and cancels account deletion safely', async ({ page, loginAs, audit }) => {
    await loginAs('buyer');
    await page.goto('/en/profile');

    const profile = page.locator('#main-content').getByTestId('profile-page');
    await expect(profile).toBeVisible();
    await expect(profile.getByText('e2e_buyer@arabiyatmart.test').first()).toBeVisible();
    await profile.getByTestId('delete-account-trigger').click();
    await expect(page.getByTestId('delete-account-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('delete-account-dialog')).toBeHidden();
    await expectNoSensitiveBrowserStorage(page);
    await expectNoHorizontalOverflow(page);
    expect(audit.requestUrls.some((url) => /e2e_buyer|am_at/.test(url))).toBe(false);
  });

  test('updates profile data through a protected server action and signs out cleanly', async ({ page, loginAs }) => {
    await loginAs('buyer');
    await page.goto('/en/profile/edit');
    const form = page.locator('#main-content').getByTestId('profile-form');
    await form.locator('#profile-first-name').fill('Updated');
    await form.getByTestId('profile-save').click();
    await expect.poll(async () => {
      const savedStatus = await form.getByRole('status').filter({ hasText: 'Your profile was saved' }).count();
      return page.url().endsWith('/en/profile') || savedStatus > 0;
    }).toBe(true);
    if (!page.url().endsWith('/en/profile')) {
      await page.goto('/en/profile');
    }
    await expect(page.locator('#main-content').getByRole('heading', { name: 'Updated E2E' })).toBeVisible();

    await page.locator('#main-content').getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === 'am_at')).toBe(false);
    await page.goto('/en/profile');
    await expect(page).toHaveURL(/\/en\/login\?returnTo=%2Fen%2Fprofile$/);
  });

  test('runs the backend phone-verification stages without exposing the OTP', async ({ page, loginAs, audit }) => {
    await loginAs('unverified');
    await page.goto('/en/profile?panel=verify-phone&returnTo=%2Fen%2Fsell');
    const panel = page.locator('#main-content').getByTestId('phone-verification-panel');
    await panel.locator('#verification-phone').fill('+201099999999');
    await panel.getByTestId('send-phone-code').click();
    await expect(panel.locator('#phone-code')).toBeVisible();
    await panel.locator('#phone-code').fill('123456');
    await panel.getByTestId('confirm-phone-code').click();
    await expect(panel.getByTestId('phone-verification-success')).toBeVisible();
    expect(audit.requestUrls.some((url) => url.includes('123456'))).toBe(false);
  });

  test('paginates favorites and reconciles a successful removal', async ({ page, loginAs }) => {
    await loginAs('buyer');
    await page.goto('/en/favorites');
    const favorites = page.locator('#main-content').getByTestId('favorites-list');
    await expect(favorites.getByTestId('listing-card-lst_favorite_alpha')).toBeVisible();
    await favorites.getByTestId('favorites-load-more').click();
    await expect(favorites.getByTestId('listing-card-lst_favorite_beta')).toBeVisible();
    const primary = favorites.getByTestId('listing-card-lst_favorite_alpha');
    await primary.getByRole('button', { name: 'Remove from favorites' }).click();
    await expect(primary).toHaveCount(0);
    await expect(favorites.getByTestId('listing-card-lst_favorite_beta')).toBeVisible();
  });

  test('updates and deletes a saved search with optimistic reconciliation', async ({ page, loginAs }) => {
    await loginAs('buyer');
    await page.goto('/en/saved-searches');
    const saved = page.locator('#main-content').getByTestId('saved-search-ss_alpha');
    const alertToggle = saved.getByRole('switch', { name: 'Toggle alert' });
    await expect(alertToggle).toBeChecked();
    await alertToggle.click();
    await expect(alertToggle).not.toBeChecked();
    await saved.getByTestId('delete-saved-search-ss_alpha').click();
    await page.getByTestId('confirm-delete-saved-search-ss_alpha').click();
    await expect(page.locator('#main-content').getByTestId('saved-search-empty')).toBeVisible();
  });

  test('marks a notification read and exposes a deterministic push fallback', async ({ page, loginAs }) => {
    await loginAs('buyer');
    await page.goto('/en/notifications');
    const main = page.locator('#main-content');
    await expect(main.getByText('1 unread')).toBeVisible();
    await main.getByTestId('mark-notification-read-ntf_alpha').click();
    await expect(main.getByText('0 unread')).toBeVisible();
    await expect(main.getByTestId('mark-notification-read-ntf_alpha')).toHaveCount(0);
    await expect(main.getByTestId('push-unsupported').or(main.getByTestId('push-opt-in'))).toBeVisible();
  });
});
