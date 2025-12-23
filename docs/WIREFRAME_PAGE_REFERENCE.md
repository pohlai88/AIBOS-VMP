# VMP Complete Page Wireframe Reference

**Version:** 1.0.0  
**Date:** 2025-01-21  
**Purpose:** Complete reference of all pages in the VMP project with entry points and navigation connections

---

## 📋 Table of Contents

1. [Public/Unauthenticated Pages](#publicunauthenticated-pages)
2. [Vendor/Authenticated Pages](#vendorauthenticated-pages)
3. [Ops/Internal Pages](#opsinternal-pages)
4. [Error Pages](#error-pages)
5. [Special/Utility Pages](#specialutility-pages)
6. [Navigation Flow Summary](#navigation-flow-summary)

---

## 🌐 Public/Unauthenticated Pages

### 1. Landing Page (`/`)
- **File:** `pages/landing.html`
- **Route:** `GET /`
- **Entry Points:**
  - Direct URL access (root entry point)
  - Redirect from `/` for unauthenticated users
- **Connections To:**
  - `/login` - Sign In button, Get Started buttons
  - `/manifesto` - Nav link
  - `#features`, `#compliance`, `#docs` - Anchor links (same page)
  - `#demo` - Anchor link (same page)
- **Connections From:**
  - None (primary entry point)

---

### 2. Login Page (`/login`)
- **File:** `pages/login.html`
- **Route:** `GET /login`, `POST /login`
- **Entry Points:**
  - Direct URL access
  - From Landing page (Sign In, Get Started buttons)
  - From Sign Up page (after registration)
  - From Reset Password page (after password reset)
  - From Accept Invite page (Go to Login link)
- **Connections To:**
  - `/home` - After successful login (vendor users)
  - `/ops/dashboard` - After successful login (internal users)
  - `/forgot-password` - Forgot Password link
  - `/sign-up` - Sign Up link
- **Connections From:**
  - Landing page
  - Sign Up page
  - Forgot Password flow
  - Reset Password page
  - Accept Invite page

---

### 3. Sign Up Page (`/sign-up`)
- **File:** `pages/sign_up.html`
- **Route:** `GET /sign-up`, `POST /sign-up`
- **Entry Points:**
  - Direct URL access
  - From Login page (Sign Up link)
- **Connections To:**
  - `/login` - After successful sign up
- **Connections From:**
  - Login page

---

### 4. Forgot Password Page (`/forgot-password`)
- **File:** `pages/forgot_password.html`
- **Route:** `GET /forgot-password`, `POST /forgot-password`
- **Entry Points:**
  - Direct URL access
  - From Login page (Forgot Password link)
- **Connections To:**
  - `/reset-password` - Via email reset link (with token)
  - `/login` - Back to login
- **Connections From:**
  - Login page

---

### 5. Reset Password Page (`/reset-password`)
- **File:** `pages/reset_password.html`
- **Route:** `GET /reset-password`, `POST /reset-password`
- **Entry Points:**
  - Direct URL access with token (from email reset link)
  - Redirect from `/` if recovery token detected
- **Connections To:**
  - `/login` - After successful password reset
- **Connections From:**
  - Forgot Password page (via email link)
  - Root redirect (if token detected)

---

### 6. Accept Invite Page (`/accept`)
- **File:** `pages/accept.html`
- **Route:** `GET /accept`, `POST /accept`
- **Entry Points:**
  - Direct URL access with token
  - From Supabase Invite Handler
- **Connections To:**
  - `/login` - Go to Login link
  - `/home` - After successful invite acceptance
- **Connections From:**
  - Supabase Invite Handler page

---

### 7. Manifesto Page (`/manifesto`)
- **File:** `pages/manifesto.html`
- **Route:** `GET /manifesto`
- **Entry Points:**
  - Direct URL access
  - From Landing page (nav link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Landing page

---

### 8. Supabase Invite Handler (`/supabase-invite`)
- **File:** `pages/supabase_invite_handler.html`
- **Route:** `GET /supabase-invite`
- **Entry Points:**
  - Direct URL access (webhook handler)
- **Connections To:**
  - `/accept` - Redirects to accept page with token
- **Connections From:**
  - External Supabase invite system

---

## 👤 Vendor/Authenticated Pages

### 9. Home Dashboard (`/home`)
- **File:** `pages/home.html`
- **Route:** `GET /home`
- **Entry Points:**
  - After successful login (vendor users)
  - From sidebar navigation
- **Connections To:**
  - `/cases/:id` - Case detail (via case click)
  - `/invoices/:id` - Invoice detail (via invoice click)
  - `/payments/:id` - Payment detail (via payment click)
  - `/notifications` - Notifications link
  - `/profile` - Profile link
  - `/settings` - Settings link
  - Case Dashboard (via HTMX case inbox)
- **Connections From:**
  - Login page (after authentication)
  - Sidebar navigation
- **HTMX Partials:**
  - `/partials/case-inbox.html` - Case inbox
  - `/partials/notification-badge.html` - Notification badge

---

### 10. Case Dashboard
- **File:** `pages/case_dashboard.html`
- **Route:** Not directly routed (loaded via HTMX or internal navigation)
- **Entry Points:**
  - From Home dashboard (Cases section)
  - Via HTMX case inbox
- **Connections To:**
  - `/cases/:id` - Case detail (via case click)
  - New Case page (via new case button)
- **Connections From:**
  - Home dashboard

---

### 11. Case Detail (`/cases/:id`)
- **File:** `pages/case_detail.html`
- **Route:** `GET /cases/:id`
- **Entry Points:**
  - Direct URL access with case ID
  - From Home dashboard (case click)
  - From Case Dashboard (case click)
  - From Supplier Dashboard (case click)
- **Connections To:**
  - Case Dashboard (Back to cases link)
  - Case Template (via template link)
- **Connections From:**
  - Home dashboard
  - Case Dashboard
  - Supplier Dashboard
- **HTMX Partials:**
  - `/partials/case-detail.html` - Case detail content
  - `/partials/case-thread.html` - Case thread/messages
  - `/partials/case-activity.html` - Case activity log
  - `/partials/case-checklist.html` - Case checklist
  - `/partials/case-evidence.html` - Case evidence

---

### 12. Case Template
- **File:** `pages/case_template.html`
- **Route:** Not directly routed (template view)
- **Entry Points:**
  - From Case Detail page (template link)
- **Connections To:**
  - Case Detail (back)
- **Connections From:**
  - Case Detail page

---

### 13. New Case
- **File:** `pages/new_case.html`
- **Route:** Not directly routed (form view)
- **Entry Points:**
  - From Case Dashboard (new case button)
- **Connections To:**
  - `/cases/:id` - After case creation
- **Connections From:**
  - Case Dashboard

---

### 14. Invoice List (`/invoices`)
- **File:** `pages/invoices.html`
- **Route:** `GET /invoices`
- **Entry Points:**
  - Direct URL access
  - From sidebar navigation
  - From Home dashboard
- **Connections To:**
  - `/invoices/:id` - Invoice detail (via invoice click)
  - Invoice List View (via list view toggle)
- **Connections From:**
  - Sidebar navigation
  - Home dashboard
- **HTMX Partials:**
  - `/partials/invoice-list.html` - Invoice list
  - `/partials/invoice-card-feed.html` - Invoice card feed

---

### 15. Invoice List View
- **File:** `pages/invoice_list.html`
- **Route:** Not directly routed (alternative view)
- **Entry Points:**
  - From Invoice List page (view toggle)
- **Connections To:**
  - `/invoices/:id` - Invoice detail (via invoice click)
- **Connections From:**
  - Invoice List page

---

### 16. Invoice Detail (`/invoices/:id`)
- **File:** `pages/invoice_detail.html`
- **Route:** `GET /invoices/:id`
- **Entry Points:**
  - Direct URL access with invoice ID
  - From Invoice List (invoice click)
  - From Invoice List View (invoice click)
  - From Home dashboard (invoice click)
- **Connections To:**
  - `/invoices` - Back to invoice list
- **Connections From:**
  - Invoice List
  - Invoice List View
  - Home dashboard
- **HTMX Partials:**
  - `/partials/invoice-detail.html` - Invoice detail content
  - `/partials/matching-status.html` - Matching status

---

### 17. Payments (`/payments`)
- **File:** `pages/payments.html`
- **Route:** `GET /payments`
- **Entry Points:**
  - Direct URL access
  - From sidebar navigation
  - From Home dashboard
- **Connections To:**
  - `/payments/:id` - Payment detail (via payment click)
  - `/payments/history` - Payment history link
- **Connections From:**
  - Sidebar navigation
  - Home dashboard
- **HTMX Partials:**
  - `/partials/payment-list.html` - Payment list

---

### 18. Payment Detail (`/payments/:id`)
- **File:** `pages/payment_detail.html`
- **Route:** `GET /payments/:id`
- **Entry Points:**
  - Direct URL access with payment ID
  - From Payments page (payment click)
  - From Home dashboard (payment click)
- **Connections To:**
  - `/payments` - Back to payments list
  - `/payments/:id/receipt` - Receipt download
- **Connections From:**
  - Payments page
  - Home dashboard

---

### 19. Payment History (`/payments/history`)
- **File:** `pages/payment_history.html`
- **Route:** `GET /payments/history`
- **Entry Points:**
  - Direct URL access
  - From Payments page (history link)
- **Connections To:**
  - `/payments` - Back to payments
  - `/payments/history/export` - Export history
- **Connections From:**
  - Payments page
- **HTMX Partials:**
  - `/partials/payment-history.html` - Payment history content

---

### 20. Supplier Dashboard (`/supplier/dashboard`)
- **File:** `pages/supplier_dashboard.html`
- **Route:** `GET /supplier/dashboard`
- **Entry Points:**
  - Direct URL access
  - From sidebar navigation (for supplier users)
- **Connections To:**
  - `/cases/:id` - Case detail (via case click)
- **Connections From:**
  - Sidebar navigation
- **HTMX Partials:**
  - `/partials/supplier-case-list.html` - Supplier case list

---

### 21. Profile (`/profile`)
- **File:** `pages/profile.html`
- **Route:** `GET /profile`
- **Entry Points:**
  - Direct URL access
  - From sidebar navigation
  - From Home dashboard
- **Connections To:**
  - `/settings` - Settings link
- **Connections From:**
  - Sidebar navigation
  - Home dashboard
- **HTMX Partials:**
  - `/partials/profile-form.html` - Profile form

---

### 22. Settings (`/settings`)
- **File:** `pages/settings.html`
- **Route:** `GET /settings`
- **Entry Points:**
  - Direct URL access
  - From Profile page
  - From Home dashboard
- **Connections To:**
  - `/profile` - Back to profile
- **Connections From:**
  - Profile page
  - Home dashboard

---

### 23. Notifications (`/notifications`)
- **File:** `pages/notifications.html`
- **Route:** `GET /notifications`
- **Entry Points:**
  - Direct URL access
  - From Home dashboard (notifications link)
  - From notification badge click
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Home dashboard
  - Notification badge

---

## 🔧 Ops/Internal Pages

### 24. Ops Command Center (`/ops`)
- **File:** `pages/ops_command_center.html`
- **Route:** `GET /ops`
- **Entry Points:**
  - Direct URL access (internal users only)
  - Redirect from `/` for authenticated internal users
- **Connections To:**
  - `/ops/dashboard` - Dashboard link
  - `/ops/cases` - Cases link
  - `/ops/vendors` - Vendors link
  - `/ops/ingest` - Ingest link
  - `/ops/ports` - Ports link
  - `/ops/invites/new` - Invite New link
  - `/ops/access-requests` - Access Requests link
  - `/ops/sla-analytics` - SLA Analytics link
- **Connections From:**
  - Root redirect (for internal users)
- **HTMX Partials:**
  - `/partials/org-tree-sidebar.html` - Organization tree sidebar

---

### 25. Ops Dashboard (`/ops/dashboard`)
- **File:** `pages/ops_dashboard.html`
- **Route:** `GET /ops/dashboard`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (dashboard link)
  - After successful login (internal users)
- **Connections To:**
  - Ops Data History (via data history link)
- **Connections From:**
  - Ops Command Center
  - Login page (for internal users)
- **HTMX Partials:**
  - `/partials/scoped-dashboard.html` - Scoped dashboard content

---

### 26. Ops Cases (`/ops/cases`)
- **File:** `pages/ops_cases.html`
- **Route:** `GET /ops/cases`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (cases link)
- **Connections To:**
  - `/ops/cases/:id` - Ops case detail (via case click)
- **Connections From:**
  - Ops Command Center
- **HTMX Partials:**
  - `/partials/ops-case-queue.html` - Ops case queue

---

### 27. Ops Case Detail (`/ops/cases/:id`)
- **File:** `pages/ops_case_detail.html`
- **Route:** `GET /ops/cases/:id`
- **Entry Points:**
  - Direct URL access with case ID
  - From Ops Cases (case click)
- **Connections To:**
  - `/ops/cases` - Back to ops cases
- **Connections From:**
  - Ops Cases

---

### 28. Ops Vendors (`/ops/vendors`)
- **File:** `pages/ops_vendors.html`
- **Route:** `GET /ops/vendors`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (vendors link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center
- **HTMX Partials:**
  - `/partials/vendor-directory.html` - Vendor directory
  - `/partials/decision-log.html` - Decision log

---

### 29. Ops Ingest (`/ops/ingest`)
- **File:** `pages/ops_ingest.html`
- **Route:** `GET /ops/ingest`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (ingest link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center

---

### 30. Ops Ports (`/ops/ports`)
- **File:** `pages/ops_ports.html`
- **Route:** `GET /ops/ports`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (ports link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center
- **HTMX Partials:**
  - `/partials/port-configuration.html` - Port configuration
  - `/partials/port-activity-log.html` - Port activity log
  - `/partials/remittance-viewer.html` - Remittance viewer

---

### 31. Ops Invite New (`/ops/invites/new`)
- **File:** `pages/ops_invite_new.html`
- **Route:** `GET /ops/invites/new`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (invite new link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center
- **HTMX Partials:**
  - `/partials/invite-form.html` - Invite form

---

### 32. Ops Access Requests (`/ops/access-requests`)
- **File:** `pages/ops_access_requests.html`
- **Route:** `GET /ops/access-requests`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (access requests link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center

---

### 33. Ops Data History
- **File:** `pages/ops_data_history.html`
- **Route:** Not directly routed (internal view)
- **Entry Points:**
  - From Ops Dashboard (data history link)
- **Connections To:**
  - Ops Dashboard (back)
- **Connections From:**
  - Ops Dashboard

---

### 34. SLA Analytics (`/ops/sla-analytics`)
- **File:** `pages/sla_analytics.html`
- **Route:** `GET /ops/sla-analytics`
- **Entry Points:**
  - Direct URL access
  - From Ops Command Center (SLA analytics link)
- **Connections To:**
  - None (standalone page)
- **Connections From:**
  - Ops Command Center
- **HTMX Partials:**
  - `/partials/sla-analytics.html` - SLA analytics content
  - `/partials/compliance-docs.html` - Compliance docs
  - `/partials/contract-library.html` - Contract library

---

## ⚠️ Error Pages

### 35. 403 Forbidden (`/403`)
- **File:** `pages/403.html`
- **Route:** Not directly routed (error handler)
- **Entry Points:**
  - Automatic redirect on 403 errors
  - From any protected route (unauthorized access)
- **Connections To:**
  - `/login` - Login link
  - `/home` - Home link (if authenticated)
- **Connections From:**
  - Any protected route (on authorization failure)

---

### 36. Error Page
- **File:** `pages/error.html`
- **Route:** Not directly routed (error handler)
- **Entry Points:**
  - Automatic redirect on errors
  - From any route (on error)
- **Connections To:**
  - `/home` - Home link
  - `/login` - Login link
- **Connections From:**
  - Any route (on error)

---

## 📊 Navigation Flow Summary

### Primary Entry Points
1. **Root (`/`)** - Landing page for unauthenticated users
2. **Login (`/login`)** - Authentication entry point
3. **Ops Command Center (`/ops`)** - Entry point for internal users

### Main Navigation Paths

#### Vendor User Flow
```
Landing → Login → Home Dashboard
  ├── Cases → Case Detail
  ├── Invoices → Invoice Detail
  ├── Payments → Payment Detail → Payment History
  ├── Profile → Settings
  └── Notifications
```

#### Internal User Flow
```
Landing → Login → Ops Command Center
  ├── Ops Dashboard → Ops Data History
  ├── Ops Cases → Ops Case Detail
  ├── Ops Vendors
  ├── Ops Ingest
  ├── Ops Ports
  ├── Ops Invite New
  ├── Ops Access Requests
  └── SLA Analytics
```

### Authentication Flow
```
Landing → Login → [Vendor: Home | Internal: Ops Dashboard]
  ├── Forgot Password → Reset Password → Login
  └── Sign Up → Login
```

### Invite Flow
```
Supabase Invite → Accept Invite → Login → Home
```

---

## 🔗 HTMX Partial Routes

The following partials are loaded via HTMX and don't have direct page routes:

- `/partials/case-inbox.html`
- `/partials/case-detail.html`
- `/partials/case-thread.html`
- `/partials/case-activity.html`
- `/partials/case-checklist.html`
- `/partials/case-evidence.html`
- `/partials/invoice-list.html`
- `/partials/invoice-card-feed.html`
- `/partials/invoice-detail.html`
- `/partials/matching-status.html`
- `/partials/payment-list.html`
- `/partials/payment-history.html`
- `/partials/profile-form.html`
- `/partials/notification-badge.html`
- `/partials/org-tree-sidebar.html`
- `/partials/scoped-dashboard.html`
- `/partials/ops-case-queue.html`
- `/partials/vendor-directory.html`
- `/partials/decision-log.html`
- `/partials/port-configuration.html`
- `/partials/port-activity-log.html`
- `/partials/remittance-viewer.html`
- `/partials/invite-form.html`
- `/partials/sla-analytics.html`
- `/partials/compliance-docs.html`
- `/partials/contract-library.html`
- `/partials/supplier-case-list.html`

---

## 📝 Notes

- All routes follow **kebab-case** for URLs and **snake_case** for filenames
- Pages must be rendered via routes in `server.js` (never served statically)
- HTMX partials are loaded dynamically and don't require full page navigation
- Error pages are rendered automatically by error handlers
- Authentication is required for all vendor and ops pages
- Internal users (`isInternal: true`) have access to ops pages
- Vendor users have access to vendor pages only

---

**Last Updated:** 2025-01-21  
**Total Pages Documented:** 36  
**Total HTMX Partials:** 26

