import { expect, test, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';
import type { SellListingDraft } from '@/types/sell';

const SELLER_PUBLIC_ID = 'usr_e2e_seller';

function fnvHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const completeDraft: SellListingDraft = {
  condition: 'USED', makePublicId: 'mak_toyota', modelPublicId: 'mod_corolla',
  generationPublicId: null, trimPublicId: null, year: 2024, mileageKm: 15000,
  fuelType: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SEDAN', engineCc: 1600,
  colorExterior: 'White', colorInterior: 'Black', features: ['ABS'],
  description: 'A carefully maintained vehicle.', priceCents: 65000000,
  isNegotiable: true, installmentAvailable: false, exchangeAccepted: false,
  hasWarranty: false, hasServiceHistory: true, cityId: 1, areaId: null,
  contactPhone: '+201001112222', whatsappPhone: '+201009998888', allowChat: true,
};

async function seedDraft(page: Page, draft: SellListingDraft = completeDraft) {
  const key = `arabiyatmart:sell-draft:${fnvHash(SELLER_PUBLIC_ID)}:v1`;
  await page.addInitScript(({ storageKey, value }) => {
    if (!sessionStorage.getItem('e2e-sell-draft-seeded')) {
      localStorage.setItem(storageKey, JSON.stringify(value));
      sessionStorage.setItem('e2e-sell-draft-seeded', 'true');
    }
  }, { storageKey: key, value: { version: 1, userHash: fnvHash(SELLER_PUBLIC_ID), draft } });
  return key;
}

test.describe('TASK-057 sell authorization journeys', () => {
  test('sends an unverified seller to phone verification with a safe return target', async ({ page, loginAs }) => {
    await loginAs('unverified');
    await page.goto('/en/sell');
    await expect(page).toHaveURL(/\/en\/profile\?panel=verify-phone&returnTo=%2Fen%2Fsell$/);
  });

  test('allows a verified private seller to enter the listing workflow', async ({ page, loginAs, audit }) => {
    await loginAs('seller');
    await page.goto('/en/sell');
    await expect(page.getByTestId('sell-page')).toBeVisible();
    await expect(page.getByTestId('sell-step-condition')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expectNoHorizontalOverflow(page);
    expect(audit.requestUrls.some((url) => /access|refresh|password/i.test(url))).toBe(false);
  });

  test('restores or discards only the current seller draft', async ({ page, loginAs }) => {
    await loginAs('seller');
    const key = await seedDraft(page, { ...completeDraft, condition: 'NEW' });
    await page.goto('/en/sell');
    await expect(page.getByTestId('draft-recovery-dialog')).toBeVisible();
    await page.getByTestId('restore-sell-draft').click();
    await expect(page.getByTestId('condition-option-new')).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.getByTestId('draft-recovery-dialog')).toBeVisible();
    await page.getByTestId('discard-sell-draft').click();
    await expect(page.getByTestId('draft-recovery-dialog')).toBeHidden();
    await expect.poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  });

  test('uploads the minimum photos and publishes one idempotent listing', async ({ page, loginAs, audit }) => {
    await loginAs('seller');
    const key = await seedDraft(page);
    await page.goto('/en/sell');
    await page.getByTestId('restore-sell-draft').click();

    for (const step of ['vehicle', 'details', 'pricing', 'photos']) {
      await page.getByTestId('sell-next').click();
      await expect(page.getByTestId(`sell-step-${step}`)).toBeVisible();
    }

    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await page.getByTestId('photo-file-input').setInputFiles([
      { name: 'front.png', mimeType: 'image/png', buffer: image },
      { name: 'rear.png', mimeType: 'image/png', buffer: image },
      { name: 'interior.png', mimeType: 'image/png', buffer: image },
    ]);
    await expect(page.getByText('Complete (3 ready)')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('sell-next').click();
    await expect(page.getByTestId('sell-step-location')).toBeVisible();
    await page.getByTestId('sell-next').click();
    await expect(page.getByTestId('sell-step-review')).toBeVisible();

    const before = audit.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/en/sell')).length;
    await page.getByTestId('sell-next').click();
    await expect(page).toHaveURL(/\/en\/listing\/created-toyota-corolla$/);
    const after = audit.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/en/sell')).length;
    expect(after - before).toBe(1);
    await expect.poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  });
});
