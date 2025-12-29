# Metadata Control Protocol: Implementation Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Step-by-step implementation guide for adopting Metadata-Driven Architecture  
**Related:** [METADATA_CONTROL_PROTOCOL.md](./METADATA_CONTROL_PROTOCOL.md)  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Foundation Setup](#phase-1-foundation-setup)
3. [Phase 2: Schema Implementation](#phase-2-schema-implementation)
4. [Phase 3: Adapter Integration](#phase-3-adapter-integration)
5. [Phase 4: Middleware Creation](#phase-4-middleware-creation)
6. [Phase 5: Admin API](#phase-5-admin-api)
7. [Phase 6: Testing](#phase-6-testing)
8. [Phase 7: Migration Strategy](#phase-7-migration-strategy)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 20.x installed
- ✅ Supabase project configured
- ✅ Existing database with JSONB columns (`metadata`, `preferences`, `settings`)
- ✅ Understanding of Zod schemas (see [METADATA_CONTROL_PROTOCOL.md](./METADATA_CONTROL_PROTOCOL.md))

---

## Phase 1: Foundation Setup

### Step 1.1: Install Zod

```bash
npm install zod
```

### Step 1.2: Create Schema Directory

```bash
mkdir -p src/schemas
```

### Step 1.3: Activate Metadata Schema File

1. Open `src/schemas/metadata.schema.js`
2. Uncomment all Zod imports and schemas
3. Remove placeholder exports at the bottom

**Expected Result:** File exports working Zod schemas.

### Step 1.4: Verify Installation

```bash
node -e "import('./src/schemas/metadata.schema.js').then(m => console.log('Schemas loaded:', Object.keys(m)))"
```

---

## Phase 2: Schema Implementation

### Step 2.1: Review Existing Metadata Structure

Analyze your current JSONB usage:

```sql
-- Check existing metadata structures
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE data_type = 'jsonb'
  AND table_schema = 'public'
ORDER BY table_name, column_name;
```

### Step 2.2: Customize Schemas

Update `src/schemas/metadata.schema.js` to match your actual data:

1. **Review existing metadata** in your database
2. **Add/remove fields** from schemas as needed
3. **Set appropriate defaults** for your business logic
4. **Add validation rules** (min/max, enums, regex)

**Example Customization:**

```javascript
// If your tenants have a "billing_tier" field
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    billing_tier: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'), // ADD THIS
    // ... rest of schema
  })
});
```

### Step 2.3: Add Database Constraints (Optional but Recommended)

Add CHECK constraints to enforce structure at database level:

```sql
-- Example: Enforce organization metadata structure
ALTER TABLE nexus_tenants
ADD CONSTRAINT enforce_tenant_metadata_structure
CHECK (
  (metadata->'plan_config' IS NULL OR jsonb_typeof(metadata->'plan_config') = 'object')
  AND (metadata->'feature_flags' IS NULL OR jsonb_typeof(metadata->'feature_flags') = 'object')
);

-- Example: Enforce user preferences structure
ALTER TABLE nexus_users
ADD CONSTRAINT enforce_user_preferences_structure
CHECK (
  (preferences->'ui' IS NULL OR jsonb_typeof(preferences->'ui') = 'object')
  AND (preferences->'notifications' IS NULL OR jsonb_typeof(preferences->'notifications') = 'object')
);
```

**Note:** These constraints are optional but provide an extra safety layer.

---

## Phase 3: Adapter Integration

### Step 3.1: Update Nexus Adapter

Modify `src/adapters/nexus-adapter.js` to use metadata schemas:

```javascript
// Add import at top
import { 
  parseOrgMetadata, 
  parseUserPreferences,
  parseCaseMetadata 
} from '../schemas/metadata.schema.js';

// Update adaptTenant function
export function adaptTenant(row) {
  const safeMetadata = parseOrgMetadata(row.metadata);
  
  return {
    tenantId: row.tenant_id,
    name: row.name,
    // ... other fields
    config: safeMetadata // Typed, validated metadata
  };
}

// Update adaptNexusUser function
export function adaptNexusUser(row) {
  const safePreferences = parseUserPreferences(row.preferences);
  
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    // ... other fields
    preferences: safePreferences // Typed, validated preferences
  };
}

// Update adaptCase function (if exists)
export function adaptCase(row) {
  const safeMetadata = parseCaseMetadata(row.metadata);
  
  return {
    caseId: row.case_id,
    // ... other fields
    metadata: safeMetadata // Typed, validated metadata
  };
}
```

### Step 3.2: Test Adapter Changes

Create a simple test to verify adapters work:

```javascript
// tests/unit/adapters/metadata-parsing.test.js
import { adaptTenant, adaptNexusUser } from '@/adapters/nexus-adapter.js';

test('adapter applies defaults for empty metadata', () => {
  const row = {
    tenant_id: 'TNT-001',
    name: 'Test Tenant',
    metadata: {} // Empty
  };
  
  const adapted = adaptTenant(row);
  expect(adapted.config.plan_config.max_users).toBe(10); // Default applied
});
```

---

## Phase 4: Middleware Creation

### Step 4.1: Create Governance Middleware

Create `src/middleware/governance.js`:

```javascript
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
```

### Step 4.2: Add Helper Functions

Add helper functions to `src/adapters/nexus-adapter.js`:

```javascript
/**
 * Get current user count for tenant
 */
export async function getCurrentUserCount(tenantId) {
  const { count, error } = await supabase
    .from('nexus_users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  
  if (error) throw error;
  return count || 0;
}
```

### Step 4.3: Apply Middleware to Routes

Update routes to use middleware:

```javascript
// src/routes/nexus-portal.js
import { checkQuota, requireFeature } from '../middleware/governance.js';

// Apply to user creation route
app.post('/api/users', 
  authenticate,
  checkQuota('users'),
  userController.create
);

// Apply to feature-gated routes
app.post('/api/reports/advanced', 
  authenticate,
  requireFeature('ai_reports'),
  reportController.createAdvanced
);
```

---

## Phase 5: Admin API

### Step 5.1: Create Admin Routes

Create `src/routes/admin/metadata.js`:

```javascript
import { OrgMetadataSchema } from '@/schemas/metadata.schema.js';
import { supabase } from '@/adapters/supabase.js';

/**
 * Update organization metadata (Admin only)
 */
app.patch('/api/admin/organizations/:tenantId/metadata', 
  requireAdmin,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const updates = req.body;
      
      // Validate with Zod (partial allows updating only some fields)
      const validated = OrgMetadataSchema.partial().parse(updates);
      
      // Get existing metadata
      const { data: org, error: fetchError } = await supabase
        .from('nexus_tenants')
        .select('metadata')
        .eq('tenant_id', tenantId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Merge with existing metadata
      const newMetadata = { ...org.metadata, ...validated };
      
      // Update database
      const { error: updateError } = await supabase
        .from('nexus_tenants')
        .update({ metadata: newMetadata })
        .eq('tenant_id', tenantId);
      
      if (updateError) throw updateError;
      
      res.json({ success: true, metadata: newMetadata });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);
```

### Step 5.2: Add Admin Authentication

Ensure `requireAdmin` middleware exists:

```javascript
// src/middleware/auth.js (or create new file)
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isInternal) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

### Step 5.3: Test Admin API

```bash
# Test metadata update
curl -X PATCH http://localhost:3000/api/admin/organizations/TNT-001/metadata \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_config": {
      "max_users": 100
    }
  }'
```

---

## Phase 6: Testing

### Step 6.1: Unit Tests (Schema Validation)

Create `tests/unit/schemas/metadata.test.js`:

```javascript
import { 
  OrgMetadataSchema, 
  UserPreferencesSchema 
} from '@/schemas/metadata.schema.js';

describe('Metadata Governance', () => {
  describe('OrgMetadataSchema', () => {
    it('should apply defaults when metadata is empty', () => {
      const result = OrgMetadataSchema.parse({});
      expect(result.plan_config.max_users).toBe(10);
      expect(result.plan_config.retention_days).toBe(30);
    });

    it('should strip out unknown fields', () => {
      const raw = { 
        plan_config: { max_users: 5 }, 
        hacker_field: 'inject_code'
      };
      const parsed = OrgMetadataSchema.parse(raw);
      expect(parsed).not.toHaveProperty('hacker_field');
    });
  });
});
```

### Step 6.2: Integration Tests (Middleware)

Create `tests/integration/server/feature-flags.test.js`:

```javascript
import { createTenantWithMetadata } from '@/tests/setup/test-helpers.js';

describe('Feature Flag Middleware', () => {
  it('should block access when feature flag is false', async () => {
    const tenant = await createTenantWithMetadata({
      feature_flags: { ai_reports: false }
    });
    const user = await createUserForTenant(tenant.tenant_id);
    
    const res = await request(app)
      .post('/api/reports/advanced')
      .set('Authorization', `Bearer ${user.token}`);
      
    expect(res.status).toBe(403);
  });
});
```

### Step 6.3: E2E Tests (Business Workflows)

Create `tests/e2e/metadata-driven-workflows.test.js`:

```javascript
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
      .send({ plan_config: { max_users: 10 } });
    
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

## Phase 7: Migration Strategy

### Step 7.1: Migrate Existing Data

If you have existing metadata without structure:

```sql
-- Migration: Add defaults to existing empty metadata
UPDATE nexus_tenants
SET metadata = jsonb_build_object(
  'plan_config', jsonb_build_object(
    'max_users', COALESCE((metadata->'plan_config'->>'max_users')::int, 10),
    'retention_days', COALESCE((metadata->'plan_config'->>'retention_days')::int, 30),
    'can_export', COALESCE((metadata->'plan_config'->>'can_export')::boolean, false)
  ),
  'feature_flags', COALESCE(metadata->'feature_flags', '{}'::jsonb)
)
WHERE metadata IS NULL OR metadata = '{}'::jsonb;
```

### Step 7.2: Gradual Rollout

1. **Week 1:** Deploy schemas and adapters (read-only)
2. **Week 2:** Add middleware to non-critical routes
3. **Week 3:** Add middleware to all routes
4. **Week 4:** Deploy admin API

### Step 7.3: Monitor and Adjust

- Monitor error rates from schema validation
- Check for unexpected defaults being applied
- Adjust schemas based on real-world usage

---

## Troubleshooting

### Issue: "Zod validation errors in production"

**Solution:** Add error logging to see what data is failing:

```javascript
export function parseOrgMetadata(raw) {
  try {
    return OrgMetadataSchema.parse(raw || {});
  } catch (error) {
    console.error('Metadata validation failed:', {
      raw,
      error: error.message,
      issues: error.issues
    });
    // Return safe defaults instead of crashing
    return OrgMetadataSchema.parse({});
  }
}
```

### Issue: "Middleware not blocking access"

**Check:**
1. Is `req.user.organization` populated?
2. Is `org.config` the parsed metadata (not raw JSONB)?
3. Are feature flags being checked correctly?

**Debug:**

```javascript
export const requireFeature = (flagName) => (req, res, next) => {
  console.log('Feature check:', {
    flagName,
    org: req.user?.organization?.tenant_id,
    flags: req.user?.organization?.config?.feature_flags
  });
  // ... rest of middleware
};
```

### Issue: "Admin API updates not taking effect"

**Check:**
1. Is the update query actually executing?
2. Is the metadata being merged correctly?
3. Are adapters re-parsing on next request?

**Solution:** Add logging:

```javascript
const { error: updateError } = await supabase
  .from('nexus_tenants')
  .update({ metadata: newMetadata })
  .eq('tenant_id', tenantId);

console.log('Metadata update:', {
  tenantId,
  newMetadata,
  error: updateError
});
```

---

## ✅ Implementation Checklist

- [ ] Phase 1: Foundation Setup
  - [ ] Install Zod
  - [ ] Activate schema file
  - [ ] Verify installation

- [ ] Phase 2: Schema Implementation
  - [ ] Review existing metadata
  - [ ] Customize schemas
  - [ ] Add database constraints (optional)

- [ ] Phase 3: Adapter Integration
  - [ ] Update adapters to use schemas
  - [ ] Test adapter changes

- [ ] Phase 4: Middleware Creation
  - [ ] Create governance middleware
  - [ ] Add helper functions
  - [ ] Apply to routes

- [ ] Phase 5: Admin API
  - [ ] Create admin routes
  - [ ] Add admin authentication
  - [ ] Test admin API

- [ ] Phase 6: Testing
  - [ ] Unit tests (schemas)
  - [ ] Integration tests (middleware)
  - [ ] E2E tests (workflows)

- [ ] Phase 7: Migration
  - [ ] Migrate existing data
  - [ ] Gradual rollout
  - [ ] Monitor and adjust

---

**Document Status:** ✅ Active  
**Last Updated:** 2025-01-22  
**Next Review:** After Phase 1 completion

