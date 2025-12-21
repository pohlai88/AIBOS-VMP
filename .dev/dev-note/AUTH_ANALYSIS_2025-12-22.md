# Auth Logic Analysis — VMP Workspace & Database

**Date:** 2025-12-22  
**Tool:** Supabase MCP  
**Status:** Gap Analysis Complete

---

## Database State (Supabase)

### ✅ Auth Tables Exist

#### `auth.users` (Supabase Auth — 5 users)
- **Status:** Populated but **NOT USED** by VMP
- **Users:**
  - `jackwee@ai-bos.io` (confirmed, last sign-in: 2025-12-19)
  - `jackwee2020@gmail.com` (confirmed, last sign-in: 2025-12-20)
  - `testing@gmail.com` (unconfirmed)
  - `diagnostic-test-20251220120602@gmail.com` (unconfirmed)
  - `testuser20251220114346@gmail.com` (unconfirmed)

#### `auth.sessions` (Supabase Auth — 3 active sessions)
- **Status:** Populated but **NOT USED** by VMP
- **Sessions:** All linked to `auth.users` IDs

#### `public.vmp_vendor_users` (VMP Custom Auth — 1 user)
- **Status:** ✅ **EXISTS AND READY**
- **User:**
  ```json
  {
    "id": "0bf802f3-38b1-40ed-88f7-45bff4150e16",
    "email": "admin@acme.com",
    "vendor_id": "11fd9cff-a017-4708-a2f6-3575ba4827d5",
    "is_active": true,
    "created_at": "2025-12-20 13:09:19"
  }
  ```
- **Note:** Has `password_hash` column (nullable) — ready for password auth

#### `public.vmp_sessions` (VMP Custom Sessions — 0 sessions)
- **Status:** ✅ **TABLE EXISTS** but empty
- **Schema:**
  - `id` (text, PK)
  - `user_id` (uuid, FK → `vmp_vendor_users.id`)
  - `expires_at` (timestamptz)
  - `data` (jsonb, default: `{}`)

---

## Workspace Code State

### ❌ Current Implementation (Mock Auth)

**File:** `server.js` (lines 103-114)

```javascript
// --- MIDDLEWARE: Mock Auth (Phase 0 shortcut) ---
app.use((req, res, next) => {
  if (!req.session.userId) {
    // AUTO-LOGIN as the Seed User for Demo
    req.user = { id: 'seed-user-id', name: 'Acme Admin' };
  }
  next();
});
```

**Problems:**
1. ❌ No real user lookup
2. ❌ No password verification
3. ❌ No session creation in `vmp_sessions` table
4. ❌ Hardcoded user object
5. ❌ Cookie session configured but `req.session.userId` never set

### ✅ Adapter Method Exists (But Unused)

**File:** `src/adapters/supabase.js` (lines 52-70)

```javascript
async getVendorContext(userId) {
  // Queries vmp_vendor_users with vendor relationship
  // Returns: { id, display_name, vendor_id, vmp_vendors: {...} }
}
```

**Status:** Method exists but **NEVER CALLED** in server.js

### ❌ Missing Components

1. **Login POST Handler**
   - No route: `POST /login`
   - No password verification logic
   - No session creation

2. **Session Lookup Middleware**
   - No lookup in `vmp_sessions` table
   - No validation of `expires_at`
   - No user context loading via `getVendorContext()`

3. **Password Hashing/Verification**
   - No bcrypt or similar library
   - No password comparison logic
   - `password_hash` column exists but unused

4. **Logout Handler**
   - No route: `POST /logout`
   - No session deletion

---

## Gap Analysis

### What Works ✅
- Database tables exist and are properly structured
- Cookie session middleware configured
- Adapter method `getVendorContext()` exists
- Vendor user exists in database (`admin@acme.com`)

### What's Missing ❌
1. **Password Verification**
   - Need: bcrypt compare function
   - Need: Query `vmp_vendor_users` by email
   - Need: Verify `password_hash` against input

2. **Session Management**
   - Need: Create session in `vmp_sessions` on login
   - Need: Lookup session by ID from cookie
   - Need: Validate `expires_at` timestamp
   - Need: Delete expired sessions

3. **Login Flow**
   - Need: `POST /login` endpoint
   - Need: Email/password validation
   - Need: Set `req.session.userId` and `req.session.sessionId`
   - Need: Redirect to `/home` on success

4. **Auth Middleware**
   - Need: Replace mock auth with real session lookup
   - Need: Call `getVendorContext()` to load user
   - Need: Set `req.user` with real data
   - Need: Redirect to `/login` if no valid session

5. **Logout Flow**
   - Need: `POST /logout` endpoint
   - Need: Delete session from `vmp_sessions`
   - Need: Clear cookie
   - Need: Redirect to `/login`

---

## Recommended Implementation Plan

### Phase 1: Password Auth (Day 2 Completion)

1. **Install Dependencies**
   ```bash
   npm install bcrypt
   ```

2. **Add Password Methods to Adapter**
   ```javascript
   // src/adapters/supabase.js
   async getUserByEmail(email) { ... }
   async verifyPassword(userId, password) { ... }
   async createSession(userId) { ... }
   async getSession(sessionId) { ... }
   async deleteSession(sessionId) { ... }
   ```

3. **Create Login POST Handler**
   ```javascript
   // server.js
   app.post('/login', async (req, res) => {
     // 1. Get email/password from body
     // 2. Query vmp_vendor_users by email
     // 3. Verify password_hash
     // 4. Create session in vmp_sessions
     // 5. Set req.session.userId and req.session.sessionId
     // 6. Redirect to /home
   });
   ```

4. **Replace Mock Auth Middleware**
   ```javascript
   // server.js
   app.use(async (req, res, next) => {
     const sessionId = req.session.sessionId;
     if (!sessionId) {
       return res.redirect('/login');
     }
     
     // Lookup session in vmp_sessions
     const session = await vmpAdapter.getSession(sessionId);
     if (!session || session.expires_at < new Date()) {
       return res.redirect('/login');
     }
     
     // Load user context
     req.user = await vmpAdapter.getVendorContext(session.user_id);
     next();
   });
   ```

5. **Create Logout Handler**
   ```javascript
   app.post('/logout', async (req, res) => {
     await vmpAdapter.deleteSession(req.session.sessionId);
     req.session = null;
     res.redirect('/login');
   });
   ```

---

## Database Schema Validation

### ✅ Tables Ready
- `vmp_vendor_users` — User accounts with password_hash
- `vmp_sessions` — Session storage
- `vmp_vendors` — Vendor relationship
- `vmp_companies` — Company relationship

### ⚠️ Missing (Optional)
- `vmp_password_reset_tokens` — For "forgot password" flow
- `vmp_login_attempts` — For rate limiting/security

---

## Next Steps

1. **Immediate:** Implement password auth (Phase 1 above)
2. **Short-term:** Add password reset flow
3. **Long-term:** Consider Supabase Auth integration (if needed for SSO)

---

## Notes

- **Current State:** Mock auth allows development to continue without blocking
- **Database:** All required tables exist and are properly structured
- **Adapter:** `getVendorContext()` method ready but unused
- **Security:** Password hashing needed before production

