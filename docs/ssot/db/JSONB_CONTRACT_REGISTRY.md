# JSONB Contract Registry (Detailed)

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** ✅ Active  
**Purpose:** Detailed JSONB contract definitions with Zod schemas and validation rules  
**Aligned To:** [PRD_DB_SCHEMA.md](../../development/prds/PRD_DB_SCHEMA.md) | [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md)

---

## 📋 Overview

This registry provides detailed definitions for all JSONB contracts used in the NexusCanon VMP database. Each contract includes:
- Zod schema definition
- Required and allowed keys
- Version history and migration notes
- Database CHECK constraints
- Index recommendations

---

## Contract Definitions

### 1. `tenant_settings` (nexus_tenants.settings)

**Purpose:** Tenant-level configuration (feature flags, UI preferences, plan config)

**Zod Schema:**
```javascript
// src/schemas/metadata.schema.js
export const TenantSettingsSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('tenant_settings').default('tenant_settings'),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
  }).optional(),
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    retention_days: z.number().min(1).default(30),
    can_export: z.boolean().default(false),
    max_storage_gb: z.number().min(1).default(5)
  }).default({})
});
```

**Required Keys:** `_schema_version`, `_context`, `type`

**Allowed Keys:** `feature_flags`, `ui_preferences`, `plan_config`

**CHECK Constraint:**
```sql
ALTER TABLE nexus_tenants
ADD CONSTRAINT enforce_tenant_settings_structure
CHECK (
  jsonb_typeof(settings->'feature_flags') = 'object' OR settings->'feature_flags' IS NULL
  AND jsonb_typeof(settings->'plan_config') = 'object' OR settings->'plan_config' IS NULL
);
```

**Index Recommendation:** GIN index on `settings->'feature_flags'` path (if frequently queried)

**Migration Notes:**
- v1: Initial schema

---

### 2. `tenant_metadata` (nexus_tenants.metadata)

**Purpose:** Tenant-level extension data (custom fields, integration data)

**Zod Schema:**
```javascript
export const TenantMetadataSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('tenant_metadata').default('tenant_metadata'),
  custom_fields: z.record(z.string(), z.any()).default({}),
  integration_data: z.record(z.string(), z.any()).default({})
});
```

**Required Keys:** `_schema_version`, `_context`, `type`

**Allowed Keys:** `custom_fields`, `integration_data`

**CHECK Constraint:** None (fully flexible)

**Index Recommendation:** None (not frequently queried)

**Migration Notes:**
- v1: Initial schema

---

### 3. `user_preferences` (nexus_users.preferences)

**Purpose:** User-level preferences (UI, notifications, limits)

**Zod Schema:**
```javascript
export const UserPreferencesSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('user_preferences').default('user_preferences'),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    sidebar_collapsed: z.boolean().default(false),
    dashboard_layout: z.enum(['grid', 'list']).default('grid')
  }).optional(),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(false)
  }).optional(),
  limits: z.object({
    reports_per_day: z.number().min(0).default(10)
  }).optional()
});
```

**Required Keys:** `_schema_version`, `_context`, `type`

**Allowed Keys:** `ui`, `notifications`, `limits`

**CHECK Constraint:**
```sql
ALTER TABLE nexus_users
ADD CONSTRAINT enforce_user_preferences_structure
CHECK (
  jsonb_typeof(preferences->'ui') = 'object' OR preferences->'ui' IS NULL
  AND jsonb_typeof(preferences->'notifications') = 'object' OR preferences->'notifications' IS NULL
);
```

**Index Recommendation:** None (user-specific, not frequently queried)

**Migration Notes:**
- v1: Initial schema

---

### 4. `case_metadata` (nexus_cases.metadata)

**Purpose:** Case-level extension data (custom fields, escalation data)

**Zod Schema:**
```javascript
export const CaseMetadataSchema = z.object({
  _schema_version: z.number().default(2),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('case_metadata').default('case_metadata'),
  escalation_level: z.number().min(0).max(5).optional(), // v2 addition
  custom_fields: z.record(z.string(), z.any()).default({})
});
```

**Required Keys:** `_schema_version`, `_context`, `type`

**Allowed Keys:** `escalation_level` (v2+), `custom_fields`

**CHECK Constraint:**
```sql
ALTER TABLE nexus_cases
ADD CONSTRAINT enforce_case_metadata_structure
CHECK (
  (metadata->>'_schema_version')::int >= 1
  AND jsonb_typeof(metadata->'custom_fields') = 'object' OR metadata->'custom_fields' IS NULL
);
```

**Index Recommendation:** Expression index on `metadata->>'escalation_level'` (if frequently queried)

**Migration Notes:**
- v1: Initial schema
- v1→v2: Added `escalation_level` field (promoted from JSONB to column in PROMO-001)

---

### 5. `message_metadata` (nexus_case_messages.metadata)

**Purpose:** Message-level channel-specific metadata (WhatsApp, Email, etc.)

**Zod Schema:**
```javascript
export const MessageMetadataSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('message_metadata').default('message_metadata'),
  channel: z.enum(['email', 'whatsapp', 'slack', 'system']).optional(),
  whatsapp: z.object({
    message_id: z.string().optional(),
    thread_id: z.string().optional()
  }).optional(),
  email: z.object({
    message_id: z.string().optional(),
    in_reply_to: z.string().optional(),
    references: z.array(z.string()).optional()
  }).optional(),
  thread_id: z.string().optional()
});
```

**Required Keys:** `_schema_version`, `_context`, `type`

**Allowed Keys:** `channel`, `whatsapp`, `email`, `thread_id`

**CHECK Constraint:** None (channel-specific structures vary)

**Index Recommendation:** None (not frequently queried)

**Migration Notes:**
- v1: Initial schema

---

### 6. `invoice_line_items` (nexus_invoices.line_items)

**Canonical Contract ID:** `CONTRACT-INVOICE-LINE-ITEMS-V1`

**Purpose:** Flexible invoice line items (object containing items array)

**Zod Schema:**
```javascript
export const InvoiceLineItemsSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('invoice_line_items').default('invoice_line_items'),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().min(0),
    unit_price: z.number().min(0),
    amount: z.number().min(0),
    tax_rate: z.number().min(0).max(1).optional(),
    discount: z.number().min(0).optional()
  })).default([])
});
```

**Required Keys:** `_schema_version`, `_context`, `type`, `items`

**Allowed Keys:** `items` (array of line item objects)

**Structure:** Object `{_schema_version, _context, type, items: [...]}` (NOT raw array)

**CHECK Constraint:**
```sql
ALTER TABLE nexus_invoices
ADD CONSTRAINT enforce_line_items_structure
CHECK (
  jsonb_typeof(line_items) = 'object'
  AND (line_items->>'_schema_version')::int >= 1
  AND jsonb_typeof(line_items->'items') = 'array'
);
```

**Index Recommendation:** None (array aggregation, not indexed)

**Migration Notes:**
- v1: Initial schema

---

### 7. `notification_delivery_attempts` (nexus_notifications.delivery_attempts)

**Purpose:** Array of delivery attempt events

**Zod Schema:**
```javascript
export const DeliveryAttemptsSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  type: z.literal('notification_delivery_attempts').default('notification_delivery_attempts'),
  attempts: z.array(z.object({
    timestamp: z.string(),
    status: z.enum(['sent', 'failed', 'pending']),
    channel: z.enum(['email', 'sms', 'push', 'realtime']),
    error: z.string().optional()
  })).default([])
});
```

**Required Keys:** `_schema_version`, `_context`, `type`, `attempts`

**Allowed Keys:** `attempts` (array of attempt objects)

**CHECK Constraint:**
```sql
ALTER TABLE nexus_notifications
ADD CONSTRAINT enforce_delivery_attempts_structure
CHECK (
  jsonb_typeof(delivery_attempts) = 'array'
  AND (delivery_attempts->>'_schema_version')::int >= 1
);
```

**Index Recommendation:** None (append-only log)

**Migration Notes:**
- v1: Initial schema

---

## Registry Maintenance

### Adding New Contracts

1. Define Zod schema in `src/schemas/metadata.schema.js`
2. Add entry to this registry
3. Add entry to [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md) Section B
4. Create database CHECK constraint (if needed)
5. Update adapter layer to use contract
6. Add tests

### Versioning Contracts

1. Create new version schema (e.g., `CaseMetadataSchemaV2`)
2. Update `max_version` in registry
3. Add migration notes
4. Update adapter to handle version migration
5. Test backward compatibility

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22  
**Maintained By:** Architecture Team

