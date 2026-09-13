import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

// ─── Config ─────────────────────────────────────────────────────────────────
const ARTIFACT_DIR = '/Users/hussiennouh/.gemini/antigravity/brain/28459c11-ae5c-4f64-abca-adfe64235bfb/screenshots';
const BASE = 'http://localhost:3001';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let shotIndex = 0;
async function snap(page, label) {
  shotIndex++;
  const num = String(shotIndex).padStart(2, '0');
  const filename = `${num}_${label}.png`;
  const filepath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 [${num}] ${label} → ${filename}`);
  return filepath;
}

// ─── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 Launching FULL FEATURE human-like browser test...');
  console.log(`📂 Screenshots → ${ARTIFACT_DIR}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
    args: ['--window-size=1440,950', '--window-position=50,50']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 860 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'ar-EG',
  });

  const page = await context.newPage();

  // ─── Diagnostics ──────────────────────────────────────────────────────
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  const failedRequests = [];
  page.on('requestfailed', request => {
    failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  const networkErrors = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  const results = {};

  async function testRoute(label, url, scrollSteps = [500], extra) {
    const start = Date.now();
    try {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 ${label}`);
      console.log(`   ${url}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await delay(1200);

      // Initial screenshot
      const safeName = label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      await snap(page, safeName);

      // Scroll + capture
      for (let i = 0; i < scrollSteps.length; i++) {
        await page.mouse.wheel(0, scrollSteps[i]);
        await delay(1000);
        if (i === scrollSteps.length - 1 || scrollSteps.length <= 2) {
          await snap(page, `${safeName}_scrolled_${i + 1}`);
        }
      }

      // Extra interactions
      if (extra) {
        await extra(page);
      }

      const elapsed = Date.now() - start;
      results[label] = { status: '✅ PASS', url, elapsed: `${elapsed}ms` };
      console.log(`   ✅ Passed (${elapsed}ms)`);
    } catch (err) {
      const elapsed = Date.now() - start;
      results[label] = { status: '❌ FAIL', url, elapsed: `${elapsed}ms`, error: err.message };
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  try {
    // ══════════════════════════════════════════════════════════════════════
    // SECTION 1: PUBLIC MARKETPLACE (Arabic RTL)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n🏪 ═══ SECTION 1: PUBLIC MARKETPLACE (Arabic RTL) ═══\n');

    // 1. Homepage — Arabic
    await testRoute('Homepage Arabic (RTL)', `${BASE}/ar`, [500, 700, 600], async (pg) => {
      // Try hover on a car card if visible
      const card = pg.locator('[data-testid="listing-card"], .listing-card, article').first();
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        await card.hover();
        await delay(500);
        await snap(pg, 'homepage_card_hover');
      }
    });

    // 2. Search marketplace
    await testRoute('Search Marketplace', `${BASE}/ar/search`, [450, 500], async (pg) => {
      // Try interacting with search input
      const searchInput = pg.locator('input[type="search"], input[placeholder*="بحث"], input[name="q"]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.click();
        await delay(300);
        await searchInput.fill('تويوتا');
        await delay(800);
        await snap(pg, 'search_typed_query');
      }

      // Try clicking a filter / brand pill
      const filterPill = pg.locator('[data-testid="filter-pill"], .filter-chip, .brand-pill, button:has-text("فلتر")').first();
      if (await filterPill.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterPill.click();
        await delay(800);
        await snap(pg, 'search_filter_active');
      }
    });

    // 3. Listing detail — pick a real listing slug from search results
    await testRoute('Listing Detail Page', `${BASE}/ar/listing/open-market-7277086`, [550, 600, 400], async (pg) => {
      // Test gallery thumbnail click if available
      const thumb = pg.locator('[data-testid="gallery-thumb"], .gallery-thumbnail, .thumbnail-strip img').first();
      if (await thumb.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thumb.click();
        await delay(800);
        await snap(pg, 'listing_gallery_click');
      }

      // Scroll to specs
      await pg.mouse.wheel(0, 500);
      await delay(800);
      await snap(pg, 'listing_specs_bottom');
    });

    // 4. Dealers directory
    await testRoute('Dealers Directory', `${BASE}/ar/dealers`, [500, 500]);

    // 5. Catalogue — Makes index
    await testRoute('Catalogue Makes', `${BASE}/ar/catalogue/makes`, [400, 400], async (pg) => {
      // Click on a make to see models
      const makeLink = pg.locator('a[href*="/catalogue/models"]').first();
      if (await makeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        const href = await makeLink.getAttribute('href');
        console.log(`   🔗 Found make link: ${href}`);
        await makeLink.click();
        await delay(1500);
        await snap(pg, 'catalogue_models_page');
        await pg.mouse.wheel(0, 400);
        await delay(800);
        await snap(pg, 'catalogue_models_scrolled');
      }
    });

    // 6. Compare workspace
    await testRoute('Compare Workspace', `${BASE}/ar/compare`, [300]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 2: ENGLISH (LTR) LAYOUT
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n🌐 ═══ SECTION 2: ENGLISH (LTR) LAYOUT ═══\n');

    await testRoute('Homepage English (LTR)', `${BASE}/en`, [500, 600]);
    await testRoute('Search English', `${BASE}/en/search`, [400]);
    await testRoute('Dealers English', `${BASE}/en/dealers`, [400]);
    await testRoute('Compare English', `${BASE}/en/compare`, [300]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3: AUTH PAGES (Unauthenticated View)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n🔐 ═══ SECTION 3: AUTH PAGES ═══\n');

    // Login page
    await testRoute('Login Page', `${BASE}/ar/login`, [200], async (pg) => {
      const emailInput = pg.locator('input[type="email"], input[name="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('test@example.com');
        await delay(400);
        const passInput = pg.locator('input[type="password"]').first();
        if (await passInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passInput.fill('TestPassword123!');
          await delay(400);
        }
        await snap(pg, 'login_form_filled');
      }
    });

    // Register page
    await testRoute('Register Page', `${BASE}/ar/register`, [300], async (pg) => {
      // Check form fields
      const nameInput = pg.locator('input[name="name"], input[placeholder*="الاسم"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('أحمد محمد');
        await delay(300);
        await snap(pg, 'register_form_filled');
      }
    });

    // Forgot password
    await testRoute('Forgot Password', `${BASE}/ar/forgot-password`, [200]);

    // Register success
    await testRoute('Register Success', `${BASE}/ar/register-success`, [200]);

    // Verify email
    await testRoute('Verify Email', `${BASE}/ar/verify-email`, [200]);

    // Reset password
    await testRoute('Reset Password', `${BASE}/ar/reset-password`, [200]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 4: PROTECTED ACCOUNT PAGES (test redirect / guard behavior)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n👤 ═══ SECTION 4: ACCOUNT PAGES (guard test) ═══\n');

    await testRoute('Profile Page', `${BASE}/ar/profile`, [300]);
    await testRoute('Sell Wizard', `${BASE}/ar/sell`, [300, 300]);
    await testRoute('My Listings', `${BASE}/ar/me/listings`, [300]);
    await testRoute('My Dashboard', `${BASE}/ar/me/dashboard`, [300]);
    await testRoute('My Leads', `${BASE}/ar/me/leads`, [300]);
    await testRoute('Favorites', `${BASE}/ar/favorites`, [300]);
    await testRoute('Notifications', `${BASE}/ar/notifications`, [300]);
    await testRoute('Saved Searches', `${BASE}/ar/saved-searches`, [300]);
    await testRoute('Best Offers', `${BASE}/ar/best-offer`, [300]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 5: ERROR / EDGE CASES
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n⚠️ ═══ SECTION 5: ERROR & EDGE CASES ═══\n');

    await testRoute('404 Not Found', `${BASE}/ar/this-page-does-not-exist`, [200]);
    await testRoute('Forbidden Page', `${BASE}/ar/forbidden`, [200]);
    await testRoute('Invalid Listing Slug', `${BASE}/ar/listing/non-existent-slug-12345`, [200]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 6: MOBILE RESPONSIVE (iPhone 14 Pro — 393x852)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n📱 ═══ SECTION 6: MOBILE RESPONSIVE (393×852) ═══\n');

    await page.setViewportSize({ width: 393, height: 852 });
    await delay(300);

    await testRoute('Mobile — Homepage AR', `${BASE}/ar`, [500, 400], async (pg) => {
      // Check for hamburger / mobile nav
      const hamburger = pg.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger, button:has(svg)').first();
      if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hamburger.click();
        await delay(800);
        await snap(pg, 'mobile_menu_open');
        // close it
        await pg.keyboard.press('Escape');
        await delay(400);
      }
    });

    await testRoute('Mobile — Search AR', `${BASE}/ar/search`, [400]);
    await testRoute('Mobile — Listing Detail', `${BASE}/ar/listing/open-market-7277086`, [500, 400]);
    await testRoute('Mobile — Dealers', `${BASE}/ar/dealers`, [400]);
    await testRoute('Mobile — Login', `${BASE}/ar/login`, [200]);
    await testRoute('Mobile — Register', `${BASE}/ar/register`, [200]);

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 7: TABLET RESPONSIVE (iPad — 820x1180)
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n📟 ═══ SECTION 7: TABLET RESPONSIVE (820×1180) ═══\n');

    await page.setViewportSize({ width: 820, height: 1180 });
    await delay(300);

    await testRoute('Tablet — Homepage AR', `${BASE}/ar`, [500, 500]);
    await testRoute('Tablet — Search AR', `${BASE}/ar/search`, [400]);
    await testRoute('Tablet — Listing Detail', `${BASE}/ar/listing/open-market-7277086`, [500]);

    // ══════════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              📊 FULL FEATURE TEST REPORT                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    const allTests = Object.entries(results);
    const passed = allTests.filter(([, v]) => v.status.includes('PASS'));
    const failed = allTests.filter(([, v]) => v.status.includes('FAIL'));

    console.log(`║  Total Tests:       ${allTests.length.toString().padEnd(39)}║`);
    console.log(`║  ✅ Passed:          ${passed.length.toString().padEnd(39)}║`);
    console.log(`║  ❌ Failed:          ${failed.length.toString().padEnd(39)}║`);
    console.log(`║  📸 Screenshots:     ${shotIndex.toString().padEnd(39)}║`);
    console.log(`║  ⚠️  Console Errors:  ${consoleLogs.length.toString().padEnd(39)}║`);
    console.log(`║  🌐 Network 4xx/5xx: ${networkErrors.length.toString().padEnd(39)}║`);
    console.log(`║  ❌ Failed Requests:  ${failedRequests.length.toString().padEnd(39)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');

    console.log('║  RESULTS BY SECTION:                                        ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    for (const [name, r] of allTests) {
      const line = `${r.status} ${name} (${r.elapsed})`;
      console.log(`║  ${line.padEnd(58)}║`);
      if (r.error) {
        console.log(`║    ↳ ${r.error.slice(0, 52).padEnd(54)}║`);
      }
    }

    if (consoleLogs.length > 0) {
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║  CONSOLE WARNINGS/ERRORS (first 15):                        ║');
      consoleLogs.slice(0, 15).forEach(log => {
        console.log(`║  ${log.slice(0, 58).padEnd(58)}║`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║  NETWORK ERRORS (first 15):                                 ║');
      networkErrors.slice(0, 15).forEach(err => {
        console.log(`║  ${err.slice(0, 58).padEnd(58)}║`);
      });
    }

    if (failedRequests.length > 0) {
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║  FAILED REQUESTS (first 10):                                ║');
      failedRequests.slice(0, 10).forEach(req => {
        console.log(`║  ${req.slice(0, 58).padEnd(58)}║`);
      });
    }

    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Write results to JSON for artifact processing
    const reportPath = path.join(ARTIFACT_DIR, 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalTests: allTests.length,
      passed: passed.length,
      failed: failed.length,
      screenshots: shotIndex,
      consoleErrors: consoleLogs.length,
      networkErrors: networkErrors.length,
      failedRequests: failedRequests.length,
      results,
      consoleLogs: consoleLogs.slice(0, 30),
      networkErrorDetails: networkErrors.slice(0, 30),
      failedRequestDetails: failedRequests.slice(0, 20),
    }, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}`);

  } catch (error) {
    console.error('💥 Fatal test error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed. Full feature test completed.');
  }
})();
