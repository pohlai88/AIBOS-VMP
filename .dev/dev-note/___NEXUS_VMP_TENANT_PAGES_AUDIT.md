# Nexus VMP: Tenant-Facing Pages Audit List
**Date:** 2025-01-27  
**Server:** localhost:9000  
**Purpose:** Complete list of all tenant-facing pages for audit and testing

---

## Public Pages (No Authentication Required)

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 1 | `http://localhost:9000/` | `pages/landing.html` | Marketing landing page | Redirects password reset links |
| 2 | `http://localhost:9000/manifesto` | `pages/manifesto.html` | Manifesto page | Marketing content |
| 3 | `http://localhost:9000/nexus/login` | `nexus/pages/login.html` | Login page | Redirects if already logged in |
| 4 | `http://localhost:9000/nexus/sign-up` | `nexus/pages/sign-up.html` | Sign up page | Role selection (client/vendor) |
| 5 | `http://localhost:9000/nexus/forgot-password` | `nexus/pages/forgot-password.html` | Forgot password page | Sends reset email |
| 6 | `http://localhost:9000/nexus/reset-password` | `nexus/pages/reset-password.html` | Reset password page | Requires access_token from email |
| 7 | `http://localhost:9000/nexus/accept` | `nexus/pages/accept.html` | Accept invitation page | Requires token query param |
| 8 | `http://localhost:9000/nexus/oauth/callback` | `nexus/pages/oauth_callback.html` | OAuth callback handler | Handles code/token from OAuth provider |
| 9 | `http://localhost:9000/nexus/complete-profile` | `nexus/pages/complete-profile.html` | OAuth profile completion | First-time OAuth users only |

---

## Portal Pages (Authentication Required)

### Core Portal

| # | URL | Template | Context | Description | Notes |
|---|-----|----------|---------|-------------|-------|
| 10 | `http://localhost:9000/nexus/portal` | `nexus/pages/role-dashboard.html` | Dual-context only | Role selection dashboard | Shows if dual-context tenant, otherwise redirects to inbox |
| 11 | `http://localhost:9000/nexus/inbox` | `nexus/pages/inbox.html` | Any | Unified case inbox | Requires active context |
| 12 | `http://localhost:9000/nexus/cases/:id` | `nexus/pages/case-detail.html` | Any | Case detail page | Requires case access (client or vendor) |
| 13 | `http://localhost:9000/nexus/payments` | `nexus/pages/payments.html` | Any | Payment dashboard | Requires active context |
| 14 | `http://localhost:9000/nexus/payments/:id` | `nexus/pages/payment-detail.html` | Any | Payment detail | Requires payment access (payer or payee) |
| 15 | `http://localhost:9000/nexus/relationships` | `nexus/pages/relationships.html` | Any | Relationship management | Shows vendors (as client) and clients (as vendor) |
| 16 | `http://localhost:9000/nexus/notifications` | `nexus/pages/notifications.html` | Any | Notifications page | All notifications for user |
| 17 | `http://localhost:9000/nexus/settings` | `nexus/pages/settings.html` | Any | Settings page | Notification preferences, tenant config (admin) |

---

## Client Command Center Pages (Client Context Required - TC-*)

### Dashboard & Overview

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 18 | `http://localhost:9000/nexus/client` | `nexus/pages/client-dashboard.html` | Client dashboard | Aggregate metrics: vendors, invoices, payments, cases |
| 19 | `http://localhost:9000/nexus/client/vendors` | `nexus/pages/vendor-directory.html` | Vendor directory | List all vendors (active, pending, inactive) |

### Invoice Management (AP Queue)

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 20 | `http://localhost:9000/nexus/client/invoices` | `nexus/pages/client-invoices.html` | AP Queue (invoice inbox) | Tabs: needs_review, approved, disputed, paid, all |
| 21 | `http://localhost:9000/nexus/client/invoices/:invoice_id` | `nexus/pages/client-invoice-detail.html` | Invoice detail | Shows matching signal (if pilot enabled), line items, payments |

### Payment Management

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 22 | `http://localhost:9000/nexus/client/payments` | `nexus/pages/client-payments.html` | Payment outbox | Payments I have sent/am sending |
| 23 | `http://localhost:9000/nexus/client/payments/:payment_id` | `nexus/pages/client-payment-detail.html` | Payment detail | Single payment view with linked invoice |

### Case Management (Issue Tracker)

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 24 | `http://localhost:9000/nexus/client/cases` | `nexus/pages/client-cases.html` | Issue tracker | Cases where I am the client |
| 25 | `http://localhost:9000/nexus/client/cases/:case_id` | `nexus/pages/client-case-detail.html` | Case detail | Investigation record with timeline, evidence, status transitions |

### Notifications & Document Requests

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 26 | `http://localhost:9000/nexus/client/notifications` | `nexus/pages/client-notifications.html` | Client notifications | Notifications for client context |
| 27 | `http://localhost:9000/nexus/client/document-requests` | `nexus/pages/client-document-requests.html` | Document request list | Requests I created |
| 28 | `http://localhost:9000/nexus/client/document-requests/:id` | `nexus/pages/client-document-request-detail.html` | Document request detail | Review uploaded documents, accept/reject |

---

## Vendor Portal Pages (Vendor Context Required - TV-*)

### Case Management

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 29 | `http://localhost:9000/nexus/vendor/cases/:case_id` | `nexus/pages/vendor-case-detail.html` | Vendor case detail | Cases where I am the vendor |

### Notifications & Document Requests

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 30 | `http://localhost:9000/nexus/vendor/notifications` | `nexus/pages/vendor-notifications.html` | Vendor notifications | Notifications for vendor context |
| 31 | `http://localhost:9000/nexus/vendor/document-requests` | `nexus/pages/vendor-document-requests.html` | Document request inbox | Requests sent to me |
| 32 | `http://localhost:9000/nexus/vendor/document-requests/:id` | `nexus/pages/vendor-document-request-detail.html` | Document request detail | Upload document to fulfill request |

---

## Error Pages

| # | URL | Template | Description | Notes |
|---|-----|----------|-------------|-------|
| 33 | `http://localhost:9000/nexus/*` (404) | `nexus/pages/error.html` | 404 Not Found | Any non-existent route |
| 34 | `http://localhost:9000/nexus/*` (500) | `nexus/pages/error.html` | 500 Internal Server Error | Server errors |

---

## API Endpoints (For Reference)

### Public APIs

| # | Endpoint | Method | Auth | Description |
|---|----------|--------|------|-------------|
| 35 | `http://localhost:9000/nexus/api/realtime-config` | GET | None | Returns Supabase URL and anon key |

### Protected APIs

| # | Endpoint | Method | Auth | Description |
|---|----------|--------|------|-------------|
| 36 | `http://localhost:9000/nexus/api/notifications/unread` | GET | Required | Get unread notification counts |
| 37 | `http://localhost:9000/nexus/api/notifications/read` | POST | Required | Mark notifications as read |
| 38 | `http://localhost:9000/nexus/api/realtime-token` | GET | Required | Get short-lived access token for Realtime |

---

## Summary Statistics

- **Total Public Pages:** 9
- **Total Portal Pages:** 8
- **Total Client Pages:** 11
- **Total Vendor Pages:** 4
- **Total Error Pages:** 2
- **Total API Endpoints:** 4
- **Grand Total:** 38 unique pages/endpoints

---

## Testing Checklist

### Authentication Flow
- [ ] Login with email/password
- [ ] Login with OAuth (Google, GitHub, Azure, Microsoft)
- [ ] Sign up as client
- [ ] Sign up as vendor
- [ ] Accept invitation
- [ ] Forgot password flow
- [ ] Reset password flow
- [ ] Logout

### Client Context Pages
- [ ] Client dashboard loads
- [ ] Vendor directory shows vendors
- [ ] Invoice inbox with tabs
- [ ] Invoice detail with matching signal
- [ ] Payment outbox
- [ ] Payment detail
- [ ] Case list
- [ ] Case detail with timeline
- [ ] Add note to case (HTMX)
- [ ] Upload evidence (HTMX)
- [ ] Transition case status (HTMX)
- [ ] Document requests list
- [ ] Document request detail
- [ ] Accept/reject document

### Vendor Context Pages
- [ ] Vendor case detail
- [ ] Add note to case (HTMX)
- [ ] Upload evidence (HTMX)
- [ ] Document request inbox
- [ ] Upload document to fulfill request

### Portal Pages
- [ ] Role dashboard (dual-context tenants)
- [ ] Unified inbox
- [ ] Case detail (portal route)
- [ ] Payment dashboard
- [ ] Payment detail
- [ ] Relationships page
- [ ] Notifications page
- [ ] Settings page

### Error Handling
- [ ] 404 for non-existent routes
- [ ] 401 redirect to login for protected routes
- [ ] 403 for unauthorized access
- [ ] 500 error page

---

## Notes for Auditors

1. **Context Switching:** Dual-context tenants must select context before accessing protected routes. Single-context tenants auto-select.

2. **Route Protection:**
   - `/nexus/client/*` routes require client context (TC-*)
   - `/nexus/vendor/*` routes require vendor context (TV-*)
   - `/nexus/*` routes require authentication and active context

3. **Resource Access:**
   - Cases: User must be client or vendor of the case
   - Payments: User must be payer or payee
   - Invoices: Client can only see invoices from their vendors
   - Document Requests: Client sees requests they created; vendor sees requests sent to them

4. **HTMX Integration:**
   - Many pages use HTMX for dynamic updates
   - Partials are loaded via `hx-get` and updated via `hx-post`
   - OOB swaps update multiple elements simultaneously

5. **File Uploads:**
   - Evidence upload: Max 10MB, PDF/PNG/JPG/DOCX/XLSX
   - Document upload: Same constraints
   - Stored in Supabase Storage bucket `nexus-evidence`

6. **Realtime Updates:**
   - Cases, messages, and notifications update in real-time
   - Requires valid access token from `/nexus/api/realtime-token`
   - Legacy bcrypt users cannot use Realtime (no auth token)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Purpose:** Audit and testing reference

