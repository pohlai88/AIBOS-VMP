import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '@server';
import { createTestSession, getTestAuthHeaders } from '@tests/helpers/auth-helper.js';
import { vmpAdapter } from '@/adapters/supabase.js';

/**
 * Mobile UX Improvements Test Suite
 *
 * Tests the mobile-first UX improvements for Journey 1 - Supplier:
 * - Task 1: Invoice Detail Mobile Layout Stacking
 * - Task 2: Invoice List Filter Mobile Layout
 * - Task 3: Invoice Row Touch Targets
 * - Task 4: Login Loading Spinner
 * - Task 5: ARIA Labels for Status Indicators
 * - Task 6: Status Badge Icons
 */

describe('Mobile UX Improvements: Invoice Detail Layout', () => {
  let mockSessionId = null;
  let mockUserId = null;
  let mockVendorId = null;
  let mockInvoiceId = null;
  let authHeaders = null;

  beforeAll(async () => {
    // Get demo vendor ID
    const demoVendorId = process.env.DEMO_VENDOR_ID;
    if (!demoVendorId) {
      console.warn('⚠️  DEMO_VENDOR_ID not set - some tests may fail');
      return;
    }
    mockVendorId = demoVendorId;

    // Get test user
    try {
      const vendorUsers = await vmpAdapter.getVendorUsers(mockVendorId);
      if (vendorUsers && vendorUsers.length > 0) {
        mockUserId = vendorUsers[0].id;
        authHeaders = getTestAuthHeaders(mockUserId, mockVendorId);
      }
    } catch (error) {
      console.warn('⚠️  Could not get test user:', error.message);
    }

    // Get test invoice
    try {
      const invoices = await vmpAdapter.getInvoices(mockVendorId);
      if (invoices && invoices.length > 0) {
        mockInvoiceId = invoices[0].id;
      }
    } catch (error) {
      console.warn('⚠️  Could not get test invoice:', error.message);
    }
  });

  test('Task 1: Invoice detail uses flex-col on mobile, grid on desktop', async () => {
    if (!mockInvoiceId || !authHeaders) {
      console.log('⏭️  Skipping - no test invoice or auth');
      return;
    }

    const response = await request(app)
      .get(`/invoices/${mockInvoiceId}`)
      .set(authHeaders)
      .expect(200);

    const html = response.text;

    // Check for flex-col lg:grid pattern
    expect(html).toContain('flex flex-col lg:grid lg:grid-cols-[1fr_380px]');

    // Check for responsive borders
    expect(html).toContain('border-r-0 lg:border-r');
    expect(html).toContain('border-b lg:border-b-0');
    expect(html).toContain('border-t lg:border-t-0 lg:border-l');

    // Check for gap spacing
    expect(html).toContain('gap-6');
  });

  test('Task 1: Open Case button remains full-width', async () => {
    if (!mockInvoiceId || !authHeaders) {
      console.log('⏭️  Skipping - no test invoice or auth');
      return;
    }

    const response = await request(app)
      .get(`/invoices/${mockInvoiceId}`)
      .set(authHeaders)
      .expect(200);

    const html = response.text;

    // Check button has w-full class
    expect(html).toMatch(/class="[^"]*vmp-btn-primary[^"]*w-full[^"]*"/);
  });
});

describe('Mobile UX Improvements: Invoice List Filter', () => {
  let mockVendorId = null;
  let authHeaders = null;

  beforeAll(async () => {
    const demoVendorId = process.env.DEMO_VENDOR_ID;
    if (!demoVendorId) {
      console.warn('⚠️  DEMO_VENDOR_ID not set - some tests may fail');
      return;
    }
    mockVendorId = demoVendorId;

    try {
      const vendorUsers = await vmpAdapter.getVendorUsers(mockVendorId);
      if (vendorUsers && vendorUsers.length > 0) {
        const mockUserId = vendorUsers[0].id;
        authHeaders = getTestAuthHeaders(mockUserId, mockVendorId);
      }
    } catch (error) {
      console.warn('⚠️  Could not get test user:', error.message);
    }
  });

  test('Task 2: Filter form stacks vertically on mobile', async () => {
    if (!authHeaders) {
      console.log('⏭️  Skipping - no auth');
      return;
    }

    const response = await request(app).get('/invoices').set(authHeaders).expect(200);

    const html = response.text;

    // Check for flex-col md:flex-row pattern
    expect(html).toContain('flex flex-col md:flex-row');
    expect(html).toContain('items-stretch md:items-center');

    // Check input has flex-1
    expect(html).toMatch(/class="[^"]*vmp-form-input[^"]*flex-1[^"]*"/);

    // Check select has flex-1 md:flex-none
    expect(html).toContain('flex-1 md:flex-none');

    // Check button has w-full md:w-auto
    expect(html).toContain('w-full md:w-auto');
  });
});

describe('Mobile UX Improvements: Touch Targets', () => {
  test('Task 3: CSS includes mobile touch target rules', async () => {
    const fs = await import('fs/promises');
    const globalsCss = await fs.readFile('public/globals.css', 'utf-8');

    // Check for mobile media query
    expect(globalsCss).toContain('@media (max-width: 768px)');

    // Check for table row min-height
    expect(globalsCss).toContain('.vmp-table tbody tr');
    expect(globalsCss).toContain('min-height: 44px');

    // Check for table cell padding
    expect(globalsCss).toContain('.vmp-table tbody td');
    expect(globalsCss).toContain('padding: var(--vmp-space-4) var(--vmp-space-3)');
  });
});

describe('Mobile UX Improvements: Login Form', () => {
  test('Task 4: Login form includes loading state', async () => {
    const response = await request(app).get('/login').expect(200);

    const html = response.text;

    // Check for loading state in Alpine.js data
    expect(html).toContain('loading: false');
    expect(html).toContain('handleSubmit()');

    // Check for disabled attribute binding
    expect(html).toContain(':disabled="!canSubmit() || loading"');

    // Check for loading class binding
    expect(html).toContain(':class="{ \'vmp-btn-loading\': loading }"');

    // Check for spinner
    expect(html).toContain('vmp-spinner');
    expect(html).toContain('x-show="loading"');

    // Check for loading text
    expect(html).toContain('Authenticating...');
  });
});

describe('Mobile UX Improvements: ARIA Labels', () => {
  let mockVendorId = null;
  let authHeaders = null;
  let mockInvoiceId = null;

  beforeAll(async () => {
    const demoVendorId = process.env.DEMO_VENDOR_ID;
    if (!demoVendorId) {
      console.warn('⚠️  DEMO_VENDOR_ID not set - some tests may fail');
      return;
    }
    mockVendorId = demoVendorId;

    try {
      const vendorUsers = await vmpAdapter.getVendorUsers(mockVendorId);
      if (vendorUsers && vendorUsers.length > 0) {
        const mockUserId = vendorUsers[0].id;
        authHeaders = getTestAuthHeaders(mockUserId, mockVendorId);
      }

      const invoices = await vmpAdapter.getInvoices(mockVendorId);
      if (invoices && invoices.length > 0) {
        mockInvoiceId = invoices[0].id;
      }
    } catch (error) {
      console.warn('⚠️  Could not get test data:', error.message);
    }
  });

  test('Task 5: Invoice list status badges have ARIA labels', async () => {
    if (!authHeaders) {
      console.log('⏭️  Skipping - no auth');
      return;
    }

    const response = await request(app).get('/invoices').set(authHeaders).expect(200);

    const html = response.text;

    // Check for role="status"
    expect(html).toContain('role="status"');

    // Check for aria-label with status text
    expect(html).toMatch(/aria-label="Invoice status: (Paid|Pending|Matched|Disputed)"/);
  });

  test('Task 5: Invoice detail status badges have ARIA labels', async () => {
    if (!mockInvoiceId || !authHeaders) {
      console.log('⏭️  Skipping - no test invoice or auth');
      return;
    }

    const response = await request(app)
      .get(`/invoices/${mockInvoiceId}`)
      .set(authHeaders)
      .expect(200);

    const html = response.text;

    // Check for role="status"
    expect(html).toContain('role="status"');

    // Check for aria-label
    expect(html).toMatch(/aria-label="Invoice status: (Paid|Pending|Disputed)"/);
  });

  test('Task 5: View button has ARIA label', async () => {
    if (!authHeaders) {
      console.log('⏭️  Skipping - no auth');
      return;
    }

    const response = await request(app).get('/invoices').set(authHeaders).expect(200);

    const html = response.text;

    // Check for aria-label on View button
    expect(html).toMatch(/aria-label="View invoice/);
  });

  test('Task 5: Open Case button has ARIA label', async () => {
    if (!mockInvoiceId || !authHeaders) {
      console.log('⏭️  Skipping - no test invoice or auth');
      return;
    }

    const response = await request(app)
      .get(`/invoices/${mockInvoiceId}`)
      .set(authHeaders)
      .expect(200);

    const html = response.text;

    // Check for aria-label on Open Case button
    expect(html).toMatch(/aria-label="Open case for invoice/);
  });
});

describe('Mobile UX Improvements: Status Badge Icons', () => {
  let mockVendorId = null;
  let authHeaders = null;
  let mockInvoiceId = null;

  beforeAll(async () => {
    const demoVendorId = process.env.DEMO_VENDOR_ID;
    if (!demoVendorId) {
      console.warn('⚠️  DEMO_VENDOR_ID not set - some tests may fail');
      return;
    }
    mockVendorId = demoVendorId;

    try {
      const vendorUsers = await vmpAdapter.getVendorUsers(mockVendorId);
      if (vendorUsers && vendorUsers.length > 0) {
        const mockUserId = vendorUsers[0].id;
        authHeaders = getTestAuthHeaders(mockUserId, mockVendorId);
      }

      const invoices = await vmpAdapter.getInvoices(mockVendorId);
      if (invoices && invoices.length > 0) {
        mockInvoiceId = invoices[0].id;
      }
    } catch (error) {
      console.warn('⚠️  Could not get test data:', error.message);
    }
  });

  test('Task 6: Status badges include icons with proper attributes', async () => {
    if (!authHeaders) {
      console.log('⏭️  Skipping - no auth');
      return;
    }

    const response = await request(app).get('/invoices').set(authHeaders).expect(200);

    const html = response.text;

    // Check for SVG icons
    expect(html).toContain('<svg class="w-4 h-4"');

    // Check for aria-hidden="true" on icons
    expect(html).toContain('aria-hidden="true"');

    // Check for checkmark icon (PAID)
    expect(html).toContain('d="M5 13l4 4L19 7"');

    // Check for clock icon (PENDING)
    expect(html).toContain('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z');

    // Check for alert icon (DISPUTED)
    expect(html).toContain('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3');
  });

  test('Task 6: Invoice detail status badges include icons', async () => {
    if (!mockInvoiceId || !authHeaders) {
      console.log('⏭️  Skipping - no test invoice or auth');
      return;
    }

    const response = await request(app)
      .get(`/invoices/${mockInvoiceId}`)
      .set(authHeaders)
      .expect(200);

    const html = response.text;

    // Check for SVG icons
    expect(html).toContain('<svg class="w-4 h-4"');

    // Check for aria-hidden="true"
    expect(html).toContain('aria-hidden="true"');
  });
});
