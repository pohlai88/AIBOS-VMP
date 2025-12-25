Perfect — what you pasted is already **very strong**. What it needs now is **consolidation + hardening**, so it reads as **one authoritative SOA chapter**, not two parallel explanations.

Below is a **cleanly combined, senior-grade SOA Reconciliation & UI/Domain Blueprint**, ready to drop into
`__INTEGRATION_WIREFRAME_PLAN_V2.md`.

I’ve done four things:

1. **Merged** your text with the earlier SOA blueprint (no duplication)
2. **Normalized terminology** (Truth Surface, Case, Posture, Shadow Ledger)
3. **Tightened the AHA logic → DB → UI loop**
4. **Made DN (Debit Note) a first-class outcome**, not an afterthought

---

# SOA RECONCILIATION & STATEMENT CONTROL

### NexusCanon VMP — Financial Control OS Layer

This **Statement of Account (SOA) Reconciliation Blueprint** elevates NexusCanon VMP from a *communication hub* into a **Financial Control OS**.

SOA is no longer a document.
It is a **Truth Surface** that continuously reconciles **supplier claims vs buyer ledger** under governed rules.

> **Design Constitution Alignment**
>
> * Everything is a **Case**
> * Every variance creates **Actionable Truth**
> * No settlement without **reconcilable evidence**

---

## 1. SOA Truth Surface Architecture

### SOA as a Case

* Every SOA upload **automatically creates a Case**
* Case type: `soa`
* Parent case = SOA Period
* Child cases = Variances / Exceptions

```
SOA Case
 ├── Line 001 → MATCHED
 ├── Line 002 → STATEMENT_ONLY → Sub-Case
 ├── Line 003 → AMOUNT_VARIANCE → Sub-Case
```

This ensures:

* Full audit lineage
* Vendor-visible accountability
* Zero off-channel reconciliation

---

## 2. Autonomous Matching Engine (AHA Logic)

Matching is deterministic first, heuristic last.

### Matching Passes

1. **Exact Match**
   `vendor + doc_no + currency + amount`

2. **Date Tolerance Match**
   Same as above, with **±7 days**

3. **Fuzzy Doc Match**
   Normalizes `doc_no` (strip spaces, dashes, punctuation)

4. **Amount Tolerance Match**

   * Absolute tolerance (e.g. RM 1.00)
   * Percentage tolerance (e.g. 0.5%)

5. **Group / Partial Match**

   * One invoice ↔ multiple payments
   * Partial settlement with residual balance

> Any match below Pass 1 is **explicitly marked** as `TOLERANCE` or `PARTIAL` — never silently “green”.

---

## 3. Reconciliation States (Canonical)

### Line-Level Status

* `MATCHED_EXACT`
* `MATCHED_TOLERANCE`
* `PARTIAL_MATCH`
* `STATEMENT_ONLY`
* `LEDGER_ONLY`
* `DISPUTED`
* `RESOLVED`
* `WRITE_OFF_PROPOSED`
* `WRITE_OFF_APPROVED`

### SOA-Level Posture

* `CLEAN`
* `MINOR_VARIANCE`
* `ACTION_REQUIRED`
* `ON_HOLD`
* `CLOSED`

These map directly to your **posture rail** and **case filters**.

---

## 4. Database Schema (Shadow Ledger)

This schema **does not replace AP** — it overlays it.

```sql
-- SOA Header (Parent Case)
CREATE TABLE vmp_soa_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES vmp_tenants(id),
  vendor_id uuid REFERENCES vmp_vendors(id),
  period_start date,
  period_end date,
  opening_balance decimal(15,2),
  closing_balance decimal(15,2),
  net_variance decimal(15,2),
  status varchar DEFAULT 'ACTION_REQUIRED',
  source_file_id uuid,
  imported_at timestamp DEFAULT now()
);

-- SOA Lines (Truth Claims)
CREATE TABLE vmp_soa_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid REFERENCES vmp_soa_statements(id),
  line_no int,
  doc_type varchar, -- INV, CN, DN, PAY, WHT, ADJ
  doc_no varchar,
  doc_date date,
  amount decimal(15,2),
  match_status varchar DEFAULT 'UNMATCHED',
  confidence int,
  ledger_link_id uuid
);

-- Match Mapping
CREATE TABLE vmp_soa_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soa_line_id uuid REFERENCES vmp_soa_lines(id),
  ledger_line_id uuid,
  matched_amount decimal(15,2),
  match_type varchar, -- EXACT, TOLERANCE, PARTIAL
  created_at timestamp DEFAULT now()
);

-- Variance / Issue Tracker
CREATE TABLE vmp_soa_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid,
  soa_line_id uuid,
  issue_type varchar, -- STATEMENT_ONLY, LEDGER_ONLY, AMOUNT, DATE, WHT
  severity varchar, -- LOW, MED, HIGH
  amount_delta decimal(15,2),
  status varchar DEFAULT 'OPEN',
  linked_case_id uuid
);
```

---

## 5. UI: Recon Workspace (3-Column Canon)

### Left — **SOA Lines**

* Scrollable list
* Status icons (exact / tolerance / disputed)
* Quick filters: unmatched, disputed, resolved

### Center — **Evidence Matcher**

* Suggested ledger matches (ranked)
* Drag-to-link / partial allocation
* Evidence upload
* Comment thread (case-bound)

### Right — **Live Variance HUD**

* Opening balance
* Matched total
* Statement-only total
* Ledger-only total
* Net variance (real-time)
* Sign-off readiness indicator

---

## 6. Dashboard / Posture Rail Integration

SOA becomes a **first-class posture**, not a side card.

```html
<a href="/case-dashboard?posture=soa" class="hud-card relative rounded-xl p-5">
  <div class="text-[10px] uppercase tracking-widest text-white/40 mb-3">
    Statements
  </div>
  <div class="text-4xl font-light tracking-tighter text-white mb-1">
    {{ soaCount or 0 }}
  </div>
  <div class="text-xs {% if net_variance != 0 %}text-[var(--neon-red)]{% else %}text-white/30{% endif %}">
    NET VARIANCE: {{ net_variance }}
  </div>
</a>
```

---

## 7. Debit Note (DN) as a Native Outcome

DN is **not manual accounting** — it is a reconciliation resolution.

### DN Trigger Scenarios

* Overpayment confirmed
* Supplier missing CN
* Pricing variance accepted
* WHT mismatch acknowledged

### DN Workflow

1. Variance resolved → `LEDGER_ONLY`
2. System proposes DN
3. Finance approves
4. DN generated + linked to SOA case
5. SOA posture updates automatically

This closes the loop:
**SOA → Variance → DN → Clean Ledger**

---

## 8. End-to-End Flow (Authoritative)

1. Supplier uploads SOA
2. SOA Case auto-created
3. Autonomous matching runs
4. Unmatched lines → sub-cases
5. Evidence requested automatically
6. Variance reduced to tolerance
7. DN / CN generated if required
8. Dual digital sign-off
9. Period locked → `CLOSED`

---

## Why This Is Strong

* SOA becomes a **governance surface**, not a spreadsheet
* Vendors work *inside your truth*
* Finance never reconciles off-system
* Audit trail is automatic
* DN/CN becomes **controlled output**, not ad-hoc accounting

---

### Next (recommended)

I can now:

1. Generate `soa-recon.html` (HTMX-ready)
2. Generate **DN creation UI + posting logic**
3. Produce the **API contract** (`/soa/match`, `/soa/resolve`, `/soa/signoff`)

Say **which one first**, and I’ll go surgical.
