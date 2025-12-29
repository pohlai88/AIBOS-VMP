# Developer Note: SSOT Guardrail Matrix Status

**Date:** 2025-01-22  
**Status:** L1 Documented (Ready for L2 Enforced)  
**Owner:** Architecture Team

---

## 📊 Current Status

### ✅ Completed (L1 Documented)

The SSOT Guardrail Matrix is **fully documented and operational** at L1 level:

1. **All 7 upgrades implemented:**
   - ✅ Compliance Level column (L0-L3)
   - ✅ Derived tenant proof requirement (EXISTS policies)
   - ✅ `invoice_line_items` structure fixed
   - ✅ Canonical Contract IDs (stable IDs for all contracts)
   - ✅ Index justification links (anti "GIN everything")
   - ✅ Core column deprecation workflow (6-month grace period)
   - ✅ Adapter owner + validator owner split (module paths)

2. **Critical fix applied:**
   - ✅ All tables marked ⚠️ (Declared) - correct state until DRIFT checks are enforced
   - ✅ Rule added: No ✅ unless DRIFT-01/02/03 passing on live DB or CI snapshot

3. **Drift check script created:**
   - ✅ `scripts/check-drift.mjs` - Generates machine-readable JSON reports
   - ✅ Integrated into `ci:gate` (first-class CI gate)
   - ✅ Reports generated: `reports/schema-diff.json`, `reports/rls-coverage.json`, `reports/contract-coverage.json`

4. **Documentation complete:**
   - ✅ All 20 tables documented in matrix
   - ✅ All 20 JSONB contracts registered
   - ✅ All 20 RLS policies documented
   - ✅ 100% coverage documented

---

## 🎯 What's Next (L1 → L2 Enforced)

### ✅ L1 Enhancements Completed (2025-01-22)

**Refinements Applied:**
1. ✅ DRIFT-01: Renamed `baseline`/`current` → `schema_source`/`ssot_source` (clarity)
2. ✅ DRIFT-02: Added `derived_path` field for derived scopes (machine-readable)
3. ✅ DRIFT-03: Added `semantic_role` field to RLS reports
4. ✅ Severity Model: Added `severity` field (BLOCKER/MAJOR/MINOR/NONE) to all reports
5. ✅ Version Semantics: Documented write/read rules in JSONB_CONTRACT_REGISTRY.md
6. ✅ Audit Log Clarification: Enhanced wording (flexible ≠ arbitrary)
7. ✅ L2/L3 Upgrade Path: Created comprehensive upgrade guide

**New Documents:**
- `docs/ssot/db/L2_L3_UPGRADE_PATH.md` - Complete upgrade roadmap

**Enhanced Reports:**
- All reports now include `severity` field
- RLS reports include `derived_path` and `semantic_role`
- Schema diff uses clearer field names

---

### Priority 1: Connect Drift Script to Live Database

**Current State:** Script generates reports using expected data (not live DB)

**What to Do:**
1. Connect `scripts/check-drift.mjs` to Supabase
2. Query actual schema (tables, columns, indexes)
3. Query actual RLS policies
4. Query actual JSONB columns
5. Compare against matrix expectations

**Files to Modify:**
- `scripts/check-drift.mjs` - Add Supabase connection code
- Use service role key (CI only, never in local commits)

**Reference:** See `docs/ssot/db/L2_L3_UPGRADE_PATH.md` for detailed implementation guide

**After Implementation:**
- Tables can move from ⚠️ → ✅
- Compliance Level can move from L1 → L2
- CI will enforce drift checks on live DB

---

## 📁 Key File Locations

### SSOT Documents (Master)
- **`docs/ssot/db/DB_GUARDRAIL_MATRIX.md`** - Main matrix (all 5 sections)
- **`docs/ssot/db/JSONB_CONTRACT_REGISTRY.md`** - Detailed contract definitions
- **`docs/ssot/db/PROMOTION_LOG.md`** - Promotion history (Phase A/B/C)
- **`docs/ssot/db/RLS_COVERAGE.md`** - Detailed RLS policy definitions
- **`docs/ssot/db/COMPLIANCE_SUMMARY.md`** - Compliance metrics and status

### Scripts
- **`scripts/check-drift.mjs`** - Drift check script (needs DB connection)
- **`package.json`** - `check:drift` script added to `ci:gate`

### Reports (Generated)
- **`reports/schema-diff.json`** - Schema diff report
- **`reports/rls-coverage.json`** - RLS coverage report
- **`reports/contract-coverage.json`** - Contract registry coverage report

### PRD Reference
- **`docs/development/prds/PRD_DB_SCHEMA.md`** - Source PRD (aligned to matrix)

---

## 🔍 Quick Reference

### Compliance Levels
- **L0 Draft** = Table exists but not documented
- **L1 Documented** = Matrix filled, CI not enforcing (current state)
- **L2 Enforced** = DRIFT-01/02/03 running in CI on live DB
- **L3 Enforced+Tested** = Enforced + integration tests

### Drift Status Meanings
- **✅** = Passes `check:drift` (requires DRIFT-01/02/03 on live DB or CI snapshot)
- **⚠️ Declared** = Documented but not enforced (current state for all tables)
- **❌** = Blocks merge

### Running Drift Checks
```bash
# Run drift checks manually
npm run check:drift

# Run full CI gate (includes drift checks)
npm run ci:gate
```

---

## 🚨 Critical Rules

1. **No ✅ unless DRIFT checks are enforced in CI**
   - "It passed locally" is not acceptable
   - Must pass on live DB or CI snapshot

2. **Core columns are immutable**
   - No drop/rename without deprecation
   - Minimum 6-month grace period

3. **All JSONB must be registered**
   - Every JSONB column needs contract type
   - Contract must exist in registry

4. **RLS is mandatory**
   - 100% coverage for tenant-scoped tables
   - Derived scopes must have EXISTS policy proof

5. **Promotions follow Phase A/B/C**
   - Not optional
   - Must have rollback script

---

## 📝 Maintenance

### When Adding New Tables
1. Add row to `DB_GUARDRAIL_MATRIX.md` Section A
2. Add RLS policies to `RLS_COVERAGE.md`
3. Register JSONB contracts in `JSONB_CONTRACT_REGISTRY.md`
4. Update drift check script expected data
5. Mark as L1 Documented until DRIFT checks pass

### When Adding JSONB Contracts
1. Add to `DB_GUARDRAIL_MATRIX.md` Section B
2. Add detailed definition to `JSONB_CONTRACT_REGISTRY.md`
3. Create Zod schema in `src/schemas/metadata.schema.js`
4. Update drift check script expected data

### When Promoting JSONB → Column
1. Follow Phase A/B/C in `PROMOTION_LOG.md`
2. Update matrix (remove from JSONB, add to columns)
3. Update contract registry (mark as promoted)
4. Document in promotion log

---

## 🎯 Success Criteria for L2 Enforced

- [ ] `check:drift` connects to live Supabase database
- [ ] DRIFT-01 validates actual schema vs migrations
- [ ] DRIFT-02 validates actual RLS policies vs matrix
- [ ] DRIFT-03 validates actual JSONB columns vs registry
- [ ] All 3 checks pass in CI
- [ ] Tables can be marked ✅ (instead of ⚠️)
- [ ] Compliance Level moves to L2

---

## 📞 Questions?

- **Matrix questions:** See `docs/ssot/db/DB_GUARDRAIL_MATRIX.md`
- **Contract questions:** See `docs/ssot/db/JSONB_CONTRACT_REGISTRY.md`
- **RLS questions:** See `docs/ssot/db/RLS_COVERAGE.md`
- **PRD questions:** See `docs/development/prds/PRD_DB_SCHEMA.md`

---

**Last Updated:** 2025-01-22  
**Next Review:** After DB connection implementation (L2 milestone)

