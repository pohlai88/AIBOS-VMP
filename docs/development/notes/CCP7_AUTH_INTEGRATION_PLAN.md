# CCP-7: Supabase Auth Integration Plan for Nexus Portal

> **Status:** 📋 PLANNING | Created: 2025-12-25
> **Objective:** Migrate Nexus Portal from custom bcrypt auth to Supabase Auth with OAuth support

---

## 📊 Current State Analysis

### Nexus Portal (NEW - Custom Auth)
| Component | Implementation | File |
|-----------|---------------|------|
| Password Storage | bcrypt hash in `nexus_users.password_hash` | nexus-context.js:362 |
| Session Management | Custom `nexus_sessions` table | nexus-adapter.js |
| Login | Email + password → bcrypt verify | nexus-portal.js:65 |
| Sign-up | Create user + bcrypt hash | nexus-portal.js:145 |
| Cookie | `nexus_session` (session ID) | nexus-context.js |

### Legacy VMP (EXISTING - Supabase Auth)
| Component | Implementation | File |
|-----------|---------------|------|
| Password Storage | Supabase Auth (`auth.users`) | server.js:136 |
| Session Management | Supabase Auth tokens + custom session | server.js:592 |
| Login | `supabaseAuth.auth.signInWithPassword()` | server.js |
| Sign-up | `supabaseAdmin.auth.admin.inviteUserByEmail()` | server.js:8335 |
| OAuth | Supported (Google, GitHub configurable) | Supabase Dashboard |

### Key Insight
Legacy VMP already has Supabase Auth working. Nexus Portal should **align with legacy pattern** for:
1. Consistent user experience
2. Single auth source of truth (`auth.users`)
3. Future SSO/OAuth support
4. RLS policies can use `auth.uid()`

---

## 🎯 Integration Strategy

### Option A: Full Supabase Auth Migration ⭐ RECOMMENDED
Replace `nexus_users.password_hash` with Supabase Auth, link via `auth_user_id`

**Pros:**
- Single auth source (`auth.users`)
- Built-in OAuth (Google, GitHub, etc.)
- Password reset emails via Supabase
- RLS can use `auth.uid()`
- Consistent with legacy VMP

**Cons:**
- Migration complexity for existing `nexus_users`
- Need to sync `auth.users` ↔ `nexus_users`

### Option B: Hybrid Auth (Keep Both)
Keep bcrypt for password, add optional OAuth

**Pros:**
- Less disruptive
- Gradual migration

**Cons:**
- Two auth systems to maintain
- Inconsistent with legacy VMP
- Can't use RLS `auth.uid()`

**Decision: Option A** - Align with legacy VMP pattern

---

## 🔄 Migration Plan

### Phase 1: Schema Update (via Supabase MCP)

```sql
-- Add auth_user_id column to nexus_users
ALTER TABLE nexus_users
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for fast lookup
CREATE INDEX idx_nexus_users_auth_user_id ON nexus_users(auth_user_id);

-- Add function to get nexus user from auth user
CREATE OR REPLACE FUNCTION get_nexus_user_by_auth_id(p_auth_id UUID)
RETURNS nexus_users AS $$
  SELECT * FROM nexus_users WHERE auth_user_id = p_auth_id;
$$ LANGUAGE SQL STABLE;
```

### Phase 2: Sync Demo Users to auth.users

Create auth.users entries for existing demo users:

| nexus_users Email | auth.users Entry | tenant_id Metadata |
|-------------------|------------------|-------------------|
| alice@alpha.com | ✅ Create | TNT-ALPH0001 |
| alex@alpha.com | ✅ Create | TNT-ALPH0001 |
| bob@beta.com | ✅ Create | TNT-BETA0001 |
| bella@beta.com | ✅ Create | TNT-BETA0001 |
| grace@gamma.com | ✅ Create | TNT-GAMM0001 |
| gary@gamma.com | ✅ Create | TNT-GAMM0001 |
| dan@delta.com | ✅ Create | TNT-DELT0001 |
| diana@delta.com | ✅ Create | TNT-DELT0001 |

**Password:** Same `Demo123!` for all demo users

### Phase 3: Update Nexus Adapter

Add Supabase Auth methods to `nexus-adapter.js`:

```javascript
// New auth methods
async signIn(email, password) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

async signUp(email, password, metadata) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata
  });
  if (error) throw error;
  return data;
}

async signOut(accessToken) {
  // Invalidate Supabase session
}

async getAuthUser(accessToken) {
  const { data, error } = await supabaseAuth.auth.getUser(accessToken);
  if (error) throw error;
  return data.user;
}

// OAuth methods
async signInWithOAuth(provider) {
  // Generate OAuth URL for redirect
}

async handleOAuthCallback(code) {
  // Exchange code for session
}
```

### Phase 4: Update Routes

Modify `nexus-portal.js`:

#### Login Route
```javascript
// Before: bcrypt verify against nexus_users.password_hash
// After: supabaseAuth.auth.signInWithPassword()

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Authenticate with Supabase Auth
  const { data: authData, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.render('nexus/pages/login', { error: 'Invalid credentials' });
  }

  // Get nexus_user by auth_user_id
  const nexusUser = await nexusAdapter.getUserByAuthId(authData.user.id);

  // Create nexus session with auth tokens
  const session = await nexusAdapter.createSession({
    userId: nexusUser.user_id,
    tenantId: nexusUser.tenant_id,
    authToken: authData.session.access_token,
    refreshToken: authData.session.refresh_token
  });

  res.cookie('nexus_session', session.id, { httpOnly: true, secure: true });
  res.redirect('/nexus/portal');
});
```

#### Sign-up Route
```javascript
// Before: bcrypt hash → nexus_users
// After: Supabase Auth → link to nexus_users

router.post('/sign-up', async (req, res) => {
  const { email, password, companyName } = req.body;

  // Create Supabase Auth user
  const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name: companyName }
  });

  if (error) {
    return res.render('nexus/pages/sign-up', { error: error.message });
  }

  // Create tenant and nexus_user
  const tenant = await nexusAdapter.createTenant({ name: companyName });
  const user = await nexusAdapter.createUser({
    email,
    name: companyName,
    tenantId: tenant.tenant_id,
    authUserId: authUser.user.id  // Link to auth.users
  });

  // Create session
  // ...
});
```

### Phase 5: OAuth Integration

#### Supabase Dashboard Configuration
1. Go to Authentication → Providers
2. Enable desired providers:
   - **Google:** Add Client ID + Secret
   - **GitHub:** Add Client ID + Secret
   - **Microsoft:** Add Tenant ID + Client ID + Secret

#### Add OAuth Routes
```javascript
// OAuth initiation
router.get('/oauth/:provider', (req, res) => {
  const { provider } = req.params;
  const redirectUrl = `${BASE_URL}/nexus/oauth/callback`;

  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl
    }
  });

  res.redirect(data.url);
});

// OAuth callback
router.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);

  if (error) {
    return res.redirect('/nexus/login?error=oauth_failed');
  }

  // Check if nexus_user exists for this auth user
  let nexusUser = await nexusAdapter.getUserByAuthId(data.user.id);

  if (!nexusUser) {
    // First-time OAuth user - create tenant and user
    // Or redirect to complete profile page
    return res.redirect('/nexus/complete-profile');
  }

  // Create session
  const session = await nexusAdapter.createSession({
    userId: nexusUser.user_id,
    tenantId: nexusUser.tenant_id,
    authToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });

  res.cookie('nexus_session', session.id, { httpOnly: true, secure: true });
  res.redirect('/nexus/portal');
});
```

### Phase 6: Email Integration

Supabase Auth handles emails automatically:
- **Invite emails:** `admin.inviteUserByEmail()`
- **Password reset:** `auth.resetPasswordForEmail()`
- **Email confirmation:** Automatic on sign-up

#### Custom Email Templates (Supabase Dashboard)
1. Go to Authentication → Email Templates
2. Customize:
   - Confirm signup
   - Invite user
   - Magic Link
   - Change Email Address
   - Reset Password

---

## 📋 Implementation Checklist

### Migration Tasks
| # | Task | Status | Command/File |
|---|------|--------|--------------|
| 1.1 | Add `auth_user_id` to nexus_users | ❌ Todo | MCP: apply_migration |
| 1.2 | Create auth.users for demo users | ❌ Todo | MCP: execute_sql |
| 1.3 | Link demo users to auth.users | ❌ Todo | MCP: execute_sql |

### Adapter Updates
| # | Task | Status | File |
|---|------|--------|------|
| 2.1 | Add `supabaseAuth` client | ❌ Todo | nexus-adapter.js |
| 2.2 | Add `signIn()` method | ❌ Todo | nexus-adapter.js |
| 2.3 | Add `signUp()` method | ❌ Todo | nexus-adapter.js |
| 2.4 | Add `getUserByAuthId()` method | ❌ Todo | nexus-adapter.js |
| 2.5 | Add `signInWithOAuth()` method | ❌ Todo | nexus-adapter.js |

### Route Updates
| # | Task | Status | File |
|---|------|--------|------|
| 3.1 | Update POST /login | ❌ Todo | nexus-portal.js |
| 3.2 | Update POST /sign-up | ❌ Todo | nexus-portal.js |
| 3.3 | Add GET /oauth/:provider | ❌ Todo | nexus-portal.js |
| 3.4 | Add GET /oauth/callback | ❌ Todo | nexus-portal.js |
| 3.5 | Add POST /forgot-password | ❌ Todo | nexus-portal.js |
| 3.6 | Add GET/POST /reset-password | ❌ Todo | nexus-portal.js |

### Middleware Updates
| # | Task | Status | File |
|---|------|--------|------|
| 4.1 | Store auth tokens in session | ❌ Todo | nexus-context.js |
| 4.2 | Add token refresh logic | ❌ Todo | nexus-context.js |
| 4.3 | Validate auth token on load | ❌ Todo | nexus-context.js |

### UI Updates
| # | Task | Status | File |
|---|------|--------|------|
| 5.1 | Add OAuth buttons to login | ❌ Todo | login.html |
| 5.2 | Add OAuth buttons to sign-up | ❌ Todo | sign-up.html |
| 5.3 | Create forgot-password page | ❌ Todo | forgot-password.html |
| 5.4 | Create reset-password page | ❌ Todo | reset-password.html |

### Supabase Dashboard Config
| # | Task | Status | Location |
|---|------|--------|----------|
| 6.1 | Enable Google OAuth | ❌ Todo | Auth → Providers |
| 6.2 | Enable GitHub OAuth | ❌ Todo | Auth → Providers |
| 6.3 | Set Site URL | ❌ Todo | Auth → URL Config |
| 6.4 | Customize email templates | ❌ Todo | Auth → Email Templates |

---

## 🔧 Supabase MCP Commands

### 1. Schema Migration
```sql
-- Run via mcp_supabase_apply_migration
ALTER TABLE nexus_users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nexus_users_auth_user_id
ON nexus_users(auth_user_id);
```

### 2. Create Auth Users for Demo Data
```sql
-- Must use Supabase Admin API, not raw SQL
-- Use nexus-adapter.js to call supabaseAdmin.auth.admin.createUser()
```

### 3. Verify Integration
```sql
SELECT
  nu.user_id,
  nu.email,
  nu.auth_user_id,
  au.email as auth_email,
  au.raw_app_meta_data->>'provider' as provider
FROM nexus_users nu
LEFT JOIN auth.users au ON nu.auth_user_id = au.id
WHERE nu.data_source = 'demo';
```

---

## ⚠️ Migration Considerations

### Backward Compatibility
- Keep `password_hash` column during transition
- Support both auth methods temporarily
- Migrate users gradually

### Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Use `SUPABASE_ANON_KEY` for auth operations
- Store auth tokens securely (httpOnly cookies)

### Session Management
- Nexus session stores: user_id, tenant_id, context
- Add: auth_token, refresh_token
- Handle token refresh in middleware

### RLS Enhancement
After migration, can use `auth.uid()` in RLS policies:
```sql
CREATE POLICY "Users can read own tenant" ON nexus_cases
FOR SELECT USING (
  client_id = (SELECT tenant_client_id FROM nexus_users WHERE auth_user_id = auth.uid())
  OR
  vendor_id = (SELECT tenant_vendor_id FROM nexus_users WHERE auth_user_id = auth.uid())
);
```

---

## 📅 Execution Order

1. **Phase 1:** Schema update (add `auth_user_id`) - 10 min
2. **Phase 2:** Create auth users for demo data - 15 min
3. **Phase 3:** Update nexus-adapter with auth methods - 30 min
4. **Phase 4:** Update routes (login, sign-up) - 45 min
5. **Phase 5:** Add OAuth routes - 30 min
6. **Phase 6:** Add password reset routes - 20 min
7. **Phase 7:** Update UI templates - 30 min
8. **Phase 8:** Configure Supabase Dashboard - 15 min
9. **Phase 9:** E2E testing - 30 min

**Total Estimated Time:** ~4 hours

---

## 🚀 Ready to Proceed?

Confirm to start with:
1. **Phase 1:** Apply schema migration via Supabase MCP
2. **Phase 2:** Create auth.users for demo users

Reply with `proceed` to begin implementation.
