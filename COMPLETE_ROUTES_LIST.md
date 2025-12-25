# Complete Routes List - NexusCanon VMP

**Base URL:** `http://localhost:9000`

**Last Updated:** 2025-01-21

---

## 🔓 Public Pages (No Authentication Required)

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/` | http://localhost:9000/ | GET | Landing page (redirects to /home if authenticated) |
| `/manifesto` | http://localhost:9000/manifesto | GET | Manifesto page |
| `/login` | http://localhost:9000/login | GET | Login page |
| `/login` | http://localhost:9000/login | POST | Login submission |
| `/login2` | http://localhost:9000/login2 | GET | Alternative login page |
| `/login4` | http://localhost:9000/login4 | GET | Alternative login page |
| `/sign-up` | http://localhost:9000/sign-up | GET | Sign up page |
| `/sign-up` | http://localhost:9000/sign-up | POST | Sign up submission |
| `/forgot-password` | http://localhost:9000/forgot-password | GET | Forgot password page |
| `/forgot-password` | http://localhost:9000/forgot-password | POST | Forgot password submission |
| `/reset-password` | http://localhost:9000/reset-password | GET | Reset password page (requires token) |
| `/reset-password` | http://localhost:9000/reset-password | POST | Reset password submission |
| `/accept` | http://localhost:9000/accept | GET | Accept invite page (requires token) |
| `/accept` | http://localhost:9000/accept | POST | Accept invite submission |
| `/supabase-invite` | http://localhost:9000/supabase-invite | GET | Supabase invite handler |

---

## 🔐 Vendor/Client Pages (Authentication Required)

### Dashboard & Navigation

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/home` | http://localhost:9000/home | GET | Main dashboard/home page |
| `/case-dashboard` | http://localhost:9000/case-dashboard | GET | Case dashboard (with posture filter) |
| `/case-dashboard?posture=action` | http://localhost:9000/case-dashboard?posture=action | GET | Action required cases |
| `/case-dashboard?posture=open` | http://localhost:9000/case-dashboard?posture=open | GET | Open cases |
| `/case-dashboard?posture=soa` | http://localhost:9000/case-dashboard?posture=soa | GET | Statement cases |
| `/case-dashboard?posture=paid` | http://localhost:9000/case-dashboard?posture=paid | GET | Paid/settled cases |

### Cases

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/new-case` | http://localhost:9000/new-case | GET | Create new case page |
| `/cases/:id` | http://localhost:9000/cases/{case-id} | GET | Case detail page |
| `/cases/:id/messages` | http://localhost:9000/cases/{case-id}/messages | POST | Create case message |
| `/cases/:id/evidence` | http://localhost:9000/cases/{case-id}/evidence | POST | Upload evidence |
| `/cases/:id/documents` | http://localhost:9000/cases/{case-id}/documents | POST | Upload document |
| `/cases/:id/verify-evidence` | http://localhost:9000/cases/{case-id}/verify-evidence | POST | Verify evidence |
| `/cases/:id/reject-evidence` | http://localhost:9000/cases/{case-id}/reject-evidence | POST | Reject evidence |
| `/cases/:id/reassign` | http://localhost:9000/cases/{case-id}/reassign | POST | Reassign case |
| `/cases/:id/update-status` | http://localhost:9000/cases/{case-id}/update-status | POST | Update case status |
| `/cases/:id/escalate` | http://localhost:9000/cases/{case-id}/escalate | POST | Escalate case |
| `/cases/:id/approve-onboarding` | http://localhost:9000/cases/{case-id}/approve-onboarding | POST | Approve onboarding case |

### Invoices

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/invoices` | http://localhost:9000/invoices | GET | Invoice list page |
| `/invoices/:id` | http://localhost:9000/invoices/{invoice-id} | GET | Invoice detail page |
| `/invoices/:id/open-case` | http://localhost:9000/invoices/{invoice-id}/open-case | POST | Open case from invoice |
| `/invoices/:id/request-grn` | http://localhost:9000/invoices/{invoice-id}/request-grn | POST | Request GRN |
| `/invoices/:id/dispute-amount` | http://localhost:9000/invoices/{invoice-id}/dispute-amount | POST | Dispute invoice amount |
| `/invoices/:id/report-exception` | http://localhost:9000/invoices/{invoice-id}/report-exception | POST | Report exception |

### Payments

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/payments` | http://localhost:9000/payments | GET | Payments page |
| `/payments/:id` | http://localhost:9000/payments/{payment-id} | GET | Payment detail page |
| `/payments/history` | http://localhost:9000/payments/history | GET | Payment history page |
| `/payments/:id/receipt` | http://localhost:9000/payments/{payment-id}/receipt | GET | Payment receipt download |
| `/payments/history/export` | http://localhost:9000/payments/history/export | GET | Export payment history to CSV |

### Profile & Settings

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/profile` | http://localhost:9000/profile | GET | User profile page |
| `/profile/contact` | http://localhost:9000/profile/contact | POST | Update contact information |
| `/profile/bank-details` | http://localhost:9000/profile/bank-details | POST | Request bank details change |
| `/settings` | http://localhost:9000/settings | GET | Settings page |

### Notifications

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/notifications` | http://localhost:9000/notifications | GET | Notifications page |
| `/notifications/:id/read` | http://localhost:9000/notifications/{id}/read | POST | Mark notification as read |
| `/notifications/mark-all-read` | http://localhost:9000/notifications/mark-all-read | POST | Mark all notifications as read |

### Utilities

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/scanner` | http://localhost:9000/scanner | GET | Live feed/scanner page |
| `/help` | http://localhost:9000/help | GET | Help & support page |

---

## 🏢 Supplier Pages (Authentication Required)

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/supplier/dashboard` | http://localhost:9000/supplier/dashboard | GET | Supplier dashboard |
| `/supplier/radar` | http://localhost:9000/supplier/radar | GET | Supplier financial radar |

---

## 🏢 Operations Pages (Internal Only - Authentication Required)

### Dashboard & Navigation

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops` | http://localhost:9000/ops | GET | Operations root (redirects to dashboard) |
| `/ops/dashboard` | http://localhost:9000/ops/dashboard | GET | Operations dashboard |
| `/ops/ingest` | http://localhost:9000/ops/ingest | GET | Data ingest UI |

### Data Ingest

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/ingest/invoices` | http://localhost:9000/ops/ingest/invoices | POST | Upload invoice CSV |
| `/ops/ingest/payments` | http://localhost:9000/ops/ingest/payments | POST | Upload payment CSV |
| `/ops/ingest/remittances` | http://localhost:9000/ops/ingest/remittances | POST | Upload remittance PDFs |

### Cases Management

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/cases` | http://localhost:9000/ops/cases | GET | Operations case queue |
| `/ops/cases/:id` | http://localhost:9000/ops/cases/{case-id} | GET | Operations case detail |

### Vendor Management

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/vendors` | http://localhost:9000/ops/vendors | GET | Vendor directory |

### Invites & Access

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/invites/new` | http://localhost:9000/ops/invites/new | GET | New invite form page |
| `/ops/invites` | http://localhost:9000/ops/invites | POST | Create new invite |
| `/ops/access-requests` | http://localhost:9000/ops/access-requests | GET | Access requests list |
| `/ops/access-requests/:id/status` | http://localhost:9000/ops/access-requests/{id}/status | POST | Update access request status |

### Port Configuration

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/ports` | http://localhost:9000/ops/ports | GET | Port configuration page |
| `/ops/ports/:portType` | http://localhost:9000/ops/ports/{portType} | POST | Update port configuration |

### SLA & Analytics

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ops/sla-reminders/check` | http://localhost:9000/ops/sla-reminders/check | POST | Check SLA reminders |
| `/ops/sla-reminders/stats` | http://localhost:9000/ops/sla-reminders/stats | GET | SLA reminder statistics |
| `/ops/sla-analytics` | http://localhost:9000/ops/sla-analytics | GET | SLA analytics dashboard |

---

## 🔌 Port Webhooks (Public - No Authentication)

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/ports/email` | http://localhost:9000/ports/email | POST | Email webhook endpoint |
| `/ports/whatsapp` | http://localhost:9000/ports/whatsapp | POST | WhatsApp webhook endpoint |

---

## 📦 HTMX Partials (Authentication Required)

### Case Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/case-inbox.html` | http://localhost:9000/partials/case-inbox.html | GET | Case inbox list |
| `/partials/case-detail.html` | http://localhost:9000/partials/case-detail.html | GET | Case detail partial |
| `/partials/case-thread.html` | http://localhost:9000/partials/case-thread.html | GET | Case message thread |
| `/partials/case-activity.html` | http://localhost:9000/partials/case-activity.html | GET | Case activity feed |
| `/partials/case-checklist.html` | http://localhost:9000/partials/case-checklist.html | GET | Case checklist |
| `/partials/case-evidence.html` | http://localhost:9000/partials/case-evidence.html | GET | Case evidence list |
| `/partials/case-row.html` | http://localhost:9000/partials/case-row.html | GET | Case row component |
| `/partials/escalation.html` | http://localhost:9000/partials/escalation.html | GET | Escalation zone |

### Invoice Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/invoice-list.html` | http://localhost:9000/partials/invoice-list.html | GET | Invoice list |
| `/partials/invoice-card-feed.html` | http://localhost:9000/partials/invoice-card-feed.html | GET | Invoice card feed (Action Mode) |
| `/partials/invoice-detail.html` | http://localhost:9000/partials/invoice-detail.html | GET | Invoice detail |
| `/partials/matching-status.html` | http://localhost:9000/partials/matching-status.html | GET | 3-way matching status |

### Payment Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/payment-list.html` | http://localhost:9000/partials/payment-list.html | GET | Payment list |
| `/partials/payment-history.html` | http://localhost:9000/partials/payment-history.html | GET | Payment history |
| `/partials/remittance-viewer.html` | http://localhost:9000/partials/remittance-viewer.html | GET | Remittance PDF viewer |

### Profile Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/profile-form.html` | http://localhost:9000/partials/profile-form.html | GET | Profile form |
| `/partials/compliance-docs.html` | http://localhost:9000/partials/compliance-docs.html | GET | Compliance documents |
| `/partials/contract-library.html` | http://localhost:9000/partials/contract-library.html | GET | Contract library |

### Operations Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/org-tree-sidebar.html` | http://localhost:9000/partials/org-tree-sidebar.html | GET | Organization tree sidebar |
| `/partials/scoped-dashboard.html` | http://localhost:9000/partials/scoped-dashboard.html | GET | Scoped dashboard |
| `/partials/ops-case-queue.html` | http://localhost:9000/partials/ops-case-queue.html | GET | Operations case queue |
| `/partials/vendor-directory.html` | http://localhost:9000/partials/vendor-directory.html | GET | Vendor directory |
| `/partials/decision-log.html` | http://localhost:9000/partials/decision-log.html | GET | Decision log |
| `/partials/timeline.html` | http://localhost:9000/partials/timeline.html | GET | Timeline component |
| `/partials/truth-panel.html` | http://localhost:9000/partials/truth-panel.html | GET | Truth panel (linked transactions) |
| `/partials/sla-analytics.html` | http://localhost:9000/partials/sla-analytics.html | GET | SLA analytics |
| `/partials/port-configuration.html` | http://localhost:9000/partials/port-configuration.html | GET | Port configuration UI |
| `/partials/port-activity-log.html` | http://localhost:9000/partials/port-activity-log.html | GET | Port activity log |
| `/partials/invite-form.html` | http://localhost:9000/partials/invite-form.html | GET | Invite form |

### Supplier Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/supplier-case-list.html` | http://localhost:9000/partials/supplier-case-list.html | GET | Supplier case list |

### Notification Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/notification-badge.html` | http://localhost:9000/partials/notification-badge.html | GET | Notification badge |

### Login Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/login-help-access.html` | http://localhost:9000/partials/login-help-access.html | GET | Login help - access |
| `/partials/login-help-sso.html` | http://localhost:9000/partials/login-help-sso.html | GET | Login help - SSO |
| `/partials/login-help-security.html` | http://localhost:9000/partials/login-help-security.html | GET | Login help - security |
| `/partials/login-mock-success.html` | http://localhost:9000/partials/login-mock-success.html | POST | Login mock success |
| `/partials/login-mock-magic-sent.html` | http://localhost:9000/partials/login-mock-magic-sent.html | POST | Login mock magic link sent |
| `/partials/login-mock-forgot.html` | http://localhost:9000/partials/login-mock-forgot.html | GET | Login mock forgot password |
| `/partials/login-mock-sso.html` | http://localhost:9000/partials/login-mock-sso.html | GET | Login mock SSO |
| `/partials/login-mock-passkey.html` | http://localhost:9000/partials/login-mock-passkey.html | GET | Login mock passkey |
| `/partials/login-gate-ritual.html` | http://localhost:9000/partials/login-gate-ritual.html | GET | Login gate ritual |

### Component Partials

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/partials/file-upload-dropzone.html` | http://localhost:9000/partials/file-upload-dropzone.html | GET | File upload dropzone |
| `/partials/avatar-component.html` | http://localhost:9000/partials/avatar-component.html | GET | Avatar component |
| `/partials/oauth-github-button.html` | http://localhost:9000/partials/oauth-github-button.html | GET | OAuth GitHub button |
| `/partials/supabase-ui-examples.html` | http://localhost:9000/partials/supabase-ui-examples.html | GET | Supabase UI examples |

---

## 🔌 API Endpoints (Authentication Required)

### Command Palette

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/api/command-palette/search` | http://localhost:9000/api/command-palette/search | GET | Command palette search |

### Bulk Actions

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/api/bulk-actions/:listType/:action` | http://localhost:9000/api/bulk-actions/{listType}/{action} | POST | Execute bulk action |

### Push Notifications

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/api/push/subscribe` | http://localhost:9000/api/push/subscribe | POST | Subscribe to push notifications |
| `/api/push/unsubscribe` | http://localhost:9000/api/push/unsubscribe | POST | Unsubscribe from push notifications |

### Case API

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/api/cases/:id/validate` | http://localhost:9000/api/cases/{id}/validate | GET | Validate case data |
| `/api/cases/:id/auto-respond` | http://localhost:9000/api/cases/{id}/auto-respond | POST | Auto-respond to case |

### Demo API

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/api/demo/status` | http://localhost:9000/api/demo/status | GET | Demo status |
| `/api/demo/seed` | http://localhost:9000/api/demo/seed | POST | Seed demo data |
| `/api/demo/reset` | http://localhost:9000/api/demo/reset | POST | Reset demo data |
| `/api/demo/clear` | http://localhost:9000/api/demo/clear | DELETE | Clear demo data |

---

## 📄 Static Files & Templates

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/manifest.json` | http://localhost:9000/manifest.json | GET | PWA manifest |
| `/sw.js` | http://localhost:9000/sw.js | GET | Service worker |
| `/offline.html` | http://localhost:9000/offline.html | GET | Offline fallback page |
| `/templates/:type-template.pdf` | http://localhost:9000/templates/{type}-template.pdf | GET | Document template PDF |

---

## 🧪 Development/Test Pages

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/test` | http://localhost:9000/test | GET | Test page |
| `/examples` | http://localhost:9000/examples | GET | Examples page |
| `/components` | http://localhost:9000/components | GET | Components showcase |
| `/snippets-test` | http://localhost:9000/snippets-test | GET | Snippets test page |

---

## 🔧 System Endpoints

| Route | Full URL | Method | Description |
|-------|----------|--------|-------------|
| `/health` | http://localhost:9000/health | GET | Health check endpoint |
| `/logout` | http://localhost:9000/logout | POST | Logout endpoint |

---

## 📝 Notes

### Dynamic Routes
Routes with `:id` parameters require actual UUIDs. Examples:
- `/cases/123e4567-e89b-12d3-a456-426614174000`
- `/invoices/123e4567-e89b-12d3-a456-426614174000`
- `/payments/123e4567-e89b-12d3-a456-426614174000`

### Query Parameters
Some routes support query parameters:
- `/case-dashboard?posture=action` - Filter by posture
- `/case-dashboard?posture=open` - Filter by posture
- `/case-dashboard?posture=soa` - Filter by posture
- `/case-dashboard?posture=paid` - Filter by posture

### Authentication
- **Public Routes:** No authentication required
- **Vendor/Client Routes:** Require vendor authentication (`requireAuth`)
- **Operations Routes:** Require internal user authentication (`requireInternal`)
- **Port Webhooks:** Public (no authentication, but should validate webhook signatures)

### HTMX Partials
Many pages load content via HTMX partials. These are not direct page routes but are used for dynamic content loading.

---

## 📊 Route Statistics

- **Total Routes:** ~135 routes
- **Public Routes:** 13 routes
- **Vendor/Client Routes:** ~40 routes
- **Operations Routes:** ~20 routes
- **HTMX Partials:** ~40 routes
- **API Endpoints:** ~10 routes
- **Port Webhooks:** 2 routes
- **Static Files:** 4 routes
- **Development/Test:** 4 routes
- **System:** 2 routes

---

**Last Updated:** 2025-01-21  
**Version:** 1.0.0

