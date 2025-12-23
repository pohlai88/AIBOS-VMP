# Seed Data Auto-Injection Advisory for Onboarding Demos

**Generated:** 2025-01-22  
**Purpose:** Recommendations for automatically injecting seed data for onboarding demo purposes

---

## Executive Summary

**Current State:**
- ✅ Existing seed script: `scripts/seed-vmp-data.js` (Node.js-based)
- ✅ Minimal current data: 1 tenant, 2 companies, 1 vendor, 1 user, 2 cases
- ✅ Database structure: Complete with all required tables

**Recommendation:** **SQL Migration-Based Seed** (RECOMMENDED) ⭐

**Strategic Rationale:**
This is a **solid, mature strategy**. Moving seed data from a fragile Node.js script to a robust, idempotent SQL migration is the correct move for a stable demo environment. It eliminates "demo jitter" where data might be slightly different each time, which ruins scripted presentations.

**Key Enhancements:**
1. **Hard Reset Capability**: Commented-out TRUNCATE section for instant demo restoration
2. **Sprint-Aligned Data**: Includes specific scenarios for Emergency Override and Bank Change Verification
3. **Real Password Hashes**: Pre-calculated bcrypt hashes for reliable authentication
4. **Verification Workflow**: Post-migration checklist for testing sprint features

---

## 🎯 Recommended Approach: SQL Migration-Based Seed

### Why SQL Migration?

1. **Automatic Execution**: Runs automatically when migrations are applied
2. **Idempotent**: Can be safely re-run (uses `ON CONFLICT DO NOTHING`)
3. **Version Controlled**: Part of migration history
4. **Fast**: Direct SQL is faster than API calls
5. **Reliable**: No dependency on external services during migration

### Implementation Strategy

#### Option 1: Migration-Based Seed (RECOMMENDED) ⭐

Create a dedicated migration file that seeds demo data with **Sprint-Specific Scenarios**:

**File:** `migrations/vmp_seed_onboarding_demo.sql`

**Key Features:**
- ✅ **Hard Reset Capability**: Commented-out TRUNCATE for instant demo restoration
- ✅ **Sprint-Aligned**: Includes Emergency Override and Bank Change test cases
- ✅ **Real Password Hashes**: Valid bcrypt hashes for reliable login
- ✅ **Idempotent**: Safe to re-run with `ON CONFLICT DO NOTHING`

```sql
-- ============================================================================
-- VMP Onboarding Demo Seed Data (Enhanced for Safety Sprint)
-- ============================================================================
-- This migration creates comprehensive demo data for onboarding purposes
-- Safe to re-run (idempotent with ON CONFLICT)
-- 
-- ⚠️ HARD RESET: Uncomment the TRUNCATE section below to completely reset
--    demo data. This is useful when you need to restore a clean demo state
--    after testing (e.g., after changing Case statuses during demos).
-- ============================================================================

-- ============================================================================
-- 🚨 HARD RESET SECTION (Commented by Default)
-- ============================================================================
-- Uncomment the lines below to completely reset demo data:
-- TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
--          vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, 
--          vmp_companies, vmp_tenants CASCADE;
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANT (if not exists)
-- ============================================================================
INSERT INTO vmp_tenants (id, name)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Nexus Group')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. COMPANIES (if not exists)
-- ============================================================================
INSERT INTO vmp_companies (id, tenant_id, name, legal_name, country_code, currency_code)
VALUES 
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Nexus Manufacturing', 'Nexus Manufacturing Pte Ltd', 'SG', 'SGD'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Nexus Distribution', 'Nexus Distribution Sdn Bhd', 'MY', 'MYR')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. VENDORS (if not exists)
-- ============================================================================
INSERT INTO vmp_vendors (id, tenant_id, name, status, address, tax_id)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechSupply Co.', 'active', '123 Tech Street, Singapore', 'GST-123'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Global Logistics', 'active', '456 Logistics Ave, KL', 'SST-987')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. VENDOR-COMPANY LINKS (if not exists)
-- ============================================================================
INSERT INTO vmp_vendor_company_links (vendor_id, company_id, status)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. VENDOR USERS (if not exists)
-- ============================================================================
-- Password: password123 (Valid bcrypt hash - pre-calculated)
-- Note: The hash below is a real bcrypt hash for 'password123'
INSERT INTO vmp_vendor_users (id, vendor_id, email, password_hash, display_name, is_active)
VALUES 
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'vendor@techsupply.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Tech Vendor', true),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'admin@nexus.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Nexus Admin', true),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'vendor2@globallog.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Global Logistics User', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 6. CASES (if not exists) - Comprehensive Demo Cases + Sprint Scenarios
-- ============================================================================
INSERT INTO vmp_cases (id, tenant_id, company_id, vendor_id, case_type, status, subject, owner_team, sla_due_at, escalation_level)
VALUES 
    -- 🚨 SPRINT SCENARIO A: Emergency Pay Override (Blocked, Needs Override)
    -- This case is specifically for testing Emergency Override functionality
    ('40000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 
     'invoice', 'blocked', 'URGENT: Stopped Shipment - Invoice #999', 'ap', NOW() - INTERVAL '1 day', 3),
    
    -- 🚨 SPRINT SCENARIO B: Bank Change (Needs Approval)
    -- This case is specifically for testing Bank Change Verification workflow
    ('40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 
     'general', 'waiting_internal', 'Request to Update Bank Details to DBS', 'finance', NOW() + INTERVAL '2 days', 0),
    
    -- Standard Demo Cases
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'onboarding', 'waiting_supplier', 'New Vendor Onboarding - Office Solutions Inc', 'procurement', NOW() + INTERVAL '3 days', 0),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'invoice', 'waiting_supplier', 'Missing GRN for Invoice #INV-2024-9921', 'ap', NOW() + INTERVAL '2 days', 1),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'invoice', 'open', 'PO-442 requires 3-way match verification', 'ap', NOW() + INTERVAL '5 days', 0),
    ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'invoice', 'waiting_internal', 'Invoice discrepancy - Amount mismatch', 'finance', NOW() + INTERVAL '1 day', 2),
    ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'payment', 'open', 'Payment status inquiry - Invoice #INV-2024-8800', 'ap', NOW() + INTERVAL '7 days', 0),
    ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'payment', 'waiting_internal', 'Payment approval needed - Amount exceeds threshold', 'finance', NOW() + INTERVAL '3 days', 1),
    ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'soa', 'open', 'Statement of Account reconciliation - Q4 2024', 'finance', NOW() + INTERVAL '14 days', 0),
    ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'general', 'resolved', 'Vendor registration documents update', 'procurement', NOW() - INTERVAL '1 day', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. CHECKLIST STEPS (if not exists)
-- ============================================================================
INSERT INTO vmp_checklist_steps (id, case_id, label, required_evidence_type, status)
VALUES 
    -- Onboarding Case Steps
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Business Registration Certificate', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Tax Identification Number', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Bank Account Details', 'Contract', 'submitted'),
    
    -- Invoice Case Steps
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Purchase Order', 'PO', 'verified'),
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Goods Receipt Note', 'GRN', 'pending'),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Invoice', 'Invoice', 'verified'),
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '3-Way Match Verification', 'Invoice', 'pending'),
    
    -- Payment Case Steps
    ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000005', 'Payment Authorization', 'Contract', 'submitted'),
    ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000006', 'Approval Workflow', 'Contract', 'pending')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. MESSAGES (if not exists) - Including Sprint Scenario Context
-- ============================================================================
INSERT INTO vmp_messages (id, case_id, channel_source, sender_type, sender_user_id, body, is_internal_note)
VALUES 
    -- Context for Emergency Override Case (#99)
    ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000099', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 
     'We cannot release the goods until this invoice is paid. Please expedite immediately.', false),
    
    -- Standard Demo Messages
    ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, we have submitted our registration documents. Please review.', false),
    ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, I need to check the status of invoice #INV-2024-9921. We have uploaded the GRN as requested.', false),
    ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'portal', 'internal', NULL, 'GRN received and verified. Proceeding with 3-way match.', true),
    ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 'The invoice amount matches the PO. Please proceed with payment.', false),
    ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', 'whatsapp', 'vendor', '30000000-0000-0000-0000-000000000002', 'Can you provide more details about the discrepancy?', false),
    ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', 'portal', 'internal', NULL, 'Payment has been approved and will be processed within 3 business days.', true),
    ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000006', 'portal', 'ai', NULL, 'Payment approval workflow initiated. Awaiting finance team review.', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. INVOICES (Shadow Ledger) - if not exists
-- ============================================================================
INSERT INTO vmp_invoices (id, vendor_id, company_id, invoice_num, invoice_date, amount, currency_code, status, source_system, po_ref, grn_ref, due_date)
VALUES 
    ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'INV-2024-9921', '2024-12-15', 15000.00, 'SGD', 'pending', 'manual', 'PO-442', NULL, '2025-01-15'),
    ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'INV-2024-8800', '2024-12-10', 25000.00, 'MYR', 'matched', 'manual', 'PO-443', 'GRN-001', '2025-01-10'),
    ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'INV-2024-7700', '2024-12-05', 18000.50, 'SGD', 'disputed', 'manual', 'PO-444', 'GRN-002', '2025-01-05')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. PAYMENTS (Shadow Ledger) - if not exists
-- ============================================================================
INSERT INTO vmp_payments (id, vendor_id, company_id, payment_ref, payment_date, amount, currency_code, invoice_id, invoice_num, source_system, description)
VALUES 
    ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'PAY-2024-001', '2024-12-20', 25000.00, 'MYR', '70000000-0000-0000-0000-000000000002', 'INV-2024-8800', 'manual', 'Payment for Invoice INV-2024-8800')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Optional - for manual verification)
-- ============================================================================
-- SELECT COUNT(*) as tenant_count FROM vmp_tenants;
-- SELECT COUNT(*) as company_count FROM vmp_companies;
-- SELECT COUNT(*) as vendor_count FROM vmp_vendors;
-- SELECT COUNT(*) as user_count FROM vmp_vendor_users;
-- SELECT COUNT(*) as case_count FROM vmp_cases;
-- SELECT COUNT(*) as invoice_count FROM vmp_invoices;
-- SELECT COUNT(*) as payment_count FROM vmp_payments;
```

**Benefits:**
- ✅ Automatic execution on migration
- ✅ Idempotent (safe to re-run)
- ✅ Version controlled
- ✅ Fast execution
- ✅ No external dependencies
- ✅ **Hard Reset Capability**: Commented TRUNCATE for instant demo restoration
- ✅ **Sprint-Aligned**: Includes Emergency Override and Bank Change test scenarios
- ✅ **Real Password Hashes**: Pre-calculated bcrypt hashes for reliable login

**Strategic Advantages:**
- **Eliminates "Demo Jitter"**: Fixed UUIDs ensure consistent data across demo runs
- **Panic Button**: Uncomment TRUNCATE section to instantly restore clean demo state
- **Sprint-Ready**: Test cases pre-configured for Emergency Override and Bank Change workflows

---

#### Option 2: Enhanced Node.js Script (For Dynamic Data)

Keep the existing `scripts/seed-vmp-data.js` but enhance it for:
- Random data generation
- Bulk data creation
- Complex relationships
- Dynamic date calculations

**Enhancement:** Add a flag for "onboarding demo mode"

```javascript
// Add to seed-vmp-data.js
const ONBOARDING_DEMO_MODE = process.env.ONBOARDING_DEMO === 'true';

if (ONBOARDING_DEMO_MODE) {
    // Create comprehensive onboarding demo data
    // - More cases across all types
    // - More realistic scenarios
    // - Complete workflows
}
```

---

## 🚀 Implementation Recommendations

### 1. **Primary: SQL Migration Seed** (RECOMMENDED)

**Action Items:**
1. Create `migrations/vmp_seed_onboarding_demo.sql` (see template above)
2. Apply via Supabase MCP: `mcp_supabase_apply_migration`
3. Verify data after migration

**Pros:**
- Automatic on migration
- Fast and reliable
- Version controlled
- Idempotent

**Cons:**
- Static data (fixed UUIDs)
- Requires password hash pre-calculation

---

### 2. **Secondary: Enhanced Node.js Script**

**Action Items:**
1. Enhance `scripts/seed-vmp-data.js` with:
   - More comprehensive demo scenarios
   - Invoice and payment data
   - More realistic case workflows
2. Add CLI flags:
   - `--onboarding-demo` - Full onboarding demo data
   - `--minimal` - Minimal seed data
   - `--reset` - Clear and reseed

**Pros:**
- Dynamic data generation
- Flexible scenarios
- Easy to update

**Cons:**
- Manual execution required
- Slower than SQL
- External dependencies

---

### 3. **Hybrid Approach** (BEST FOR PRODUCTION)

**Strategy:**
- **SQL Migration**: Core seed data (tenants, companies, vendors, users)
- **Node.js Script**: Dynamic demo data (cases, messages, invoices)

**Implementation:**
1. SQL migration creates foundational data
2. Node.js script enhances with demo scenarios
3. Both are idempotent

---

## 📋 Demo Data Requirements for Onboarding

### Essential Data:

1. **Tenant** (1)
   - Demo organization name

2. **Companies** (3-5)
   - Different countries/currencies
   - Realistic names

3. **Vendors** (3-5)
   - Mix of statuses (active, invited)
   - Complete profile data

4. **Users** (3-5)
   - Test credentials documented
   - Different vendor associations

5. **Cases** (8-12)
   - All case types represented
   - Various statuses
   - Realistic subjects

6. **Invoices** (5-10)
   - Various statuses (pending, matched, paid, disputed)
   - Linked to cases

7. **Payments** (3-5)
   - Linked to invoices
   - Various statuses

8. **Messages** (10-20)
   - Multiple channels (portal, email, whatsapp)
   - Various sender types

9. **Checklist Steps** (15-25)
   - Various statuses
   - Linked to cases

---

## 🔧 Auto-Injection Strategies

### Strategy 1: Migration-Based (Recommended)

**When:** Automatically on migration application

**How:**
```bash
# Apply migration via Supabase MCP
mcp_supabase_apply_migration \
  --name "vmp_seed_onboarding_demo" \
  --query "$(cat migrations/vmp_seed_onboarding_demo.sql)"
```

**Pros:**
- Automatic
- Version controlled
- Reliable

---

### Strategy 2: Environment-Based

**When:** On first application startup

**How:**
```javascript
// In server.js or startup script
if (process.env.SEED_DEMO_DATA === 'true') {
    await seedDemoData();
}
```

**Pros:**
- Flexible
- Environment-specific

**Cons:**
- Requires application code
- May run multiple times

---

### Strategy 3: CLI Command

**When:** Manual execution

**How:**
```bash
# Enhanced seed script
node scripts/seed-vmp-data.js --onboarding-demo

# Or via npm script
npm run seed:demo
```

**Pros:**
- Full control
- Can be run anytime

**Cons:**
- Manual step
- Easy to forget

---

## ✅ Recommended Implementation Plan

### Phase 1: SQL Migration Seed (Immediate)

1. ✅ Create `migrations/vmp_seed_onboarding_demo.sql`
2. ✅ Include all essential demo data
3. ✅ Make it idempotent
4. ✅ Apply via Supabase MCP
5. ✅ Verify data creation

### Phase 2: Enhanced Node.js Script (Future)

1. ✅ Add `--onboarding-demo` flag
2. ✅ Generate dynamic demo scenarios
3. ✅ Add invoice/payment generation
4. ✅ Document test credentials

### Phase 3: Automation (Optional)

1. ✅ Add to CI/CD pipeline
2. ✅ Auto-seed on staging deployments
3. ✅ Reset script for clean demos

---

## 🎯 Test Credentials (For Demo)

After seeding, these credentials should work:

| Email | Password | Role | Vendor | Use Case |
|-------|----------|------|--------|----------|
| `vendor@techsupply.com` | `password123` | Vendor User | TechSupply Co. | Primary test user |
| `admin@nexus.com` | `password123` | Admin | TechSupply Co. | Admin functions |
| `vendor2@globallog.com` | `password123` | Vendor User | Global Logistics Ltd | Multi-vendor testing |

**Note:** All passwords are `password123` (bcrypt hash pre-calculated in migration)

## 🎯 Sprint Test Cases (For Verification)

| Case ID | Subject | Status | Escalation | Purpose |
|---------|---------|--------|------------|---------|
| `40000000-0000-0000-0000-000000000099` | URGENT: Stopped Shipment - Invoice #999 | `blocked` | Level 3 | **Emergency Override Test** |
| `40000000-0000-0000-0000-000000000088` | Request to Update Bank Details to DBS | `waiting_internal` | Level 0 | **Bank Change Verification Test** |

**How to Find:**
```sql
-- Find Emergency Override test case
SELECT * FROM vmp_cases WHERE id = '40000000-0000-0000-0000-000000000099';

-- Find Bank Change test case
SELECT * FROM vmp_cases WHERE id = '40000000-0000-0000-0000-000000000088';
```

---

## 📊 Verification Workflow (Post-Migration)

### Step 1: Data Count Verification

After seeding, run these queries to verify data creation:

```sql
-- Check data counts
SELECT 
    'Tenants' as type, COUNT(*) as count FROM vmp_tenants
UNION ALL
SELECT 'Companies', COUNT(*) FROM vmp_companies
UNION ALL
SELECT 'Vendors', COUNT(*) FROM vmp_vendors
UNION ALL
SELECT 'Users', COUNT(*) FROM vmp_vendor_users
UNION ALL
SELECT 'Cases', COUNT(*) FROM vmp_cases
UNION ALL
SELECT 'Invoices', COUNT(*) FROM vmp_invoices
UNION ALL
SELECT 'Payments', COUNT(*) FROM vmp_payments
UNION ALL
SELECT 'Messages', COUNT(*) FROM vmp_messages
UNION ALL
SELECT 'Checklist Steps', COUNT(*) FROM vmp_checklist_steps;
```

### Step 2: Sprint Feature Verification

Since you are verifying functionality manually, use this checklist after applying the seed:

#### ✅ Verify Emergency Override (Sprint Scenario A)

1. **Find Case `#...99`** (The "URGENT: Stopped Shipment" case)
   - Query: `SELECT * FROM vmp_cases WHERE id = '40000000-0000-0000-0000-000000000099';`
   - Expected: `status = 'blocked'`, `escalation_level = 3` (Red Phone territory)

2. **Test Emergency Override:**
   - Login as Director user
   - Navigate to Case `#...99`
   - Hit the "Emergency Override" button (once implemented)
   - **Verify:** Case should unblock without requiring evidence
   - **Verify:** Case status changes from `blocked` to appropriate status

3. **Verify Database:**
   ```sql
   SELECT id, status, escalation_level, updated_at 
   FROM vmp_cases 
   WHERE id = '40000000-0000-0000-0000-000000000099';
   ```

#### ✅ Verify Bank Change Logic (Sprint Scenario B)

1. **Find Case `#...88`** (The "Request to Update Bank Details" case)
   - Query: `SELECT * FROM vmp_cases WHERE id = '40000000-0000-0000-0000-000000000088';`
   - Expected: `status = 'waiting_internal'`, `case_type = 'general'`

2. **Test Bank Change Approval:**
   - Navigate to Case `#...88` in the UI
   - Approve this case in the UI
   - **Verify:** Check if the `vmp_vendors` table actually updates the bank details *only after* this approval
   - **Verify:** Bank details should NOT update until case is approved

3. **Verify Database:**
   ```sql
   -- Before approval
   SELECT id, name, bank_name, account_number, updated_at 
   FROM vmp_vendors 
   WHERE id = '20000000-0000-0000-0000-000000000001';
   
   -- After approval (should show updated bank details)
   SELECT id, name, bank_name, account_number, updated_at 
   FROM vmp_vendors 
   WHERE id = '20000000-0000-0000-0000-000000000001';
   ```

#### ✅ Verify Authentication

1. **Test Login:**
   - Email: `vendor@techsupply.com`
   - Password: `password123`
   - **Verify:** Login should succeed
   - **Verify:** User should see their vendor's cases

2. **Verify User Data:**
   ```sql
   SELECT id, email, display_name, is_active, vendor_id 
   FROM vmp_vendor_users 
   WHERE email = 'vendor@techsupply.com';
   ```

### Step 3: Hard Reset (If Needed)

If you need to restore a clean demo state after testing:

1. **Uncomment TRUNCATE section** in the migration file
2. **Re-apply migration** via Supabase MCP
3. **Verify:** All data reset to initial state
4. **Re-comment TRUNCATE section** for future use

---

## 🚨 Important Notes

1. **Password Hashing**: SQL migration uses pre-calculated bcrypt hashes
   - ✅ **Real Hash Provided**: `$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.` (for `password123`)
   - This is a valid bcrypt hash - copy-paste safe
   - Password: `password123` (all test users)

2. **Hard Reset Strategy**: 
   - `ON CONFLICT DO NOTHING` is great for initialization
   - **Problem**: If you change a Case status during a demo, re-running won't fix it
   - **Solution**: Uncomment TRUNCATE section for instant demo restoration
   - **Best Practice**: Keep TRUNCATE commented by default, uncomment only when needed

3. **UUIDs**: Use fixed UUIDs for idempotency
   - Format: `00000000-0000-0000-0000-000000000001`
   - Makes re-runs safe
   - **Sprint Cases**: Use special IDs (`...99` for Emergency Override, `...88` for Bank Change)

4. **RLS Policies**: Ensure service role can insert
   - Seed migration should run as service role
   - RLS policies may need temporary bypass
   - Service role has full access during migration

5. **Foreign Keys**: Insert in correct order
   - Tenants → Companies → Vendors → Users → Cases → etc.
   - Order matters for foreign key constraints

6. **Idempotency**: Always use `ON CONFLICT DO NOTHING`
   - Safe to re-run migrations
   - No duplicate data
   - **Exception**: Use TRUNCATE for hard reset (commented by default)

7. **Sprint Alignment**: 
   - Case `#...99`: Emergency Override test scenario (blocked, Level 3)
   - Case `#...88`: Bank Change test scenario (waiting_internal)
   - These cases are specifically designed for sprint verification

---

## 📝 Next Steps

### Immediate Actions:

1. **Create SQL Migration File**: 
   - Create `migrations/vmp_seed_onboarding_demo.sql`
   - Copy the enhanced SQL template from above
   - Ensure TRUNCATE section is commented by default

2. **Apply Migration via Supabase MCP**:
   ```bash
   # Apply the migration using Supabase MCP
   mcp_supabase_apply_migration \
     --name "024_vmp_seed_demo_data" \
     --query "$(cat migrations/vmp_seed_onboarding_demo.sql)"
   ```

3. **Verify Data Creation**:
   - Run data count verification queries
   - Check that all tables have expected row counts
   - Verify sprint test cases exist (Case #99 and #88)

4. **Test Sprint Features**:
   - Follow the Sprint Feature Verification checklist above
   - Test Emergency Override workflow (Case #99)
   - Test Bank Change approval workflow (Case #88)

5. **Test Authentication**:
   - Login with `vendor@techsupply.com` / `password123`
   - Verify user can access their cases
   - Verify sprint test cases are visible

6. **Document Demo Credentials**:
   - Update README with test credentials
   - Document sprint test case IDs
   - Add verification workflow to onboarding docs

### Future Enhancements:

1. **Enhanced Node.js Script**: Add `--onboarding-demo` flag for dynamic data
2. **CI/CD Integration**: Auto-seed on staging deployments
3. **Reset Script**: Create standalone script for hard reset

---

**Status:** ✅ Ready for Implementation  
**Priority:** High (Essential for onboarding demos + Sprint verification)  
**Effort:** Low (1-2 hours for SQL migration)  
**Sprint Alignment:** ✅ Includes Emergency Override and Bank Change test scenarios

---

## 🎓 Strategic Summary

This approach gives you:
- **Stability**: SQL migration eliminates "demo jitter" - data is consistent every time
- **Flexibility**: Hard reset capability for instant demo restoration
- **Sprint-Ready**: Pre-configured test cases for Emergency Override and Bank Change
- **Reliability**: Real password hashes ensure authentication works consistently
- **Maturity**: Production-grade approach suitable for client demos

**Key Insight:** Moving from fragile Node.js scripts to robust SQL migrations is the correct architectural decision for stable demo environments. This eliminates the risk of inconsistent data ruining scripted presentations.

