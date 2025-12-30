# SSOT Guardrail Matrix (Master)

> **Foundation:** This operational matrix derives from and enforces the principles defined in **[NEXUS_CANON_V5_KERNEL_DOCTRINE.md](./NEXUS_CANON_V5_KERNEL_DOCTRINE.md)** (the Kernel Doctrine). All database schema, JSONB contracts, and RLS policies must comply with both this matrix and the foundational kernel doctrine.

## Document Status & Authority

**Authority Level:** NORMATIVE  
**SSOT:** Yes  
**Enforcement:** Enforced by CI (`check:drift`)  
**Applies To:** All database tables, JSONB contracts, RLS policies  
**Owner:** Architecture Team  
**Effective From:** 2025-01-22  
**Version:** 1.1.0

**Definitions:**
- **NORMATIVE:** Defines requirements. If this changes, enforcement MUST change.
- **INFORMATIVE:** Explains or guides. MUST NOT introduce new rules.
- **EVIDENCE:** Generated proof / reports. MUST be reproducible.

**Precedence (Conflict Resolution):**
1. **NORMATIVE SSOT** (this document - highest authority)
2. Enforcement code (must follow SSOT)
3. INFORMATIVE guides
4. EVIDENCE reports (derived output)

**Change Control:**
- Changes to NORMATIVE sections require:
  1) Version bump
  2) Update to enforcement or explicit "Declared" status
  3) Entry in Promotion / Decision log (if data semantics affected)

---

**Last Updated:** 2025-01-22  
**Status:** ✅ Active (L1 Documented - DRIFT checks pending implementation)  
**Purpose:** Single Source of Truth operational matrix for database schema guardrails - anti-drift enforcement  
**Aligned To:** [PRD_DB_SCHEMA.md](../../development/prds/PRD_DB_SCHEMA.md)

**⚠️ Critical Rule:** ✅ (passes `check:drift`) requires DRIFT-01/02/03 passing on live DB OR on a DB snapshot generated in CI. "It passed locally" is not acceptable. No table can be marked ✅ unless DRIFT checks are actually enforced in CI.

**⚠️ Claim Control (No False Compliance):**
- "✅ compliant" may only be used when enforcement exists at the stated level.
- "⚠️ Declared" means documented only; **external claims MUST NOT treat it as enforced.**

---

## SSOT Compilation Contract (Machine-Enforceable)

This SSOT is considered valid **only if**:
1. It is version-controlled (Git)
2. It is parseable by the SSOT compiler (`matrix-parser.mjs`)
3. It produces deterministic machine reports (`check-drift.mjs`)
4. CI gates reference those reports

**SSOT Format Guarantees:**
- Each table row MUST include:
  - `table`
  - `tenant_scope` (direct `tenant_id`, `derived:<path>`, or `global`)
  - `rls_required` (yes/no)
  - `jsonb_columns` (if any)
  - `owner`
  - `status` (✅ compliant / ⚠️ declared / ❌ non-compliant)
- Any JSONB column MUST have a registered contract:
  - `contract_type`
  - `canonical_contract_id`
  - `validator_ref`
  - version range (`min_version`..`max_version`)

---

## SSOT Definition (Machine-Enforceable)

**A structure is considered SSOT only if it is:**

1. **Version-controlled** - Stored in version control (Git) with full history
2. **Validated in CI** - Automatically checked in continuous integration pipelines
3. **Queried by automation** - Validated by machine-readable scripts, not human interpretation

**This prevents future drift where someone claims a Google Doc, README, or wiki page is "SSOT".**

**Enforcement:**
- All SSOT artifacts must be in `docs/ssot/` directory
- All SSOT artifacts must be validated by `scripts/check-drift.mjs` or equivalent automation
- All SSOT artifacts must produce machine-readable reports (JSON) for CI/CD integration

---

## 📋 Table of Contents

1. [A) Table Guardrail Matrix](#a-table-guardrail-matrix-per-table)
2. [B) JSONB Contract Registry Matrix](#b-jsonb-contract-registry-matrix)
3. [C) Promotion Matrix](#c-promotion-matrix-phase-abc-enforcement)
4. [D) RLS Coverage Matrix](#d-rls-coverage-matrix-100-tenant-safety)
5. [E) Drift Checks Matrix](#e-drift-checks-matrix-ci-gatekeeper)
6. [Maintenance](#maintenance)

---

## A) Table Guardrail Matrix (per table)

**Legend:**
- **Core Columns** = immutable (no drop/rename; deprecate only)
- **Tenant Scope** = `tenant_id` or derived + documented RLS pattern
- **JSONB Contracts** must be registered + validated in CI
- **Compliance Level:** `L0 Draft | L1 Documented | L2 Enforced | L3 Enforced+Tested`
- **Drift Status:** ✅ passes `check:drift` (L2+ - requires DRIFT-01/02/03 on live DB or CI snapshot) | ⚠️ Declared (L1) | ❌ blocks merge

| Table | Purpose | Semantic Role | Tenant Scope | Derived Scope Proof | Core Columns (immutable) | JSONB Columns | JSONB Contract Types (registered) | RLS Policy ID | Index Requirements | Index Justification Link | Promotion Candidates | Adapter Owner | Validator Owner | Test Coverage | Compliance Level | Drift Status |
|-------|---------|---------------|--------------|--------------------------|---------------|-----------------------------------|---------------|-------------------|---------------------|---------------|---------------|--------------|
| `nexus_tenants` | Master tenant table with explicit sub-IDs | *Configuration* | `tenant_id` | N/A (direct) | `id (pk)`, `tenant_id`, `tenant_client_id`, `tenant_vendor_id`, `created_at`, `updated_at` | `settings`, `metadata` | `tenant_settings`, `tenant_metadata` | `rls:tenant_isolation` | PK + all IDs indexed | [PROMO-002](./PROMOTION_LOG.md#promo-002) | `settings.feature_flags`, `metadata.plan_config` | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_tenant_relationships` | Binary client-vendor relationships | *Ledger* | `derived:client_id/vendor_id` | [RLS_COVERAGE.md#2](./RLS_COVERAGE.md#2-nexus_tenant_relationships) | `id (pk)`, `client_id`, `vendor_id`, `created_at`, `updated_at` | `metadata` | `relationship_metadata` | `rls:relationship_isolation` | PK + client_id + vendor_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_relationship_invites` | Pending relationship invitations | *Event Log* | `derived:inviting_tenant_id` | [RLS_COVERAGE.md#19](./RLS_COVERAGE.md#19-nexus_relationship_invites) | `id (pk)`, `token`, `inviting_tenant_id`, `created_at` | None | None | `rls:invite_isolation` | PK + token + email indexed | None | None | `src/adapters/nexus-adapter.js` | N/A | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_users` | Users belonging to tenants | *Ledger* | `tenant_id` | N/A (direct) | `id (pk)`, `user_id`, `tenant_id`, `email`, `created_at`, `updated_at` | `preferences` | `user_preferences` | `rls:user_isolation` | PK + user_id + tenant_id + email indexed | [PROMO-003](./PROMOTION_LOG.md#promo-003) | `preferences.ui.theme`, `preferences.notifications` | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_sessions` | User session management | *Event Log* | `tenant_id` | N/A (direct) | `id (pk)`, `user_id`, `tenant_id`, `expires_at`, `created_at` | `data` | `session_data` | `rls:session_isolation` | PK + user_id + tenant_id + expires_at indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_cases` | Case management (vendor interactions) | *Ledger* | `derived:client_id/vendor_id` | [RLS_COVERAGE.md#4](./RLS_COVERAGE.md#4-nexus_cases) | `id (pk)`, `case_id`, `client_id`, `vendor_id`, `status`, `priority`, `created_at`, `updated_at` | `metadata` | `case_metadata` | `rls:case_isolation` | PK + case_id + client_id + vendor_id + status + priority indexed | None | `metadata.priority` (already promoted), `metadata.escalation_level` | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_case_messages` | Case communication thread | *Event Log* | `derived:case_id→client_id/vendor_id` | [RLS_COVERAGE.md#5](./RLS_COVERAGE.md#5-nexus_case_messages) (EXISTS policy) | `id (pk)`, `message_id`, `case_id`, `sender_user_id`, `created_at` | `metadata` | `message_metadata` | `rls:message_isolation` | PK + case_id + sender_user_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_case_evidence` | Case evidence files | *Projection* | `derived:case_id→client_id/vendor_id` | [RLS_COVERAGE.md#6](./RLS_COVERAGE.md#6-nexus_case_evidence) (EXISTS policy) | `id (pk)`, `evidence_id`, `case_id`, `uploader_user_id`, `created_at` | `metadata` | `evidence_metadata` | `rls:evidence_isolation` | PK + case_id + uploader_user_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_case_checklist` | Case checklist items | *Projection* | `derived:case_id→client_id/vendor_id` | [RLS_COVERAGE.md#7](./RLS_COVERAGE.md#7-nexus_case_checklist) (EXISTS policy) | `id (pk)`, `item_id`, `case_id`, `created_at`, `updated_at` | `metadata` | `checklist_metadata` | `rls:checklist_isolation` | PK + case_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_case_activity` | Case activity log | *Event Log* | `derived:case_id→client_id/vendor_id` | [RLS_COVERAGE.md#8](./RLS_COVERAGE.md#8-nexus_case_activity) (EXISTS policy) | `id (pk)`, `activity_id`, `case_id`, `created_at` | `metadata` | `activity_metadata` | `rls:activity_isolation` | PK + case_id + activity_type indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_invoices` | Invoice shadow ledger | *Ledger* | `derived:client_id/vendor_id` | [RLS_COVERAGE.md#9](./RLS_COVERAGE.md#9-nexus_invoices) | `id (pk)`, `invoice_id`, `vendor_id`, `client_id`, `status`, `created_at`, `updated_at` | `line_items`, `metadata` | `invoice_line_items`, `invoice_metadata` | `rls:invoice_isolation` | PK + invoice_id + vendor_id + client_id + status indexed | None | `line_items.items[].amount` (if frequently aggregated) | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_payments` | Payment records | *Ledger* | `derived:from_id/to_id` | [RLS_COVERAGE.md#10](./RLS_COVERAGE.md#10-nexus_payments) | `id (pk)`, `payment_id`, `from_id`, `to_id`, `status`, `created_at`, `updated_at` | `metadata` | `payment_metadata` | `rls:payment_isolation` | PK + payment_id + from_id + to_id + status indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_payment_schedule` | Recurring payment schedules | *Configuration* | `derived:from_id/to_id` | [RLS_COVERAGE.md#11](./RLS_COVERAGE.md#11-nexus_payment_schedule) | `id (pk)`, `schedule_id`, `from_id`, `to_id`, `status`, `created_at`, `updated_at` | `metadata` | `schedule_metadata` | `rls:schedule_isolation` | PK + from_id + to_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_payment_activity` | Payment activity log | *Event Log* | `derived:payment_id→from_id/to_id` | [RLS_COVERAGE.md#12](./RLS_COVERAGE.md#12-nexus_payment_activity) (EXISTS policy) | `id (pk)`, `activity_id`, `payment_id`, `created_at` | `metadata` | `activity_metadata` | `rls:pay_activity_isolation` | PK + payment_id + activity_type indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_notifications` | User notifications | *Event Log* | `tenant_id` | N/A (direct) | `id (pk)`, `notification_id`, `user_id`, `tenant_id`, `created_at` | `delivery_attempts`, `metadata` | `notification_delivery_attempts`, `notification_metadata` | `rls:notification_isolation` | PK + user_id + tenant_id + notification_type indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_notification_config` | Tenant notification configuration | *Configuration* | `tenant_id` (PK) | N/A (direct) | `tenant_id (pk)` | `metadata` | `notification_config_metadata` | `rls:notif_config_isolation` | PK only | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_user_notification_prefs` | User notification preferences | *Configuration* | `tenant_id` | N/A (direct) | `user_id (pk)`, `tenant_id` | `metadata` | `user_notif_prefs_metadata` | `rls:user_prefs_isolation` | PK + tenant_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_notification_queue` | Notification delivery queue | *Event Log* | `tenant_id` | N/A (direct) | `id (pk)`, `user_id`, `tenant_id`, `created_at` | None | None | `rls:queue_isolation` | PK + scheduled_for + status indexed | None | None | `src/adapters/nexus-adapter.js` | N/A | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_push_subscriptions` | Push notification subscriptions | *Configuration* | `tenant_id` | N/A (direct) | `id (pk)`, `user_id`, `tenant_id`, `created_at` | None | None | `rls:push_sub_isolation` | PK + user_id + endpoint indexed | None | None | `src/adapters/nexus-adapter.js` | N/A | unit+int | L1 Documented | ⚠️ Declared |
| `nexus_audit_log` | System audit log | *Event Log* | `derived:actor_tenant_id` | [RLS_COVERAGE.md#18](./RLS_COVERAGE.md#18-nexus_audit_log) | `id (pk)`, `table_name`, `record_id`, `action`, `created_at` | `old_data`, `new_data` | `audit_old_data`, `audit_new_data` | `rls:audit_isolation` | PK + table_name + record_id + actor_user_id indexed | None | None | `src/adapters/nexus-adapter.js` | `src/schemas/metadata.schema.js` | unit+int | L1 Documented | ⚠️ Declared |

### Column Definitions

**Semantic Role:**
- **Ledger** = Transactional data representing business events (cases, invoices, payments, relationships)
- **Event Log** = Append-only audit trail or activity log (audit_log, case_activity, notifications)
- **Configuration** = Settings, preferences, or system configuration (tenants, users, notification_config)
- **Projection** = Derived or computed data (evidence, checklist items)

**Purpose:** Prevents misuse (e.g., querying audit log as transactional data), helps AI agents understand intent, future data-warehouse modeling clarity.

**Tenant Scope Rules:**
- `tenant_id` = Direct tenant_id column (default pattern)
- `derived:client_id/vendor_id` = Tenant derived from client_id or vendor_id via FK chain (must have documented RLS pattern)
- `derived:case_id→client_id/vendor_id` = Tenant derived from case_id → client_id/vendor_id (nested FK chain)

**Core Columns (Immutable):**
- Must include: `id (pk)`, tenant scoping column(s), foreign keys, audit fields (`created_at`, `updated_at`)
- Cannot be removed/renamed without deprecation (minimum 6-month grace period)

**JSONB Contract Types:**
- Every JSONB column must have a registered contract type
- Contract types must exist in [JSONB Contract Registry](#b-jsonb-contract-registry-matrix)

**Index Requirements:**
- Always: PK + all FKs indexed
- JSONB: No blanket GIN; prefer expression indexes on stable keys or promote to columns

**Promotion Candidates:**
- Only list keys that meet promotion criteria:
  - Frequently queried (> 10% of queries)
  - Stable structure (consistent across records)
  - Reporting/analytics requirements
  - Database-level validation needed

**Compliance Level Definitions:**
- **L0 Draft** = Table exists but not documented in matrix
- **L1 Documented** = Matrix filled but CI not enforcing (current state)
- **L2 Enforced** = DRIFT-01/02/03 running in CI
- **L3 Enforced+Tested** = Enforced + integration tests for RLS + contract validation

**Derived Scope Proof:**
- If `Tenant Scope` starts with `derived:`, RLS policy must use EXISTS against parent table
- Proof link must point to RLS_COVERAGE.md section showing EXISTS pattern
- FK chain must be documented

**Index Justification Link:**
- Required for any JSONB GIN index
- Must include: query example + measured benefit (even rough)
- Links to promotion log entry or ADR

**Adapter Owner:**
- Must be module path (ex: `src/adapters/nexus-adapter.js`)
- Evolvable when splitting Canons/Molecules

**Validator Owner:**
- Schema owner (ex: `src/schemas/metadata.schema.js`)
- Must exist and be version-controlled

---

## Core Column Deprecation Workflow

**Requirement:** Core columns cannot be removed/renamed without deprecation (minimum 6-month grace period).

**Deprecation Fields (add to table when deprecating):**
- `deprecated_at` - Timestamp when deprecation started
- `deprecation_ticket` - Issue/ticket tracking deprecation
- `replacement_field` - New field name (if renaming) or migration path
- `sunset_at` - Date when field will be removed (minimum 6 months from `deprecated_at`)

**Workflow:**
1. Add deprecation fields to table
2. Update adapter to handle both old and new fields
3. Migrate data to new field (if renaming)
4. Update all consumers (minimum 6-month grace period)
5. Remove deprecated field after `sunset_at`

**Example:**
```sql
-- Deprecating a column
ALTER TABLE nexus_cases
  ADD COLUMN deprecated_field_deprecated_at TIMESTAMPTZ,
  ADD COLUMN deprecated_field_deprecation_ticket TEXT,
  ADD COLUMN deprecated_field_replacement_field TEXT,
  ADD COLUMN deprecated_field_sunset_at DATE;

-- Mark as deprecated
UPDATE nexus_cases
SET 
  deprecated_field_deprecated_at = now(),
  deprecated_field_deprecation_ticket = 'TICKET-123',
  deprecated_field_replacement_field = 'new_field_name',
  deprecated_field_sunset_at = (now() + INTERVAL '6 months')::DATE
WHERE deprecated_field IS NOT NULL;
```

---

## B) JSONB Contract Registry Matrix

**Purpose:** The "no swamp" firewall. Makes `_schema_version` real and enforceable.

**Mandatory Contract Headers (must exist in all JSONB):**
- `_schema_version` - Schema version number
- `_context` - Audit context (created_by, created_at, updated_by, updated_at, reason, source)
- `type` - Contract type identifier

| Contract Type (`type`) | Canonical Contract ID | Used In (tables.columns) | Min Ver | Max Ver | Validator Ref (Zod) | Required Keys | Allowed Keys | CHECK Constraint? | Index Keys Allowed | Migration Notes | Owner | Status |
|------------------------|---------------------------|---------|---------|---------------------|---------------|--------------|-------------------|-------------------|-----------------|-------|--------|
| `tenant_settings` | `CONTRACT-TENANT-SETTINGS-V1` | `nexus_tenants.settings` | 1 | 1 | `TenantSettingsSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `feature_flags`, `ui_preferences`, `plan_config` | Yes | `feature_flags` (GIN on path) | - | architecture-team | ✅ |
| `tenant_metadata` | `CONTRACT-TENANT-METADATA-V1` | `nexus_tenants.metadata` | 1 | 1 | `TenantMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_fields`, `integration_data` | Yes | None | - | architecture-team | ✅ |
| `user_preferences` | `CONTRACT-USER-PREFS-V1` | `nexus_users.preferences` | 1 | 1 | `UserPreferencesSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `ui`, `notifications`, `limits` | Yes | None | - | architecture-team | ✅ |
| `case_metadata` | `CONTRACT-CASE-METADATA-V2` | `nexus_cases.metadata` | 1 | 2 | `CaseMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `priority` (v1), `escalation_level` (v2), `custom_fields` | Yes | `priority` (expression index) | v1→v2: Added escalation_level | architecture-team | ✅ |
| `message_metadata` | `CONTRACT-MESSAGE-METADATA-V1` | `nexus_case_messages.metadata` | 1 | 1 | `MessageMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `channel`, `whatsapp`, `email`, `thread_id` | Yes | None | - | architecture-team | ✅ |
| `evidence_metadata` | `CONTRACT-EVIDENCE-METADATA-V1` | `nexus_case_evidence.metadata` | 1 | 1 | `EvidenceMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `verification_status`, `ocr_data`, `tags` | Yes | None | - | architecture-team | ✅ |
| `checklist_metadata` | `CONTRACT-CHECKLIST-METADATA-V1` | `nexus_case_checklist.metadata` | 1 | 1 | `ChecklistMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_fields`, `notes` | Yes | None | - | architecture-team | ✅ |
| `activity_metadata` | `CONTRACT-ACTIVITY-METADATA-V1` | `nexus_case_activity.metadata` | 1 | 1 | `ActivityMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `system_data`, `ui_state` | Yes | None | - | architecture-team | ✅ |
| `invoice_line_items` | `CONTRACT-INVOICE-LINE-ITEMS-V1` | `nexus_invoices.line_items` | 1 | 1 | `InvoiceLineItemsSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type`, `items` | `items` (array of line item objects) | Yes | None | Structure: `{_schema_version, _context, type, items: [...]}` | architecture-team | ✅ |
| `invoice_metadata` | `CONTRACT-INVOICE-METADATA-V1` | `nexus_invoices.metadata` | 1 | 1 | `InvoiceMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_fields`, `integration_data` | Yes | None | - | architecture-team | ✅ |
| `payment_metadata` | `CONTRACT-PAYMENT-METADATA-V1` | `nexus_payments.metadata` | 1 | 1 | `PaymentMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `bank_details`, `reconciliation_data` | Yes | None | - | architecture-team | ✅ |
| `schedule_metadata` | `CONTRACT-SCHEDULE-METADATA-V1` | `nexus_payment_schedule.metadata` | 1 | 1 | `ScheduleMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_fields` | Yes | None | - | architecture-team | ✅ |
| `notification_delivery_attempts` | `CONTRACT-NOTIF-DELIVERY-V1` | `nexus_notifications.delivery_attempts` | 1 | 1 | `DeliveryAttemptsSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type`, `attempts` | `attempts` (array of attempt objects) | Yes | None | Structure: `{_schema_version, _context, type, attempts: [...]}` | architecture-team | ✅ |
| `notification_metadata` | `CONTRACT-NOTIF-METADATA-V1` | `nexus_notifications.metadata` | 1 | 1 | `NotificationMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_fields`, `ui_state` | Yes | None | - | architecture-team | ✅ |
| `notification_config_metadata` | `CONTRACT-NOTIF-CONFIG-V1` | `nexus_notification_config.metadata` | 1 | 1 | `NotificationConfigMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_settings` | Yes | None | - | architecture-team | ✅ |
| `user_notif_prefs_metadata` | `CONTRACT-USER-NOTIF-PREFS-V1` | `nexus_user_notification_prefs.metadata` | 1 | 1 | `UserNotifPrefsMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `custom_preferences` | Yes | None | - | architecture-team | ✅ |
| `session_data` | `CONTRACT-SESSION-DATA-V1` | `nexus_sessions.data` | 1 | 1 | `SessionDataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `session_state`, `ui_state` | Yes | None | - | architecture-team | ✅ |
| `relationship_metadata` | `CONTRACT-RELATIONSHIP-METADATA-V1` | `nexus_tenant_relationships.metadata` | 1 | 1 | `RelationshipMetadataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | `contract_terms`, `custom_fields` | Yes | None | - | architecture-team | ✅ |
| `audit_old_data` | `CONTRACT-AUDIT-OLD-V1` | `nexus_audit_log.old_data` | 1 | 1 | `AuditDataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | Any (flexible) | No | None | - | architecture-team | ✅ |
| `audit_new_data` | `CONTRACT-AUDIT-NEW-V1` | `nexus_audit_log.new_data` | 1 | 1 | `AuditDataSchema@src/schemas/metadata.schema.js` | `_schema_version`, `_context`, `type` | Any (flexible) | No | None | - | architecture-team | ✅ |

**Enforcement:**
- ✅ ✅ All JSONB columns must have registered contract type
- ✅ ✅ Registry is validated in CI/CD (coverage check)
- ✅ ✅ Missing registry entries block deployment
- ✅ ✅ Contract updates require PR review

**`_schema_version` Directionality Rule:**
- `_schema_version` MUST be monotonic per contract type (versions only increase, never decrease)
- Lower versions may be read (for backward compatibility) but MUST NOT be written after upgrade
- This prevents rollback corruption and ensures data integrity during schema evolution

**See:** [JSONB_CONTRACT_REGISTRY.md](./JSONB_CONTRACT_REGISTRY.md) for detailed contract definitions

---

## C) Promotion Matrix (Phase A/B/C enforcement)

**Hard Rule:** Promotions must follow Phase A/B/C (not optional).

| Promotion ID | Table | JSONB Source | New Column(s) | Phase A (Backfill) | Phase B (Dual-write) | Phase C (Cutover) | Verification Window | Rollback Ready | Owner | Status |
|--------------|-------|--------------|---------------|-------------------|---------------------|-------------------|---------------------|----------------|-------|--------|
| PROMO-001 | `nexus_cases` | `metadata->>'priority'` | `priority TEXT` | ✅ Done | ✅ Done | ✅ Done | 30 days (completed) | ✅ Yes | architecture-team | ✅ Done |
| PROMO-002 | `nexus_tenants` | `settings->'feature_flags'` | `feature_flags JSONB` (promote to GIN index) | ⚠️ Planned | - | - | - | ⚠️ Pending | architecture-team | ⚠️ Planned |
| PROMO-003 | `nexus_users` | `preferences->'ui'->>'theme'` | `ui_theme TEXT` | ⚠️ Planned | - | - | - | ⚠️ Pending | architecture-team | ⚠️ Planned |

**Promotion Status:**
- ✅ Done = Completed and verified
- ⚠️ Planned = Scheduled for implementation
- 🔄 In Progress = Currently in Phase A/B/C
- ❌ Blocked = Blocked by dependency or issue

**See:** [PROMOTION_LOG.md](./PROMOTION_LOG.md) for detailed promotion history

---

## D) RLS Coverage Matrix (100% tenant safety)

**Requirement:** 100% RLS coverage for all tenant-scoped tables.

| Table | Tenant Scope | RLS Enabled | Policies (IDs) | Roles Covered | Tested (integration) | Notes | Status |
|-------|--------------|-------------|----------------|---------------|---------------------|-------|--------|
| `nexus_tenants` | `tenant_id` | ✅ Yes | `rls:tenant_isolation`, `rls:tenant_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_tenant_relationships` | `derived:client_id/vendor_id` | ✅ Yes | `rls:relationship_isolation`, `rls:relationship_create`, `rls:relationship_service_bypass` | authenticated, service_role | ✅ Yes | Derived via client_id/vendor_id | ✅ Compliant |
| `nexus_relationship_invites` | `derived:inviting_tenant_id` | ✅ Yes | `rls:invite_isolation`, `rls:invite_service_bypass` | authenticated, service_role | ✅ Yes | Derived via inviting_tenant_id | ✅ Compliant |
| `nexus_users` | `tenant_id` | ✅ Yes | `rls:user_isolation`, `rls:user_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_sessions` | `tenant_id` | ✅ Yes | `rls:session_isolation`, `rls:session_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_cases` | `derived:client_id/vendor_id` | ✅ Yes | `rls:case_isolation`, `rls:case_service_bypass` | authenticated, service_role | ✅ Yes | Derived via client_id/vendor_id | ✅ Compliant |
| `nexus_case_messages` | `derived:case_id→client_id/vendor_id` | ✅ Yes | `rls:message_isolation`, `rls:message_service_bypass` | authenticated, service_role | ✅ Yes | Derived via case_id → client_id/vendor_id | ✅ Compliant |
| `nexus_case_evidence` | `derived:case_id→client_id/vendor_id` | ✅ Yes | `rls:evidence_isolation`, `rls:evidence_service_bypass` | authenticated, service_role | ✅ Yes | Derived via case_id → client_id/vendor_id | ✅ Compliant |
| `nexus_case_checklist` | `derived:case_id→client_id/vendor_id` | ✅ Yes | `rls:checklist_isolation`, `rls:checklist_service_bypass` | authenticated, service_role | ✅ Yes | Derived via case_id → client_id/vendor_id | ✅ Compliant |
| `nexus_case_activity` | `derived:case_id→client_id/vendor_id` | ✅ Yes | `rls:activity_isolation`, `rls:activity_service_bypass` | authenticated, service_role | ✅ Yes | Derived via case_id → client_id/vendor_id | ✅ Compliant |
| `nexus_invoices` | `derived:client_id/vendor_id` | ✅ Yes | `rls:invoice_isolation`, `rls:invoice_service_bypass` | authenticated, service_role | ✅ Yes | Derived via client_id/vendor_id | ✅ Compliant |
| `nexus_payments` | `derived:from_id/to_id` | ✅ Yes | `rls:payment_isolation`, `rls:payment_service_bypass` | authenticated, service_role | ✅ Yes | Derived via from_id/to_id | ✅ Compliant |
| `nexus_payment_schedule` | `derived:from_id/to_id` | ✅ Yes | `rls:schedule_isolation`, `rls:schedule_service_bypass` | authenticated, service_role | ✅ Yes | Derived via from_id/to_id | ✅ Compliant |
| `nexus_payment_activity` | `derived:payment_id→from_id/to_id` | ✅ Yes | `rls:pay_activity_isolation`, `rls:pay_activity_service_bypass` | authenticated, service_role | ✅ Yes | Derived via payment_id → from_id/to_id | ✅ Compliant |
| `nexus_notifications` | `tenant_id` | ✅ Yes | `rls:notification_isolation`, `rls:notification_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_notification_config` | `tenant_id` (PK) | ✅ Yes | `rls:notif_config_isolation`, `rls:notif_config_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_user_notification_prefs` | `tenant_id` | ✅ Yes | `rls:user_prefs_isolation`, `rls:user_prefs_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_notification_queue` | `tenant_id` | ✅ Yes | `rls:queue_isolation`, `rls:queue_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_push_subscriptions` | `tenant_id` | ✅ Yes | `rls:push_sub_isolation`, `rls:push_sub_service_bypass` | authenticated, service_role | ✅ Yes | Direct tenant isolation | ✅ Compliant |
| `nexus_audit_log` | `derived:actor_tenant_id` | ✅ Yes | `rls:audit_isolation`, `rls:audit_service_bypass` | authenticated, service_role | ✅ Yes | Derived via actor_tenant_id | ✅ Compliant |

**Coverage Summary:**
- Total Tables: 20
- Tenant-Scoped: 20 (100%)
- RLS Enabled: 20 (100%)
- Tested: 20 (100%)
- **Status: ✅ 100% Compliant**

**See:** [RLS_COVERAGE.md](./RLS_COVERAGE.md) for detailed policy definitions

---

## E) Drift Checks Matrix (CI "gatekeeper")

**Requirement:** All drift checks must produce machine-readable reports. These are mandatory CI/CD gates.

| Check ID | What it validates | Input | Output Artifact | Severity | Owner | Status |
|----------|-------------------|-------|----------------|----------|-------|--------|
| DRIFT-01 | Schema diff | migrations vs live schema | `reports/schema-diff.json` | BLOCK | platform | ⚠️ Pending Implementation (Priority 1) |
| DRIFT-02 | RLS coverage | list of tenant tables | `reports/rls-coverage.json` | BLOCK | security | ⚠️ Pending Implementation (Priority 1) |
| DRIFT-03 | Contract registry coverage | JSONB fields vs registry | `reports/contract-coverage.json` | BLOCK | data-gov | ⚠️ Pending Implementation (Priority 1) |
| DRIFT-04 | Index coverage | FK list vs indexes | `reports/index-coverage.json` | BLOCK | db | ⚠️ Pending Implementation (Priority 2) |
| DRIFT-05 | Core immutability | core list vs schema changes | `reports/core-immutability.json` | BLOCK | arch | ⚠️ Pending Implementation (Priority 2) |

**Implementation Status:**
- ⚠️ Pending Implementation = Not yet implemented (highest ROI next step)
- ✅ Implemented = Active in CI/CD
- 🔄 In Progress = Currently being implemented

**Priority:** Implement DRIFT-01, DRIFT-02, DRIFT-03 first (directly enforce PRD promises)

**Drift Ownership Rule:**
Any drift failure must name:
- **Fix owner** - Individual or team responsible for resolving the drift
- **ETA** - Expected resolution date/time
- **Risk level** - Low/Medium/High/Critical (based on security, data integrity, or compliance impact)

This prevents drift being "someone else's problem" and ensures accountability.

---

## Maintenance

### Update Frequency
- **Table Guardrail Matrix:** Updated when tables are added/modified
- **JSONB Contract Registry:** Updated when JSONB contracts are added/modified
- **Promotion Matrix:** Updated when promotions are planned/executed
- **RLS Coverage Matrix:** Updated when RLS policies are added/modified
- **Drift Checks Matrix:** Updated when drift checks are implemented

### Validation
- ✅ All matrices are validated in CI/CD
- ✅ Missing entries block deployment
- ✅ Matrix updates require PR review

### Related Documentation
- [PRD_DB_SCHEMA.md](../../development/prds/PRD_DB_SCHEMA.md) - Source PRD
- [JSONB_CONTRACT_REGISTRY.md](./JSONB_CONTRACT_REGISTRY.md) - Detailed contract definitions
- [PROMOTION_LOG.md](./PROMOTION_LOG.md) - Promotion history
- [RLS_COVERAGE.md](./RLS_COVERAGE.md) - Detailed RLS policy definitions

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22  
**Maintained By:** Architecture Team

