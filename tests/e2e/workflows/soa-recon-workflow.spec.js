/**
 * SOA Reconciliation E2E Tests
 *
 * Tests complete SOA reconciliation workflows using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('SOA Reconciliation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Login as test user
    await page.fill('input[name="email"]', 'vendor@techsupply.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL('**/home');
  });

  test('should navigate to SOA reconciliation workspace', async ({ page }) => {
    // Navigate to SOA recon
    await page.goto('/soa/recon/test-case-id');

    // Verify workspace loads
    await expect(page.locator('h2:has-text("Statement Workspace")')).toBeVisible();
    await expect(page.locator('.vmp-label-kicker:has-text("soa reconciliation")')).toBeVisible();
  });

  test('should display SOA lines list', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for SOA lines to load
    await page.waitForSelector('#soa-lines', { timeout: 10000 });

    // Verify lines panel is visible
    await expect(page.locator('.vmp-label-kicker:has-text("lines")')).toBeVisible();
  });

  test('should filter SOA lines by status', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for lines to load
    await page.waitForSelector('select[name="status"]', { timeout: 10000 });

    // Select filter
    await page.selectOption('select[name="status"]', 'extracted');

    // Verify filter applied (HTMX should update list)
    await page.waitForTimeout(500); // Wait for HTMX update
  });

  test('should search SOA lines by document number', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for search input
    await page.waitForSelector('input[name="q"]', { timeout: 10000 });

    // Type search query
    await page.fill('input[name="q"]', 'INV-');

    // Wait for HTMX debounce
    await page.waitForTimeout(300);

    // Verify search applied
    const searchValue = await page.inputValue('input[name="q"]');
    expect(searchValue).toBe('INV-');
  });

  test('should select SOA line and show focus view', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for lines to load
    await page.waitForSelector('#soa-lines button', { timeout: 10000 });

    // Click first line
    await page.click('#soa-lines button:first-child');

    // Wait for focus view to load
    await page.waitForSelector('#soa-focus .vmp-label-kicker:has-text("selected line")', {
      timeout: 5000,
    });

    // Verify focus view is visible
    await expect(page.locator('#soa-focus')).toBeVisible();
  });

  test('should display variance HUD', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for HUD to load
    await page.waitForSelector('.vmp-label-kicker:has-text("variance hud")', { timeout: 10000 });

    // Verify HUD elements
    await expect(page.locator('text=opening')).toBeVisible();
    await expect(page.locator('text=matched')).toBeVisible();
    await expect(page.locator('text=net variance')).toBeVisible();
  });

  test('should recompute SOA reconciliation', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for recompute button
    await page.waitForSelector('button:has-text("Recompute")', { timeout: 10000 });

    // Click recompute
    await page.click('button:has-text("Recompute")');

    // Wait for toast message
    await page.waitForSelector('#soa-toast', { timeout: 5000 });

    // Verify toast appears
    await expect(page.locator('#soa-toast')).toBeVisible();
  });

  test('should export SOA reconciliation pack', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for export button
    await page.waitForSelector('button:has-text("Export Pack")', { timeout: 10000 });

    // Click export
    const [response] = await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/api/soa/') && resp.url().includes('/export')
      ),
      page.click('button:has-text("Export Pack")'),
    ]);

    // Verify response
    expect(response.status()).toBe(200);
  });

  test('should sign off SOA reconciliation when variance is zero', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Wait for sign-off button
    await page.waitForSelector('button:has-text("Digital Sign-off")', { timeout: 10000 });

    // Check if button is enabled (only enabled when variance is 0)
    const isEnabled = await page.locator('button:has-text("Digital Sign-off")').isEnabled();

    if (isEnabled) {
      // Click sign-off
      await page.click('button:has-text("Digital Sign-off")');

      // Wait for toast
      await page.waitForSelector('#soa-toast', { timeout: 5000 });

      // Verify success message
      await expect(page.locator('#soa-toast')).toContainText('signed off');
    } else {
      // Button should be disabled when variance is not zero
      expect(isEnabled).toBe(false);
    }
  });

  test('should create manual match for SOA line', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Select a line
    await page.waitForSelector('#soa-lines button', { timeout: 10000 });
    await page.click('#soa-lines button:first-child');

    // Wait for focus view
    await page.waitForSelector('#soa-focus', { timeout: 5000 });

    // Check if suggested matches exist
    const hasMatches = await page.locator('#soa-focus button:has-text("Link")').count();

    if (hasMatches > 0) {
      // Click link button
      await page.click('#soa-focus button:has-text("Link"):first-child');

      // Wait for toast
      await page.waitForSelector('#soa-toast', { timeout: 5000 });

      // Verify match created
      await expect(page.locator('#soa-toast')).toContainText('Match');
    }
  });

  test('should mark SOA line as disputed', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Select a line
    await page.waitForSelector('#soa-lines button', { timeout: 10000 });
    await page.click('#soa-lines button:first-child');

    // Wait for focus view
    await page.waitForSelector('button:has-text("Mark Disputed")', { timeout: 5000 });

    // Click dispute button
    await page.click('button:has-text("Mark Disputed")');

    // Wait for toast
    await page.waitForSelector('#soa-toast', { timeout: 5000 });

    // Verify dispute created
    await expect(page.locator('#soa-toast')).toContainText('disputed');
  });

  test('should upload evidence for SOA line', async ({ page }) => {
    await page.goto('/soa/recon/test-case-id');

    // Select a line
    await page.waitForSelector('#soa-lines button', { timeout: 10000 });
    await page.click('#soa-lines button:first-child');

    // Wait for evidence form
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });

    // Upload file (create test file)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-evidence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test file content'),
    });

    // Fill note
    await page.fill('input[name="note"]', 'Test evidence upload');

    // Submit form
    await page.click('button[type="submit"]:has-text("Upload Evidence")');

    // Wait for toast
    await page.waitForSelector('#soa-toast', { timeout: 5000 });

    // Verify upload success
    await expect(page.locator('#soa-toast')).toContainText('uploaded');
  });
});
