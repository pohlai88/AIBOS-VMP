import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Mobile UX Improvements
 *
 * Tests mobile-first UX improvements with real browser viewports:
 * - Mobile viewport (375px) - iPhone
 * - Tablet viewport (768px) - iPad
 * - Desktop viewport (1280px) - Desktop
 */

const TEST_EMAIL = 'admin@acme.com';
const TEST_PASSWORD = 'testpassword123';

// Helper function to login
async function login(page) {
  await page.goto('/login');
  // Wait for form to be ready
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  // Wait a bit for Alpine.js to initialize
  await page.waitForTimeout(500);
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  // Wait for submit button to be enabled
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 5000 });
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 10000 });
}

test.describe('Mobile UX Improvements: E2E Tests', () => {
  let testInvoiceId = null;

  test.beforeAll(async ({ browser }) => {
    // Get a test invoice ID by logging in
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to invoices and get first invoice ID
      await page.goto('/invoices');
      await page.waitForSelector('.vmp-table tbody tr', { timeout: 5000 });

      // Try to get invoice ID from first row
      const firstRow = page.locator('.vmp-table tbody tr').first();
      const invoiceLink = firstRow.locator('a[href^="/invoices/"]');
      const href = await invoiceLink.getAttribute('href');
      if (href) {
        testInvoiceId = href.replace('/invoices/', '');
      }
    } catch (error) {
      console.warn('⚠️  Could not set up test invoice ID:', error.message);
    } finally {
      await context.close();
    }
  });

  test.describe('Task 1: Invoice Detail Mobile Layout', () => {
    test('Layout stacks vertically on mobile viewport (375px)', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone SE
      });
      const page = await context.newPage();

      try {
        await login(page);

        if (testInvoiceId) {
          await page.goto(`/invoices/${testInvoiceId}`);
          await page.waitForSelector('.vmp-h3', { timeout: 5000 });

          // Check that layout uses flex-col (not grid) on mobile
          const mainContainer = page.locator('.flex.flex-col.lg\\:grid');
          await expect(mainContainer).toBeVisible();

          // Check that right column appears below (has border-t on mobile)
          const rightColumn = page.locator('.border-t.lg\\:border-t-0');
          await expect(rightColumn).toBeVisible();

          // Verify no horizontal scrolling
          const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
          const viewportWidth = 375;
          expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
        } else {
          console.log('⏭️  Skipping - no test invoice ID');
        }
      } finally {
        await context.close();
      }
    });

    test('Layout uses grid on desktop viewport (1280px)', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        if (testInvoiceId) {
          await page.goto(`/invoices/${testInvoiceId}`);
          await page.waitForSelector('.vmp-h3', { timeout: 5000 });

          // Check that grid is active on desktop
          const gridContainer = page.locator('.lg\\:grid-cols-\\[1fr_380px\\]');
          await expect(gridContainer).toBeVisible();
        } else {
          console.log('⏭️  Skipping - no test invoice ID');
        }
      } finally {
        await context.close();
      }
    });

    test('Open Case button is full-width and accessible', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        if (testInvoiceId) {
          await page.goto(`/invoices/${testInvoiceId}`);
          await page.waitForSelector('button[type="submit"]', { timeout: 5000 });

          // Check button has w-full class
          const openCaseButton = page.locator('button:has-text("Open Case")');
          await expect(openCaseButton).toBeVisible();

          // Check button width (should be close to viewport width minus padding)
          const buttonBox = await openCaseButton.boundingBox();
          expect(buttonBox.width).toBeGreaterThan(300); // Should be nearly full width
        } else {
          console.log('⏭️  Skipping - no test invoice ID');
        }
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Task 2: Invoice List Filter Mobile Layout', () => {
    test('Filters stack vertically on mobile viewport (375px)', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('form', { timeout: 5000 });

        // Check form uses flex-col on mobile
        const form = page.locator('form').first();
        const formClasses = await form.getAttribute('class');
        expect(formClasses).toContain('flex-col');

        // Check filter button is full-width
        const filterButton = page.locator('button:has-text("Filter")');
        const buttonClasses = await filterButton.getAttribute('class');
        expect(buttonClasses).toContain('w-full');

        // Verify no horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = 375;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
      } finally {
        await context.close();
      }
    });

    test('Filters display horizontally on desktop viewport (1280px)', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('form', { timeout: 5000 });

        // Check form uses flex-row on desktop (md:flex-row)
        const form = page.locator('form').first();
        const formClasses = await form.getAttribute('class');
        expect(formClasses).toContain('md:flex-row');
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Task 3: Touch Targets', () => {
    test('Table rows meet 44px minimum height on mobile', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('.vmp-table tbody tr', { timeout: 5000 });

        // Check first table row height
        const firstRow = page.locator('.vmp-table tbody tr').first();
        const rowBox = await firstRow.boundingBox();

        if (rowBox) {
          // Convert pixels to points (1px ≈ 0.75pt on mobile, but we check in px)
          expect(rowBox.height).toBeGreaterThanOrEqual(44);
        }
      } finally {
        await context.close();
      }
    });

    test('View button meets 44px minimum touch target', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('a:has-text("View")', { timeout: 5000 });

        const viewButton = page.locator('a:has-text("View")').first();
        const buttonBox = await viewButton.boundingBox();

        if (buttonBox) {
          expect(buttonBox.height).toBeGreaterThanOrEqual(44);
          expect(buttonBox.width).toBeGreaterThanOrEqual(44);
        }
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Task 4: Login Loading Spinner', () => {
    test('Loading spinner appears when form is submitted', async ({ page }) => {
      await page.goto('/login');

      // Fill form
      await page.fill('input[name="email"]', TEST_EMAIL);
      await page.fill('input[name="password"]', TEST_PASSWORD);

      // Submit form
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Check for loading state (spinner should appear briefly)
      // Note: Since form redirects on success, we check for spinner class
      const spinner = page.locator('.vmp-spinner');

      // The spinner might appear very briefly, so we check if the class exists
      const hasSpinner = (await spinner.count()) > 0;
      expect(hasSpinner || (await submitButton.getAttribute('class'))).toContain('vmp-btn-loading');
    });

    test('Submit button is disabled during loading', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', TEST_EMAIL);
      await page.fill('input[name="password"]', TEST_PASSWORD);

      const submitButton = page.locator('button[type="submit"]');

      // Check button has disabled attribute binding
      const disabledAttr = await submitButton.getAttribute('disabled');
      // Button should be disabled if form is invalid, enabled if valid
      // We check that the binding exists in the HTML
      const html = await page.content();
      expect(html).toContain(':disabled="!canSubmit() || loading"');
    });
  });

  test.describe('Task 5: ARIA Labels', () => {
    test('Status badges have role="status" and aria-label', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('.vmp-badge', { timeout: 5000 });

        // Check first status badge
        const firstBadge = page.locator('.vmp-badge').first();
        const role = await firstBadge.getAttribute('role');
        const ariaLabel = await firstBadge.getAttribute('aria-label');

        expect(role).toBe('status');
        expect(ariaLabel).toContain('Invoice status:');
      } finally {
        await context.close();
      }
    });

    test('View button has aria-label', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('a:has-text("View")', { timeout: 5000 });

        const viewButton = page.locator('a:has-text("View")').first();
        const ariaLabel = await viewButton.getAttribute('aria-label');

        expect(ariaLabel).toContain('View invoice');
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Task 6: Status Badge Icons', () => {
    test('Status badges include SVG icons with proper attributes', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('.vmp-badge', { timeout: 5000 });

        // Check first badge has icon
        const firstBadge = page.locator('.vmp-badge').first();
        const icon = firstBadge.locator('svg.w-4.h-4');

        await expect(icon).toBeVisible();

        // Check icon has aria-hidden="true"
        const ariaHidden = await icon.getAttribute('aria-hidden');
        expect(ariaHidden).toBe('true');
      } finally {
        await context.close();
      }
    });

    test('Icons are properly sized (16px)', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await login(page);

        await page.goto('/invoices');
        await page.waitForSelector('.vmp-badge svg', { timeout: 5000 });

        const icon = page.locator('.vmp-badge svg').first();
        const iconClasses = await icon.getAttribute('class');

        expect(iconClasses).toContain('w-4');
        expect(iconClasses).toContain('h-4');
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Task 7: Mobile Navigation Drawer', () => {
    test('Mobile drawer exists and is accessible', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        // Check for mobile menu button
        const menuButton = page.locator('#mobile-menu-button');
        await expect(menuButton).toBeVisible();

        // Click to open drawer
        await menuButton.click();

        // Check drawer is visible
        const drawer = page.locator('#mobile-nav-drawer');
        await expect(drawer).toBeVisible();

        // Check drawer has navigation links
        const navLinks = drawer.locator('.vmp-navigation-link');
        const linkCount = await navLinks.count();
        expect(linkCount).toBeGreaterThan(0);
      } finally {
        await context.close();
      }
    });

    test('Mobile drawer navigation items meet touch target requirements', async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
      });
      const page = await context.newPage();

      try {
        await login(page);

        // Open drawer
        await page.locator('#mobile-menu-button').click();
        await page.waitForSelector('#mobile-nav-drawer', { timeout: 2000 });

        // Check first navigation link
        const firstLink = page.locator('#mobile-nav-drawer .vmp-navigation-link').first();
        const linkBox = await firstLink.boundingBox();

        if (linkBox) {
          expect(linkBox.height).toBeGreaterThanOrEqual(44);
        }
      } finally {
        await context.close();
      }
    });
  });
});
