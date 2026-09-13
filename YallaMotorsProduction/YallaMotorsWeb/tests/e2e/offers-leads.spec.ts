import { expect, test, expectNoHorizontalOverflow } from './fixtures';

test.describe('TASK-057 direct-contact lead journeys', () => {
  test('shows a seller inquiry without exposing buyer contact in navigation or URLs', async ({ page, loginAs, audit }) => {
    await loginAs('seller');
    await page.goto('/en/me/leads');

    const leadList = page.locator('#main-content').getByTestId('lead-list');
    await expect(leadList).toBeVisible();
    await expect(leadList.getByText('Toyota Corolla 2024')).toBeVisible();
    await expect(leadList.getByText('WhatsApp')).toBeVisible();
    expect(audit.requestUrls.some((url) => url.includes('+201112223333'))).toBe(false);
    await expectNoHorizontalOverflow(page);
  });

  test('records direct WhatsApp contact and a verified-user listing report', async ({ page, loginAs, audit }) => {
    await loginAs('buyer');
    await page.goto('/en/listing/toyota-corolla-contact');
    const whatsapp = page.locator('a[href^="https://wa.me/201009998888"]:visible').first();
    await expect(whatsapp).toBeVisible();
    await page.evaluate(() => {
      document.addEventListener('click', (event) => {
        if ((event.target as Element | null)?.closest('a[href^="https://wa.me/"]')) event.preventDefault();
      }, { capture: true });
    });
    const contactAction = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/en/listing/toyota-corolla-contact'));
    await whatsapp.click();
    await expect(contactAction).resolves.toBeTruthy();
    await expect(page).toHaveURL(/\/en\/listing\/toyota-corolla-contact$/);

    await page.getByTestId('report-listing-button').first().evaluate((button: HTMLElement) => button.click());
    const report = page.getByTestId('report-listing-form').filter({ visible: true });
    await expect(report).toBeVisible();
    await report.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText('Report received. Thank you for helping us.')).toBeVisible();
    expect(audit.requestUrls.some((url) => url.includes('+201009998888'))).toBe(false);
  });

  test('updates a private seller lead status through the authorized scope', async ({ page, loginAs }) => {
    await loginAs('seller');
    await page.goto('/en/me/leads/lead_alpha');
    const form = page.locator('#main-content').getByTestId('lead-status-form');
    await form.locator('#lead-status').selectOption('CONTACTED');
    await form.locator('#lead-status-note').fill('Buyer contacted on WhatsApp');
    await form.getByRole('button', { name: 'Save status' }).click();
    await expect(form.getByRole('status')).toHaveText('Inquiry status updated.');
  });

  test('contains no buyer price-offer route or price-offer action', async ({ page, loginAs }) => {
    await loginAs('buyer');
    const response = await page.goto('/en/me/offers');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/price offer|accept offer|reject offer/i)).toHaveCount(0);
  });
});
