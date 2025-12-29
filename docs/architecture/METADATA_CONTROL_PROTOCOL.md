# Metadata Control Protocol (MCP)

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Source of truth for metadata-driven architecture - governance framework for business-controlled configuration  
**Philosophy:** Metadata First. Code Second.  
**Goal:** Maximize flexibility for business logic while enforcing strict schema governance.  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [The Core Concept](#i-the-core-concept-metadata-is-the-control-plane)
2. [The Governance Layer](#ii-the-governance-layer-the-guardrails)
3. [The Flexibility Layer](#iii-the-flexibility-layer-business-control)
4. [Implementation Strategy](#iv-implementation-strategy)
5. [Evolution Strategy](#v-evolution-strategy)
6. [Testing Strategy](#vi-testing-strategy)
7. [Real-World Examples](#vii-real-world-examples)
8. [Related Documentation](#viii-related-documentation)

---

## I. The Core Concept: "Metadata is the Control Plane"

We do not hardcode business rules. We hardcode **capabilities**, and we use Metadata to **configure** them.

### The Hierarchy of Data

| Layer | Type | Storage | Governance | Modified By |
|-------|------|---------|------------|-------------|
| **Core Data** | Identity, Foreign Keys, Audit Logs | SQL Columns | **Absolute** | Migration only |
| **Metadata** | Permissions, Configs, Quotas, UI Prefs | JSONB | **Strong** (Schema-validated) | API/Admin UI |
| **Content** | User inputs, Descriptions | SQL Columns/JSONB | **Loose** | User input |

### What Metadata Controls

Metadata acts as the "DNA" of your application. It controls:

1. **Access:** Who can see what (RBAC/Permissions)
2. **Features:** What tools are active (Feature Flags)
3. **UI:** How the dashboard looks (Preferences/Layout)
4. **Business Logic:** Limits, quotas, and tier restrictions

### The Metadata Lifecycle

```
Developer → Defines Schema (Zod) + Implements Logic (Middleware)
    ↓
Database → Stores Configuration (JSONB)
    ↓
Business → Updates Configuration (Admin UI)
    ↓
User → Experiences Result Immediately
```

**Result:** High Flexibility (Business Speed) balanced by High Governance (Engineering Stability).

---

## II. The Governance Layer (The Guardrails)

Flexibility without structure is chaos. We enforce governance at **three levels** to prevent "JSON Soup."

### Level 1: Database Constraints (The Hard Stop)

We use PostgreSQL `CHECK` constraints to ensure the top-level keys always exist.

```sql
-- Enforce that specific keys must exist in the JSONB column
ALTER TABLE public.organizations
ADD CONSTRAINT enforce_metadata_structure 
CHECK (
  metadata ? 'plan_config' AND
  metadata ? 'feature_flags' AND
  metadata ? 'ui_preferences'
);

-- Example: Enforce structure for nexus_tenants
ALTER TABLE nexus_tenants
ADD CONSTRAINT enforce_tenant_metadata_structure
CHECK (
  jsonb_typeof(metadata->'plan_config') = 'object' OR metadata->'plan_config' IS NULL
  AND jsonb_typeof(metadata->'feature_flags') = 'object' OR metadata->'feature_flags' IS NULL
);

-- Example: Enforce structure for nexus_users preferences
ALTER TABLE nexus_users
ADD CONSTRAINT enforce_user_preferences_structure
CHECK (
  jsonb_typeof(preferences->'ui') = 'object' OR preferences->'ui' IS NULL
  AND jsonb_typeof(preferences->'notifications') = 'object' OR preferences->'notifications' IS NULL
);
```

**Why:** Prevents invalid data from entering the database, even if application validation fails.

### Level 2: Application Schema (The Validator)

We use **Zod** as the Single Source of Truth for what valid metadata looks like. The DB stores JSON, but the App only sees Typed Objects.

```javascript
// src/schemas/metadata.schema.js
import { z } from 'zod';

// 1. Define the Governance Schema for Organizations
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    retention_days: z.number().min(1).default(30),
    can_export: z.boolean().default(false),
    max_storage_gb: z.number().min(1).default(5)
  }).default({}),
  feature_flags: z.record(z.string(), z.boolean()).default({}), // { "beta_dashboard": true }
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
  }).optional()
});

// 2. Define the Governance Schema for Users
export const UserPreferencesSchema = z.object({
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

// 3. Export Types (for JSDoc/TypeScript)
/** @typedef {z.infer<typeof OrgMetadataSchema>} OrgMetadata */
/** @typedef {z.infer<typeof UserPreferencesSchema>} UserPreferences */
```

**Why:** Provides runtime validation, type safety, and automatic defaults.

### Level 3: The Adapter Layer (The Gatekeeper)

Data never enters the app without passing through the Adapter.

```javascript
// src/adapters/organization.adapter.js
import { OrgMetadataSchema } from '@/schemas/metadata.schema';

export function adaptOrganization(row) {
  // If DB has old/bad data, Zod fixes it with defaults or throws error
  const safeMetadata = OrgMetadataSchema.parse(row.metadata || {});
  
  return {
    id: row.id,
    name: row.name,
    tenant_id: row.tenant_id,
    config: safeMetadata // The app ONLY uses this safe object
  };
}

// src/adapters/nexus-adapter.js (existing pattern)
import { UserPreferencesSchema } from '@/schemas/metadata.schema';

export function adaptNexusUser(row) {
  const safePreferences = UserPreferencesSchema.parse(row.preferences || {});
  
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    preferences: safePreferences // Typed, validated preferences
  };
}
```

**Why:** Ensures all metadata is validated and typed before use in application logic.

---

## III. The Flexibility Layer (Business Control)

Because we used the Governance Layer above, we can now expose these controls safely to the Business.

### 1. Zero-Code Plan Upgrades

**Scenario:** Customer pays for "Enterprise."

**Action:** Business Ops updates `metadata.plan_config` via Admin Panel:
- `max_users`: `10` → `1000`
- `can_export`: `false` → `true`
- `max_storage_gb`: `5` → `500`

**Result:** Application middleware immediately honors the new limits. **No code deploy required.**

```sql
-- Admin Panel executes:
UPDATE nexus_tenants
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      metadata,
      '{plan_config,max_users}',
      '1000'::jsonb
    ),
    '{plan_config,can_export}',
    'true'::jsonb
  ),
  '{plan_config,max_storage_gb}',
  '500'::jsonb
)
WHERE tenant_id = 'TNT-XXXXXXXX';
```

### 2. Feature Flagging

**Scenario:** Testing a new "AI Report" feature.

**Action:** Set `metadata.feature_flags.ai_reports = true` for only 5 beta users.

**Result:** Only those users see the feature.

```sql
-- Enable for specific tenants
UPDATE nexus_tenants
SET metadata = jsonb_set(
  metadata,
  '{feature_flags,ai_reports}',
  'true'::jsonb
)
WHERE tenant_id IN ('TNT-ALPH0001', 'TNT-BETA0001', 'TNT-GAMM0001', 'TNT-DELT0001', 'TNT-EPSI0001');
```

### 3. UI Personalization

**Scenario:** A client wants their dashboard to match their brand.

**Action:** Update `metadata.ui_preferences.theme` and `metadata.ui_preferences.primary_color`.

```sql
-- Customize tenant UI
UPDATE nexus_tenants
SET metadata = jsonb_set(
  jsonb_set(
    metadata,
    '{ui_preferences,theme}',
    '"dark"'::jsonb
  ),
  '{ui_preferences,primary_color}',
  '"#FF5733"'::jsonb
)
WHERE tenant_id = 'TNT-XXXXXXXX';
```

### 4. User-Level Preferences

**Scenario:** User wants email notifications disabled, but SMS enabled.

**Action:** Update `preferences.notifications` for that user.

```sql
-- Update user preferences
UPDATE nexus_users
SET preferences = jsonb_set(
  jsonb_set(
    preferences,
    '{notifications,email}',
    'false'::jsonb
  ),
  '{notifications,sms}',
  'true'::jsonb
)
WHERE user_id = 'USR-XXXXXXXX';
```

---

## IV. Implementation Strategy

### 1. Middleware: The Enforcer

Create middleware that reads the Metadata and blocks/allows access.

```javascript
// src/middleware/governance.js
import { OrgMetadataSchema } from '@/schemas/metadata.schema';

/**
 * Middleware: Check if user's organization has reached plan limit
 */
export const checkQuota = (resource) => async (req, res, next) => {
  const org = req.user.organization; // Already parsed by Adapter
  const config = org.config; // Typed metadata from Zod
  
  if (resource === 'users') {
    const currentCount = await getCurrentUserCount(org.tenant_id);
    if (currentCount >= config.plan_config.max_users) {
      return res.status(402).json({ 
        error: 'Plan limit reached. Please upgrade.',
        limit: config.plan_config.max_users,
        current: currentCount
      });
    }
  }
  
  if (resource === 'storage') {
    const currentGB = await getCurrentStorageGB(org.tenant_id);
    if (currentGB >= config.plan_config.max_storage_gb) {
      return res.status(402).json({ 
        error: 'Storage limit reached. Please upgrade.',
        limit: config.plan_config.max_storage_gb,
        current: currentGB
      });
    }
  }
  
  next();
};

/**
 * Middleware: Require specific feature flag
 */
export const requireFeature = (flagName) => (req, res, next) => {
  const org = req.user.organization;
  const config = org.config;
  
  if (!config.feature_flags[flagName]) {
    return res.status(403).json({ 
      error: `Feature "${flagName}" is disabled for your account` 
    });
  }
  
  next();
};

// Usage in Routes
app.post('/api/users', 
  authenticate,
  checkQuota('users'),
  userController.create
);

app.post('/api/reports/advanced', 
  authenticate,
  requireFeature('ai_reports'),
  reportController.createAdvanced
);
```

### 2. Service Layer: The Business Logic

Use metadata in service methods to control behavior.

```javascript
// src/services/report.service.js
export async function createReport(userId, reportData) {
  const user = await getUserWithPreferences(userId);
  const preferences = user.preferences; // Typed from Zod
  
  // Check daily limit
  const reportsToday = await getReportsCountToday(userId);
  const limit = preferences.limits?.reports_per_day || 10;
  
  if (reportsToday >= limit) {
    throw new Error(`Daily report limit reached (${limit})`);
  }
  
  // Create report...
  return await createReportRecord(reportData);
}
```

### 3. Admin API: The Control Panel

Expose safe endpoints for business to update metadata.

```javascript
// src/routes/admin/metadata.js
import { OrgMetadataSchema } from '@/schemas/metadata.schema';

/**
 * Update organization metadata (Admin only)
 */
app.patch('/api/admin/organizations/:tenantId/metadata', 
  requireAdmin,
  async (req, res) => {
    const { tenantId } = req.params;
    const updates = req.body;
    
    // Validate with Zod
    const validated = OrgMetadataSchema.partial().parse(updates);
    
    // Merge with existing metadata
    const { data: org } = await supabase
      .from('nexus_tenants')
      .select('metadata')
      .eq('tenant_id', tenantId)
      .single();
    
    const newMetadata = { ...org.metadata, ...validated };
    
    // Update database
    const { error } = await supabase
      .from('nexus_tenants')
      .update({ metadata: newMetadata })
      .eq('tenant_id', tenantId);
    
    if (error) throw error;
    
    res.json({ success: true, metadata: newMetadata });
  }
);
```

---

## V. Evolution Strategy

How do we change the Schema (Governance) without breaking the Data (Flexibility)?

### 1. Additive Changes (Always Safe)

Adding new fields with defaults breaks nothing.

```javascript
// Before
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10)
  })
});

// After (Additive)
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    ai_enabled: z.boolean().default(false) // NEW: Safe addition
  })
});
```

**Result:** Existing data automatically gets `ai_enabled: false` via Zod defaults.

### 2. Deprecation (Gradual Removal)

Never delete keys immediately. Mark them deprecated, ignore them, then drop later.

```javascript
// Mark as deprecated
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    old_field: z.string().optional().deprecated() // Marked deprecated
  })
});

// In Adapter: Ignore deprecated fields
export function adaptOrganization(row) {
  const parsed = OrgMetadataSchema.parse(row.metadata || {});
  // Remove deprecated fields from output
  delete parsed.plan_config.old_field;
  return { ...row, config: parsed };
}

// Later: Remove from schema entirely (after migration)
```

### 3. Versioning (Major Changes)

If a major shift happens, add a `version` key and handle migration logic.

```javascript
// Version 1 Schema
export const OrgMetadataSchemaV1 = z.object({
  version: z.literal(1).default(1),
  plan_config: z.object({
    max_users: z.number().default(10)
  })
});

// Version 2 Schema (Breaking change)
export const OrgMetadataSchemaV2 = z.object({
  version: z.literal(2).default(2),
  plan_config: z.object({
    limits: z.object({
      users: z.number().default(10), // Renamed from max_users
      storage_gb: z.number().default(5) // New structure
    })
  })
});

// Adapter handles migration
export function adaptOrganization(row) {
  const metadata = row.metadata || {};
  const version = metadata.version || 1;
  
  if (version === 1) {
    // Migrate V1 to V2
    const v1 = OrgMetadataSchemaV1.parse(metadata);
    const v2 = {
      version: 2,
      plan_config: {
        limits: {
          users: v1.plan_config.max_users,
          storage_gb: 5 // Default
        }
      }
    };
    // Optionally: Save migrated version back to DB
    return { ...row, config: OrgMetadataSchemaV2.parse(v2) };
  }
  
  return { ...row, config: OrgMetadataSchemaV2.parse(metadata) };
}
```

---

## VI. Testing Strategy

Since metadata controls logic, you must test the **combinations**.

### 1. Unit Tests (Schema Validation)

Test your Zod schema and Adapter logic.

```javascript
// tests/unit/schemas/metadata.test.js
import { OrgMetadataSchema, UserPreferencesSchema } from '@/schemas/metadata.schema';

describe('Metadata Governance', () => {
  describe('OrgMetadataSchema', () => {
    it('should apply defaults when metadata is empty', () => {
      const result = OrgMetadataSchema.parse({});
      expect(result.plan_config.max_users).toBe(10); // Default applied
      expect(result.plan_config.retention_days).toBe(30);
      expect(result.plan_config.can_export).toBe(false);
    });

    it('should strip out unknown garbage data', () => {
      const raw = { 
        plan_config: { max_users: 5 }, 
        hacker_field: 'inject_code' // Garbage
      };
      const parsed = OrgMetadataSchema.parse(raw);
      
      expect(parsed).not.toHaveProperty('hacker_field'); // Governance working
      expect(parsed.plan_config.max_users).toBe(5);
    });

    it('should validate enum values', () => {
      expect(() => {
        OrgMetadataSchema.parse({
          ui_preferences: { theme: 'invalid' }
        });
      }).toThrow(); // Should reject invalid enum
    });
  });

  describe('UserPreferencesSchema', () => {
    it('should apply defaults for missing preferences', () => {
      const result = UserPreferencesSchema.parse({});
      expect(result.ui?.theme).toBe('system');
      expect(result.notifications?.email).toBe(true);
    });
  });
});
```

### 2. Integration Tests (Control Flow)

Test that changing metadata actually blocks/allows access.

```javascript
// tests/integration/server/feature-flags.test.js
import { createUserWithMetadata, createTenantWithMetadata } from '@/tests/setup/test-helpers';

describe('Feature Flag Middleware', () => {
  it('should block access when beta_feature flag is false', async () => {
    const tenant = await createTenantWithMetadata({
      feature_flags: { ai_reports: false }
    });
    const user = await createUserForTenant(tenant.tenant_id);
    
    const res = await request(app)
      .post('/api/reports/advanced')
      .set('Authorization', `Bearer ${user.token}`);
      
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('disabled');
  });

  it('should allow access when beta_feature flag is true', async () => {
    const tenant = await createTenantWithMetadata({
      feature_flags: { ai_reports: true }
    });
    const user = await createUserForTenant(tenant.tenant_id);
    
    const res = await request(app)
      .post('/api/reports/advanced')
      .set('Authorization', `Bearer ${user.token}`);
      
    expect(res.status).toBe(200);
  });
});

describe('Quota Middleware', () => {
  it('should block user creation when quota reached', async () => {
    const tenant = await createTenantWithMetadata({
      plan_config: { max_users: 2 }
    });
    
    // Create 2 users (at limit)
    await createUserForTenant(tenant.tenant_id);
    await createUserForTenant(tenant.tenant_id);
    
    const user = await createUserForTenant(tenant.tenant_id);
    
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: 'new@example.com' });
      
    expect(res.status).toBe(402);
    expect(res.body.error).toContain('limit reached');
  });
});
```

### 3. E2E Tests (Business Scenarios)

Test complete business workflows controlled by metadata.

```javascript
// tests/e2e/metadata-driven-workflows.test.js
describe('Metadata-Driven Workflows', () => {
  it('should upgrade plan and immediately allow more users', async () => {
    // 1. Create tenant with basic plan
    const tenant = await createTenantWithMetadata({
      plan_config: { max_users: 2 }
    });
    
    // 2. Create 2 users (at limit)
    await createUserForTenant(tenant.tenant_id);
    await createUserForTenant(tenant.tenant_id);
    
    // 3. Attempt to create 3rd user (should fail)
    const user = await createUserForTenant(tenant.tenant_id);
    let res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: 'third@example.com' });
    expect(res.status).toBe(402);
    
    // 4. Upgrade plan via admin API
    await request(app)
      .patch(`/api/admin/organizations/${tenant.tenant_id}/metadata`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plan_config: { max_users: 10 }
      });
    
    // 5. Now 3rd user creation should succeed
    res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: 'third@example.com' });
    expect(res.status).toBe(201);
  });
});
```

---

## VII. Real-World Examples

### Example 1: Multi-Tenant SaaS Plan Management

**Problem:** Different tenants need different limits based on subscription tier.

**Solution:** Store plan configuration in `nexus_tenants.metadata`.

```sql
-- Basic Plan
metadata = '{
  "plan_config": {
    "max_users": 5,
    "max_storage_gb": 10,
    "can_export": false,
    "retention_days": 30
  },
  "feature_flags": {
    "advanced_reports": false,
    "api_access": false
  }
}'

-- Enterprise Plan
metadata = '{
  "plan_config": {
    "max_users": 1000,
    "max_storage_gb": 1000,
    "can_export": true,
    "retention_days": 365
  },
  "feature_flags": {
    "advanced_reports": true,
    "api_access": true,
    "white_label": true
  }
}'
```

### Example 2: User Preference Management

**Problem:** Users want to customize their dashboard and notification preferences.

**Solution:** Store preferences in `nexus_users.preferences`.

```sql
-- User preferences
preferences = '{
  "ui": {
    "theme": "dark",
    "sidebar_collapsed": true,
    "dashboard_layout": "grid"
  },
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  },
  "limits": {
    "reports_per_day": 50
  }
}'
```

### Example 3: Feature Flag Rollout

**Problem:** Roll out new "AI Assistant" feature to 10% of users gradually.

**Solution:** Use feature flags in tenant metadata.

```sql
-- Phase 1: Enable for 5 beta tenants
UPDATE nexus_tenants
SET metadata = jsonb_set(
  metadata,
  '{feature_flags,ai_assistant}',
  'true'::jsonb
)
WHERE tenant_id IN (
  SELECT tenant_id FROM nexus_tenants 
  ORDER BY created_at 
  LIMIT 5
);

-- Phase 2: Enable for all Enterprise tenants
UPDATE nexus_tenants
SET metadata = jsonb_set(
  metadata,
  '{feature_flags,ai_assistant}',
  'true'::jsonb
)
WHERE metadata->'plan_config'->>'tier' = 'enterprise';
```

---

## VIII. Related Documentation

### Core Architecture

- [Database Standards](./DATABASE_STANDARDS.md) - Database design principles and metadata strategy
- [RLS Enforcement Architecture](./RLS_ENFORCEMENT_COMPLETE_ARCHITECTURE.md) - Row Level Security patterns

### Database Design

- [Flexible Data Patterns](../integrations/supabase/database/FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. Columns decision framework
- [Evolutionary Design](../integrations/supabase/best-practices/EVOLUTIONARY_DESIGN.md) - Schema evolution strategies
- [Domain Modeling](../integrations/supabase/database/DOMAIN_MODELING.md) - Business entity modeling

### Testing

- [Testing Strategy](./TESTING_STRATEGY.md) - Complete testing architecture
- [Test Standards](../../tests/TEST_STANDARDS.md) - Testing conventions and patterns

### Implementation

- [Supabase Platform Capabilities](../integrations/supabase/SUPABASE_PLATFORM_CAPABILITIES.md) - Supabase features overview
- [Audit & Optimization](../integrations/supabase/SUPABASE_AUDIT_AND_OPTIMIZATION.md) - Performance and security optimization

---

## 🎯 Final Motto

> **"The Database stores the State. The Metadata stores the Rules. The Code obeys both."**

---

## 📝 Next Steps

1. **Define Governance Schemas** - Create `src/schemas/metadata.schema.js` with Zod schemas
2. **Update Adapters** - Integrate metadata parsing into existing adapters
3. **Create Middleware** - Implement quota and feature flag middleware
4. **Build Admin API** - Expose safe endpoints for metadata updates
5. **Write Tests** - Test schema validation, middleware, and business workflows

**See Implementation Checklist in [OPTIMIZATION_ACTION_PLAN.md](../integrations/supabase/OPTIMIZATION_ACTION_PLAN.md) for detailed tasks.**

---

**Document Status:** ✅ Active  
**Last Updated:** 2025-01-22  
**Maintained By:** Architecture Team  
**Review Cycle:** Quarterly

