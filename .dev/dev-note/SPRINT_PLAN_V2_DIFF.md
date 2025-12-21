# Sprint Development Plan v2 - Change Summary

**Date:** 2025-12-21  
**Status:** 📋 Change Documentation  
**From:** v1 (Original Plan)  
**To:** v2 (Manual/Hybrid Mode)

---

## Executive Summary

The v2 plan introduces **Manual/Standalone Mode** pivot, prioritizes **Payment Visibility** over Profile, and pulls critical **Schema changes** forward to prevent technical debt. This enables VMP to operate without ERP integration via CSV ingest.

---

## Key Changes Overview

| Change Type | Description | Impact |
|-------------|-------------|--------|
| **Manual Mode Pivot** | Shadow Ledger (vmp_invoices, vmp_payments tables) | Enables standalone operation |
| **Priority Swap** | Payment (Sprint 4) vs Profile (Sprint 5) | Faster value capture |
| **Schema Forward** | Linked refs moved to Sprint 2 | Prevents technical debt |
| **CSV Ingest** | Manual data upload for invoices/payments | No ERP dependency |
| **Remittance Drop** | Bulk PDF upload with filename matching | Enhanced payment visibility |

---

## Detailed Changes by Sprint

### Sprint 1: Case Deep-Linking + Escalation Action

**Status:** ✅ **No Changes** - Sprint 1 remains identical

---

### Sprint 2: Invoice Transparency Facade

**v1 Approach:**
- Port/Adapter pattern (hexagonal architecture)
- Mock adapter for MVP
- No database tables for invoices

**v2 Approach:**
- **Shadow Ledger** - `vmp_invoices` table (source_system: 'erp' | 'manual')
- **CSV Ingest** - `/ops/ingest/invoices` route for manual upload
- **Direct DB Access** - `invoice_adapter.js` reads from `vmp_invoices` table
- **Linked Refs Forward** - `linked_invoice_id` added in Sprint 2 (not Sprint 8)

**New Tasks Added:**
- ✅ 2.1: Schema creation (`vmp_invoices`, `vmp_po_refs`, `vmp_grn_refs`)
- ✅ 2.2: CSV ingest route and logic
- ✅ Linked refs migration moved from Sprint 8 to Sprint 2

**Removed Tasks:**
- ❌ Port interface creation (deferred, direct DB access for MVP)
- ❌ Mock adapter (replaced with direct DB adapter)

**Files Added:**
```
migrations/014_vmp_shadow_ledger.sql
migrations/015_vmp_cases_linked_refs.sql
src/views/pages/ops_ingest.html
src/views/partials/invoice_ingest_form.html
src/adapters/invoice_adapter.js
```

**Files Removed:**
```
src/ports/invoice_read_port.js (deferred)
src/adapters/invoice_mock.js (replaced)
```

---

### Sprint 3: Supplier Onboarding Flow

**v1 Approach:**
- Conditional checklist engine (vendor type/country branching)
- Complex rule expressions

**v2 Approach:**
- **Simplified Checklist** - Standard steps first (Bank, Tax, Reg)
- **Note Added:** "Start with standard checklist; conditional logic can be added later"

**Changed Tasks:**
- ⚠️ 3.6: Simplified - removed conditional rules complexity
- ⚠️ 3.3: Added note about standard checklist first

**Impact:** Faster delivery, easier to implement, can enhance later

---

### Sprint 4: Payment Visibility (SWAPPED with Sprint 5)

**v1 Position:** Sprint 5  
**v2 Position:** Sprint 4 (moved up for faster value capture)

**v1 Approach:**
- Port/Adapter pattern
- Mock adapter for MVP
- No database tables for payments

**v2 Approach:**
- **Shadow Ledger** - `vmp_payments` table (source_system: 'erp' | 'manual')
- **CSV Ingest** - `/ops/ingest/payments` route
- **Remittance Drop** - `/ops/ingest/remittances` route (bulk PDF upload)
- **Filename Matching** - Match PDFs to payments by filename (e.g., `INV-123.pdf`)
- **Direct DB Access** - Reads from `vmp_payments` table

**New Tasks Added:**
- ✅ 4.1: Payment schema creation
- ✅ 4.2: Bulk payment CSV ingest
- ✅ 4.3: Remittance drop (bulk PDF upload with filename matching)
- ✅ 4.4: Supplier payment views (reads from `vmp_payments`)

**Removed Tasks:**
- ❌ Port interface creation (deferred)
- ❌ Mock adapter (replaced with direct DB access)

**Files Added:**
```
migrations/016_vmp_payments.sql
src/views/pages/payments.html
src/views/partials/payment_list.html
src/views/pages/payment_detail.html
src/views/partials/remittance_viewer.html
```

**Files Removed:**
```
src/ports/payment_read_port.js (deferred)
src/adapters/payment_mock.js (replaced)
```

---

### Sprint 5: Supplier Profile & Compliance (SWAPPED with Sprint 4)

**v1 Position:** Sprint 4  
**v2 Position:** Sprint 5 (moved down, lower priority)

**Status:** ✅ **No Changes** - Same tasks, different priority

---

### Sprint 6: Internal Ops Routes

**v1 Approach:**
- Case queue management
- Vendor directory
- Basic ops routes

**v2 Approach:**
- **Data Ingest History** - New task 6.4
- **Ingest Log Table** - `vmp_ingest_log` migration
- **Rollback Feature** - Undo last CSV upload (soft delete)

**New Tasks Added:**
- ✅ 6.4: Data ingest history and rollback functionality

**Files Added:**
```
migrations/017_vmp_ingest_log.sql
src/views/pages/ops_data_history.html
src/views/partials/data_ingest_history.html
```

**Adapter Methods Added:**
- `logIngest(type, filename, recordsCount, userId)`
- `rollbackIngest(ingestLogId)`

---

### Sprint 7: SLA Reminders + Decision Log

**Status:** ✅ **No Changes** - Sprint 7 remains identical

---

### Sprint 8: Domain Object Polish

**v1 Approach:**
- Linked refs, assigned_to, tags, attachments, metadata, contract type

**v2 Approach:**
- **Linked Refs Removed** - Moved to Sprint 2 (already done)
- **Attachments Removed** - Deferred (not critical for MVP)
- **Tags, Assigned To, Metadata, Contract Type** - Kept

**Removed Tasks:**
- ❌ 8.1: Add Linked Refs (moved to Sprint 2)
- ❌ 8.4: Add Attachments to Messages (deferred)

**Files Removed:**
```
migrations/017_vmp_cases_linked_refs.sql (moved to Sprint 2)
migrations/020_vmp_messages_attachments.sql (deferred)
```

---

## Development Principles Changes

### Added Principles

**v2 Adds:**
- **Shadow Ledger (Manual Mode):** VMP maintains its own `vmp_invoices` and `vmp_payments` tables to support clients without ERP integration (CSV Ingest).

### Removed Principles

**v1 Had:**
- Port/Adapter pattern emphasis (hexagonal architecture)

**v2 Approach:**
- Direct DB access for MVP (can add ports later if needed)

---

## Technical Checklist Changes

### v1 Checklist
1. Define Schema
2. Define Routes
3. Create View/Partial
4. Implement Logic
5. Connect
6. Test

### v2 Checklist
1. Define Schema
2. Define Routes
3. Create View/Partial
4. Implement Logic
5. Connect
6. **Verify:** Test Manual Ingest (CSV) -> Supplier View data flow

**Change:** Added CSV ingest verification step

---

## Migration Number Changes

| Migration | v1 Sprint | v2 Sprint | Change |
|-----------|-----------|-----------|--------|
| `014_vmp_cases_linked_refs.sql` | Sprint 8 | Sprint 2 | ⬆️ Moved forward |
| `014_vmp_shadow_ledger.sql` | N/A | Sprint 2 | ➕ New |
| `015_vmp_cases_linked_refs.sql` | N/A | Sprint 2 | ➕ New (renumbered) |
| `016_vmp_decision_log.sql` | Sprint 7 | Sprint 7 | ✅ Same |
| `016_vmp_payments.sql` | N/A | Sprint 4 | ➕ New |
| `017_vmp_ingest_log.sql` | N/A | Sprint 6 | ➕ New |
| `017_vmp_cases_linked_refs.sql` | Sprint 8 | N/A | ❌ Removed (moved to Sprint 2) |
| `018_vmp_cases_assigned_to.sql` | Sprint 8 | Sprint 8 | ✅ Same |
| `019_vmp_cases_tags.sql` | Sprint 8 | Sprint 8 | ✅ Same |
| `020_vmp_messages_attachments.sql` | Sprint 8 | N/A | ❌ Deferred |
| `021_vmp_messages_metadata.sql` | Sprint 8 | Sprint 8 | ✅ Same |
| `022_vmp_cases_contract_type.sql` | Sprint 8 | Sprint 8 | ✅ Same |

---

## Architecture Impact

### v1 Architecture
```
ERP System → Port Interface → Adapter → VMP
```

### v2 Architecture
```
CSV Upload → VMP Shadow Ledger (vmp_invoices, vmp_payments)
ERP System → (Future: Port Interface → Adapter → VMP)
```

**Benefits:**
- ✅ No ERP dependency for MVP
- ✅ Faster time-to-value
- ✅ Can add ERP integration later without breaking changes
- ✅ Supports hybrid mode (manual + ERP)

---

## Acceptance Criteria Changes

### Sprint 2 (Invoice Facade)

**v1 Criteria:**
- Port/adapter pattern followed (hexagonal boundary)

**v2 Criteria:**
- Shadow ledger tables created
- CSV ingest works
- Direct DB access (no port pattern required for MVP)

### Sprint 4 (Payment Visibility)

**v1 Criteria:**
- Port/adapter pattern followed

**v2 Criteria:**
- Payment table created
- CSV ingest works
- Remittance drop works
- Direct DB access (no port pattern required for MVP)

---

## Summary of File Changes

### Files Added (v2)
```
migrations/014_vmp_shadow_ledger.sql
migrations/015_vmp_cases_linked_refs.sql
migrations/016_vmp_payments.sql
migrations/017_vmp_ingest_log.sql
src/views/pages/ops_ingest.html
src/views/partials/invoice_ingest_form.html
src/adapters/invoice_adapter.js
src/views/pages/payments.html
src/views/partials/payment_list.html
src/views/pages/payment_detail.html
src/views/partials/remittance_viewer.html
src/views/pages/ops_data_history.html
src/views/partials/data_ingest_history.html
```

### Files Removed/Deferred (v2)
```
src/ports/invoice_read_port.js (deferred)
src/adapters/invoice_mock.js (replaced)
src/ports/payment_read_port.js (deferred)
src/adapters/payment_mock.js (replaced)
migrations/020_vmp_messages_attachments.sql (deferred)
```

### Files Moved (v2)
```
migrations/017_vmp_cases_linked_refs.sql → migrations/015_vmp_cases_linked_refs.sql (Sprint 2)
```

---

## Risk Assessment

### Risks Mitigated
- ✅ **ERP Dependency Risk:** Eliminated via Shadow Ledger
- ✅ **Technical Debt Risk:** Linked refs moved forward to Sprint 2
- ✅ **Value Delivery Risk:** Payment visibility prioritized (adoption carrot)

### New Risks Introduced
- ⚠️ **Data Sync Risk:** Manual CSV vs ERP data (mitigated by source_system field)
- ⚠️ **CSV Format Risk:** Need to support multiple CSV formats (mitigated by validation)

---

## Migration Path

### From v1 to v2

1. **If Sprint 1 Complete:** Continue with Sprint 2 v2 (Shadow Ledger)
2. **If Sprint 2 Started:** Add Shadow Ledger tasks, remove port/interface tasks
3. **If Sprint 4 Started:** Swap with Sprint 5 (move Payment up, Profile down)

### Backward Compatibility

- ✅ All existing routes remain unchanged
- ✅ Database schema additions are additive (no breaking changes)
- ✅ Existing adapters continue to work

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-12-21  
**Version:** v2.0

