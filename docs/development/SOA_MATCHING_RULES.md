# SOA Matching Rules & Contract

**Purpose:** Define deterministic behavior for SOA reconciliation matching engine.  
**Owner:** Engineering  
**Last Updated:** 2025-12-24

---

## Matching Pass Execution Order

The SOA matching engine runs **5 passes** in strict order:

1. **Pass 1: Exact Match** (strict)
2. **Pass 2: Date Tolerance** (±7 days)
3. **Pass 3: Fuzzy Document** (normalized doc numbers)
4. **Pass 4: Amount Tolerance** (±1.00 or 0.5%)
5. **Pass 5: Partial/Group** (opt-in only)

**First match wins** — if Pass 1 succeeds, Passes 2-5 never execute.

---

## Pass 5: Partial/Group Matching (Opt-In Contract)

### ⚠️ CRITICAL: Pass 5 is **DISABLED BY DEFAULT**

**Why:** Prevents aggressive matching from hijacking negative test cases and false positives in production.

### Enabling Pass 5

Pass 5 **only executes** when ONE of these conditions is true:

```javascript
// Option 1: SOA line flag
soaLine.allow_partial === true

// Option 2: SOA line match mode
soaLine.match_mode === 'partial'

// Option 3: Explicit option
matchOptions.allowPartial === true
```

### Use Cases for Pass 5

**Valid scenarios:**
- Vendor makes partial payment (SOA amount < invoice amount)
- Explicitly requested "aggressive matching" mode
- Group reconciliation where multiple SOA lines map to one invoice

**Invalid scenarios:**
- Default reconciliation (always starts with strict Pass 1)
- Cases where false positives are unacceptable
- Automated batch matching without human review

---

## Pass Semantics (Detailed)

### Pass 1: Strict Exact Match
```javascript
// All must match EXACTLY:
- invoice_number === doc_number (trimmed, uppercase)
- total_amount === amount (exact decimal match)
- currency === currency (exact match)
- invoice_date === date (exact match, if both present)
```

**When to use:** Default first attempt for all reconciliations.

### Pass 2: Date Tolerance Match
```javascript
// Strict doc equality, relaxed date:
- invoice_number === doc_number (trimmed, uppercase)
- total_amount === amount (exact decimal match)
- currency === currency (exact match)
- invoice_date within ±7 days of date
```

**When to use:** Handle date entry errors (e.g., "2025-01-15" vs "2025-01-22").

### Pass 3: Fuzzy Document Match
```javascript
// Normalized doc numbers, exact amount:
- normalize(invoice_number) === normalize(doc_number)
  // Removes: spaces, dashes, slashes, leading zeros
  // Example: "INV-001" matches "INV001", "001"
- total_amount === amount (exact decimal match)
- currency === currency (exact match)
```

**When to use:** Handle formatting inconsistencies (e.g., "INV-001" vs "INV001").

### Pass 4: Amount Tolerance Match
```javascript
// Strict doc equality, relaxed amount:
- invoice_number === doc_number (trimmed, uppercase)
- abs(total_amount - amount) <= 1.00 (RM 1.00 absolute)
  OR
- abs((total_amount - amount) / invoice.total_amount) <= 0.005 (0.5%)
- currency === currency (exact match)
```

**When to use:** Handle rounding errors, minor pricing adjustments.

### Pass 5: Partial/Group Match (Opt-In)
```javascript
// Relaxed constraints (opt-in only):
- invoice_number === doc_number (trimmed, uppercase)
- amount < total_amount (SOA amount is LESS than invoice)
- currency === currency (exact match)
```

**When to use:** Partial payments, split reconciliations, multi-line SOA items.

---

## Canonical Invoice Shape Contract

**All matching logic MUST use canonical field names:**

```javascript
{
  invoice_number: string,  // NOT invoice_num
  total_amount: decimal,   // NOT amount
  currency: string,        // NOT currency_code
  invoice_date: string,    // NOT date
  doc_number: string,      // Normalized for comparison
}
```

**Adapter Responsibility:**  
`src/adapters/supabase.js` → `getInvoices()` maps DB schema to canonical shape.

**Engine Rule:**  
Matching logic (`src/utils/soa-matching-engine.js`) MUST NOT reference DB-native column names.

---

## Testing Contract

### Unit Tests (Matching Engine)
**File:** `tests/utils/soa-matching-engine.test.js`

- **Pass 1 tests:** Verify strict exact matching (no tolerance)
- **Pass 2 tests:** Verify date tolerance (±7 days only)
- **Pass 3 tests:** Verify fuzzy doc normalization
- **Pass 4 tests:** Verify amount tolerance (absolute + percentage)
- **Pass 5 tests:** MUST set `allow_partial = true` explicitly
- **Negative tests:** MUST NOT enable Pass 5 (test default behavior)

### Component Tests (SOA Recon)
**File:** `tests/components/soa-recon.test.js`

- Use `createTestSOACase()` helper to ensure company_id/tenant_id set
- Use `DISCREPANCY_TYPES` enum for discrepancy inserts
- Always supply `description` for discrepancy records (NOT NULL)

---

## Regression Prevention

### CI Gate (Phase 1)
```yaml
soa_stability_gate:
  required_passing:
    - tests/utils/soa-matching-engine.test.js (17/17)
    - tests/components/soa-recon.test.js (8/8)
```

### Code Review Checklist
- [ ] Pass 5 not enabled by default
- [ ] Canonical field names used (not DB-native)
- [ ] Discrepancy inserts include `description` + valid `discrepancy_type`
- [ ] Test fixtures supply `company_id` + `tenant_id` where required

---

## Migration Alignment

**Matching engine contract MUST align with:**
- `migrations/031_vmp_soa_tables.sql` — SOA schema
- `migrations/032_vmp_debit_notes.sql` — Debit note schema

**Enum Contracts:**
- `vmp_soa_discrepancies.discrepancy_type` — see `DISCREPANCY_TYPES` in test helpers
- `vmp_soa_discrepancies.severity` — see `DISCREPANCY_SEVERITIES` in test helpers

---

## Known Issues & Debt

### Issue: Relaxed Invoice Constraints
**Context:** `vmp_invoices` NOT NULL constraints were relaxed to unblock tests.  
**Risk:** Can normalize invalid tenant states in production.  
**Mitigation:** Tracking ticket to restore constraints after test fixtures updated.  
**Timeline:** Fix within 2 sprints (before production load).

---

## Change Log

- **2025-12-24:** Initial contract definition after SOA stabilization milestone
  - Pass 5 opt-in gating implemented
  - Canonical mapping enforced
  - Test suite 100% green (engine + components)
