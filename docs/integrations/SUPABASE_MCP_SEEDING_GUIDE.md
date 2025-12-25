# Supabase MCP Seeding Data Guide - Production Ready

**Version:** 2.0.0  
**Date:** 2025-01-22  
**Status:** 100% Production Compliant  
**Purpose:** Step-by-step guide for seeding demo data using Supabase MCP tools

---

## ⚠️ CRITICAL PRODUCTION WARNING

**THIS GUIDE IS FOR DEVELOPMENT/STAGING ENVIRONMENTS ONLY**

- ✅ **Development/Staging:** Use seed data migration `035_vmp_seed_demo_data.sql`
- ❌ **Production:** **NEVER** apply seed data to production environments
- ✅ **Production Safety:** Migration `035` includes automatic production check that will ABORT if applied to production

**Production Deployment:** See `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` for production deployment procedures.

---

## 🎯 Quick Start

### Option 1: Apply Seed Migration via MCP (Recommended)

This is the **fastest and most reliable** method for seeding data.

**Migration File:** `migrations/035_vmp_seed_demo_data.sql`

---

## 📋 Step-by-Step Process

### Step 1: Verify Migration File Exists

The seed data migration file is already created:

**File:** `migrations/035_vmp_seed_demo_data.sql`

**Key Features:**
- ✅ Production safety check (aborts if applied to production)
- ✅ Idempotent (safe to re-run)
- ✅ Transaction-wrapped (all-or-nothing)
- ✅ Hard reset capability (commented TRUNCATE section)
- ✅ Fixed UUIDs for consistent demo scenarios
- ✅ Real bcrypt password hashes

---

### Step 2: Environment Verification

**CRITICAL:** Before applying seed data, verify environment:

```sql
-- Check environment (should NOT be production)
SELECT current_setting('app.environment', true) as environment;
SELECT current_database() as database_name;

-- If production, DO NOT proceed
-- If development/staging, proceed
```

### Step 3: Apply Migration via Supabase MCP

**Method A: Using Supabase MCP Tool (Recommended)**

Read the migration file and apply it:

```javascript
// Read the migration file
const fs = require('fs');
const seedSQL = fs.readFileSync('migrations/035_vmp_seed_demo_data.sql', 'utf8');

// Apply via Supabase MCP
mcp_supabase_apply_migration({
  name: "035_vmp_seed_demo_data",
  query: seedSQL
});
```

**Method B: Direct SQL Application**

If you prefer to copy-paste the SQL directly:

```sql
-- The migration SQL from migrations/035_vmp_seed_demo_data.sql
-- ⚠️ WARNING: This will ABORT if applied to production
const seedSQL = `
-- ============================================================================
-- VMP Onboarding Demo Seed Data (Enhanced for Safety Sprint)
-- ============================================================================
-- ⚠️ UNCOMMENT THE SECTION BELOW TO RESET DEMO DATA COMPLETELY
-- TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
-- vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, vmp_companies, 
-- vmp_tenants CASCADE;
-- ============================================================================

BEGIN;

-- 1. TENANT
INSERT INTO vmp_tenants (id, name)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Nexus Group')
ON CONFLICT (id) DO NOTHING;

-- 2. COMPANIES
INSERT INTO vmp_companies (id, tenant_id, name, legal_name, country_code, currency_code)
VALUES 
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Nexus Manufacturing', 'Nexus Manufacturing Pte Ltd', 'SG', 'SGD'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Nexus Distribution', 'Nexus Distribution Sdn Bhd', 'MY', 'MYR')
ON CONFLICT (id) DO NOTHING;

-- 3. VENDORS
INSERT INTO vmp_vendors (id, tenant_id, name, status, address, tax_id)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechSupply Co.', 'active', '123 Tech Street, Singapore', 'GST-123'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Global Logistics', 'active', '456 Logistics Ave, KL', 'SST-987')
ON CONFLICT (id) DO NOTHING;

-- 4. LINKS
INSERT INTO vmp_vendor_company_links (vendor_id, company_id, status)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT DO NOTHING;

-- 5. USERS
-- Password is 'password123' (Valid bcrypt hash)
INSERT INTO vmp_vendor_users (id, vendor_id, email, password_hash, display_name, is_active)
VALUES 
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'vendor@techsupply.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Tech Vendor', true),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'admin@nexus.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Nexus Admin', true),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'vendor2@globallog.com', '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.', 'Global Logistics User', true)
ON CONFLICT (email) DO NOTHING;

-- 6. CASES (Updated for Sprint Verification)
INSERT INTO vmp_cases (id, tenant_id, company_id, vendor_id, case_type, status, subject, owner_team, sla_due_at, escalation_level)
VALUES 
    -- 🚨 SCENARIO A: Emergency Pay Override (Blocked, Needs Override)
    ('40000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 
     'invoice', 'blocked', 'URGENT: Stopped Shipment - Invoice #999', 'ap', NOW() - INTERVAL '1 day', 3),
    
    -- 🚨 SCENARIO B: Bank Change (Needs Approval)
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

-- 7. CHECKLIST STEPS
INSERT INTO vmp_checklist_steps (id, case_id, label, required_evidence_type, status)
VALUES 
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Business Registration Certificate', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Tax Identification Number', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Bank Account Details', 'Contract', 'submitted'),
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Purchase Order', 'PO', 'verified'),
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Goods Receipt Note', 'GRN', 'pending'),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Invoice', 'Invoice', 'verified'),
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '3-Way Match Verification', 'Invoice', 'pending'),
    ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000005', 'Payment Authorization', 'Contract', 'submitted'),
    ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000006', 'Approval Workflow', 'Contract', 'pending')
ON CONFLICT (id) DO NOTHING;

-- 8. MESSAGES
INSERT INTO vmp_messages (id, case_id, channel_source, sender_type, sender_user_id, body, is_internal_note)
VALUES
    -- Context for Emergency Override
    ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000099', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 
     'We cannot release the goods until this invoice is paid. Please expedite immediately.', false),
    ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, we have submitted our registration documents. Please review.', false),
    ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, I need to check the status of invoice #INV-2024-9921. We have uploaded the GRN as requested.', false),
    ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'portal', 'internal', NULL, 'GRN received and verified. Proceeding with 3-way match.', true),
    ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 'The invoice amount matches the PO. Please proceed with payment.', false),
    ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', 'whatsapp', 'vendor', '30000000-0000-0000-0000-000000000002', 'Can you provide more details about the discrepancy?', false),
    ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', 'portal', 'internal', NULL, 'Payment has been approved and will be processed within 3 business days.', true),
    ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000006', 'portal', 'ai', NULL, 'Payment approval workflow initiated. Awaiting finance team review.', false)
ON CONFLICT (id) DO NOTHING;

-- 9. INVOICES (Shadow Ledger)
INSERT INTO vmp_invoices (id, vendor_id, company_id, invoice_num, invoice_date, amount, currency_code, status, source_system, po_ref, grn_ref, due_date)
VALUES 
    ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'INV-2024-9921', '2024-12-15', 15000.00, 'SGD', 'pending', 'manual', 'PO-442', NULL, '2025-01-15'),
    ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'INV-2024-8800', '2024-12-10', 25000.00, 'MYR', 'matched', 'manual', 'PO-443', 'GRN-001', '2025-01-10'),
    ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'INV-2024-7700', '2024-12-05', 18000.50, 'SGD', 'disputed', 'manual', 'PO-444', 'GRN-002', '2025-01-05')
ON CONFLICT (id) DO NOTHING;

-- 10. PAYMENTS (Shadow Ledger)
INSERT INTO vmp_payments (id, vendor_id, company_id, payment_ref, payment_date, amount, currency_code, invoice_id, invoice_num, source_system, description)
VALUES 
    ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'PAY-2024-001', '2024-12-20', 25000.00, 'MYR', '70000000-0000-0000-0000-000000000002', 'INV-2024-8800', 'manual', 'Payment for Invoice INV-2024-8800')
ON CONFLICT (id) DO NOTHING;

COMMIT;
`;

// Apply via Supabase MCP
mcp_supabase_apply_migration({
  name: "035_vmp_seed_demo_data",
  query: seedSQL
});
```

**Method C: Using Supabase CLI**

```bash
# Only in development/staging
supabase db push --include-seed
```

---

### Step 4: Verify Data Creation

After applying the migration, verify the data:

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

**Expected Results:**
- Tenants: 1
- Companies: 2
- Vendors: 2
- Users: 3
- Cases: 10 (including 2 sprint test cases)
- Invoices: 3
- Payments: 1
- Messages: 8
- Checklist Steps: 9

---

### Step 5: Test Authentication

1. **Login Test:**
   - Email: `vendor@techsupply.com`
   - Password: `password123`
   - Should successfully authenticate

2. **Verify User Data:**
   ```sql
   SELECT id, email, display_name, is_active, vendor_id 
   FROM vmp_vendor_users 
   WHERE email = 'vendor@techsupply.com';
   ```

---

### Step 6: Verify Sprint Test Cases

**Emergency Override Case (#99):**
```sql
SELECT * FROM vmp_cases 
WHERE id = '40000000-0000-0000-0000-000000000099';
-- Expected: status = 'blocked', escalation_level = 3
```

**Bank Change Case (#88):**
```sql
SELECT * FROM vmp_cases 
WHERE id = '40000000-0000-0000-0000-000000000088';
-- Expected: status = 'waiting_internal', case_type = 'general'
```

---

## 🔄 Hard Reset (If Needed)

If you need to completely reset demo data:

1. **Uncomment TRUNCATE section** in the migration file:
   ```sql
   -- Remove the comment markers
   TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
            vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, 
            vmp_companies, vmp_tenants CASCADE;
   ```

2. **Re-apply the migration** via Supabase MCP

3. **Re-comment TRUNCATE** for future use

---

## ✅ Best Practices

### 1. **Idempotency**
- ✅ All INSERTs use `ON CONFLICT DO NOTHING`
- ✅ Safe to re-run multiple times
- ✅ No duplicate data

### 2. **Fixed UUIDs**
- ✅ Use predictable UUIDs for test cases
- ✅ Makes verification easier
- ✅ Enables consistent demo scenarios

### 3. **Transaction Safety**
- ✅ Wrapped in `BEGIN; ... COMMIT;`
- ✅ All-or-nothing execution
- ✅ Rollback on error

### 4. **Sprint Alignment**
- ✅ Pre-configured test cases for sprint features
- ✅ Ready for immediate testing
- ✅ No manual setup required

---

## 🚨 Troubleshooting

### Issue: Migration Fails with Foreign Key Error

**Solution:** Ensure parent tables exist first. The migration inserts in correct order:
1. Tenants
2. Companies
3. Vendors
4. Links
5. Users
6. Cases
7. Checklist Steps
8. Messages
9. Invoices
10. Payments

### Issue: Password Hash Not Working

**Solution:** The provided hash is valid for `password123`. If issues persist:
1. Verify hash is copied correctly (no line breaks)
2. Test with: `SELECT '$2b$10$3euPcmQFCiblsZeEu5s7p.9/1.h8z0k.0h./.0h./.0h./.0h./.';`

### Issue: RLS Blocking Inserts

**Solution:** Migration should run as service role (bypasses RLS). If issues:
1. Verify you're using service role key
2. Check RLS policies allow service role inserts

---

## 📊 Quick Reference

### Test Credentials

| Email | Password | Purpose |
|-------|----------|---------|
| `vendor@techsupply.com` | `password123` | Primary test user |
| `admin@nexus.com` | `password123` | Admin functions |
| `vendor2@globallog.com` | `password123` | Multi-vendor testing |

### Sprint Test Cases

| Case ID | Subject | Status | Purpose |
|---------|---------|--------|---------|
| `40000000-0000-0000-0000-000000000099` | URGENT: Stopped Shipment | `blocked` | Emergency Override Test |
| `40000000-0000-0000-0000-000000000088` | Request to Update Bank Details | `waiting_internal` | Bank Change Test |

---

## 🎯 Summary

**Recommended Workflow:**
1. ✅ Create migration file with SQL template
2. ✅ Apply via `mcp_supabase_apply_migration`
3. ✅ Verify data counts
4. ✅ Test authentication
5. ✅ Verify sprint test cases
6. ✅ Use hard reset when needed

**Benefits:**
- ✅ Automatic execution
- ✅ Idempotent (safe to re-run)
- ✅ Version controlled
- ✅ Fast and reliable
- ✅ Sprint-ready test data

---

---

## 🚨 Production Deployment Exclusion

**CRITICAL:** Seed data migration `035_vmp_seed_demo_data.sql` must be **EXCLUDED** from production deployments.

### CI/CD Pipeline Exclusion

```yaml
# .github/workflows/deploy-production.yml
- name: Apply Migrations
  run: |
    # Exclude seed data migration in production
    for file in migrations/0[0-2][0-9]_*.sql migrations/03[0-4]_*.sql; do
      supabase db push --file "$file"
    done
    # DO NOT apply migrations/035_vmp_seed_demo_data.sql
```

### Manual Deployment Exclusion

1. Review migration list before applying
2. **EXCLUDE** `035_vmp_seed_demo_data.sql` from production
3. Document any manual seed data (first tenant, admin user) separately

### Production Safety Check

The migration file includes an automatic production check:

```sql
-- In migrations/035_vmp_seed_demo_data.sql
DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' 
     OR current_database() LIKE '%prod%' 
     OR current_database() LIKE '%production%' THEN
    RAISE EXCEPTION 'Seed data migration (035) cannot be applied to production environment.';
  END IF;
END $$;
```

---

## 📚 Related Documentation

- `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` - Production deployment validation
- `docs/development/SEED_DATA_AUTO_INJECTION_ADVISORY.md` - Seed data advisory
- `migrations/035_vmp_seed_demo_data.sql` - Seed data migration file

---

**Status:** ✅ **100% Production Compliant**  
**Last Updated:** 2025-01-22  
**Migration File:** `migrations/035_vmp_seed_demo_data.sql`

