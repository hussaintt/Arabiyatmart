import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = '/Users/hussiennouh/.gemini/antigravity/brain/a59f2fe3-0070-4786-9d3e-304db5ca4dcd/screenshots';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🚀 Launching visible browser in headed mode for human-like testing...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400, // human-like pace
    args: ['--window-size=1400,950', '--window-position=50,50']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'ar-EG',
  });

  const page = await context.newPage();

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

  try {
    // ----------------------------------------------------
    // MILESTONE 1: Arabic Homepage Exploration
    // ----------------------------------------------------
    console.log('\n📍 Milestone 1: Arabic Homepage Exploration (http://localhost:3001/ar)...');
    await page.goto('http://localhost:3001/ar', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot1 = path.join(ARTIFACT_DIR, '01_homepage_initial.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log('📸 Captured:', shot1);

    // Smooth scroll down to explore hero, quick filters & spotlight
    console.log('👀 Human smooth scroll down homepage...');
    await page.mouse.wheel(0, 550);
    await delay(1500);

    const shot2 = path.join(ARTIFACT_DIR, '02_homepage_scrolled.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log('📸 Captured:', shot2);

    // Scroll down further to see dealer cards and latest listings
    await page.mouse.wheel(0, 750);
    await delay(1500);

    const shot3 = path.join(ARTIFACT_DIR, '03_homepage_dealers_listings.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log('📸 Captured:', shot3);

    // ----------------------------------------------------
    // MILESTONE 2: Search & Marketplace Filters
    // ----------------------------------------------------
    console.log('\n📍 Milestone 2: Search & Marketplace Filters (/ar/search)...');
    await page.goto('http://localhost:3001/ar/search', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot4 = path.join(ARTIFACT_DIR, '04_search_marketplace.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log('📸 Captured:', shot4);

    // Scroll to see results and filters
    console.log('🔍 Interacting with search filters and results...');
    await page.mouse.wheel(0, 450);
    await delay(1500);

    const shot5 = path.join(ARTIFACT_DIR, '05_search_results_filtered.png');
    await page.screenshot({ path: shot5, fullPage: false });
    console.log('📸 Captured:', shot5);

    // ----------------------------------------------------
    // MILESTONE 3: Listing Detail Page Inspection
    // ----------------------------------------------------
    console.log('\n📍 Milestone 3: Listing Detail Page Inspection (/ar/listing/open-market-7277086)...');
    await page.goto('http://localhost:3001/ar/listing/open-market-7277086', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot6 = path.join(ARTIFACT_DIR, '06_listing_detail_header.png');
    await page.screenshot({ path: shot6, fullPage: false });
    console.log('📸 Captured:', shot6);

    // Scroll down to inspect specs, features, dealer card, and finance calculator
    console.log('👀 Scrolling down listing specs and features...');
    await page.mouse.wheel(0, 600);
    await delay(1500);

    const shot7 = path.join(ARTIFACT_DIR, '07_listing_specs_features.png');
    await page.screenshot({ path: shot7, fullPage: false });
    console.log('📸 Captured:', shot7);

    // ----------------------------------------------------
    // MILESTONE 4: Dealers Directory Inspection
    // ----------------------------------------------------
    console.log('\n📍 Milestone 4: Dealers Directory Inspection (/ar/dealers)...');
    await page.goto('http://localhost:3001/ar/dealers', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot8 = path.join(ARTIFACT_DIR, '08_dealers_directory.png');
    await page.screenshot({ path: shot8, fullPage: false });
    console.log('📸 Captured:', shot8);

    // ----------------------------------------------------
    // MILESTONE 5: Catalogue & Makes Index Inspection
    // ----------------------------------------------------
    console.log('\n📍 Milestone 5: Catalogue & Makes Index (/ar/catalogue/makes)...');
    await page.goto('http://localhost:3001/ar/catalogue/makes', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot9 = path.join(ARTIFACT_DIR, '09_catalogue_makes.png');
    await page.screenshot({ path: shot9, fullPage: false });
    console.log('📸 Captured:', shot9);

    // ----------------------------------------------------
    // MILESTONE 6: Vehicle Comparison Workspace
    // ----------------------------------------------------
    console.log('\n📍 Milestone 6: Vehicle Comparison Workspace (/ar/compare)...');
    await page.goto('http://localhost:3001/ar/compare', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot10 = path.join(ARTIFACT_DIR, '10_compare_workspace.png');
    await page.screenshot({ path: shot10, fullPage: false });
    console.log('📸 Captured:', shot10);

    // ----------------------------------------------------
    // MILESTONE 7: English Language (LTR Layout) Test
    // ----------------------------------------------------
    console.log('\n📍 Milestone 7: English LTR Version (/en)...');
    await page.goto('http://localhost:3001/en', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot11 = path.join(ARTIFACT_DIR, '11_homepage_english_ltr.png');
    await page.screenshot({ path: shot11, fullPage: false });
    console.log('📸 Captured:', shot11);

    // ----------------------------------------------------
    // MILESTONE 8: Mobile Responsive Viewport (iPhone 14 / 390x844)
    // ----------------------------------------------------
    console.log('\n📍 Milestone 8: Mobile Responsive Viewport (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3001/ar', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot12 = path.join(ARTIFACT_DIR, '12_mobile_homepage.png');
    await page.screenshot({ path: shot12, fullPage: false });
    console.log('📸 Captured:', shot12);

    // Scroll on mobile
    await page.mouse.wheel(0, 500);
    await delay(1200);

    const shot13 = path.join(ARTIFACT_DIR, '13_mobile_listings_scroll.png');
    await page.screenshot({ path: shot13, fullPage: false });
    console.log('📸 Captured:', shot13);

    // Mobile Search page
    console.log('📍 Mobile Search Viewport (/ar/search)...');
    await page.goto('http://localhost:3001/ar/search', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const shot14 = path.join(ARTIFACT_DIR, '14_mobile_search.png');
    await page.screenshot({ path: shot14, fullPage: false });
    console.log('📸 Captured:', shot14);

    console.log('\n=========================================');
    console.log('📊 Diagnostic Summary:');
    console.log(`- Total Screenshots Captured: 14`);
    console.log(`- Console Warnings/Errors: ${consoleLogs.length}`);
    if (consoleLogs.length > 0) {
      consoleLogs.slice(0, 10).forEach(log => console.log(`   ${log}`));
    }
    console.log(`- Failed Network Requests: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
      failedRequests.slice(0, 10).forEach(req => console.log(`   ${req}`));
    }
    console.log('=========================================\n');

    console.log('✅ Human test completed successfully!');
  } catch (error) {
    console.error('❌ Human test error:', error);
  } finally {
    await browser.close();
  }
})();
