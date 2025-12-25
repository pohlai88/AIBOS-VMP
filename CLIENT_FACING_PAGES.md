# Client-Facing Pages & Routes

**Base URL:** `http://localhost:9000`

---

## 🔓 Public Pages (No Authentication Required)

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/` | http://localhost:9000/ | `pages/landing.html` | Landing page (redirects to /home if authenticated) |
| `/manifesto` | http://localhost:9000/manifesto | `pages/manifesto.html` | Manifesto page |
| `/login` | http://localhost:9000/login | `pages/login.html` | Login page |
| `/sign-up` | http://localhost:9000/sign-up | `pages/sign_up.html` | Sign up page |
| `/forgot-password` | http://localhost:9000/forgot-password | `pages/forgot_password.html` | Forgot password page |
| `/reset-password` | http://localhost:9000/reset-password | `pages/reset_password.html` | Reset password page |
| `/accept` | http://localhost:9000/accept | `pages/accept.html` | Accept invite page |
| `/supabase-invite` | http://localhost:9000/supabase-invite | `pages/supabase_invite_handler.html` | Supabase invite handler |

---

## 🔐 Vendor/Client Pages (Authentication Required)

### Dashboard & Navigation

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/home` | http://localhost:9000/home | `pages/home.html` | Main dashboard/home page |
| `/case-dashboard` | http://localhost:9000/case-dashboard | `pages/case_dashboard.html` | Case dashboard (with posture filter) |
| `/case-dashboard?posture=action` | http://localhost:9000/case-dashboard?posture=action | `pages/case_dashboard.html` | Action required cases |
| `/case-dashboard?posture=open` | http://localhost:9000/case-dashboard?posture=open | `pages/case_dashboard.html` | Open cases |
| `/case-dashboard?posture=soa` | http://localhost:9000/case-dashboard?posture=soa | `pages/case_dashboard.html` | Statement cases |
| `/case-dashboard?posture=paid` | http://localhost:9000/case-dashboard?posture=paid | `pages/case_dashboard.html` | Paid/settled cases |

### Cases

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/new-case` | http://localhost:9000/new-case | `pages/new_case.html` | Create new case page |
| `/cases/:id` | http://localhost:9000/cases/{case-id} | `pages/case_detail.html` | Case detail page (replace {case-id} with actual ID) |

### Invoices

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/invoices` | http://localhost:9000/invoices | `pages/invoices.html` | Invoice list page |
| `/invoices/:id` | http://localhost:9000/invoices/{invoice-id} | `pages/invoice_detail.html` | Invoice detail page (replace {invoice-id} with actual ID) |

### Payments

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/payments` | http://localhost:9000/payments | `pages/payments.html` | Payments page |
| `/payments/:id` | http://localhost:9000/payments/{payment-id} | `pages/payment_detail.html` | Payment detail page (replace {payment-id} with actual ID) |
| `/payments/history` | http://localhost:9000/payments/history | `pages/payment_history.html` | Payment history page |

### Profile & Settings

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/profile` | http://localhost:9000/profile | `pages/profile.html` | User profile page |
| `/settings` | http://localhost:9000/settings | `pages/settings.html` | Settings page |

### Notifications

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/notifications` | http://localhost:9000/notifications | `pages/notifications.html` | Notifications page |

### Utilities

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/scanner` | http://localhost:9000/scanner | `pages/scanner.html` | Live feed/scanner page |
| `/help` | http://localhost:9000/help | `pages/help.html` | Help & support page |

---

## 🏢 Supplier Pages (Authentication Required)

| Route | URL | Page Template | Description |
|-------|-----|---------------|-------------|
| `/supplier/dashboard` | http://localhost:9000/supplier/dashboard | `pages/supplier_dashboard.html` | Supplier dashboard |
| `/supplier/radar` | http://localhost:9000/supplier/radar | `pages/supplier_financial_radar.html` | Supplier financial radar |

---

## 📝 Notes

- **Authentication:** All vendor/client and supplier pages require authentication
- **Dynamic Routes:** Routes with `:id` parameters require actual IDs (e.g., `/cases/123e4567-e89b-12d3-a456-426614174000`)
- **Query Parameters:** Some routes support query parameters (e.g., `?posture=action`)
- **HTMX Partials:** Many pages load content via HTMX partials (not listed here as they're not direct page routes)

---

## 🚫 Excluded Routes

The following routes are **NOT** client-facing:
- `/ops/*` - Internal operations routes (admin only)
- `/partials/*` - HTMX partial fragments
- `/api/*` - API endpoints
- `/test`, `/examples`, `/components`, `/snippets-test` - Development/test pages
- `/health` - Health check endpoint
- Static files (`/manifest.json`, `/sw.js`, `/offline.html`)

---

**Last Updated:** 2025-01-21

