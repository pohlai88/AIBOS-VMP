# Supabase & Database Architecture Standards

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Source of truth for Supabase database design, metadata strategy, and best practices  
**Context:** Supabase (PostgreSQL) + Express Backend  
**Philosophy:** "Strict Schema for Core Data, Flexible Schema for Metadata."  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Core Database Design Principles](#i-core-database-design-principles)
2. [Testing Strategy Integration](#ii-testing-strategy-integration)
3. [Clean Code Rules](#iii-summary-of-clean-code-rules-for-supabase)
4. [Visual Architecture](#iv-visual-architecture)
5. [Implementation Patterns](#v-implementation-patterns)
6. [Related Documentation](#vi-related-documentation)

---

## I. Core Database Design Principles

### 1. The "User Profile" Pattern (The Supabase Standard)

Supabase manages authentication in its own locked schema (`auth.users`). **Never** modify this table directly. Instead, create a public profile table that "mirrors" it.

#### Standard Pattern

* **Pattern:** `public.profiles` table linked 1:1 with `auth.users`.
* **Trigger:** Use a Postgres Trigger to automatically create a row in `public.profiles` whenever a new user signs up in `auth.users`.

```sql
-- The "Sidecar" Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### VMP/Nexus Implementation Pattern

**Note:** The VMP project uses a custom `nexus_users` table that integrates with Supabase Auth via `auth_user_id`. This is a valid pattern for multi-tenant applications.

```sql
-- Nexus Users Pattern (Multi-Tenant)
CREATE TABLE nexus_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,              -- USR-XXXXXXXX
  tenant_id TEXT NOT NULL,                    -- TNT-XXXXXXXX
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'member',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast auth lookup
CREATE INDEX idx_nexus_users_auth_user_id ON nexus_users(auth_user_id);
```

**Key Difference:**
- **Standard Pattern:** 1:1 relationship with `auth.users` (single profile per user)
- **Nexus Pattern:** Many-to-one relationship (user can belong to multiple tenants via separate records)

**When to Use Each:**
- **Standard Pattern:** Single-tenant applications, simple user profiles
- **Nexus Pattern:** Multi-tenant applications, role-per-tenant scenarios

---

### 2. Metadata Strategy: "Core vs. Meta"

Do not clutter your clean relational tables with temporary or UI-specific flags. Use a **Hybrid Approach**.

| Data Type | Definition | Storage Location | Example |
|-----------|-----------|------------------|---------|
| **Core Data** | Critical business logic. Relational, indexed, searchable. | **Columns** | `email`, `subscription_status`, `balance`, `tenant_id` |
| **Metadata** | User preferences, UI state, feature flags. Fluid and non-critical. | **JSONB Column** | `{"theme": "dark", "last_viewed": 12, "notifications": {"email": true}}` |

#### Best Practice: Add Metadata Column

Add a `metadata` or `preferences` JSONB column to your core tables (`users`, `organizations`, `cases`).

```sql
-- Add metadata column to profiles
ALTER TABLE public.profiles 
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add preferences column to nexus_users (already exists)
-- preferences JSONB DEFAULT '{}'

-- Usage: Update just the theme without locking the row for schema changes
UPDATE profiles 
SET metadata = jsonb_set(metadata, '{theme}', '"dark"') 
WHERE id = '...';

-- Usage: Update nested preferences
UPDATE nexus_users
SET preferences = jsonb_set(
  preferences,
  '{notifications,email}',
  'true'::jsonb
)
WHERE user_id = 'USR-XXXXXXXX';
```

#### Metadata Guardrails

To prevent a "Data Swamp," always include metadata guardrails:

1. **Version Tag:** `_schema_version: 2` for parsing logic
2. **Context Header:** `_changed_by`, `_changed_at`, `_reason` for auditability
3. **Type Discriminator:** `type` field for polymorphism

See [FLEXIBLE_DATA_PATTERNS.md](../integrations/supabase/database/FLEXIBLE_DATA_PATTERNS.md) for detailed patterns.

---

### 3. Row Level Security (RLS) is Mandatory

Supabase exposes your DB to the frontend. RLS is your firewall.

#### Rule: Enable RLS on ALL Tables

* **Rule:** Enable RLS on ALL tables immediately after creation.
* **Pattern:** Create strict policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Example: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Example: Users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING ( auth.uid() = id );

-- Example: Multi-tenant RLS (Nexus pattern)
ALTER TABLE nexus_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant users"
  ON nexus_users FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM nexus_users WHERE auth_user_id = auth.uid()
    )
  );
```

#### RLS Testing Strategy

**Never trust RLS policies blindly. Test them.**

See [Testing Strategy Integration](#ii-testing-strategy-integration) below.

---

## II. Testing Strategy Integration

How our `tests/` directory supports this architecture.

### 1. Integration Tests (`tests/integration/rls/`)

We do **not** trust RLS policies blindly. We test them.

#### Goal

Verify that User A *cannot* see User B's data.

#### Method

1. Create `User A` and `User B` (using `tests/fixtures`).
2. Log in as `User A`.
3. Attempt to fetch `User B`'s records.
4. **Expect:** Empty array or 403 Forbidden.

#### Example Test Structure

```javascript
// tests/integration/rls/profiles.test.js
describe('RLS: Profiles', () => {
  it('should prevent User A from viewing User B profile', async () => {
    // 1. Create test users
    const userA = await createTestUser({ email: 'alice@test.com' });
    const userB = await createTestUser({ email: 'bob@test.com' });
    
    // 2. Log in as User A
    const { data: sessionA } = await supabase.auth.signInWithPassword({
      email: 'alice@test.com',
      password: 'Test123!'
    });
    
    // 3. Attempt to fetch User B's profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userB.id)
      .single();
    
    // 4. Assert: Should be empty or forbidden
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});
```

### 2. Database Triggers (`tests/integration/adapters/`)

We test that the "User Profile" trigger actually fires.

#### Test: "Should create public profile when auth user is created"

**Method:** Insert into `auth.users` → Check `public.profiles`.

#### Example Test Structure

```javascript
// tests/integration/adapters/profile-trigger.test.js
describe('Profile Creation Trigger', () => {
  it('should auto-create profile when auth user is created', async () => {
    // 1. Create auth user (via Supabase Admin API)
    const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@example.com',
      password: 'Test123!',
      email_confirm: true
    });
    
    expect(error).toBeNull();
    
    // 2. Check that profile was created
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.user.id)
      .single();
    
    expect(profile).toBeTruthy();
    expect(profile.email).toBe('test@example.com');
  });
});
```

### 3. Metadata JSONB Tests (`tests/integration/adapters/`)

Test that metadata updates work correctly without breaking core data.

```javascript
// tests/integration/adapters/metadata.test.js
describe('Metadata Updates', () => {
  it('should update theme preference without affecting core data', async () => {
    const user = await createTestUser();
    
    // Update metadata
    await supabase
      .from('profiles')
      .update({ metadata: { theme: 'dark' } })
      .eq('id', user.id);
    
    // Verify core data unchanged
    const { data } = await supabase
      .from('profiles')
      .select('email, metadata')
      .eq('id', user.id)
      .single();
    
    expect(data.email).toBe(user.email);
    expect(data.metadata.theme).toBe('dark');
  });
});
```

---

## III. Summary of "Clean Code" Rules for Supabase

### 1. Foreign Keys Always

**Rule:** Never store a `user_id` as a plain string. Always use `REFERENCES auth.users(id)`.

```sql
-- ❌ BAD
CREATE TABLE orders (
  user_id TEXT  -- No foreign key constraint
);

-- ✅ GOOD
CREATE TABLE orders (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ✅ GOOD (Nexus Pattern)
CREATE TABLE nexus_cases (
  created_by_user_id UUID REFERENCES nexus_users(id) ON DELETE SET NULL
);
```

### 2. Naming Conventions: CamelCase vs Snake_case

**Rule:** Use consistent naming across layers.

| Layer | Convention | Example |
|-------|-----------|---------|
| **Postgres** | `snake_case` | `created_at`, `user_id`, `tenant_id` |
| **JavaScript** | `camelCase` | `createdAt`, `userId`, `tenantId` |
| **The Bridge** | **Adapter Layer** (`src/adapters/`) converts between them | |

#### Example: Adapter Conversion

```javascript
// src/adapters/nexus-adapter.js
async function getUser(userId) {
  const { data, error } = await supabase
    .from('nexus_users')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  
  // Convert snake_case to camelCase
  return {
    userId: data.user_id,
    tenantId: data.tenant_id,
    email: data.email,
    displayName: data.display_name,
    createdAt: data.created_at,
    preferences: data.preferences  // JSONB stays as-is
  };
}
```

### 3. No Logic in Triggers (Mostly)

**Rule:** Keep business logic in your API/Edge Functions. Use DB Triggers *only* for data integrity.

#### ✅ Allowed Trigger Use Cases

- `updated_at` timestamps
- Profile creation on user signup
- Audit logging
- Data denormalization (for performance)

#### ❌ Forbidden Trigger Use Cases

- Complex business logic
- External API calls
- Email sending
- Payment processing

#### Example: Good Trigger

```sql
-- ✅ GOOD: Simple data integrity
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nexus_users_updated_at
  BEFORE UPDATE ON nexus_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Example: Bad Trigger

```sql
-- ❌ BAD: Business logic in trigger
CREATE OR REPLACE FUNCTION process_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't do this! Use Edge Function instead.
  PERFORM http_post('https://payment-api.com/charge', ...);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. Indexes for Performance

**Rule:** Index foreign keys, frequently queried columns, and JSONB paths.

```sql
-- Foreign key indexes
CREATE INDEX idx_nexus_cases_tenant_id ON nexus_cases(tenant_id);
CREATE INDEX idx_nexus_cases_created_by ON nexus_cases(created_by_user_id);

-- JSONB GIN indexes (for metadata queries)
CREATE INDEX idx_nexus_users_preferences_gin ON nexus_users USING GIN (preferences);

-- Composite indexes (for common query patterns)
CREATE INDEX idx_nexus_cases_tenant_status ON nexus_cases(tenant_id, status);
```

### 5. Timestamps Always

**Rule:** Always include `created_at` and `updated_at` on all tables.

```sql
CREATE TABLE nexus_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... other columns ...
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## IV. Visual Architecture

Here is how the concepts connect:

```
┌─────────────┐
│  Frontend   │
│  (HTMX)    │
└──────┬──────┘
       │
       │ HTTP Requests
       │
┌──────▼─────────────────────────────────────┐
│         Express API (server.js)            │
│  - Authentication middleware               │
│  - Route handlers                          │
│  - Adapter layer (snake_case → camelCase) │
└──────┬─────────────────────────────────────┘
       │
       │ Supabase Client
       │ (with RLS context)
       │
┌──────▼─────────────────────────────────────┐
│         Supabase (PostgreSQL)              │
│  ┌─────────────────────────────────────┐  │
│  │  RLS Policies (Firewall)            │  │
│  │  - SELECT policies                  │  │
│  │  - INSERT policies                  │  │
│  │  - UPDATE policies                  │  │
│  │  - DELETE policies                  │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  Core Data (Columns)                 │  │
│  │  - email, tenant_id, status          │  │
│  │  - Indexed, searchable, relational   │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  Metadata (JSONB)                    │  │
│  │  - preferences, settings             │  │
│  │  - Flexible, non-critical           │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### Data Flow

1. **Frontend** talks to **Express API**.
2. **Express API** talks to **Supabase (Postgres)**.
3. **RLS Policies** sit between the API and the Data, acting as a filter.
4. **Metadata** sits inside the JSONB column, accessible but not enforcing schema.

---

## V. Implementation Patterns

### Pattern 1: Standard User Profile (Single-Tenant)

```sql
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );

-- 4. Create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Pattern 2: Multi-Tenant User (Nexus Pattern)

```sql
-- 1. Create nexus_users table
CREATE TABLE nexus_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'member',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE nexus_users ENABLE ROW LEVEL SECURITY;

-- 3. Create tenant-scoped policies
CREATE POLICY "Users can view own tenant users"
  ON nexus_users FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM nexus_users WHERE auth_user_id = auth.uid()
    )
  );

-- 4. Create indexes
CREATE INDEX idx_nexus_users_auth_user_id ON nexus_users(auth_user_id);
CREATE INDEX idx_nexus_users_tenant_id ON nexus_users(tenant_id);
CREATE INDEX idx_nexus_users_preferences_gin ON nexus_users USING GIN (preferences);
```

### Pattern 3: Metadata Updates

```sql
-- Update nested metadata
UPDATE profiles
SET metadata = jsonb_set(
  metadata,
  '{notifications,email}',
  'true'::jsonb
)
WHERE id = auth.uid();

-- Add metadata with version tag
UPDATE nexus_users
SET preferences = jsonb_set(
  preferences,
  '{_schema_version}',
  '2'::jsonb
)
WHERE user_id = 'USR-XXXXXXXX';
```

---

## VI. Related Documentation

### Core Architecture

- [Metadata Control Protocol](./METADATA_CONTROL_PROTOCOL.md) - **Metadata-driven architecture governance framework** - How to build business-controlled configuration
- [RLS Enforcement Architecture](./RLS_ENFORCEMENT_COMPLETE_ARCHITECTURE.md) - Detailed RLS patterns

### Core Supabase Documentation

- [Supabase Platform Capabilities](../integrations/supabase/SUPABASE_PLATFORM_CAPABILITIES.md) - Overview of all Supabase features
- [Authentication Guide](../integrations/supabase/AUTHENTICATION_GUIDE.md) - Complete auth implementation guide

### Database Design

- [Flexible Data Patterns](../integrations/supabase/database/FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. Columns decision framework
- [Evolutionary Design](../integrations/supabase/best-practices/EVOLUTIONARY_DESIGN.md) - Schema evolution strategies
- [Domain Modeling](../integrations/supabase/database/DOMAIN_MODELING.md) - Business entity modeling

### Testing

- [Testing Strategy](./TESTING_STRATEGY.md) - Complete testing architecture
- [Test Standards](../../tests/TEST_STANDARDS.md) - Testing conventions and patterns

### Optimization

- [Audit & Optimization](../integrations/supabase/SUPABASE_AUDIT_AND_OPTIMIZATION.md) - Comprehensive audit report
- [Performance Optimization](../integrations/supabase/PERFORMANCE_OPTIMIZATION_GUIDE.md) - Performance tuning guide
- [Security Hardening](../integrations/supabase/SECURITY_HARDENING_GUIDE.md) - Security best practices

---

## 🎯 Next Action Steps

Since we have set up the `tests/integration` folder, your first task should be:

1. ✅ **Move existing RLS tests** to `tests/integration/rls/`
2. ✅ **Verify they pass** - Run test suite
3. ✅ **Replace UI tests** - If you have "10 clicks" testing RLS via the UI, delete them and replace with **1 Integration Test** that checks the policy directly
4. ✅ **Add trigger tests** - Test profile creation triggers in `tests/integration/adapters/`
5. ✅ **Add metadata tests** - Test JSONB updates in `tests/integration/adapters/`

---

**Document Status:** ✅ Active  
**Last Updated:** 2025-01-22  
**Maintained By:** Architecture Team  
**Review Cycle:** Quarterly

