# Tech Debt: Restore vmp_invoices NOT NULL Constraints

**Created:** 2025-12-24  
**Priority:** High (P1)  
**Timeline:** Fix within 2 sprints (before production load)  
**Owner:** Engineering  
**Status:** Tracked

---

## Problem Statement

During SOA test stabilization, we **relaxed NOT NULL constraints** on `vmp_invoices` table to unblock test fixtures. This was the correct short-term fix to prevent test failures, but poses **production risks**.

### Constraints Relaxed

**Original Migration:** `migrations/017_vmp_payments.sql` (or similar)

```sql
-- BEFORE (strict, correct for production)
CREATE TABLE vmp_invoices (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vmp_vendors(id),
  company_id UUID NOT NULL REFERENCES vmp_companies(id),
  tenant_id UUID NOT NULL REFERENCES vmp_tenants(id),
  invoice_number TEXT NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  -- ... other required fields
);
```

**Current State (relaxed for tests):**
```sql
-- AFTER (relaxed, risky for production)
CREATE TABLE vmp_invoices (
  id UUID PRIMARY KEY,
  vendor_id UUID REFERENCES vmp_vendors(id),           -- NOT NULL removed
  company_id UUID REFERENCES vmp_companies(id),        -- NOT NULL removed
  tenant_id UUID REFERENCES vmp_tenants(id),           -- NOT NULL removed
  invoice_number TEXT,                                 -- NOT NULL removed
  total_amount DECIMAL(15,2),                          -- NOT NULL removed
  -- ... other fields
);
```

### Risk Assessment

**Severity:** High

**Risks:**
1. **Data integrity:** Invoices can be created without vendor/company/tenant
2. **Tenant isolation:** NULL tenant_id breaks RLS (Row Level Security)
3. **Business logic:** Code assumes these fields exist (NULL checks missing)
4. **Production incidents:** Silent failures when invoices lack required context

**Impact if not fixed:**
- Orphaned invoices in production (no owner)
- Cross-tenant data leaks (RLS broken)
- Payment reconciliation failures (missing invoice context)

---

## Root Cause

**Why constraints were relaxed:**

Test fixtures were creating invoices without supplying required fields:
```javascript
// OLD test code (missing required fields)
const invoice = await supabase.from('vmp_invoices').insert({
  invoice_number: 'INV-001',
  total_amount: 1000.00
  // Missing: vendor_id, company_id, tenant_id
});
```

**Why this approach is wrong:**
- Tests should match production data shape
- Relaxing constraints normalizes invalid states

---

## Solution (Two-Phase Fix)

### Phase 1: Update Test Fixtures (Sprint 1)

**Goal:** Make all test helpers supply required fields.

**Changes Required:**

1. **Update `createTestInvoice()` helper:**

```javascript
// In tests/setup/test-helpers.js
export async function createTestInvoice(supabase, invoiceData = {}) {
  const { vendorId, companyId, tenantId, ...cleanData } = invoiceData;
  
  // Auto-create missing entities
  let vendor_id = vendorId || invoiceData.vendor_id;
  let company_id = companyId || invoiceData.company_id;
  let tenant_id = tenantId || invoiceData.tenant_id;
  
  if (!vendor_id) {
    const vendor = await createTestVendor(supabase);
    vendor_id = vendor.id;
    tenant_id = vendor.tenant_id;
  }
  
  if (!company_id) {
    const company = await createTestCompany(supabase, { tenant_id });
    company_id = company.id;
  }
  
  if (!tenant_id && vendor_id) {
    // Get tenant from vendor
    const { data } = await supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendor_id)
      .single();
    tenant_id = data?.tenant_id;
  }
  
  const defaultInvoice = {
    vendor_id,                      // REQUIRED
    company_id,                     // REQUIRED
    tenant_id,                      // REQUIRED
    invoice_number: `INV-${Date.now()}`,  // REQUIRED
    total_amount: 1000.00,          // REQUIRED
    currency_code: 'USD',
    invoice_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    ...cleanData
  };
  
  const { data, error } = await supabase
    .from('vmp_invoices')
    .insert(defaultInvoice)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

2. **Audit all invoice creation in tests:**

```powershell
# Find all invoice inserts
grep -r "vmp_invoices" tests/ --include="*.test.js"

# For each, ensure these fields are supplied:
# - vendor_id
# - company_id
# - tenant_id
# - invoice_number
# - total_amount
```

3. **Update affected tests:**

```javascript
// BEFORE (fails with NOT NULL constraint)
const invoice = await supabase.from('vmp_invoices').insert({
  invoice_number: 'INV-001',
  total_amount: 1000.00
});

// AFTER (passes with constraints restored)
const invoice = await createTestInvoice(supabase, {
  vendorId: testVendor.id,
  invoice_number: 'INV-001',
  total_amount: 1000.00
});
```

**Acceptance Criteria:**
- [ ] All invoice test helpers supply required fields
- [ ] All tests using `createTestInvoice()` pass
- [ ] No direct `supabase.from('vmp_invoices').insert()` calls without required fields

---

### Phase 2: Restore Constraints (Sprint 2)

**Goal:** Re-apply NOT NULL constraints via migration.

**Migration:** `migrations/0XX_restore_invoice_constraints.sql`

```sql
-- Restore vmp_invoices NOT NULL Constraints
-- Prerequisites: All test fixtures updated (Phase 1 complete)

-- Step 1: Ensure no NULL data exists (pre-check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM vmp_invoices 
    WHERE vendor_id IS NULL 
       OR company_id IS NULL 
       OR tenant_id IS NULL
       OR invoice_number IS NULL
       OR total_amount IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore constraints: NULL data exists in vmp_invoices';
  END IF;
END $$;

-- Step 2: Restore constraints
ALTER TABLE vmp_invoices
  ALTER COLUMN vendor_id SET NOT NULL,
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN invoice_number SET NOT NULL,
  ALTER COLUMN total_amount SET NOT NULL;

-- Step 3: Verify constraints
COMMENT ON COLUMN vmp_invoices.vendor_id IS 'REQUIRED: Invoice must belong to vendor';
COMMENT ON COLUMN vmp_invoices.company_id IS 'REQUIRED: Invoice must belong to company';
COMMENT ON COLUMN vmp_invoices.tenant_id IS 'REQUIRED: Invoice must belong to tenant (for RLS)';
COMMENT ON COLUMN vmp_invoices.invoice_number IS 'REQUIRED: Unique invoice identifier';
COMMENT ON COLUMN vmp_invoices.total_amount IS 'REQUIRED: Invoice total (cannot be NULL)';
```

**Pre-Migration Checklist:**
- [ ] Phase 1 complete (all test fixtures updated)
- [ ] All tests passing with current relaxed constraints
- [ ] No production invoices with NULL required fields
- [ ] RLS policies tested with restored constraints

**Acceptance Criteria:**
- [ ] Migration applies cleanly (no NULL data violations)
- [ ] All tests still pass
- [ ] Production invoices cannot be created without required fields
- [ ] RLS policies enforce tenant isolation correctly

---

## Testing Strategy

### Phase 1 Verification

```powershell
# 1. Update test helpers
# (Code changes as above)

# 2. Run full test suite
pnpm vitest

# Expected: Same or fewer failures (no NEW failures from constraint fixes)

# 3. Specifically test invoice creation
pnpm vitest run tests/adapters/supabase.test.js -t "invoice"
pnpm vitest run tests/components/soa-recon.test.js
```

### Phase 2 Verification

```powershell
# 1. Backup production data (if applicable)
supabase db dump > backup_before_constraints.sql

# 2. Apply migration (local first)
supabase db reset
# Verify no errors

# 3. Run full test suite
pnpm vitest
# All tests should still pass

# 4. Test constraint enforcement
psql -c "INSERT INTO vmp_invoices (invoice_number) VALUES ('TEST');"
# Expected: ERROR: null value in column "vendor_id" violates not-null constraint
```

---

## Rollback Plan

If Phase 2 migration fails:

```sql
-- Rollback: Remove constraints
ALTER TABLE vmp_invoices
  ALTER COLUMN vendor_id DROP NOT NULL,
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN tenant_id DROP NOT NULL,
  ALTER COLUMN invoice_number DROP NOT NULL,
  ALTER COLUMN total_amount DROP NOT NULL;
```

**When to rollback:**
- Migration fails pre-check (NULL data exists)
- Tests fail after constraint restore
- Production incidents caused by constraint enforcement

---

## Success Metrics

### Phase 1 (Test Fixtures)
- ✅ All invoice test helpers supply required fields
- ✅ Zero test failures related to missing invoice fields
- ✅ 100% test coverage for invoice creation paths

### Phase 2 (Constraint Restoration)
- ✅ Migration applies without errors
- ✅ No production invoices with NULL required fields
- ✅ RLS policies enforce tenant isolation
- ✅ All tests passing with constraints restored

---

## Related Issues

**Similar Constraints Relaxed:**
- [ ] `vmp_payments` — check if constraints relaxed
- [ ] `vmp_cases` — verify tenant_id/company_id always set
- [ ] `vmp_soa_items` — verify company_id always set

**Follow-up Actions:**
1. Audit all tables for relaxed constraints
2. Create similar tracking tickets if needed
3. Establish policy: "Never relax production constraints for tests"

---

## Prevention (Future)

### Policy: Test Data Must Match Production Shape

**Rule:** Tests MUST NOT relax schema constraints to pass.

**Correct Approach:**
1. Fix test fixtures to supply required fields
2. Use test helpers that auto-create dependencies

**Incorrect Approach:**
1. ❌ Remove NOT NULL constraints
2. ❌ Skip FK constraint validation
3. ❌ Use mock/stub data that wouldn't exist in production

### Test Helper Standards

All `createTest*()` helpers must:
- [ ] Auto-create missing FK dependencies (vendor, company, tenant)
- [ ] Supply all NOT NULL fields with valid defaults
- [ ] Match production data shape exactly

---

## Timeline

**Week 1-2 (Sprint 1):**
- [ ] Update `createTestInvoice()` helper
- [ ] Audit all invoice creation in tests
- [ ] Fix test failures
- [ ] Verify baseline unchanged (no new failures)

**Week 3-4 (Sprint 2):**
- [ ] Write migration to restore constraints
- [ ] Test migration locally
- [ ] Apply to staging
- [ ] Monitor for 1 week
- [ ] Apply to production

**Deadline:** Before production load testing (critical blocker)

---

## Contact & Escalation

**Owner:** Engineering Team  
**Reviewer:** Tech Lead  
**Escalation:** If deadline at risk, escalate immediately (blocks production)

---

## Change Log

- **2025-12-24:** Initial tracking ticket created after SOA stabilization
