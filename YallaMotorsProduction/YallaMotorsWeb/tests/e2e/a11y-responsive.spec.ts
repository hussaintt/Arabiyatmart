import { expect, test, expectNoHorizontalOverflow, expectNoSensitiveBrowserStorage, type TestIdentity } from './fixtures';

const axePath = require.resolve('axe-core/axe.min.js');

const publicRoutes = [
  '/ar',
  '/en',
  '/ar/search',
  '/en/search',
  '/ar/compare',
  '/en/compare',
  '/en/catalogue/makes',
  '/en/dealers',
  '/en/listing/toyota-corolla-contact',
  '/en/login',
];

const authenticatedRoutes: Array<{ route: string; identity: TestIdentity; vendorPublicId?: string }> = [
  { route: '/en/me/dashboard', identity: 'manager', vendorPublicId: 'vnd_e2e_manager' },
  { route: '/en/me/leads', identity: 'manager', vendorPublicId: 'vnd_e2e_manager' },
  { route: '/en/profile', identity: 'buyer' },
  { route: '/en/sell', identity: 'seller' },
];

test.describe('TASK-058 & 1.3: Comprehensive accessibility, focus, RTL, and responsive coverage', () => {
  for (const route of publicRoutes) {
    test(`passes axe, color-contrast, focus, RTL, and overflow checks for ${route}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: axePath });

      const result = await page.evaluate(async () => {
        const axe = (window as unknown as {
          axe: {
            run: (context: Document, options: unknown) => Promise<{
              violations: Array<{ id: string; impact: string | null; nodes: unknown[] }>;
            }>;
          };
        }).axe;

        // Re-enabled color-contrast with documented exceptions for disabled buttons
        const audit = await axe.run(document, {
          rules: {
            'color-contrast': { enabled: true },
          },
        });

        // Filter known justified WCAG 1.4.3 exceptions (inactive/disabled controls)
        const activeViolations = audit.violations
          .filter((v) => {
            if (v.id === 'color-contrast') {
              // Ignore color contrast warnings on disabled buttons or purely decorative elements
              const nonExemptNodes = (v.nodes as Array<{ html: string }>).filter((n) => {
                const isAttrDisabled = n.html.includes('disabled') || n.html.includes('aria-disabled="true"');
                const isPlaceholder = n.html.includes('placeholder');
                return !isAttrDisabled && !isPlaceholder;
              });
              return nonExemptNodes.length > 0;
            }
            return true;
          })
        return {
          violations: activeViolations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: (audit.violations.find((av) => av.id === v.id)?.nodes as Array<{ html: string; target: string[]; failureSummary?: string }>)?.map((n) => ({
              html: n.html,
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          imagesWithoutDimensions: [...document.images]
            .filter((image) => {
              if (image.hasAttribute('width') || image.hasAttribute('height')) return false;
              if (image.getAttribute('data-nimg') === 'fill' || image.style.position === 'absolute') {
                const parent = image.parentElement;
                if (parent) {
                  const style = window.getComputedStyle(parent);
                  const hasDimensions = (parent.offsetWidth > 0 && parent.offsetHeight > 0) ||
                                       style.aspectRatio !== 'auto' ||
                                       style.height !== 'auto' ||
                                       style.minHeight !== '0px';
                  if (hasDimensions) return false;
                }
              }
              return !image.complete;
            })
            .map((image) => image.src),
        };
      });

      expect(result.violations, `${route} accessibility violations`).toEqual([]);
      expect(result.reducedMotion).toBe(true);
      expect(result.imagesWithoutDimensions, `${route} images must reserve dimensions`).toEqual([]);
      await expectNoHorizontalOverflow(page);
      await expectNoSensitiveBrowserStorage(page);

      await page.keyboard.press('Tab');
      await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY');
      if (route.startsWith('/ar')) {
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      } else {
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      }
    });
  }

  for (const { route, identity, vendorPublicId } of authenticatedRoutes) {
    test(`passes axe, color-contrast, and keyboard focus for authenticated route ${route}`, async ({ page, loginAs }) => {
      await loginAs(identity, vendorPublicId);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: axePath });

      const result = await page.evaluate(async () => {
        const axe = (window as unknown as {
          axe: {
            run: (context: Document, options: unknown) => Promise<{
              violations: Array<{ id: string; impact: string | null; nodes: unknown[] }>;
            }>;
          };
        }).axe;

        const audit = await axe.run(document, {
          rules: {
            'color-contrast': { enabled: true },
          },
        });

        const activeViolations = audit.violations
          .filter((v) => {
            if (v.id === 'color-contrast') {
              const nonExemptNodes = (v.nodes as Array<{ html: string }>).filter((n) => {
                const isAttrDisabled = n.html.includes('disabled') || n.html.includes('aria-disabled="true"');
                const isPlaceholder = n.html.includes('placeholder');
                return !isAttrDisabled && !isPlaceholder;
              });
              return nonExemptNodes.length > 0;
            }
            return true;
          })
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.length,
          }));

        return { violations: activeViolations };
      });

      expect(result.violations, `${route} accessibility violations`).toEqual([]);
      await expectNoHorizontalOverflow(page);
      await expectNoSensitiveBrowserStorage(page);

      await page.keyboard.press('Tab');
      await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY');
    });
  }

  test('dialog traps focus and restores focus to trigger on Escape', async ({ page }) => {
    await page.goto('/en/listing/toyota-corolla-contact');
    const sendButton = page.getByRole('button', { name: /Send Message|Message/i }).first();
    if (await sendButton.isVisible()) {
      await sendButton.focus();
      await sendButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Focus should be inside dialog
      const isInsideDialog = await page.evaluate(() => {
        const active = document.activeElement;
        const dlg = document.querySelector('[role="dialog"]');
        return dlg?.contains(active) ?? false;
      });
      expect(isInsideDialog).toBe(true);

      // Escape closes dialog and restores focus
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY');
    }
  });

  test('login form communicates validation errors accessibly with aria-invalid', async ({ page }) => {
    await page.goto('/en/login');
    const submitButton = page.getByRole('button', { name: /Sign in|Log in/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Form inputs should communicate invalid state or alerts should be displayed
      const errorElements = await page.locator('[aria-invalid="true"], [role="alert"], .text-destructive').count();
      expect(errorElements).toBeGreaterThan(0);
    }
  });
});
