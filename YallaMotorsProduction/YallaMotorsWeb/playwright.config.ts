import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'ar-EG',
    timezoneId: 'UTC',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
  ],
  webServer: [
    {
      command: 'node tests/e2e/mock-backend.mjs',
      url: 'http://127.0.0.1:3200/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
    {
      command: 'npm run build:e2e && npm run start -- -p 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PORT: '3100',
        TZ: 'UTC',
        APP_ENV: 'test',
        SITE_ORIGIN: 'http://127.0.0.1:3100',
        NEXT_PUBLIC_SITE_ORIGIN: 'https://e2e.arabiyatmart.test',
        BACKEND_API_ORIGIN: 'http://127.0.0.1:3200',
        NEXT_PUBLIC_API_BASE_URL: 'https://api.e2e.arabiyatmart.test',
        MEDIA_CDN_ORIGIN: 'https://cdn.e2e.arabiyatmart.test',
        NEXT_PUBLIC_MEDIA_CDN_ORIGIN: 'https://cdn.e2e.arabiyatmart.test',
        NEXT_PUBLIC_APP_ENV: 'test',
      },
    },
  ],
});
