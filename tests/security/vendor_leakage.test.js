import request from 'supertest';
import app from '../../server.js';

// Skeleton leak tests: start as skipped to avoid breaking CI until fixtures/sessions are wired.
// TODO: replace placeholder IDs/sessions with real test fixtures and remove .skip.

describe.skip('Vendor leakage hardening', () => {
  it('denies vendor access to other tenant/vendor partials (no side effects)', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .get(`/vendor/partials/case-thread.html?case_id=${forbiddenCaseId}`)
      // TODO: set auth headers or cookies for Vendor A session
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a');

    expect([403, 404]).toContain(res.status);
    // TODO: assert no events/audit/status change once fixtures are wired
  });

  it('denies cross-tenant decision POST with zero side effects', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .post(`/cases/${forbiddenCaseId}/update`)
      // TODO: set auth headers or cookies for Vendor A session
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a')
      .send({ action: 'APPROVE', reason: 'test' });

    expect([403, 404]).toContain(res.status);
    // TODO: assert no events/audit/status change once fixtures are wired
  });

  it('denies cross-vendor evidence upload', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .post(`/cases/${forbiddenCaseId}/evidence`)
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a')
      .field('evidence_type', 'invoice_pdf');
      // .attach('file', Buffer.from('dummy'), 'dummy.pdf') // enable when fixture auth is ready

    expect([403, 404]).toContain(res.status);
  });

  it('denies cross-vendor document upload', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .post(`/cases/${forbiddenCaseId}/documents`)
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a')
      .field('note', 'test-doc');
      // .attach('document', Buffer.from('dummy'), 'dummy.pdf') // enable when fixture auth is ready

    expect([403, 404]).toContain(res.status);
  });

  it('denies vendor access to other vendor case detail', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .get(`/vendor/partials/case-detail.html?case_id=${forbiddenCaseId}`)
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a');

    expect([403, 404]).toContain(res.status);
  });

  it('denies vendor access to other vendor case activity', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .get(`/vendor/partials/case-activity.html?case_id=${forbiddenCaseId}`)
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a');

    expect([403, 404]).toContain(res.status);
  });

  it('denies vendor access to other vendor case checklist', async () => {
    const forbiddenCaseId = '00000000-0000-0000-0000-000000000000'; // replace with fixture

    const res = await request(app)
      .get(`/vendor/partials/case-checklist.html?case_id=${forbiddenCaseId}`)
      .set('x-test-auth', 'bypass')
      .set('x-test-user-id', 'vendor-a-user')
      .set('x-test-vendor-id', 'vendor-a');

    expect([403, 404]).toContain(res.status);
  });
});
