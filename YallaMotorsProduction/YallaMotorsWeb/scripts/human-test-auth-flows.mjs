import { chromium } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/hussiennouh/.gemini/antigravity/brain/a59f2fe3-0070-4786-9d3e-304db5ca4dcd/screenshots';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🚀 Launching visible browser for Authenticated User Flows...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--window-size=1400,950', '--window-position=50,50']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'ar-EG',
  });

  const page = await context.newPage();

  try {
    page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));

    // ----------------------------------------------------
    // STEP 1: Login Page
    // ----------------------------------------------------
    console.log('📍 Navigating to Login Page (/ar/login)...');
    await page.goto('http://localhost:3001/ar/login', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1200);

    const shot15 = path.join(ARTIFACT_DIR, '15_login_page.png');
    await page.screenshot({ path: shot15, fullPage: false });
    console.log('📸 Captured:', shot15);

    // Fill in login credentials
    console.log('✍️ Typing login credentials (seller@arabiyatmart.local)...');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill('seller@arabiyatmart.local');
      await delay(500);
      await passwordInput.fill('Password123!');
      await delay(500);

      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      console.log('🔄 Submitted login form...');

      await delay(4000);
      console.log('📍 Current URL after login:', page.url());
      const cookies = await context.cookies();
      console.log('🍪 Cookies:', cookies.map(c => `${c.name}=${c.value.slice(0, 15)}... (secure=${c.secure}, httpOnly=${c.httpOnly})`));
    }

    // ----------------------------------------------------
    // STEP 2: Profile Page
    // ----------------------------------------------------
    console.log('📍 Navigating to Profile Page (/ar/profile)...');
    await page.goto('http://localhost:3001/ar/profile', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await delay(1500);

    const shot16 = path.join(ARTIFACT_DIR, '16_profile_authenticated.png');
    await page.screenshot({ path: shot16, fullPage: false });
    console.log('📸 Captured:', shot16);

    // ----------------------------------------------------
    // STEP 3: Sell Wizard Page (/ar/sell)
    // ----------------------------------------------------
    console.log('📍 Navigating to Sell Wizard (/ar/sell)...');
    await page.goto('http://localhost:3001/ar/sell', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot17 = path.join(ARTIFACT_DIR, '17_sell_wizard_step1.png');
    await page.screenshot({ path: shot17, fullPage: false });
    console.log('📸 Captured:', shot17);

    // Scroll to see wizard content
    await page.mouse.wheel(0, 300);
    await delay(1000);
    const shot18 = path.join(ARTIFACT_DIR, '18_sell_wizard_details.png');
    await page.screenshot({ path: shot18, fullPage: false });
    console.log('📸 Captured:', shot18);

    // ----------------------------------------------------
    // STEP 4: My Listings Page (/ar/me/listings)
    // ----------------------------------------------------
    console.log('📍 Navigating to My Listings (/ar/me/listings)...');
    await page.goto('http://localhost:3001/ar/me/listings', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot19 = path.join(ARTIFACT_DIR, '19_my_listings_page.png');
    await page.screenshot({ path: shot19, fullPage: false });
    console.log('📸 Captured:', shot19);

    console.log('✅ Authenticated flow testing completed successfully!');
  } catch (error) {
    console.error('❌ Error during authenticated flows:', error);
  } finally {
    await browser.close();
  }
})();
