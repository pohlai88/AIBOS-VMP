# L2/L3 Upgrade Path

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** ✅ Ready for Implementation  
**Purpose:** Clear upgrade path from L1 Documented → L2 Enforced → L3 Enforced+Tested  
**Aligned To:** [DEVELOPER_NOTE_SSOT_GUARDRAIL_MATRIX.md](../../DEVELOPER_NOTE_SSOT_GUARDRAIL_MATRIX.md)

---

## 📊 Compliance Level Definitions

| Level | Name | Status | Enforcement | Testing |
|-------|------|--------|--------------|---------|
| **L0** | Draft | ⚠️ | None | None |
| **L1** | Documented | ✅ Current | Matrix filled, CI not enforcing | None |
| **L2** | Enforced | 🎯 Next | DRIFT checks in CI on live DB | None |
| **L3** | Enforced+Tested | 🚀 Future | DRIFT checks + integration tests | Full coverage |

---

## 🎯 L1 → L2 Enforced (Priority 1)

### Current State (L1)
- ✅ All 20 tables documented in matrix
- ✅ All 20 JSONB contracts registered
- ✅ All 20 RLS policies documented
- ✅ Drift check script created (`scripts/check-drift.mjs`)
- ✅ Reports generated (schema-diff, rls-coverage, contract-coverage)
- ⚠️ Script uses expected data (not live DB)

### L2 Requirements

#### 1. Connect Drift Script to Live Database ✅ Ready
**What:** Connect `scripts/check-drift.mjs` to Supabase

**Implementation:**
```javascript
// Add to scripts/check-drift.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // CI only, never in local commits
);
```

**Tasks:**
- [ ] Add Supabase client initialization
- [ ] Query actual schema (tables, columns, indexes) via `information_schema`
- [ ] Query actual RLS policies via `pg_policies`
- [ ] Query actual JSONB columns via `information_schema.columns`
- [ ] Compare against matrix expectations
- [ ] Generate diff reports with severity levels

**Files to Modify:**
- `scripts/check-drift.mjs` - Add DB connection code
- `.env.example` - Add `SUPABASE_SERVICE_ROLE_KEY` (documented, not committed)
- CI configuration - Add service role key as secret

**After Implementation:**
- Tables can move from ⚠️ → ✅
- Compliance Level can move from L1 → L2
- CI will enforce drift checks on live DB

---

#### 2. DRIFT-01: Schema Diff (Live DB) ✅ Ready
**What:** Compare live database schema vs migrations + matrix

**Implementation:**
```sql
-- Query actual tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'nexus_%';

-- Query actual columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'nexus_%';

-- Query actual indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'nexus_%';
```

**Severity Model:**
- **BLOCKER:** Unexpected tables, missing core columns, missing indexes
- **MAJOR:** Extra columns without documentation, index mismatches
- **MINOR:** Column type mismatches, nullable differences

**Output:** Enhanced `reports/schema-diff.json` with live DB comparison

---

#### 3. DRIFT-02: RLS Coverage (Live DB) ✅ Ready
**What:** Validate actual RLS policies match matrix expectations

**Implementation:**
```sql
-- Query actual RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'nexus_%';

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'nexus_%';
```

**Severity Model:**
- **BLOCKER:** Missing RLS policies, RLS disabled on tenant-scoped tables
- **MAJOR:** Policy mismatch (different operations covered)
- **MINOR:** Policy name mismatches

**Output:** Enhanced `reports/rls-coverage.json` with live DB validation

---

#### 4. DRIFT-03: Contract Registry (Live DB) ✅ Ready
**What:** Validate actual JSONB columns match registry

**Implementation:**
```sql
-- Query actual JSONB columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'jsonb'
  AND table_name LIKE 'nexus_%';

-- Query CHECK constraints
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid IN (
    SELECT oid FROM pg_class WHERE relname LIKE 'nexus_%'
  );
```

**Severity Model:**
- **BLOCKER:** Unregistered JSONB columns, missing CHECK constraints
- **MAJOR:** Contract type mismatches
- **MINOR:** Version mismatches

**Output:** Enhanced `reports/contract-coverage.json` with live DB validation

---

#### 5. CI/CD Gate Integration ✅ Ready
**What:** Fail CI on drift violations

**Implementation:**
```json
// package.json
{
  "scripts": {
    "ci:gate": "npm run lint && npm run test:unit && npm run check:drift && npm run audit:no-drift"
  }
}
```

**Behavior:**
- `check:drift` exits with code 1 on BLOCKER/MAJOR violations
- CI pipeline fails on drift
- Reports uploaded as artifacts

**Files:**
- Already integrated in `package.json` ✅
- CI configuration (GitHub Actions / GitLab CI) - Add service role key secret

---

### L2 Success Criteria

- [ ] `check:drift` connects to live Supabase database
- [ ] DRIFT-01 validates actual schema vs migrations + matrix
- [ ] DRIFT-02 validates actual RLS policies vs matrix
- [ ] DRIFT-03 validates actual JSONB columns vs registry
- [ ] All 3 checks pass in CI
- [ ] Tables can be marked ✅ (instead of ⚠️)
- [ ] Compliance Level moves to L2
- [ ] CI fails on drift violations

**Estimated Effort:** 2-3 days (DB connection + query logic)

---

## 🚀 L2 → L3 Enforced+Tested (Priority 2)

### Current State (L2)
- ✅ DRIFT checks running in CI on live DB
- ✅ CI fails on drift violations
- ⚠️ No integration tests for RLS policies
- ⚠️ No integration tests for contract validation
- ⚠️ No integration tests for promotion rollback

### L3 Requirements

#### 1. RLS Integration Tests ✅ Ready
**What:** Integration tests that verify RLS policies work correctly

**Implementation:**
```javascript
// tests/integration/rls/nexus_cases.test.js
describe('RLS: nexus_cases', () => {
  it('prevents cross-tenant reads', async () => {
    const tenant1 = await createTestTenant();
    const tenant2 = await createTestTenant();
    const case1 = await createCase(tenant1);
    
    const user2 = await createUser(tenant2);
    const result = await queryAsUser(user2, `SELECT * FROM nexus_cases WHERE id = $1`, [case1.id]);
    
    expect(result.rows).toHaveLength(0); // Should be empty
  });
  
  it('allows same-tenant reads', async () => {
    const tenant1 = await createTestTenant();
    const case1 = await createCase(tenant1);
    const user1 = await createUser(tenant1);
    
    const result = await queryAsUser(user1, `SELECT * FROM nexus_cases WHERE id = $1`, [case1.id]);
    
    expect(result.rows).toHaveLength(1); // Should return case
  });
});
```

**Coverage:**
- [ ] Cross-tenant read prevention (all 20 tables)
- [ ] Cross-tenant write prevention (all 20 tables)
- [ ] Derived scope isolation (10 derived tables)
- [ ] Service role bypass (documented cases only)

**Files:**
- `tests/integration/rls/` - Test suite (create if missing)
- Add to `package.json` test scripts

---

#### 2. Contract Validation Tests ✅ Ready
**What:** Integration tests that verify JSONB contracts are validated

**Implementation:**
```javascript
// tests/integration/contracts/tenant_settings.test.js
describe('Contract: tenant_settings', () => {
  it('rejects writes with invalid version', async () => {
    const tenant = await createTestTenant();
    
    await expect(
      adapter.updateTenant(tenant.id, {
        settings: { _schema_version: 999 } // Invalid version
      })
    ).rejects.toThrow('Version 999 out of supported range');
  });
  
  it('accepts writes with max_version', async () => {
    const tenant = await createTestTenant();
    
    await expect(
      adapter.updateTenant(tenant.id, {
        settings: { _schema_version: 1, type: 'tenant_settings', feature_flags: {} }
      })
    ).resolves.toBeDefined();
  });
});
```

**Coverage:**
- [ ] Write-time validation (max_version enforcement)
- [ ] Read-time validation (version range acceptance)
- [ ] Required keys enforcement
- [ ] Allowed keys enforcement
- [ ] CHECK constraint enforcement (where applicable)

**Files:**
- `tests/integration/contracts/` - Test suite (create if missing)
- Add to `package.json` test scripts

---

#### 3. Promotion Rollback Tests ✅ Ready
**What:** Integration tests that verify promotion rollback scripts work

**Implementation:**
```javascript
// tests/integration/promotions/promo-001.test.js
describe('Promotion: PROMO-001 (case_metadata.escalation_level)', () => {
  it('rollback script restores JSONB structure', async () => {
    // Run promotion migration
    await runMigration('050_promo_001_escalation_level.sql');
    
    // Verify column exists
    const result = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'nexus_cases' AND column_name = 'escalation_level'`);
    expect(result.rows).toHaveLength(1);
    
    // Run rollback script
    await runMigration('050_promo_001_rollback.sql');
    
    // Verify column removed, JSONB restored
    const result2 = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'nexus_cases' AND column_name = 'escalation_level'`);
    expect(result2.rows).toHaveLength(0);
    
    const jsonbCheck = await query(`SELECT metadata->>'escalation_level' FROM nexus_cases LIMIT 1`);
    expect(jsonbCheck.rows[0]).toBeDefined();
  });
});
```

**Coverage:**
- [ ] All promotion rollback scripts tested
- [ ] Data migration verified (JSONB → column, column → JSONB)
- [ ] No data loss during rollback

**Files:**
- `tests/integration/promotions/` - Test suite (create if missing)
- Rollback scripts in `migrations/` (create as needed)

---

#### 4. Drift Check Tests ✅ Ready
**What:** Unit tests for drift check script itself

**Implementation:**
```javascript
// tests/unit/drift/check-drift.test.js
describe('check-drift.mjs', () => {
  it('detects missing RLS policies', async () => {
    // Mock Supabase client
    const mockClient = {
      from: () => ({
        select: () => ({ data: [], error: null })
      })
    };
    
    const result = await checkRLSCoverage(mockClient);
    expect(result.summary.non_compliant).toBeGreaterThan(0);
  });
});
```

**Coverage:**
- [ ] DRIFT-01 logic (schema diff)
- [ ] DRIFT-02 logic (RLS coverage)
- [ ] DRIFT-03 logic (contract coverage)
- [ ] Severity calculation
- [ ] Report generation

**Files:**
- `tests/unit/drift/` - Test suite (create if missing)

---

### L3 Success Criteria

- [ ] RLS integration tests pass (all 20 tables)
- [ ] Contract validation tests pass (all 20 contracts)
- [ ] Promotion rollback tests pass (all promotions)
- [ ] Drift check tests pass
- [ ] Test coverage ≥ 95% for RLS/contract/promotion code
- [ ] CI runs all tests before merge
- [ ] Compliance Level moves to L3

**Estimated Effort:** 1-2 weeks (test suite creation + coverage)

---

## 📋 Implementation Checklist

### L1 → L2 (Priority 1)
- [ ] Add Supabase client to `scripts/check-drift.mjs`
- [ ] Implement DRIFT-01 (live DB schema query)
- [ ] Implement DRIFT-02 (live DB RLS query)
- [ ] Implement DRIFT-03 (live DB JSONB query)
- [ ] Add severity levels to reports
- [ ] Configure CI service role key secret
- [ ] Test drift checks in CI
- [ ] Update matrix (⚠️ → ✅)
- [ ] Update compliance level (L1 → L2)

### L2 → L3 (Priority 2)
- [ ] Create RLS integration test suite
- [ ] Create contract validation test suite
- [ ] Create promotion rollback test suite
- [ ] Create drift check unit tests
- [ ] Achieve ≥95% test coverage
- [ ] Update compliance level (L2 → L3)

---

## 🎯 Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **L1 → L2** | 2-3 days | Supabase access, service role key |
| **L2 → L3** | 1-2 weeks | L2 complete, test infrastructure |

**Total:** ~2-3 weeks to reach L3 Enforced+Tested

---

## 📞 Questions?

- **L2 Implementation:** See `scripts/check-drift.mjs` for current structure
- **L3 Testing:** See `tests/integration/` for existing test patterns
- **Matrix Updates:** See [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md)

---

**Last Updated:** 2025-01-22  
**Next Review:** After L2 implementation  
**Maintained By:** Architecture Team

