# Auth Migration Cleanup Plan

**Date:** 2025-12-22  
**Status:** In Progress  
**Goal:** Clean up old custom auth system and prevent broken linkages

## Migration Reason

### Why We Migrated Back to Supabase Auth

1. **Email Functionality Broken:** Custom auth required separate email service configuration (SendGrid/Resend/SMTP), which was not set up, causing password reset emails to fail.

2. **Maintenance Overhead:** Custom auth required maintaining:
   - Password hashing logic
   - Token generation and validation
   - Email sending infrastructure
   - Session management
   - Security best practices (rate limiting, token expiration, etc.)

3. **Supabase Auth Benefits:**
   - Built-in email sending (no external service needed)
   - Automatic security features (rate limiting, token management)
   - Standard authentication patterns
   - Less code to maintain
   - Better security out of the box

4. **Original Change:** The system was changed from Supabase Auth to custom auth on 2025-12-22 without approval, breaking email functionality.

## Current State Analysis

### Old Custom Auth Data Still Exists

1. **vmp_vendor_users table:**
   - 5 users with passwords
   - All users migrated to Supabase Auth
   - **Status:** Can be archived but NOT deleted (foreign key dependencies)

2. **vmp_password_reset_tokens table:**
   - 4 tokens (1 active, 4 valid)
   - **Status:** Can be safely deleted (no longer used)

3. **vmp_sessions table:**
   - Custom session storage
   - **Status:** Can be safely deleted (using express-session now)

### Critical Dependencies

**Tables that reference `vmp_vendor_users.id` (MUST preserve):**
- `vmp_break_glass_events` (user_id, director_user_id)
- `vmp_cases` (assigned_to_user_id)
- `vmp_groups` (director_user_id)
- `vmp_messages` (sender_user_id)

**Solution:** Create mapping table `vmp_auth_user_mapping` to link `auth.users.id` → `vmp_vendor_users.id`

## Cleanup Plan

### Phase 1: Create Mapping Table (COMPLETED ✅)

```sql
CREATE TABLE vmp_auth_user_mapping (
    id UUID PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    vmp_user_id UUID REFERENCES vmp_vendor_users(id),
    email TEXT NOT NULL
);
```

This preserves foreign key relationships while using Supabase Auth.

### Phase 2: Update Code References

**Files to Update:**

1. **`src/adapters/supabase.js`:**
   - `getVendorContext()` - Update to use auth.users instead of vmp_vendor_users
   - `getUserByEmail()` - Mark as deprecated or remove
   - `verifyPassword()` - Remove (Supabase Auth handles this)
   - `createPasswordResetToken()` - Remove (Supabase Auth handles this)
   - `updatePasswordWithToken()` - Remove (Supabase Auth handles this)

2. **`server.js`:**
   - All `getVendorContext()` calls - Update to use auth.users
   - Remove any remaining custom auth references

### Phase 3: Clean Up Old Tables

**Safe to Delete:**
- `vmp_password_reset_tokens` (no dependencies)
- `vmp_sessions` (no dependencies, using express-session)

**Must Keep (with mapping):**
- `vmp_vendor_users` (has foreign key dependencies)
  - Archive: Mark as read-only
  - Keep for foreign key integrity
  - Use mapping table for lookups

### Phase 4: Update Foreign Key References (Future)

**Long-term solution:** Migrate foreign keys to use `auth.users.id` directly:
- Update `vmp_break_glass_events.user_id` → `auth.users.id`
- Update `vmp_cases.assigned_to_user_id` → `auth.users.id`
- Update `vmp_groups.director_user_id` → `auth.users.id`
- Update `vmp_messages.sender_user_id` → `auth.users.id`

**Note:** This requires data migration and should be done carefully.

## Implementation Steps

### Step 1: Update getVendorContext() ✅

Update to fetch from auth.users instead of vmp_vendor_users:

```javascript
async getVendorContext(authUserId) {
    // Get user from Supabase Auth
    const { data: { user }, error } = await supabase.auth.admin.getUserById(authUserId);
    
    if (error || !user) {
        return null;
    }
    
    // Get vendor from user_metadata
    const vendorId = user.user_metadata?.vendor_id;
    const vendor = await this.getVendorById(vendorId);
    
    return {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name,
        vendor_id: vendorId,
        vmp_vendors: vendor,
        is_internal: user.user_metadata?.is_internal || false,
        is_active: user.user_metadata?.is_active !== false
    };
}
```

### Step 2: Clean Up Old Password Reset Tokens

```sql
-- Delete old password reset tokens (no longer needed)
DELETE FROM vmp_password_reset_tokens;
DROP TABLE IF EXISTS vmp_password_reset_tokens;
```

### Step 3: Clean Up Old Sessions

```sql
-- Delete old custom sessions (using express-session now)
DELETE FROM vmp_sessions;
DROP TABLE IF EXISTS vmp_sessions;
```

### Step 4: Archive vmp_vendor_users

```sql
-- Mark table as read-only (add comment)
COMMENT ON TABLE vmp_vendor_users IS 'ARCHIVED: Users migrated to Supabase Auth. Use vmp_auth_user_mapping for lookups.';

-- Remove password_hash column (security: no longer needed)
ALTER TABLE vmp_vendor_users DROP COLUMN IF EXISTS password_hash;
```

## Prevention Strategy

### To Avoid Broken Linkages:

1. **Always use mapping table** when converting between auth.users.id and vmp_vendor_users.id
2. **Update foreign keys gradually** - migrate one table at a time
3. **Keep vmp_vendor_users** until all foreign keys are migrated
4. **Document all dependencies** before making changes
5. **Test thoroughly** after each migration step

## Rollback Plan

If issues occur:
1. Users are already in Supabase Auth (can't rollback easily)
2. Keep vmp_vendor_users table for foreign key integrity
3. Use mapping table for lookups
4. Gradually migrate foreign keys

## Status

- [x] Create mapping table
- [x] Populate mapping table
- [ ] Update getVendorContext() to use Supabase Auth
- [ ] Remove old password reset methods
- [ ] Clean up old password reset tokens table
- [ ] Clean up old sessions table
- [ ] Archive vmp_vendor_users table
- [ ] Update all code references
- [ ] Test all functionality
- [ ] Document final state

