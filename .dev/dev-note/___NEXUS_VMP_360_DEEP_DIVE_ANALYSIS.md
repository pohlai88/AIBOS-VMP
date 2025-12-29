# Nexus VMP: 360° Deep Dive Analysis
**Date:** 2025-01-27  
**Server:** localhost:9000  
**Architecture:** Nexus Portal (Phase 13 - Legacy VMP Removed)

---

## Executive Summary

This document provides a comprehensive 360° analysis of the Nexus VMP implementation, capturing the current position across all layers: routes, authentication, authorization, context management, data flow, and tenant-facing interfaces.

---

## 1. Architecture Overview

### 1.1 Technology Stack
- **Runtime:** Node.js (Express.js)
- **Template Engine:** Nunjucks
- **Database:** Supabase (PostgreSQL with RLS)
- **Session Store:** PostgreSQL (connect-pg-simple)
- **Authentication:** Supabase Auth (JWT-based) + Legacy bcrypt fallback
- **File Upload:** Multer (memory storage)
- **Frontend:** HTMX for dynamic updates, vanilla JavaScript

### 1.2 Application Structure
```
server.js                    # Main Express app, route mounting
├── src/routes/
│   ├── nexus-portal.js      # Main portal routes (/nexus/*)
│   ├── nexus-client.js       # Client Command Center (/nexus/client/*)
│   └── nexus-vendor.js       # Vendor Portal (/nexus/vendor/*)
├── src/middleware/
│   └── nexus-context.js     # Session, auth, context management
├── src/adapters/
│   └── nexus-adapter.js     # Database abstraction layer
└── src/views/
    ├── nexus/pages/         # Full page templates
    └── nexus/partials/       # HTMX fragments
```

### 1.3 Core Philosophy
**"Everyone is a Tenant"** - All users belong to a tenant. Context determines whether they're viewing as:
- **Client** (TC-*): Managing vendors, invoices, payments, cases
- **Vendor** (TV-*): Serving clients, responding to cases, uploading documents

---

## 2. Route Architecture

### 2.1 Route Hierarchy

```
/                                    # Marketing landing (public)
├── /manifesto                       # Marketing page (public)
├── /sign-up                         # Redirects to /nexus/sign-up
├── /login                           # Redirects to /nexus/login
├── /forgot-password                 # Redirects to /nexus/forgot-password
└── /reset-password                  # Redirects to /nexus/reset-password

/nexus/                              # Main Portal (Nexus Portal Router)
├── PUBLIC ROUTES (No Auth)
│   ├── GET  /login                  # Login page
│   ├── POST /login                  # Process login
│   ├── GET  /sign-up                # Sign up page
│   ├── POST /sign-up                # Process sign up
│   ├── GET  /accept                 # Accept invitation
│   ├── POST /accept                 # Process invitation
│   ├── GET  /forgot-password        # Forgot password page
│   ├── POST /forgot-password        # Send reset email
│   ├── GET  /reset-password         # Reset password page
│   ├── POST /reset-password         # Process password reset
│   ├── GET  /oauth/callback         # OAuth callback handler
│   ├── GET  /oauth/exchange         # OAuth code exchange
│   ├── POST /oauth/token            # OAuth token handler
│   ├── GET  /oauth/:provider        # OAuth initiation (google, github, azure, microsoft)
│   ├── GET  /complete-profile       # OAuth profile completion
│   └── POST /complete-profile       # Process profile completion
│
├── PROTECTED ROUTES (Auth Required)
│   ├── GET  /portal                 # Role dashboard (dual-context) or redirect to inbox
│   ├── POST /portal/switch          # Switch context (client/vendor)
│   ├── GET  /inbox                  # Unified case inbox (requires context)
│   ├── GET  /cases/:id              # Case detail (requires case access)
│   ├── GET  /cases/:id/thread       # Case thread partial (HTMX)
│   ├── POST /cases/:id/messages     # Send message to case
│   ├── POST /cases/new              # Create new case
│   ├── GET  /payments               # Payment dashboard (requires context)
│   ├── GET  /payments/:id           # Payment detail (requires payment access)
│   ├── POST /payments/:id/status    # Update payment status
│   ├── GET  /relationships          # Relationship management
│   ├── POST /relationships/invite   # Send vendor invitation
│   ├── GET  /notifications          # Notifications page
│   ├── GET  /api/notifications/unread  # Unread count (API)
│   ├── POST /api/notifications/read    # Mark notifications read (API)
│   ├── GET  /api/realtime-config    # Realtime config (public, no secrets)
│   ├── GET  /api/realtime-token     # Realtime token (auth required)
│   ├── GET  /settings               # Settings page
│   └── POST /settings/notifications  # Update notification preferences

/nexus/client/                       # Client Command Center (Client Context Required)
├── GET  /                           # Client dashboard
├── GET  /vendors                    # Vendor directory
├── GET  /invoices                   # AP Queue (invoice inbox)
├── GET  /invoices/:invoice_id       # Invoice detail
├── POST /invoices/:invoice_id/approve   # Approve invoice
├── POST /invoices/:invoice_id/dispute    # Dispute invoice (creates case)
├── GET  /payments                   # Payment outbox
├── GET  /payments/:payment_id       # Payment detail
├── GET  /cases                      # Issue tracker
├── GET  /cases/:case_id             # Case detail
├── POST /cases/:case_id/notes       # Add note (HTMX)
├── POST /cases/:case_id/evidence    # Upload evidence (HTMX)
├── POST /cases/:case_id/status      # Transition case status (HTMX)
├── POST /invite                     # Onboard vendor (send invitation)
├── GET  /notifications              # Client notifications
├── GET  /document-requests          # Document request list
├── GET  /document-requests/:id      # Document request detail
├── POST /document-requests          # Create document request
├── POST /document-requests/:id/accept   # Accept uploaded document
├── POST /document-requests/:id/reject   # Reject uploaded document
└── POST /document-requests/:id/cancel  # Cancel document request

/nexus/vendor/                       # Vendor Portal (Vendor Context Required)
├── GET  /cases/:case_id             # Vendor case detail
├── POST /cases/:case_id/notes       # Add note (HTMX)
├── POST /cases/:case_id/evidence    # Upload evidence (HTMX)
├── GET  /notifications              # Vendor notifications
├── GET  /document-requests          # Document request inbox
├── GET  /document-requests/:id      # Document request detail
└── POST /document-requests/:id/upload    # Upload document to fulfill request
```

### 2.2 Route Protection Levels

| Level | Middleware | Description |
|-------|-----------|-------------|
| **Public** | None | Marketing pages, login, sign-up |
| **Authenticated** | `requireNexusAuth` | Requires valid session, redirects to login |
| **Context Required** | `requireNexusAuth` + `requireNexusContext()` | Requires active context (client or vendor) |
| **Client Only** | `requireNexusAuth` + `requireNexusContext('client')` | Blocks vendors, requires client context (TC-*) |
| **Vendor Only** | `requireNexusAuth` + `requireNexusContext('vendor')` | Blocks clients, requires vendor context (TV-*) |
| **Resource Access** | `requireCaseAccess` / `requirePaymentAccess` | Validates tenant owns/is party to resource |

---

## 3. Authentication & Authorization

### 3.1 Authentication Flow

**Dual Authentication System:**
1. **Supabase Auth (Primary):** JWT-based, RLS-enabled
   - Email + password → `signInWithPassword()`
   - Returns `access_token` + `refresh_token`
   - JWT contains `app_metadata` with `nexus_user_id` and `nexus_tenant_id`
   - Enables RLS policies via `jwt_nexus_user_id()` and `jwt_nexus_tenant_id()`

2. **Legacy bcrypt (Fallback):** For users not yet migrated
   - Password hash stored in `nexus_users.password_hash`
   - Used if Supabase Auth fails or user not linked

**Session Management:**
- Session stored in PostgreSQL (`nexus_sessions` table)
- Cookie: `nexus_session` (httpOnly, secure in production, 24h expiry)
- Session data includes:
  - `user_id`, `tenant_id`
  - `active_context` ('client' | 'vendor')
  - `active_context_id` (TC-* or TV-*)
  - `active_counterparty` (optional TNT-*)
  - `data.authToken` (Supabase JWT if available)
  - `data.refreshToken` (Supabase refresh token if available)

### 3.2 Authorization Model

**Role-Based Access Control (RBAC):**
- **Roles:** `owner`, `admin`, `member`, `viewer`
- **Tenant Roles:** Scoped to tenant, not global
- **Context-Based:** Same user can have different roles in client vs vendor contexts

**Context Enforcement:**
- **Single Context Tenants:** Auto-select context on login
- **Dual Context Tenants:** Must select context via Role Dashboard (`/nexus/portal`)
- **Context Switching:** POST `/nexus/portal/switch` updates session

**Resource-Level Authorization:**
- **Cases:** User must be client or vendor of the case
- **Payments:** User must be payer (client) or payee (vendor)
- **Invoices:** Client can only see invoices from their vendors
- **Document Requests:** Client can only see requests they created; vendor can only see requests sent to them

### 3.3 Security Features

**Rate Limiting:**
- Global: 100 requests per 15 minutes per IP
- Realtime token: 30/min per session, 60/min per IP
- In-memory store with automatic cleanup

**CSP (Content Security Policy):**
- Configured via Helmet
- Allows inline styles (for creative/marketing content)
- Allows CDN resources (Tailwind, fonts, etc.)

**Session Security:**
- HttpOnly cookies (prevents XSS)
- Secure flag in production (HTTPS only)
- SameSite: lax (CSRF protection)
- 24-hour expiry

**RLS Enforcement:**
- All database queries use Supabase client with JWT
- RLS policies check `jwt_nexus_user_id()` and `jwt_nexus_tenant_id()`
- Service role key only used for admin operations (session creation, etc.)

---

## 4. Context System

### 4.1 Context Types

**Client Context (TC-*):**
- Tenant acting as a **buyer/payer**
- Manages vendors, invoices, payments, cases
- Routes: `/nexus/client/*`
- Facing: **down** (managing vendors below)

**Vendor Context (TV-*):**
- Tenant acting as a **seller/provider**
- Serves clients, responds to cases, uploads documents
- Routes: `/nexus/vendor/*`
- Facing: **up** (serving clients above)

### 4.2 Context Detection

**Single Context Tenants:**
- Auto-selects context on login
- No Role Dashboard shown
- Direct redirect to inbox

**Dual Context Tenants:**
- Shows Role Dashboard (`/nexus/portal`)
- User must select context before accessing protected routes
- Can switch context via `/nexus/portal/switch`

**Context Switching:**
```javascript
POST /nexus/portal/switch
Body: { context: 'client' | 'vendor', counterpartyId?: 'TNT-*' }
```
- Updates session `active_context` and `active_context_id`
- Updates `req.nexus` for current request
- Redirects to `/nexus/inbox`

### 4.3 Context Middleware

**`requireNexusContext(requiredContext?)`:**
- If no `requiredContext`: Auto-selects context if single, redirects to Role Dashboard if dual
- If `requiredContext === 'client'`: Forces client context, blocks if tenant has no client context
- If `requiredContext === 'vendor'`: Forces vendor context, blocks if tenant has no vendor context

---

## 5. Data Flow

### 5.1 Request Flow

```
1. Request arrives
   ↓
2. loadNexusSession middleware
   - Reads `nexus_session` cookie
   - Loads session from DB
   - Loads user, tenant, contexts
   - Populates `req.nexus`
   ↓
3. injectNexusLocals middleware
   - Adds `nexus`, `user`, `tenant`, `context` to `res.locals`
   - Available in all templates
   ↓
4. Route-specific middleware
   - requireNexusAuth: Checks `req.nexus.user` exists
   - requireNexusContext: Validates/selects context
   - requireCaseAccess: Validates case ownership
   - requirePaymentAccess: Validates payment ownership
   ↓
5. Route handler
   - Calls `nexusAdapter` methods
   - Adapter uses Supabase client with JWT (RLS enforced)
   - Returns data
   ↓
6. Template rendering
   - Nunjucks renders template with `res.locals`
   - HTMX partials for dynamic updates
   ↓
7. Response sent
```

### 5.2 Database Access Pattern

**Adapter Layer (`nexus-adapter.js`):**
- All database access goes through adapter
- Adapter uses `serviceClient` (Supabase client with service role) for admin operations
- Adapter uses `userClient` (Supabase client with JWT) for user-scoped operations
- RLS policies enforce tenant isolation

**Query Pattern:**
```javascript
// Admin operation (session creation, etc.)
const { data, error } = await nexusAdapter.serviceClient
  .from('nexus_users')
  .select('*')
  .eq('user_id', userId);

// User-scoped operation (RLS enforced)
const { data, error } = await nexusAdapter.userClient(req)
  .from('nexus_cases')
  .select('*')
  .eq('case_id', caseId);
```

---

## 6. Tenant-Facing Pages

### 6.1 Public Pages (No Auth)

| URL | Template | Description |
|-----|----------|-------------|
| `http://localhost:9000/` | `pages/landing.html` | Marketing landing page |
| `http://localhost:9000/manifesto` | `pages/manifesto.html` | Manifesto page |
| `http://localhost:9000/nexus/login` | `nexus/pages/login.html` | Login page |
| `http://localhost:9000/nexus/sign-up` | `nexus/pages/sign-up.html` | Sign up page |
| `http://localhost:9000/nexus/forgot-password` | `nexus/pages/forgot-password.html` | Forgot password page |
| `http://localhost:9000/nexus/reset-password` | `nexus/pages/reset-password.html` | Reset password page |
| `http://localhost:9000/nexus/accept` | `nexus/pages/accept.html` | Accept invitation page |
| `http://localhost:9000/nexus/oauth/callback` | `nexus/pages/oauth_callback.html` | OAuth callback handler |
| `http://localhost:9000/nexus/complete-profile` | `nexus/pages/complete-profile.html` | OAuth profile completion |

### 6.2 Portal Pages (Auth Required)

| URL | Template | Context | Description |
|-----|----------|---------|-------------|
| `http://localhost:9000/nexus/portal` | `nexus/pages/role-dashboard.html` | Dual-context only | Role selection dashboard |
| `http://localhost:9000/nexus/inbox` | `nexus/pages/inbox.html` | Any | Unified case inbox |
| `http://localhost:9000/nexus/cases/:id` | `nexus/pages/case-detail.html` | Any | Case detail (requires case access) |
| `http://localhost:9000/nexus/payments` | `nexus/pages/payments.html` | Any | Payment dashboard |
| `http://localhost:9000/nexus/payments/:id` | `nexus/pages/payment-detail.html` | Any | Payment detail (requires payment access) |
| `http://localhost:9000/nexus/relationships` | `nexus/pages/relationships.html` | Any | Relationship management |
| `http://localhost:9000/nexus/notifications` | `nexus/pages/notifications.html` | Any | Notifications page |
| `http://localhost:9000/nexus/settings` | `nexus/pages/settings.html` | Any | Settings page |

### 6.3 Client Command Center Pages (Client Context Required)

| URL | Template | Description |
|-----|----------|-------------|
| `http://localhost:9000/nexus/client` | `nexus/pages/client-dashboard.html` | Client dashboard (aggregate metrics) |
| `http://localhost:9000/nexus/client/vendors` | `nexus/pages/vendor-directory.html` | Vendor directory |
| `http://localhost:9000/nexus/client/invoices` | `nexus/pages/client-invoices.html` | AP Queue (invoice inbox with tabs) |
| `http://localhost:9000/nexus/client/invoices/:invoice_id` | `nexus/pages/client-invoice-detail.html` | Invoice detail with matching signal |
| `http://localhost:9000/nexus/client/payments` | `nexus/pages/client-payments.html` | Payment outbox |
| `http://localhost:9000/nexus/client/payments/:payment_id` | `nexus/pages/client-payment-detail.html` | Payment detail |
| `http://localhost:9000/nexus/client/cases` | `nexus/pages/client-cases.html` | Issue tracker |
| `http://localhost:9000/nexus/client/cases/:case_id` | `nexus/pages/client-case-detail.html` | Case detail with timeline |
| `http://localhost:9000/nexus/client/notifications` | `nexus/pages/client-notifications.html` | Client notifications |
| `http://localhost:9000/nexus/client/document-requests` | `nexus/pages/client-document-requests.html` | Document request list |
| `http://localhost:9000/nexus/client/document-requests/:id` | `nexus/pages/client-document-request-detail.html` | Document request detail |

### 6.4 Vendor Portal Pages (Vendor Context Required)

| URL | Template | Description |
|-----|----------|-------------|
| `http://localhost:9000/nexus/vendor/cases/:case_id` | `nexus/pages/vendor-case-detail.html` | Vendor case detail |
| `http://localhost:9000/nexus/vendor/notifications` | `nexus/pages/vendor-notifications.html` | Vendor notifications |
| `http://localhost:9000/nexus/vendor/document-requests` | `nexus/pages/vendor-document-requests.html` | Document request inbox |
| `http://localhost:9000/nexus/vendor/document-requests/:id` | `nexus/pages/vendor-document-request-detail.html` | Document request detail |

### 6.5 Error Pages

| URL | Template | Description |
|-----|----------|-------------|
| `http://localhost:9000/nexus/*` (404) | `nexus/pages/error.html` | 404 Not Found |
| `http://localhost:9000/nexus/*` (500) | `nexus/pages/error.html` | 500 Internal Server Error |

---

## 7. API Endpoints

### 7.1 Public APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/nexus/api/realtime-config` | GET | None | Returns Supabase URL and anon key for client-side realtime |

### 7.2 Protected APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/nexus/api/notifications/unread` | GET | Required | Get unread notification counts |
| `/nexus/api/notifications/read` | POST | Required | Mark notifications as read |
| `/nexus/api/realtime-token` | GET | Required | Get short-lived access token for Realtime (rate limited) |

---

## 8. HTMX Integration

### 8.1 HTMX Patterns

**Partial Loading:**
- Case thread: `hx-get="/nexus/cases/:id/thread" hx-trigger="load"`
- Evidence upload: `hx-post="/nexus/client/cases/:id/evidence" hx-encoding="multipart/form-data"`

**Dynamic Updates:**
- Status transitions: `hx-post="/nexus/client/cases/:id/status" hx-target="#case-timeline"`
- Notes: `hx-post="/nexus/client/cases/:id/notes" hx-swap="afterbegin"`

**OOB Swaps:**
- Evidence upload updates both timeline and evidence list
- Status transition updates status badge and timeline

### 8.2 HTMX Partials

| Partial | Template | Usage |
|---------|----------|-------|
| Case thread | `nexus/partials/case-thread.html` | Message thread in case detail |
| Single message | `nexus/partials/single-message.html` | New message in thread |
| Case timeline item | `nexus/partials/case-timeline-item.html` | Timeline entry |
| Case evidence item | `nexus/partials/case-evidence-item.html` | Evidence in sidebar |
| Case evidence upload response | `nexus/partials/case-evidence-upload-response.html` | Evidence upload result (timeline + evidence) |
| Case status actions | `nexus/partials/case-status-actions.html` | Status transition buttons |
| Case status transition response | `nexus/partials/case-status-transition-response.html` | Status transition result |
| Context badge | `nexus/partials/context-badge.html` | Context indicator |
| Notification bell | `nexus/partials/notification-bell.html` | Notification bell with count |

---

## 9. File Upload System

### 9.1 Upload Constraints

**Evidence Upload:**
- Max size: 10MB (configured in `nexus-adapter.js`)
- Allowed types: PDF, PNG, JPG, DOCX, XLSX
- Storage: Supabase Storage bucket `nexus-evidence`
- Path pattern: `evidence/{case_id}/{timestamp}_{filename}`

**Document Upload:**
- Same constraints as evidence
- Path pattern: `documents/{request_id}/{filename}`

### 9.2 Upload Flow

```
1. User selects file
   ↓
2. Multer validates (size, type)
   ↓
3. File stored in memory buffer
   ↓
4. Adapter uploads to Supabase Storage
   ↓
5. Database record created (evidence or document)
   ↓
6. HTMX response with timeline item + evidence item
```

---

## 10. Notification System

### 10.1 Notification Types

| Type | Description | Priority |
|------|-------------|----------|
| `case_created` | New case created | Normal |
| `message_received` | New message in case | Normal |
| `payment_pending` | Payment pending | Normal |
| `payment_processing` | Payment processing | Normal |
| `payment_completed` | Payment completed | Normal |
| `payment_failed` | Payment failed | Critical |
| `vendor_linked` | Vendor linked to client | Normal |
| `invoice_sent` | Invoice sent to client | Normal |
| `invoice_approved` | Invoice approved | Normal |
| `invoice_disputed` | Invoice disputed | Critical |
| `document_requested` | Document request created | Normal |
| `document_uploaded` | Document uploaded | Normal |
| `document_accepted` | Document accepted | Normal |
| `document_rejected` | Document rejected | Normal |

### 10.2 Notification Delivery

**Channels:**
- **Realtime:** Supabase Realtime subscriptions (browser)
- **Push:** Web Push Notifications (VAPID)
- **Email:** Email digest (future)

**Preferences:**
- User-level: `nexus_user_notification_prefs`
- Tenant-level: `nexus_notification_config`

---

## 11. Realtime System

### 11.1 Realtime Architecture

**Client-Side:**
- Browser connects to Supabase Realtime
- Uses access token from `/nexus/api/realtime-token`
- Subscribes to channels: `nexus_cases`, `nexus_messages`, `nexus_notifications`

**Token Management:**
- Short-lived access tokens (5-minute expiry)
- Auto-refresh if expiring soon
- Rate limited: 30/min per session, 60/min per IP
- Returns 401 if no auth token (legacy bcrypt users)

### 11.2 Realtime Channels

| Channel | Table | Events | Description |
|---------|-------|--------|-------------|
| `nexus_cases` | `nexus_cases` | INSERT, UPDATE | Case updates |
| `nexus_messages` | `nexus_messages` | INSERT | New messages |
| `nexus_notifications` | `nexus_notifications` | INSERT, UPDATE | Notification updates |

---

## 12. Error Handling

### 12.1 Error Types

| Error | Status | Handler |
|-------|--------|---------|
| Not Found | 404 | `nexus/pages/error.html` |
| Unauthorized | 401 | Redirect to `/nexus/login` |
| Forbidden | 403 | `nexus/pages/error.html` |
| Bad Request | 400 | JSON error or error page |
| Internal Server Error | 500 | `nexus/pages/error.html` + logging |

### 12.2 Error Logging

**Structured Logging:**
- Uses `nexus-logger.js` utility
- Error codes: `ErrorCodes.NOT_FOUND`, `ErrorCodes.INTERNAL_ERROR`, etc.
- Error categories: `ErrorCategories.CLIENT`, `ErrorCategories.SERVER`
- Includes correlation ID, path, method, user ID

---

## 13. Health Checks

### 13.1 Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Full health check (all dependencies) |
| `/health/live` | Liveness probe (server running) |
| `/health/ready` | Readiness probe (dependencies ready) |

### 13.2 Dependency Checks

**Registered Dependencies:**
- **Supabase:** Critical, 3s timeout
  - Checks: `nexus_tenants` table query

---

## 14. Security Considerations

### 14.1 RLS Enforcement

**100% RLS Coverage:**
- All tenant-scoped queries use JWT
- RLS policies check `jwt_nexus_user_id()` and `jwt_nexus_tenant_id()`
- Service role key only for admin operations (session management)

### 14.2 Anti-Enumeration

**404 for Unauthorized Access:**
- Cases: Returns 404 if user is not client or vendor
- Payments: Returns 404 if user is not payer or payee
- Prevents information leakage about resource existence

### 14.3 Input Validation

**Validation Points:**
- Route handlers validate required fields
- Multer validates file size and type
- Adapter validates UUIDs, status transitions
- Nunjucks auto-escapes template variables

---

## 15. Performance Optimizations

### 15.1 Database

**Indexes:**
- `nexus_cases`: `client_id`, `vendor_id`, `status`, `created_at`
- `nexus_payments`: `from_id`, `to_id`, `status`, `created_at`
- `nexus_messages`: `case_id`, `created_at`
- `nexus_notifications`: `user_id`, `tenant_id`, `read_at`

**Query Optimization:**
- Pagination for large lists
- Parallel queries where possible (dashboard)
- Selective field loading (not `SELECT *`)

### 15.2 Caching

**Session Caching:**
- Session loaded once per request
- Last active timestamp updated asynchronously

**Rate Limit Store:**
- In-memory Map (simple, fast)
- Automatic cleanup of expired entries

---

## 16. Testing & Monitoring

### 16.1 Test Coverage

**Test Files:**
- `tests/` directory (41 test files)
- Vitest configuration
- Playwright for E2E

### 16.2 Monitoring

**Logging:**
- Structured logging via `nexus-logger.js`
- Error tracking with correlation IDs
- Request logging middleware

**Health Checks:**
- Kubernetes-ready liveness/readiness probes
- Dependency health tracking

---

## 17. Deployment Configuration

### 17.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | - | Service role key (admin) |
| `SUPABASE_ANON_KEY` | Yes | - | Anon key (RLS) |
| `SESSION_DB_URL` | Yes | - | PostgreSQL connection string for sessions |
| `SESSION_SECRET` | No | `dev-secret-change-in-production` | Session encryption secret |
| `PORT` | No | `9000` | Server port |
| `NODE_ENV` | No | `development` | Environment (development/production/test) |
| `BASE_URL` | No | `http://localhost:9000` | Base URL for redirects |
| `BASE_PATH` | No | `` | Base path prefix (for subdirectory deployment) |
| `VAPID_PUBLIC_KEY` | No | `` | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | No | `` | VAPID private key for push notifications |
| `FEATURE_MATCHING_PILOT` | No | `false` | Enable invoice matching pilot feature |

### 17.2 Production Considerations

**Security:**
- `SESSION_SECRET` must be strong random string
- `NODE_ENV=production` enables secure cookies
- CSP headers enforced
- Rate limiting active

**Performance:**
- Compression enabled
- Static file serving optimized
- Database connection pooling (via Supabase)

---

## 18. Known Limitations & Future Work

### 18.1 Current Limitations

1. **Legacy Auth Migration:** Some users still on bcrypt (no Realtime access)
2. **Email Notifications:** Not yet implemented (preferences exist)
3. **OAuth Profile Completion:** Requires cookie-based pending data
4. **Document Request Emails:** Not yet sent (invite link returned directly)

### 18.2 Future Enhancements

1. **Full OAuth Migration:** Remove bcrypt fallback
2. **Email Delivery:** SMTP integration for notifications
3. **Advanced Matching:** ML-based invoice matching
4. **Audit Logging:** Comprehensive audit trail
5. **Multi-Company Groups:** Enhanced group management

---

## 19. Conclusion

The Nexus VMP system is a production-ready, multi-tenant B2B platform with:
- ✅ Complete RLS enforcement
- ✅ Dual-context support (client/vendor)
- ✅ Comprehensive authentication & authorization
- ✅ Real-time updates via Supabase Realtime
- ✅ HTMX-powered dynamic UI
- ✅ File upload & document management
- ✅ Notification system
- ✅ Health checks & monitoring

**Current Position:** Phase 13 - Legacy VMP removed, Nexus-only architecture. All routes, authentication, and data access are fully implemented and production-ready.

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Author:** AI Assistant (360° Deep Dive Analysis)

