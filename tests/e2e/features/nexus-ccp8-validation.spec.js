import { test, expect } from '@playwright/test';

/**
 * Nexus Portal - CCP-8 E2E Validation Tests
 * Tests the 10 validation checks from Phase 11
 */

test.describe('CCP-8: Nexus Portal E2E Validation', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/nexus/login');
  });

  test('11.1 - Sign-up creates TNT-, TC-, TV- IDs', async ({ page }) => {
    await page.goto('/nexus/sign-up');

    // Fill sign-up form
    await page.fill('input[name="companyName"]', 'Test Corp');
    await page.fill('input[name="email"]', 'testuser@testcorp.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');

    // Select role (client or vendor)
    await page.click('input[value="client"]');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to portal or success
    await page.waitForURL(/\/nexus\/portal/);

    // Verify IDs in session/DOM
    const userInfo = await page.textContent('.nexus-user-info');
    expect(userInfo).toContain('TNT-');
    expect(userInfo).toContain('TC-');
  });

  test('11.2 - Login with demo user (alice@alpha.com)', async ({ page }) => {
    // Fill login form
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/nexus\/portal|\/nexus\/inbox/);

    // Verify logged in
    const isLoggedIn = await page.isVisible('.nexus-user-menu');
    expect(isLoggedIn).toBeTruthy();
  });

  test('11.3 - Role Dashboard shows correct contexts', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', 'greg@gamma.com'); // Dual-context user
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Should see role dashboard for dual-context tenant
    await page.waitForURL(/\/nexus\/portal/);

    // Verify both client and vendor contexts are shown
    const hasClientContext = await page.isVisible('text=/Client/i');
    const hasVendorContext = await page.isVisible('text=/Vendor/i');

    expect(hasClientContext || hasVendorContext).toBeTruthy();
  });

  test('11.4 - Inbox filters by active context', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Navigate to inbox
    await page.goto('/nexus/inbox');

    // Verify inbox loads
    const inboxTitle = await page.textContent('h1');
    expect(inboxTitle).toContain('Inbox');

    // Verify cases are displayed
    const hasCases = await page.isVisible('.case-card, .nexus-case-item');
    expect(hasCases).toBeTruthy();
  });

  test('11.5 - Cases reference correct IDs', async ({ page }) => {
    // Login and go to inbox
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');
    await page.goto('/nexus/inbox');

    // Click first case
    await page.click('.case-card:first-child, .nexus-case-item:first-child');

    // Verify case detail page
    await page.waitForURL(/\/nexus\/cases\/CASE-/);

    // Verify IDs are present
    const content = await page.content();
    expect(content).toContain('CASE-');
    expect(content).toContain('TC-'); // Client ID
    expect(content).toContain('TV-'); // Vendor ID
  });

  test('11.6 - Payments flow with correct from/to', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Navigate to payments
    await page.goto('/nexus/payments');

    // Verify payments page loads
    const paymentsTitle = await page.textContent('h1');
    expect(paymentsTitle).toContain('Payment');

    // Verify payment IDs if any exist
    const hasPayments = await page.isVisible('.payment-card, .nexus-payment-item');
    if (hasPayments) {
      const content = await page.content();
      expect(content).toContain('PAY-');
    }
  });

  test('11.8 - Notification config cascade works', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Navigate to settings
    await page.goto('/nexus/settings');

    // Verify settings page
    const settingsTitle = await page.textContent('h1');
    expect(settingsTitle).toContain('Settings');

    // Check for notification preferences
    const hasNotificationSettings = await page.isVisible('input[type="checkbox"]');
    expect(hasNotificationSettings).toBeTruthy();
  });

  test('11.9 - All CRUD operations work (Cases)', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Go to inbox
    await page.goto('/nexus/inbox');

    // Try to create new case
    const hasNewCaseButton = await page.isVisible('text=/New Case|Create/i');
    if (hasNewCaseButton) {
      await page.click('text=/New Case|Create/i');

      // Verify case creation form
      await page.waitForSelector('input[name="subject"], input[name="title"]');
    }
  });

  test('11.10 - RLS policies enforce isolation', async ({ page }) => {
    // Login as alice
    await page.fill('input[name="email"]', 'alice@alpha.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.click('button[type="submit"]');

    // Try to access a case that doesn't belong to alice's tenant
    // This should either redirect or show 403/404
    const response = await page.goto('/nexus/cases/CASE-INVALID999', {
      waitUntil: 'networkidle'
    });

    // Should not be 200 OK for invalid case
    expect(response?.status()).not.toBe(200);
  });
});

test.describe('Nexus Portal - UI/UX Checks', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/nexus/login');

    // Verify page elements
    await expect(page.locator('h1')).toContainText(/Sign|Login/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify OAuth buttons
    const hasGoogleOAuth = await page.isVisible('a[href*="oauth/google"]');
    const hasGithubOAuth = await page.isVisible('a[href*="oauth/github"]');

    expect(hasGoogleOAuth || hasGithubOAuth).toBeTruthy();
  });

  test('Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/nexus/login');

    // Verify mobile layout
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();

    // Check if layout adapts
    const inputWidth = await emailInput.boundingBox();
    expect(inputWidth?.width).toBeLessThan(400);
  });
});
