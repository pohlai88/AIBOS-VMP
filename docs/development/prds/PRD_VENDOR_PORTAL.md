# Vendor Portal: Feature Analysis & Roadmap

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Strategic Planning  
**Purpose:** Comprehensive feature analysis for Vendor Management Platform focusing on Vendor Portal  
**Related:** [NEXUS_VMP_VENDOR_MASTERCCP.md](../archive/___NEXUS_VMP_VENDOR_MASTERCCP.md)  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Current State Consolidation](#current-state-consolidation)
2. [Platform Architecture](#platform-architecture)
3. [Essential Features (Fundamental)](#essential-features-fundamental)
4. [Good to Have Features (User-Centric Design)](#good-to-have-features-user-centric-design)
5. [Silent Killer Features (Pain-Point Solving)](#silent-killer-features-pain-point-solving)
6. [Database Design Recommendations](#database-design-recommendations)
7. [Implementation Priority Matrix](#implementation-priority-matrix)
8. [Next Steps](#next-steps)

---

## Current State Consolidation

### Platform Overview

**NexusCanon VMP** is a **Vendor Management Platform** with two distinct portals:

| Portal | Purpose | User Type | Current Status |
|--------|---------|-----------|----------------|
| **Client Platform** | Internal operations (AP/Procurement) | Internal staff | ✅ Fully functional (21 routes) |
| **Vendor Portal** | External vendor self-service | Vendor users | ⚠️ **PRIMARY FOCUS** (7 routes) |

### Current Vendor Portal Routes

**Existing Routes** (`src/routes/nexus-vendor.js`):

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/nexus/vendor/cases/:case_id` | GET | View case detail | ✅ Implemented |
| `/nexus/vendor/cases/:case_id/notes` | POST | Add internal note | ✅ Implemented |
| `/nexus/vendor/cases/:case_id/evidence` | POST | Upload evidence file | ✅ Implemented |
| `/nexus/vendor/notifications` | GET | View notifications | ✅ Implemented |
| `/nexus/vendor/document-requests` | GET | List document requests | ✅ Implemented |
| `/nexus/vendor/document-requests/:id` | GET | View document request detail | ✅ Implemented |
| `/nexus/vendor/document-requests/:id/upload` | POST | Upload requested document | ✅ Implemented |

**Missing Critical Routes:**
- ❌ Vendor Dashboard (home page)
- ❌ Invoice submission/management
- ❌ Payment tracking/history
- ❌ Case creation (vendor-initiated)
- ❌ Profile/settings management
- ❌ Relationship management

### Current Client Platform Routes

**Existing Routes** (`src/routes/nexus-client.js`): 21 routes covering:
- ✅ Vendor management
- ✅ Invoice processing
- ✅ Payment orchestration
- ✅ Case management
- ✅ Document requests
- ✅ Notifications

### Database Schema Status

**Core Tables (Nexus System):**
- ✅ `nexus_tenants` - Multi-tenant isolation
- ✅ `nexus_users` - User management (linked to Supabase Auth)
- ✅ `nexus_tenant_relationships` - Client-Vendor relationships
- ✅ `nexus_cases` - Case management
- ✅ `nexus_case_messages` - Communication thread
- ✅ `nexus_case_evidence` - Document uploads
- ✅ `nexus_invoices` - Invoice records
- ✅ `nexus_payments` - Payment tracking
- ✅ `nexus_notifications` - Notification system
- ✅ `nexus_document_requests` - Document exchange

**Legacy Tables (VMP System):**
- ⚠️ `vmp_*` tables still exist (migration pending)
- ⚠️ Dual schema causing complexity

---

## Platform Architecture

### Strategic Vision: "Control Center" vs "Work Hub"

**Core Philosophy:**
- **Client Platform (Internal):** The "Control Center" — Used by Admins to approve, review, and pay. **Keep this simple & functional.**
- **Vendor Portal (External):** The "Work Hub" — Used by Vendors to onboard, submit work, and get paid. **Make this polished & powerful.**

> **Key Insight:** If vendors love using it, your data quality goes up and your administrative burden goes down.

### Multi-Tenant Design

```
┌─────────────────────────────────────────────────────────┐
│                    NEXUS PLATFORM                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │  CLIENT PLATFORM  │      │  VENDOR PORTAL   │       │
│  │  (Control Center) │      │   (Work Hub)     │       │
│  │   Internal Use    │      │   External Use   │       │
│  │                   │      │                  │       │
│  │  • Vendor Mgmt    │◄────►│  • Self-Onboard  │       │
│  │  • Invoice Proc   │      │  • PO Management │       │
│  │  • Payment Run    │      │  • Invoice Sub   │       │
│  │  • Case Triage    │      │  • Payment Track │       │
│  │  • SOA Recon      │      │  • Compliance    │       │
│  │  • Approvals      │      │  • Performance   │       │
│  └──────────────────┘      └──────────────────┘       │
│           │                          │                  │
│           └──────────┬───────────────┘                  │
│                      │                                    │
│           ┌──────────▼──────────┐                       │
│           │   NEXUS ADAPTER     │                       │
│           │  (Business Logic)   │                       │
│           │  + Metadata Layer   │                       │
│           └──────────┬──────────┘                       │
│                      │                                    │
│           ┌──────────▼──────────┐                       │
│           │   SUPABASE DB      │                       │
│           │  (PostgreSQL + RLS)│                       │
│           │  + Metadata JSONB  │                       │
│           └────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### Context Switching

**Multi-Context Support:**
- Tenants can be **Pure Client** (TC-* only)
- Tenants can be **Pure Vendor** (TV-* only)
- Tenants can be **Dual** (both TC-* and TV-*)
- Users can switch contexts via `/nexus/portal/switch`

---

## Essential Features (Fundamental)

> **Definition:** Features that are **absolutely required** for the platform to function. Without these, vendors cannot perform basic operations. These are the "Table Stakes."

### 1. Self-Service Onboarding

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Registration:** Vendors register with email, verify email, and create account
- **Profile Setup:** Fill out company profile (name, tax ID, address, contact info)
- **Compliance Documents:** Upload mandatory documents (Tax forms, Insurance, Certifications) with expiration dates
- **Bank Details:** Secure entry of payment details (Metadata-driven validation based on country)
- **Service/Product Catalog:** List what they do or sell (Standardized SKU/Service codes)
- **Onboarding Wizard:** Step-by-step guided process with progress indicator

**Routes:**
- `GET /nexus/vendor/onboard` - Onboarding wizard start
- `POST /nexus/vendor/onboard/step/:step` - Submit onboarding step
- `GET /nexus/vendor/onboard/status` - Check onboarding completion status

**Metadata-Driven Configuration:**
```javascript
// vendor_onboarding_config in nexus_tenants.metadata
{
  "onboarding": {
    "required_documents": {
      "US": ["W-9", "Insurance Certificate", "Business License"],
      "SG": ["ACRA Certificate", "GST Registration", "Insurance"],
      "MY": ["SSM Certificate", "Tax Certificate", "Insurance"]
    },
    "bank_validation": {
      "US": { "routing_number_format": "9 digits", "account_number_min": 8 },
      "SG": { "bank_code_format": "3 digits", "account_number_format": "7-10 digits" }
    }
  }
}
```

**Pain Point Solved:** Eliminates manual admin setup. Vendors can onboard themselves 24/7 without waiting for admin assistance.

---

### 2. Compliance & KYC Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Document Upload:** Mandatory document upload (Tax forms, Insurance, Certifications)
- **Expiration Tracking:** System tracks document expiration dates
- **Renewal Reminders:** Automated reminders 30/60/90 days before expiration
- **Document Wallet:** Central place where vendors store company docs once, re-use for multiple contracts
- **Version History:** Track document versions and changes
- **Compliance Status:** Dashboard showing overall compliance status (compliant, expiring soon, expired)

**Routes:**
- `GET /nexus/vendor/compliance` - Compliance dashboard
- `POST /nexus/vendor/compliance/documents` - Upload compliance document
- `GET /nexus/vendor/compliance/documents/:id` - View document
- `POST /nexus/vendor/compliance/documents/:id/renew` - Renew expired document

**Database:**
```sql
CREATE TABLE nexus_vendor_documents (
  id UUID PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'tax_form', 'insurance', 'certification'
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'expiring_soon', 'expired'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pain Point Solved:** Prevents working with non-compliant vendors. Automated tracking reduces manual compliance checks.

---

### 3. Service/Product Catalog

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Catalog Management:** Vendors list what they do or sell (Standardized SKU/Service codes)
- **Category Selection:** Choose from predefined categories or create custom
- **Pricing Information:** Optional pricing display (can be hidden for negotiation)
- **Service Description:** Detailed description of services/products offered
- **Catalog Search:** Clients can search vendor catalog when creating POs

**Routes:**
- `GET /nexus/vendor/catalog` - View catalog
- `POST /nexus/vendor/catalog/items` - Add catalog item
- `PUT /nexus/vendor/catalog/items/:id` - Update catalog item
- `DELETE /nexus/vendor/catalog/items/:id` - Remove catalog item

**Database:**
```sql
CREATE TABLE nexus_vendor_catalog (
  id UUID PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  item_code TEXT NOT NULL, -- Standardized SKU/Service code
  item_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  unit_price DECIMAL(10,2),
  unit TEXT, -- 'each', 'hour', 'kg', etc.
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pain Point Solved:** Standardizes vendor offerings, making PO creation faster and more accurate.

---

### 4. Purchase Order (PO) Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **PO Receipt:** Vendors can receive POs sent by clients
- **PO View:** View full PO details (items, quantities, prices, delivery dates)
- **PO Acknowledgment:** "Acknowledge" PO to confirm receipt and acceptance
- **PO Status Tracking:** Track PO status (sent, acknowledged, in_progress, completed, cancelled)
- **Magic Link Actions:** Send emails with secure, one-time links for quick actions (e.g., "Click to Confirm PO") without needing to login

**Routes:**
- `GET /nexus/vendor/purchase-orders` - List all POs
- `GET /nexus/vendor/purchase-orders/:id` - View PO detail
- `POST /nexus/vendor/purchase-orders/:id/acknowledge` - Acknowledge PO
- `GET /nexus/vendor/purchase-orders/:id/acknowledge/:token` - Magic link acknowledgment (no login required)

**Magic Link Implementation:**
```javascript
// Generate secure token for PO acknowledgment
const token = crypto.randomBytes(32).toString('hex');
await nexusAdapter.createMagicLink({
  type: 'po_acknowledge',
  po_id: poId,
  token: token,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
});

// Email contains: https://portal.example.com/po/acknowledge/{po_id}/{token}
```

**Pain Point Solved:** Vendors forget passwords constantly. Magic links remove the login barrier for simple tasks like PO acknowledgment.

---

### 5. Vendor Dashboard (Home Page)

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- Overview of all active cases (count by status)
- Pending document requests count
- Recent payment activity (last 5 payments)
- Unread notifications count
- Quick actions (Create Case, Upload Document)
- SLA warnings (cases approaching deadline)

**Route:** `GET /nexus/vendor`  
**Template:** `nexus/pages/vendor_dashboard.html`

**Database Query:**
```sql
-- Aggregate counts for dashboard
SELECT 
  (SELECT COUNT(*) FROM nexus_cases WHERE vendor_id = $1 AND status = 'open') as open_cases,
  (SELECT COUNT(*) FROM nexus_document_requests WHERE vendor_id = $1 AND status = 'requested') as pending_docs,
  (SELECT COUNT(*) FROM nexus_notifications WHERE context_id = $1 AND is_read = false) as unread_notifications
```

---

### 6. Invoice Submission & Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Submit Invoice:** Upload PDF/image, extract data (AI-assisted), manual entry fallback
- **Smart Pre-Emptive Recon:** System validates invoice *before* submission. If amount > PO amount, blocks submission with clear error
- **Invoice List:** View all submitted invoices with status (draft, sent, viewed, approved, disputed, paid)
- **Invoice Detail:** View full invoice details, line items, matching status (PO/GRN), payment status
- **Invoice Status Tracking:** Real-time updates when client views/approves/disputes
- **Resubmit/Amend:** Ability to correct errors before approval

**Routes:**
- `GET /nexus/vendor/invoices` - Invoice list
- `GET /nexus/vendor/invoices/:id` - Invoice detail
- `POST /nexus/vendor/invoices` - Submit new invoice (with validation)
- `POST /nexus/vendor/invoices/:id/upload` - Upload invoice file
- `POST /nexus/vendor/invoices/:id/dispute` - Dispute rejection
- `POST /nexus/vendor/invoices/validate` - Pre-submission validation endpoint

**Pre-Emptive Validation (Zod Schema):**
```javascript
// src/schemas/invoice.schema.js
export const InvoiceSubmissionSchema = z.object({
  po_id: z.string().uuid(),
  invoice_number: z.string(),
  invoice_date: z.date(),
  amount: z.number().positive(),
  line_items: z.array(z.object({
    item_code: z.string(),
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
    total: z.number().positive()
  }))
}).refine(async (data) => {
  // Fetch PO and validate amount
  const po = await nexusAdapter.getPurchaseOrder(data.po_id);
  if (data.amount > po.total_amount) {
    throw new z.ZodError([{
      path: ['amount'],
      message: `Invoice amount (${data.amount}) exceeds PO amount (${po.total_amount})`
    }]);
  }
  return true;
});
```

**Pain Point Solved:** 
- **Primary:** Vendors currently have no visibility into invoice status. They submit via email and wait for payment with no feedback loop.
- **Silent Killer:** Eliminates the "Invoice Rejected 3 weeks later" cycle. Vendors know immediately if their invoice will be rejected.

---

### 7. Payment Tracking & History

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Payment List:** All payments received (pending, processing, completed, failed)
- **Payment Detail:** Amount, date, method, remittance details, linked invoices
- **Payment Status:** Real-time updates (pending → processing → completed)
- **Remittance Download:** PDF remittance advice download
- **Payment History:** Historical payments with search/filter
- **Outstanding Balance:** Total amount pending payment

**Routes:**
- `GET /nexus/vendor/payments` - Payment list
- `GET /nexus/vendor/payments/:id` - Payment detail
- `GET /nexus/vendor/payments/:id/remittance` - Download remittance PDF

**Pain Point Solved:** Vendors don't know when payment is coming, causing cash flow uncertainty and unnecessary follow-up calls.

---

### 8. Case Management (Vendor-Initiated)

**Priority:** 🔴 **CRITICAL**  
**Status:** ⚠️ **PARTIAL** (can view, cannot create)

**Current State:**
- ✅ Can view case detail
- ✅ Can add notes
- ✅ Can upload evidence
- ❌ **Cannot create new cases**

**Missing:**
- `POST /nexus/vendor/cases` - Create new case
- Case type selection (invoice dispute, payment inquiry, document request, general)
- Case creation wizard with checklist
- Auto-assignment to client AP team

**Requirements:**
- **Create Case:** Simple form with case type, subject, description
- **Case Types:** Invoice dispute, Payment inquiry, Document request, General inquiry
- **Auto-Checklist:** System generates required checklist steps based on case type
- **Evidence Upload:** Attach supporting documents during creation
- **Case List:** View all cases (open, in progress, resolved, closed)

**Route:** `POST /nexus/vendor/cases`  
**Template:** `nexus/pages/vendor_case_create.html`

---

### 9. Profile & Settings Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Profile View:** Company name, tax ID, address, contact info
- **Profile Edit:** Update non-critical fields (address, phone, website)
- **Bank Details:** View bank account (masked), update via Change Request Case
- **Settings:** Notification preferences, email digest frequency
- **Password Management:** Change password, enable 2FA (future)

**Routes:**
- `GET /nexus/vendor/profile` - View profile
- `POST /nexus/vendor/profile` - Update profile (gated fields require case)
- `GET /nexus/vendor/settings` - View settings
- `POST /nexus/vendor/settings` - Update settings

**Business Rule:** Critical fields (tax_id, bank_account) require **Change Request Case** for audit trail.

---

### 10. Bank Details Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Secure Entry:** Secure entry of payment details (Metadata-driven validation based on country)
- **Bank Account View:** View bank account (masked) - e.g., "****1234"
- **Update via Change Request:** Critical fields require Change Request Case for audit trail
- **Multi-Currency Support:** Support multiple bank accounts for different currencies
- **Validation:** Real-time validation of bank account format based on country

**Routes:**
- `GET /nexus/vendor/bank-details` - View bank details (masked)
- `POST /nexus/vendor/bank-details/change-request` - Create change request case
- `GET /nexus/vendor/bank-details/validation/:country` - Get validation rules for country

**Metadata-Driven Validation:**
```javascript
// Bank validation rules in metadata
{
  "bank_validation": {
    "US": {
      "routing_number": { "format": "9 digits", "pattern": "^\\d{9}$" },
      "account_number": { "min_length": 8, "max_length": 17 }
    },
    "SG": {
      "bank_code": { "format": "3 digits", "pattern": "^\\d{3}$" },
      "account_number": { "format": "7-10 digits", "pattern": "^\\d{7,10}$" }
    }
  }
}
```

**Pain Point Solved:** Reduces payment errors and delays. Vendors can update bank details securely without manual admin intervention.

---

### 11. Document Management

**Priority:** 🔴 **CRITICAL**  
**Status:** ✅ **IMPLEMENTED** (partial)

**Current State:**
- ✅ Can view document requests
- ✅ Can upload requested documents
- ❌ Cannot view document library
- ❌ Cannot track document expiry

**Missing:**
- `GET /nexus/vendor/documents` - Document library (all uploaded documents)
- Document expiry tracking and renewal reminders
- Document version history
- Document search/filter

---

## Good to Have Features (User-Centric Design)

> **Definition:** Features that **enhance user experience** but are not strictly required for core functionality. These make the Vendor feel respected and empower them to work faster.

### 1. The "Pulse" Dashboard

**Priority:** 🟡 **HIGH**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Actions Required:** Prominent display of items needing vendor attention (unacknowledged POs, pending documents, disputed invoices)
- **Recent Payments:** Visual timeline of recent payments with amounts and dates
- **Performance Score:** Overall vendor performance metrics (on-time delivery, invoice accuracy, response time)
- **Quick Stats:** Key metrics at a glance (total outstanding, average payment time, active POs)
- **Visual Indicators:** Color-coded status badges, progress bars, trend arrows

**Design:**
```
┌─────────────────────────────────────────────────┐
│  VENDOR PULSE DASHBOARD                         │
├─────────────────────────────────────────────────┤
│  ⚠️  Actions Required: 3                        │
│     • 2 POs pending acknowledgment              │
│     • 1 document expiring in 15 days             │
│                                                  │
│  💰 Recent Payments                             │
│     $5,000 - Jan 15 (Invoice #INV-001)         │
│     $3,200 - Jan 10 (Invoice #INV-002)         │
│                                                  │
│  📊 Performance Score: 8.5/10                    │
│     ✓ On-time delivery: 95%                     │
│     ✓ Invoice accuracy: 98%                     │
│     ✓ Response time: 2.3 hours                  │
└─────────────────────────────────────────────────┘
```

**Pain Point Solved:** Vendors get overwhelmed with information. The Pulse Dashboard gives them a clear, prioritized view of what matters most.

---

### 2. Multi-User Access

**Priority:** 🟡 **HIGH**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Role-Based Access:** Allow vendor to have multiple users under one account
- **Role Types:** 
  - **Finance Manager:** Can view invoices, payments, bank details
  - **Project Manager:** Can view POs, cases, documents
  - **Admin:** Full access to all features
- **User Invitation:** Vendor admin can invite team members via email
- **Permission Management:** Granular permissions per role

**Routes:**
- `GET /nexus/vendor/users` - List team members
- `POST /nexus/vendor/users/invite` - Invite new user
- `PUT /nexus/vendor/users/:id/role` - Update user role
- `DELETE /nexus/vendor/users/:id` - Remove user

**Database:**
```sql
CREATE TABLE nexus_vendor_users (
  id UUID PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  nexus_user_id UUID REFERENCES nexus_users(id),
  role TEXT NOT NULL, -- 'admin', 'finance_manager', 'project_manager'
  permissions JSONB DEFAULT '{}',
  invited_by UUID,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ
);
```

**Pain Point Solved:** Large vendors have multiple people handling different aspects. Multi-user access prevents password sharing and improves accountability.

---

### 3. Real-Time Chat/Comments

**Priority:** 🟡 **HIGH**  
**Status:** ✅ **IMPLEMENTED** (backend ready, needs UI polish)

**Enhancements:**
- Browser push notifications (Web Push API)
- Email digest (hourly/daily/weekly)
- SMS notifications for critical events (payment received, case escalated)
- Notification preferences per type
- Quiet hours configuration

**Current:** Realtime subscriptions work, but UI needs notification center with read/unread management.

---

### 4. Real-Time Chat/Comments (Contextual)

**Priority:** 🟡 **HIGH**  
**Status:** ⚠️ **PARTIAL** (case messages exist, but not contextual chat)

**Enhancements:**
- **Contextual Chat:** Chat directly on specific Orders or Invoices (not just cases)
- **Threaded Conversations:** Each PO/Invoice has its own chat thread
- **File Attachments:** Attach files in chat (receipts, photos, documents)
- **Read Receipts:** See when client has read your message
- **Typing Indicators:** Show when client is typing
- **Email Integration:** Chat messages can be sent as email if vendor prefers

**Implementation:**
- Extend `nexus_case_messages` to support `context_type` and `context_id`
- Use Supabase Realtime for live chat updates
- Store chat metadata in `metadata` JSONB field

**Pain Point Solved:** No more lost emails. All communication is contextual and searchable. Vendors can quickly find conversations about specific invoices or orders.

---

### 5. Mobile-Friendly Interface

**Priority:** 🟡 **HIGH**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Global Search:** Search across cases, invoices, payments, documents
- **Smart Filters:** Filter by date range, status, amount, case type
- **Saved Filters:** Save frequently used filter combinations
- **Export Results:** Export filtered results to CSV/PDF

**Implementation:**
- Use PostgreSQL full-text search (`tsvector`, `tsquery`)
- Add filter UI components to list pages
- Store saved filters in `nexus_users.preferences`

---

### 8. Invoice Bulk Upload

**Priority:** 🟡 **MEDIUM**  
**Status:** ❌ **MISSING**

**Requirements:**
- Upload multiple invoices at once (ZIP file or multiple files)
- Batch processing with progress indicator
- Error handling for failed uploads
- Bulk status updates

**Use Case:** Large vendors submit 50+ invoices monthly. Manual upload is tedious.

---

### 9. Payment Forecasting

**Priority:** 🟡 **MEDIUM**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Expected Payments:** Show invoices awaiting payment with estimated payment dates
- **Cash Flow Calendar:** Visual calendar of expected payments
- **Payment Trends:** Historical payment patterns (average days to pay)
- **Outstanding Aging:** Age analysis of unpaid invoices

**Database Query:**
```sql
-- Payment forecast based on invoice due dates and historical payment patterns
SELECT 
  invoice_id,
  invoice_date,
  due_date,
  amount,
  CASE 
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'upcoming'
  END as payment_status,
  -- Calculate expected payment date based on historical average
  due_date + INTERVAL '5 days' as expected_payment_date
FROM nexus_invoices
WHERE vendor_id = $1 
  AND status IN ('sent', 'viewed', 'approved')
ORDER BY due_date
```

---

### 5. Mobile-Friendly Interface

**Priority:** 🟡 **HIGH**  
**Status:** ⚠️ **PARTIAL**

**Requirements:**
- **Responsive Layouts:** All pages work perfectly on mobile devices
- **Touch-Friendly UI:** Large buttons, swipe gestures, mobile-optimized navigation
- **Photo Upload:** Allow vendors to snap photos of receipts/invoices directly from phone camera
- **Mobile Status Checks:** Quick status checks from phone without full login
- **Push Notifications:** Mobile push notifications for critical events
- **Offline Capability:** Service worker for viewing cached data when offline

**Use Cases:**
- Vendor on-site takes photo of delivery receipt and uploads immediately
- Vendor checks payment status while in a meeting
- Vendor acknowledges PO from phone without needing to go to office

**Current:** Templates use basic responsive classes but need mobile-first redesign.

**Pain Point Solved:** Vendors are often mobile-first users. Mobile-friendly interface increases engagement and reduces friction.

---

### 6. Document Wallet

**Priority:** 🟡 **MEDIUM**  
**Status:** ❌ **MISSING**

**Requirements:**
- **Central Document Storage:** Vendors store company docs once (tax forms, insurance, certifications)
- **Re-Use for Multiple Contracts:** Same documents can be attached to multiple POs/contracts
- **Document Library:** Organized by document type with search and filter
- **Version Control:** Track document versions and expiration dates
- **Quick Attach:** One-click attach to new POs or invoices

**Routes:**
- `GET /nexus/vendor/documents/wallet` - View document wallet
- `POST /nexus/vendor/documents/wallet` - Upload to wallet
- `POST /nexus/vendor/documents/wallet/:id/attach` - Attach to PO/invoice

**Pain Point Solved:** Vendors waste time re-uploading the same documents for every contract. Document wallet eliminates this friction.

---

### 7. Advanced Search & Filtering

**Priority:** 🟢 **LOW**  
**Status:** ❌ **MISSING**

**Requirements:**
- Language selector in settings
- Translate all UI text (i18n)
- Support for: English, Chinese (Simplified), Malay, Tamil (for Singapore market)

**Implementation:**
- Use Nunjucks i18n plugin
- Store translations in JSON files
- User preference stored in `nexus_users.preferences.language`

---

## Silent Killer Features (Pain-Point Solving)

> **Definition:** Features that solve **major pain points** that competitors don't address. These are your competitive advantage. These solve the deep, hidden pains that make Vendors hate other platforms.

### 1. Smart "Pre-Emptive" Recon (Invoice Validation)

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors submit invoices that get rejected 3 weeks later because amount exceeds PO, missing PO number, or other validation errors. This creates frustration and delays payment.

**Solution:**
- **Pre-Submission Validation:** System validates invoice *before* submission
- **Real-Time Error Detection:** If amount > PO amount, blocks submission with clear error message
- **PO Matching:** Automatically matches invoice to PO and validates line items
- **Missing Field Detection:** Identifies missing required fields before submission
- **Zod Schema Validation:** Strong typing ensures data integrity

**Implementation:**
```javascript
// Pre-submission validation endpoint
POST /nexus/vendor/invoices/validate
{
  "po_id": "uuid",
  "invoice_number": "INV-001",
  "amount": 5000,
  "line_items": [...]
}

// Response if validation fails
{
  "valid": false,
  "errors": [
    {
      "field": "amount",
      "message": "Invoice amount ($5,000) exceeds PO amount ($4,500)",
      "suggestion": "Please verify PO amount or contact client"
    }
  ]
}
```

**Impact:** Eliminates the "Invoice Rejected 3 weeks later" cycle. Vendors know immediately if their invoice will be rejected, saving time and frustration.

---

### 2. Auto-Generated Compliance Pack

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors struggle with compliance paperwork. Asking "Upload W-9" creates friction and errors in legal paperwork.

**Solution:**
- **Auto-Generate Forms:** Instead of asking "Upload W-9," offer a "Generate W-9" button
- **Pre-Fill Data:** System pre-fills form with vendor profile data (name, tax ID, address)
- **Download & Sign:** Vendor downloads pre-filled form, signs, and uploads
- **Multi-Form Support:** Support W-9 (US), ACRA forms (SG), SSM forms (MY), etc.

**Implementation:**
```javascript
// Generate compliance form endpoint
POST /nexus/vendor/compliance/generate-form
{
  "form_type": "W-9", // or "ACRA", "SSM", etc.
  "vendor_id": "uuid"
}

// Response: Pre-filled PDF form ready for download
{
  "form_url": "https://storage.supabase.co/forms/w9-vendor-123.pdf",
  "expires_at": "2025-01-29T12:00:00Z"
}
```

**Impact:** Reduces friction and errors in legal paperwork. Vendors complete compliance faster, improving onboarding time.

---

### 3. "Magic Link" Actions

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors forget passwords constantly. Requiring login for simple actions (PO acknowledgment, document upload) creates unnecessary friction.

**Solution:**
- **Secure One-Time Links:** Send emails with secure, one-time links for quick actions
- **No Login Required:** Actions like "Click to Confirm PO" work without login
- **Time-Limited:** Links expire after 7 days or after use
- **Action Types:** PO acknowledgment, document upload, invoice dispute response

**Implementation:**
```javascript
// Generate magic link
const token = crypto.randomBytes(32).toString('hex');
await nexusAdapter.createMagicLink({
  type: 'po_acknowledge',
  context_id: poId,
  token: token,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Email template
"Click here to acknowledge PO #PO-12345: 
https://portal.example.com/actions/po/acknowledge/{token}"

// Route handler (no auth required)
GET /actions/po/acknowledge/:token
```

**Impact:** Removes the login barrier for simple tasks. Vendors complete actions faster, improving engagement.

---

### 4. Supply Chain Visibility (The "Network Effect")

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors operate in the dark. They don't know upcoming demand or forecast, making inventory planning difficult.

**Solution:**
- **Demand Forecast:** Show vendors upcoming demand or forecast so they can prepare inventory
- **PO Pipeline:** Visual pipeline of upcoming POs (next 30/60/90 days)
- **Trend Analysis:** Historical demand patterns to help vendors plan
- **Inventory Recommendations:** Suggest inventory levels based on forecast

**Implementation:**
```sql
-- Forecast view for vendors
CREATE VIEW vendor_demand_forecast AS
SELECT 
  vendor_id,
  DATE_TRUNC('month', expected_po_date) as forecast_month,
  SUM(expected_amount) as forecast_amount,
  COUNT(*) as forecast_po_count
FROM nexus_po_forecast
WHERE vendor_id = $1
GROUP BY vendor_id, forecast_month
ORDER BY forecast_month;
```

**Impact:** Vendors can plan inventory and resources better. This creates a "network effect" - the more clients use the platform, the more valuable it becomes for vendors.

---

### 5. AI-Powered Invoice Data Extraction

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors manually type invoice data (invoice number, date, amount, line items) which is error-prone and time-consuming.

**Solution:**
- Upload invoice PDF/image
- AI extracts: invoice number, date, vendor name, line items, tax, total
- Vendor reviews and confirms extracted data
- One-click submission

**Technology:**
- Use Supabase Edge Function with OCR (Tesseract.js or Google Vision API)
- Store extracted data in `nexus_invoices` with `extraction_method = 'ai_parse'`
- Confidence score stored in metadata

**Impact:** Reduces invoice submission time from 5 minutes to 30 seconds.

---

### 6. Proactive Payment Alerts

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors don't know when payment is coming, causing cash flow uncertainty.

**Solution:**
- **Payment Scheduled Alert:** Notify vendor when payment is scheduled (before it's sent)
- **Payment Processing Alert:** Real-time update when payment is processing
- **Payment Received Alert:** Immediate notification when payment hits bank
- **Payment Forecast:** Show expected payment dates based on invoice due dates and historical patterns

**Implementation:**
- Use Supabase Realtime subscriptions on `nexus_payments` table
- Send push notification + email when payment status changes
- Store payment forecast in `nexus_users.preferences.payment_forecast_enabled`

**Impact:** Vendors can plan cash flow with confidence, reducing "where's my payment?" calls by 80%.

---

### 7. Self-Service Dispute Resolution

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Invoice disputes require back-and-forth emails and phone calls, taking days to resolve.

**Solution:**
- **Dispute Wizard:** Guided process to dispute invoice rejection
- **Evidence Upload:** Attach supporting documents (PO, delivery note, contract)
- **Auto-Case Creation:** System creates case and assigns to AP team
- **Status Tracking:** Real-time updates on dispute resolution
- **Chat Integration:** In-app messaging with AP team

**Flow:**
1. Vendor views rejected invoice
2. Clicks "Dispute" button
3. Selects dispute reason (wrong amount, missing PO, delivery issue)
4. Uploads evidence
5. System creates case with type "invoice_dispute"
6. AP team receives notification and can respond in-app

**Impact:** Reduces dispute resolution time from 5 days to 24 hours.

---

### 8. WhatsApp Integration

**Priority:** 🔴 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors prefer WhatsApp for quick inquiries but it's not integrated with the system, causing information silos.

**Solution:**
- **WhatsApp Bot:** Vendors can query invoice status, payment status, case status via WhatsApp
- **Two-Way Sync:** Messages in WhatsApp appear in portal case thread
- **Notification Channel:** Send critical alerts via WhatsApp (payment received, case escalated)

**Implementation:**
- Use Twilio WhatsApp API or WhatsApp Business API
- Store WhatsApp message ID in `nexus_case_messages.metadata.whatsapp_message_id`
- Edge Function handles WhatsApp webhook and creates/updates messages

**Impact:** Increases vendor engagement by 300% (vendors check WhatsApp 10x more than email).

---

### 9. Automated SOA Reconciliation

**Priority:** 🟡 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Monthly Statement of Account (SOA) reconciliation is manual and error-prone. Vendors upload SOA PDF, client manually matches each line item to invoices.

**Solution:**
- **SOA Upload:** Vendor uploads SOA PDF
- **AI Extraction:** Extract all line items (invoice number, date, amount)
- **Auto-Matching:** System matches SOA line items to invoices using fuzzy matching
- **Exception Report:** Show unmatched items for manual review
- **Vendor Confirmation:** Vendor reviews and confirms matched items
- **Auto-Reconciliation:** System marks invoices as reconciled

**Technology:**
- OCR for SOA extraction
- Fuzzy matching algorithm (Levenshtein distance for invoice numbers)
- Confidence scoring for matches

**Impact:** Reduces SOA reconciliation time from 2 hours to 10 minutes.

---

### 10. Vendor Performance Dashboard

**Priority:** 🟡 **SILENT KILLER**  
**Status:** ❌ **MISSING**

**Problem:** Vendors have no visibility into their performance metrics (payment speed, invoice approval rate, dispute rate).

**Solution:**
- **Performance Metrics:** 
  - Average days to payment
  - Invoice approval rate (%)
  - Dispute rate (%)
  - On-time delivery rate (if integrated)
- **Trends:** Month-over-month comparison
- **Benchmarks:** Compare to industry average (if available)
- **Recommendations:** AI-suggested improvements ("Your invoices are rejected 20% of the time due to missing PO numbers")

**Impact:** Vendors become self-aware and improve their processes, reducing client workload.

---

## Database Design Recommendations

### Multi-Tenant Architecture (Supabase Best Practice)

Based on Supabase documentation and current implementation:

**✅ Current Implementation (Correct):**
```sql
-- Tenant isolation via tenant_id
CREATE TABLE nexus_tenants (
  id UUID PRIMARY KEY,
  tenant_id TEXT UNIQUE,  -- TNT-XXXXXXXX
  tenant_client_id TEXT UNIQUE,  -- TC-XXXXXXXX (if client)
  tenant_vendor_id TEXT UNIQUE,  -- TV-XXXXXXXX (if vendor)
  ...
);

-- All data tables include tenant_id
CREATE TABLE nexus_cases (
  id UUID PRIMARY KEY,
  case_id TEXT UNIQUE,
  client_id TEXT,  -- TC-XXXXXXXX
  vendor_id TEXT,  -- TV-XXXXXXXX
  ...
);
```

**✅ RLS Policies (Enforced):**
```sql
-- Vendor can only see their own cases
CREATE POLICY "vendor_cases_select" ON nexus_cases
  FOR SELECT TO authenticated
  USING (vendor_id = current_setting('app.vendor_id')::text);
```

**Recommendation:** Continue using this pattern. It's scalable and secure.

---

### JSONB for Flexible Metadata

**Current Pattern (Good):**
```sql
CREATE TABLE nexus_cases (
  ...
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}'
);
```

**Enhancement:** Use Zod schemas (as per `METADATA_CONTROL_PROTOCOL.md`) to validate metadata structure:

```javascript
// src/schemas/metadata.schema.js
export const CaseMetadataSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  tags: z.array(z.string()).default([]),
  custom_fields: z.record(z.any()).optional(),
});
```

---

### Indexing Strategy

**Required Indexes:**
```sql
-- Fast vendor case lookups
CREATE INDEX idx_nexus_cases_vendor_status 
  ON nexus_cases(vendor_id, status) 
  WHERE vendor_id IS NOT NULL;

-- Fast invoice lookups by vendor
CREATE INDEX idx_nexus_invoices_vendor_status 
  ON nexus_invoices(vendor_id, status);

-- Fast payment lookups
CREATE INDEX idx_nexus_payments_to_id_status 
  ON nexus_payments(to_id, status);

-- Full-text search on cases
CREATE INDEX idx_nexus_cases_search 
  ON nexus_cases USING gin(to_tsvector('english', subject || ' ' || description));
```

---

### Realtime Subscriptions

**Current Implementation:**
- ✅ Realtime enabled on `nexus_notifications`
- ✅ Realtime enabled on `nexus_case_messages`

**Enhancement:** Add realtime to payment status changes:
```sql
-- Enable realtime on payments
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_payments;
```

---

## Implementation Priority Matrix

### 🚀 Metadata-First Execution Plan

**Strategy:** Use the Metadata-Driven Architecture to build efficiently. Focus on "Happy Path" first, then add "Silent Killer" logic.

---

### Phase 1: The "Essential" Vendor Portal (Weeks 1-2)

**Focus:** ONLY on the "Happy Path" for a Vendor getting paid. If they can't onboard, nothing else matters.

| Feature | Effort | Impact | Dependencies | Metadata Strategy |
|---------|--------|--------|--------------|-------------------|
| Self-Service Onboarding | 5 days | 🔴 Critical | None | `vendor_onboarding_config` in metadata |
| Compliance & KYC | 3 days | 🔴 Critical | Onboarding | Document wallet, expiry tracking |
| Service/Product Catalog | 2 days | 🔴 Critical | Onboarding | Standardized SKU codes |
| PO Management | 3 days | 🔴 Critical | Catalog | Magic link system |
| Invoice Submission | 4 days | 🔴 Critical | PO Management | Pre-emptive validation (Zod) |
| Payment Tracking | 2 days | 🔴 Critical | Invoice Submission | Realtime subscriptions |
| Vendor Dashboard | 2 days | 🔴 Critical | All above | Aggregate queries |

**Total:** 21 days (3 weeks)

**Key Deliverables:**
1. **Database:** Create `nexus_vendor_documents`, `nexus_vendor_catalog`, `nexus_vendor_users` tables
2. **Metadata:** Define `vendor_onboarding_config` in Metadata to control which documents are required per country
3. **UI:** Build the **"Registration Wizard"** (Step-by-step onboarding)

**Why This Order?**
- Onboarding is the entry point - if vendors can't onboard, nothing else matters
- Each feature builds on the previous one (onboarding → catalog → PO → invoice → payment)
- Dashboard aggregates all features, so it comes last

---

### Phase 2: The "Silent Killer" Logic (Weeks 3-4)

**Focus:** Implement the pain-point solving features that differentiate from competitors.

| Feature | Effort | Impact | Dependencies | Metadata Strategy |
|---------|--------|--------|--------------|-------------------|
| Smart Pre-Emptive Recon | 3 days | 🔴 Silent Killer | Invoice Submission | Zod schemas for validation |
| Auto-Generated Compliance | 2 days | 🔴 Silent Killer | Compliance & KYC | PDF generation, form templates |
| Magic Link Actions | 3 days | 🔴 Silent Killer | PO Management | Token generation, email templates |
| Supply Chain Visibility | 4 days | 🔴 Silent Killer | PO Management | Forecast algorithms, analytics |

**Total:** 12 days (2.4 weeks)

**Key Deliverables:**
1. **Zod Schemas:** Implement `InvoiceSubmissionSchema` for pre-emptive validation
2. **Magic Link System:** Build secure token generation and email delivery
3. **Compliance Forms:** PDF generation with pre-filled vendor data
4. **Forecast Views:** Database views for demand forecasting

**Why This Order?**
- These features solve the deepest pain points
- They require the Phase 1 foundation to be complete
- They provide immediate competitive advantage

---

### Phase 3: Good to Have Features (Weeks 5-6)

**Focus:** Enhance user experience with user-centric design features.

| Feature | Effort | Impact | Dependencies | Metadata Strategy |
|---------|--------|--------|--------------|-------------------|
| The "Pulse" Dashboard | 3 days | 🟡 High | Vendor Dashboard | Performance metrics, aggregations |
| Multi-User Access | 4 days | 🟡 High | Onboarding | Role-based permissions |
| Real-Time Chat/Comments | 3 days | 🟡 High | Case Management | Realtime subscriptions |
| Mobile-Friendly Interface | 5 days | 🟡 High | All pages | Responsive design, PWA |
| Document Wallet | 2 days | 🟡 Medium | Compliance & KYC | Document library |

**Total:** 17 days (3.4 weeks)

---

### Phase 4: Advanced Features (Weeks 7-8)

| Feature | Effort | Impact | Dependencies | Metadata Strategy |
|---------|--------|--------|--------------|-------------------|
| AI Invoice Extraction | 5 days | 🔴 Silent Killer | Invoice Submission | Edge Function, OCR API |
| Proactive Payment Alerts | 3 days | 🔴 Silent Killer | Payment Tracking | Realtime, Push API |
| Self-Service Dispute | 4 days | 🔴 Silent Killer | Case Creation | Dispute wizard, evidence upload |
| WhatsApp Integration | 7 days | 🔴 Silent Killer | Case Management | Twilio API, webhook handler |
| Advanced Search | 3 days | 🟡 High | All features | Full-text search indexes |
| Invoice Bulk Upload | 2 days | 🟡 Medium | Invoice Submission | Batch processing |
| Payment Forecasting | 3 days | 🟡 Medium | Payment Tracking | Analytics, trend analysis |

**Total:** 27 days (5.4 weeks)

---

## Next Steps

### 🎯 Immediate Actions (Week 1)

**Phase 1 Kickoff: Essential Vendor Portal**

1. **Set Up Onboarding Infrastructure**
   - Create `nexus_vendor_documents` table migration
   - Create `nexus_vendor_catalog` table migration
   - Define `vendor_onboarding_config` metadata schema in Zod
   - Create onboarding wizard route: `GET /nexus/vendor/onboard`

2. **Build Registration Wizard UI**
   - Step 1: Email verification
   - Step 2: Company profile
   - Step 3: Compliance documents
   - Step 4: Bank details
   - Step 5: Service catalog
   - Template: `src/views/nexus/pages/vendor_onboard.html`

3. **Implement Metadata-Driven Validation**
   - Create `src/schemas/vendor-onboarding.schema.js` with Zod
   - Implement country-specific validation rules
   - Add bank account format validation

**Success Criteria:**
- Vendor can complete onboarding in < 10 minutes
- All required documents are validated
- Bank details are validated per country rules

### Documentation Updates

- [x] Update `DOCUMENTATION_REGISTRY.md` with this document
- [ ] Create `VENDOR_PORTAL_IMPLEMENTATION_PLAN.md` with detailed task breakdown
- [ ] Create `VENDOR_ONBOARDING_WIZARD_SPEC.md` with UI/UX specifications

### Database Migrations Needed (Phase 1)

- [ ] Create `nexus_vendor_documents` table (compliance documents)
- [ ] Create `nexus_vendor_catalog` table (service/product catalog)
- [ ] Create `nexus_vendor_users` table (multi-user access)
- [ ] Create `nexus_magic_links` table (magic link tokens)
- [ ] Add `vendor_onboarding_config` to `nexus_tenants.metadata` schema
- [ ] Add indexes for vendor queries (see Indexing Strategy above)
- [ ] Add `extraction_method` and `extraction_confidence` to `nexus_invoices`
- [ ] Add `whatsapp_message_id` to `nexus_case_messages.metadata`
- [ ] Create `vendor_demand_forecast` view (supply chain visibility)

### Metadata Schema Updates

- [ ] Define `VendorOnboardingConfigSchema` in `src/schemas/metadata.schema.js`
- [ ] Define `InvoiceSubmissionSchema` with pre-emptive validation
- [ ] Define `BankValidationRulesSchema` for country-specific validation

---

## References

- **Current Implementation:** `src/routes/nexus-vendor.js`, `src/routes/nexus-client.js`
- **Database Schema:** `supabase/migrations/040_nexus_*.sql`
- **Adapter Layer:** `src/adapters/nexus-adapter.js`
- **Master Plan:** `archive/___NEXUS_VMP_VENDOR_MASTERCCP.md`
- **Supabase Best Practices:** `docs/integrations/supabase/DATABASE_STANDARDS.md`
- **Metadata Strategy:** `docs/architecture/METADATA_CONTROL_PROTOCOL.md`

---

**Document Status:** ✅ Complete  
**Next Review:** After Phase 1 implementation  
**Owner:** Product Team

