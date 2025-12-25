# Revert to Supabase Auth - Migration Plan

**Date:** 2025-12-22  
**Issue:** System was changed from Supabase Auth to custom auth without approval  
**Action:** Revert to Supabase Auth while preserving all data and relationships

## What Happened

1. **Migration 002** (`002_vmp_vendor_users_sessions.sql`) was created on 2025-12-22
2. This migration created custom authentication tables (`vmp_vendor_users`, `vmp_sessions`)
3. The login route was changed to use custom auth instead of Supabase Auth
4. **No git history available** to determine who made the change

## Current State

- **Supabase Auth:** 4 users in `auth.users`
- **Custom Auth:** 5 users in `vmp_vendor_users`
- **No overlap:** Users are different between the two systems

## Revert Plan

### Step 1: Migrate Users to Supabase Auth

Run the migration script to move `vmp_vendor_users` to `auth.users`:

```bash
node scripts/revert-to-supabase-auth.js
```

This will:
- Create users in `auth.users` with email confirmation
- Store vendor relationships in `user_metadata` (vendor_id, display_name, etc.)
- Set temporary passwords (users must reset via "Forgot Password")

### Step 2: Update Login Route

Replace custom auth login with Supabase Auth:

**Before (Custom Auth):**
```javascript
const user = await vmpAdapter.getUserByEmail(email);
const isValid = await vmpAdapter.verifyPassword(user.id, password);
```

**After (Supabase Auth):**
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});
```

### Step 3: Update Password Reset

Replace custom password reset with Supabase Auth:

**Before (Custom Auth):**
```javascript
await vmpAdapter.createPasswordResetToken(email);
await sendPasswordResetEmail(...);
```

**After (Supabase Auth):**
```javascript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${BASE_URL}/reset-password`
});
// Supabase handles email sending automatically
```

### Step 4: Update Auth Middleware

Replace custom session lookup with Supabase Auth session:

**Before (Custom Auth):**
```javascript
const userContext = await vmpAdapter.getVendorContext(req.session.userId);
```

**After (Supabase Auth):**
```javascript
const { data: { user } } = await supabase.auth.getUser(sessionToken);
const vendorId = user.user_metadata.vendor_id;
```

### Step 5: Preserve Vendor Relationships

Vendor relationships will be stored in `user_metadata`:
- `vendor_id`: UUID of the vendor
- `display_name`: User's display name
- `is_active`: Account status
- `vmp_user_id`: Link back to original `vmp_vendor_users` record (for reference)

## Benefits of Reverting

1. **Built-in Email Sending:** Supabase Auth handles password reset emails automatically
2. **No Custom Email Config:** No need for SendGrid/Resend/SMTP setup
3. **Security:** Supabase Auth has built-in security features (rate limiting, etc.)
4. **Less Code:** Simpler authentication logic
5. **Standard:** Uses Supabase's standard authentication system

## Risks

1. **Password Reset Required:** All users will need to reset their passwords (temporary passwords set)
2. **Session Migration:** Existing sessions will be invalidated
3. **Testing Required:** Need to test all authentication flows

## Rollback Plan

If issues occur, you can:
1. Restore from database backup
2. Re-run migration 002 to restore custom auth
3. Revert code changes via git

## Next Steps

1. **Backup Database:** Create a full database backup before proceeding
2. **Run Migration Script:** Execute `node scripts/revert-to-supabase-auth.js`
3. **Update Code:** Modify `server.js` to use Supabase Auth
4. **Test:** Verify login, password reset, and session management
5. **Notify Users:** Inform users they need to reset passwords

