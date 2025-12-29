# L1 Implementation Guide: SSOT Guardrail Matrix

## Document Status & Authority

**Authority Level:** INFORMATIVE  
**SSOT:** No  
**Enforcement:** Not enforced (explanatory only)  
**Applies To:** Developers, auditors, onboarding  
**Owner:** Architecture Team  
**Effective From:** 2025-01-22  
**Version:** 1.0.0

**Non-Normative Notice:**
This guide is **INFORMATIVE**. It explains how to apply the SSOT and run enforcement checks.
It MUST NOT define new requirements. If a rule is not in the SSOT Matrix (`DB_GUARDRAIL_MATRIX.md`), it is not a rule.

**Precedence:**
1. **NORMATIVE SSOT** (`DB_GUARDRAIL_MATRIX.md` - highest authority)
2. Enforcement code (`check-drift.mjs`)
3. **This guide** (INFORMATIVE - explains process only)
4. EVIDENCE reports (derived output)

---

**Date:** 2025-01-22  
**Status:** ✅ Implemented  
**Compliance Level:** L1 Documented  
**Purpose:** Complete guide to L1 implementation patterns, control layer, features, and format

---

## 📋 Overview

**L1 Documented** is the foundational compliance level where all database schema guardrails are fully documented and validated against SSOT matrix files. L1 provides the structure and validation framework that enables L2 (Enforced) and L3 (Enforced+Tested) compliance levels.

---

## 🎯 L1 Definition

**L1 Documented** means:
- ✅ All tables documented in SSOT Guardrail Matrix
- ✅ All JSONB contracts registered with canonical IDs
- ✅ All RLS policies documented with coverage proof
- ✅ Drift check script reads from matrix files (not hardcoded)
- ✅ Machine-readable reports generated for CI/CD
- ✅ All patterns and workflows documented
- ⚠️ **Not yet connected to live database** (that's L2)

---

## 🏗️ Architecture Pattern

### Control Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│              SSOT Guardrail Matrix (Master)             │
│  docs/ssot/db/DB_GUARDRAIL_MATRIX.md                    │
│  - Section A: Table Guardrail Matrix                    │
│  - Section B: JSONB Contract Registry Matrix            │
│  - Section C: Promotion Matrix                          │
│  - Section D: RLS Coverage Matrix                       │
│  - Section E: Drift Checks Matrix                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         Matrix Parser (scripts/utils/matrix-parser.mjs) │
│  - parseTableMatrix()                                   │
│  - parseJsonbContractRegistry()                         │
│  - parseRLSCoverageMatrix()                              │
│  - getAllJsonbColumns()                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│      Drift Check Script (scripts/check-drift.mjs)       │
│  - DRIFT-01: Schema Diff Check                          │
│  - DRIFT-02: RLS Coverage Check                         │
│  - DRIFT-03: Contract Registry Coverage Check          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         Machine-Readable Reports (reports/)             │
│  - schema-diff.json                                     │
│  - rls-coverage.json                                     │
│  - contract-coverage.json                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              CI/CD Gate (package.json)                  │
│  - check:drift → node scripts/check-drift.mjs          │
│  - ci:gate → includes check:drift                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Features

### 1. Matrix Parser (`scripts/utils/matrix-parser.mjs`)

**Purpose:** Extract structured data from markdown matrix files.

**Functions:**
- `parseTableMatrix()` - Extracts table guardrail data (Section A)
- `parseJsonbContractRegistry()` - Extracts JSONB contract registry (Section B)
- `parseRLSCoverageMatrix()` - Extracts RLS coverage data (Section D)
- `getAllJsonbColumns()` - Aggregates all JSONB columns from tables

**Pattern:**
- Parses markdown tables by detecting section headers
- Cleans markdown formatting (backticks, links)
- Returns structured JavaScript objects
- Filters to only `nexus_*` tables

**Example:**
```javascript
import { parseTableMatrix } from './utils/matrix-parser.mjs';

const tables = parseTableMatrix();
// Returns array of table objects with all matrix columns
```

### 2. Drift Check Script (`scripts/check-drift.mjs`)

**Purpose:** Validate database schema compliance against SSOT matrix.

**Three Checks:**

#### DRIFT-01: Schema Inventory + Expected Tables Validation (L1) / Schema Diff Against Live DB (L2+)
- **Input:** Migration files + Table Matrix
- **Output:** `reports/schema-diff.json`
- **L1 Behavior:** Validates that all expected tables are documented in matrix
- **L2 Behavior:** Compares migrations vs live database schema (actual enforcement)

#### DRIFT-02: RLS Coverage Check
- **Input:** RLS Coverage Matrix + Table Matrix
- **Output:** `reports/rls-coverage.json`
- **L1 Behavior:** Validates 100% RLS coverage documented
- **L2 Behavior:** Will query actual RLS policies from database

#### DRIFT-03: Contract Registry Coverage Check
- **Input:** JSONB Columns + Contract Registry
- **Output:** `reports/contract-coverage.json`
- **L1 Behavior:** Validates all JSONB columns registered
- **L2 Behavior:** Will query actual JSONB columns from database

**Pattern:**
- Reads from matrix files (not hardcoded)
- Generates machine-readable JSON reports
- Returns exit code 0 (pass) or 1 (fail) for CI/CD
- Includes compliance level in reports

### 3. Report Format

**Standard Report Structure:**
```json
{
  "timestamp": "2025-01-22T12:00:00.000Z",
  "compliance_level": "L1 Documented",
  "summary": {
    "total": 20,
    "compliant": 20,
    "non_compliant": 0,
    "coverage_percentage": 100.0
  },
  "details": [...]
}
```

---

## 📐 Format Standards

### Matrix File Format

**Location:** `docs/ssot/db/DB_GUARDRAIL_MATRIX.md`

**Sections:**
1. **Section A:** Table Guardrail Matrix (markdown table)
2. **Section B:** JSONB Contract Registry Matrix (markdown table)
3. **Section C:** Promotion Matrix (markdown table)
4. **Section D:** RLS Coverage Matrix (markdown table)
5. **Section E:** Drift Checks Matrix (markdown table)

**Table Format:**
- Markdown tables with pipe delimiters
- Headers in first row
- Separator row with dashes
- Data rows with values
- Backticks for code/identifiers

**Example:**
```markdown
| Table | Purpose | Tenant Scope | ... |
|-------|---------|--------------|-----|
| `nexus_tenants` | Master tenant table | `tenant_id` | ... |
```

### Script Format

**Location:** `scripts/check-drift.mjs`

**Structure:**
- ES6 modules (`import`/`export`)
- Async functions for file I/O
- Error handling with try/catch
- Console output for human readability
- JSON output for machine processing

**Exit Codes:**
- `0` = All checks passed
- `1` = One or more checks failed

---

## 🔍 Control Layer Features

### 1. Single Source of Truth (SSOT)

**Principle:** All database schema information flows from matrix files.

**Implementation:**
- Matrix files are the authoritative source
- Scripts read from matrix (never hardcode)
- Changes to matrix automatically reflected in checks

### 2. Machine-Readable Reports

**Principle:** All validation results in JSON format for CI/CD integration.

**Implementation:**
- Reports in `reports/` directory
- Standard JSON structure
- Includes timestamps and compliance levels
- Summary statistics for quick assessment

### 3. Compliance Level Tracking

**Principle:** Every check reports its compliance level.

**Levels:**
- **L0 Draft** = Not documented
- **L1 Documented** = Documented, validated against matrix
- **L2 Enforced** = Validated against live database
- **L3 Enforced+Tested** = Enforced + integration tests

### 4. Drift Status

**Principle:** Tables marked with drift status based on actual validation.

**Status Values:**
- ✅ = Passes `check:drift` (requires L2+)
- ⚠️ Declared = Documented but not enforced (L1 state)
- ❌ = Blocks merge

**L1 Rule:** All tables must be ⚠️ Declared (cannot be ✅ until L2)

**⚠️ External Claims Guard:**
Any external document (sales, investor, compliance) must treat ⚠️ Declared as "documented only" and **MUST NOT claim enforcement**. Only ✅ status indicates actual enforcement.

---

## 🎨 Pattern Examples

### Pattern 1: Adding New Table

**Steps:**
1. Add row to `DB_GUARDRAIL_MATRIX.md` Section A
2. Add RLS policies to `RLS_COVERAGE.md`
3. Register JSONB contracts (if any) in Section B
4. Run `npm run check:drift` to validate
5. Matrix parser automatically picks up new table

**No code changes needed** - parser reads from matrix files.

### Pattern 2: Adding JSONB Contract

**Steps:**
1. Add contract to `DB_GUARDRAIL_MATRIX.md` Section B
2. Add detailed definition to `JSONB_CONTRACT_REGISTRY.md`
3. Create Zod schema in `src/schemas/metadata.schema.js`
4. Update table matrix to reference contract
5. Run `npm run check:drift` to validate

**Parser automatically matches columns to contracts.**

### Pattern 3: Running Drift Checks

**Command:**
```bash
npm run check:drift
```

**Output:**
- Console: Human-readable summary
- Files: JSON reports in `reports/`
- Exit code: 0 (pass) or 1 (fail)

**CI Integration:**
- Already included in `ci:gate`
- Runs automatically on PR validation
- Blocks merge if checks fail

---

## ✅ L1 Success Criteria

### Documentation
- [x] All 20 tables documented in matrix
- [x] All 20 JSONB contracts registered
- [x] All 20 RLS policies documented
- [x] All 7 upgrades implemented
- [x] Core deprecation workflow documented

### Scripts
- [x] Matrix parser created
- [x] Drift check script reads from matrix
- [x] All three checks (DRIFT-01/02/03) implemented
- [x] Reports generated in JSON format
- [x] Script integrated into CI gate

### Validation
- [x] DRIFT-01 validates table documentation
- [x] DRIFT-02 validates RLS coverage (100%)
- [x] DRIFT-03 validates contract registry (100%)
- [x] All checks pass with 100% coverage

### Compliance
- [x] All tables marked L1 Documented
- [x] All tables marked ⚠️ Declared (correct for L1)
- [x] Compliance level tracked in reports
- [x] Drift status follows L1 rules

---

## 🚀 Next Steps (L2 Enforced)

To move from L1 → L2:

1. **Connect to Database**
   - Add Supabase client to drift check script
   - Query actual schema from `information_schema`
   - Query actual RLS policies from `pg_policies`

2. **Compare Against Live**
   - DRIFT-01: Compare migrations vs live schema
   - DRIFT-02: Compare matrix vs live RLS policies
   - DRIFT-03: Compare matrix vs live JSONB columns

3. **Update Status**
   - Tables can move from ⚠️ → ✅
   - Compliance Level moves from L1 → L2
   - CI enforces actual database validation

---

## 📚 Related Documentation

- **Matrix:** `docs/ssot/db/DB_GUARDRAIL_MATRIX.md`
- **Contracts:** `docs/ssot/db/JSONB_CONTRACT_REGISTRY.md`
- **RLS:** `docs/ssot/db/RLS_COVERAGE.md`
- **Compliance:** `docs/ssot/db/COMPLIANCE_SUMMARY.md`
- **Developer Note:** `DEVELOPER_NOTE_SSOT_GUARDRAIL_MATRIX.md`

---

**Last Updated:** 2025-01-22  
**Maintained By:** Architecture Team

