# Supabase MCP Dev/Superadmin Configuration Guide

## Overview

This guide explains how to properly configure Supabase MCP for development and set up a superadmin user to avoid authentication registration issues.

---

## 1. Understanding Your Setup

### Current Configuration

Your `mcp.config.json` has two Supabase connections:

1. **Remote Supabase** (`supabase`): Connected to project `ggdtgucgrgucnvfsihdt`
2. **Local Supabase** (`supabase-local`): Connected to local Postgres at `127.0.0.1:54322`

### Authentication Architecture

Your system uses a **dual authentication system**:
- **Supabase Auth** (`auth.users`) - Primary authentication
- **Legacy vmp_vendor_users** - Database user records with bcrypt passwords (fallback)

The `vmp_auth_user_mapping` table links Supabase Auth users to legacy user records.

---

## 2. Setting Up Superadmin for Development

### Step 1: Ensure User Exists in Database

The migration `038_vmp_super_admin_default_user.sql` creates a superadmin user in `vmp_vendor_users`:

```sql
-- Default superadmin user
Email: jackwee2020@gmail.com
Password: admin123 (bcrypt hashed)
```

**To verify the user exists:**

```bash
# Using Supabase MCP (local)
# Check if user exists in vmp_vendor_users
```

Or run the validation script:

```bash
node scripts/validate-super-admin.js
```

### Step 2: Create User in Supabase Auth

**CRITICAL**: The user must exist in **both** places:
1. ✅ `vmp_vendor_users` table (created by migration)
2. ❌ `auth.users` table (Supabase Auth) - **Must be created manually**

**Use the provided script:**

```bash
node scripts/create-super-admin.js jackwee2020@gmail.com <your-password>
```

This script will:
- ✅ Verify user exists in `vmp_vendor_users`
- ✅ Create/update user in Supabase Auth
- ✅ Set password in Supabase Auth
- ✅ Auto-confirm email (no email verification needed)
- ✅ Create mapping in `vmp_auth_user_mapping`
- ✅ Set user metadata (vendor_id, is_internal, etc.)

### Step 3: Verify Superadmin Status

A superadmin user must have:
- `is_super_admin = true` in `vmp_vendor_users`
- `scope_group_id = NULL` (no group restriction)
- `scope_company_id = NULL` (no company restriction)
- `is_internal = true` (internal staff)

**Check superadmin status:**

```bash
node scripts/validate-super-admin.js
```

---

## 3. MCP Configuration for Development

### Option A: Use Local Supabase (Recommended for Dev)

For local development, use the `supabase-local` MCP server:

```json
{
  "supabase-local": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"]
  }
}
```

**Prerequisites:**
1. Start local Supabase:
   ```bash
   supabase start
   ```

2. Ensure migrations are applied:
   ```bash
   supabase db reset  # Applies all migrations
   ```

3. Create superadmin in local Supabase Auth:
   ```bash
   # Set environment variables for local Supabase
   export SUPABASE_URL=http://127.0.0.1:54321
   export SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
   
   # Get service role key from:
   supabase status
   
   # Then create superadmin
   node scripts/create-super-admin.js jackwee2020@gmail.com <password>
   ```

### Option B: Use Remote Supabase

For remote Supabase, ensure you have:

1. **Access Token** for MCP:
   - Get from: https://supabase.com/dashboard/account/tokens
   - Set in MCP config: `SUPABASE_ACCESS_TOKEN`

2. **Project Reference**:
   - Already configured: `ggdtgucgrgucnvfsihdt`
   - Find in: Supabase Dashboard → Project Settings → General

3. **Environment Variables**:
   ```bash
   SUPABASE_URL=https://ggdtgucgrgucnvfsihdt.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   SUPABASE_ANON_KEY=<your-anon-key>
   ```

---

## 4. Common Issues and Solutions

### Issue 1: "User not found in Supabase Auth"

**Symptom:**
```
❌ User NOT found in Supabase Auth
```

**Solution:**
```bash
# Create user in Supabase Auth
node scripts/create-super-admin.js jackwee2020@gmail.com <password>
```

### Issue 2: "Login failed - Invalid credentials"

**Possible Causes:**
1. User exists in database but not in Supabase Auth
2. Password mismatch between database and Supabase Auth
3. Email not confirmed in Supabase Auth

**Solution:**
```bash
# Recreate user in Supabase Auth with correct password
node scripts/create-super-admin.js jackwee2020@gmail.com <new-password>
```

### Issue 3: "User is NOT a super admin"

**Symptom:**
```
⚠️  User is NOT a super admin
   - Scope Group: <some-uuid>
   - Scope Company: <some-uuid>
```

**Solution:**
```sql
-- Make user a superadmin (remove scope restrictions)
UPDATE vmp_vendor_users 
SET 
  scope_group_id = NULL,
  scope_company_id = NULL,
  is_super_admin = true,
  is_internal = true
WHERE email = 'jackwee2020@gmail.com';
```

### Issue 4: MCP Connection Fails

**For Local Supabase:**
```bash
# Check if Supabase is running
supabase status

# If not running, start it
supabase start

# Verify connection
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"
```

**For Remote Supabase:**
1. Verify `SUPABASE_ACCESS_TOKEN` is set correctly
2. Check project reference matches: `ggdtgucgrgucnvfsihdt`
3. Ensure token has proper permissions

---

## 5. Complete Setup Checklist

### Local Development Setup

- [ ] Start local Supabase: `supabase start`
- [ ] Apply migrations: `supabase db reset`
- [ ] Verify superadmin exists in `vmp_vendor_users` (migration 038)
- [ ] Set environment variables:
  ```bash
  SUPABASE_URL=http://127.0.0.1:54321
  SUPABASE_SERVICE_ROLE_KEY=<from-supabase-status>
  ```
- [ ] Create superadmin in Supabase Auth:
  ```bash
  node scripts/create-super-admin.js jackwee2020@gmail.com <password>
  ```
- [ ] Verify setup:
  ```bash
  node scripts/validate-super-admin.js
  ```
- [ ] Test login at: `http://localhost:9000/login`

### Remote Supabase Setup

- [ ] Get Supabase Access Token from dashboard
- [ ] Set `SUPABASE_ACCESS_TOKEN` in MCP config
- [ ] Verify project reference: `ggdtgucgrgucnvfsihdt`
- [ ] Set environment variables:
  ```bash
  SUPABASE_URL=https://ggdtgucgrgucnvfsihdt.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<from-dashboard>
  SUPABASE_ANON_KEY=<from-dashboard>
  ```
- [ ] Create superadmin in Supabase Auth:
  ```bash
  node scripts/create-super-admin.js jackwee2020@gmail.com <password>
  ```
- [ ] Verify setup:
  ```bash
  node scripts/validate-super-admin.js
  ```

---

## 6. Quick Reference Commands

```bash
# Validate superadmin setup
node scripts/validate-super-admin.js

# Create/update superadmin in Supabase Auth
node scripts/create-super-admin.js <email> <password>

# Check local Supabase status
supabase status

# Reset local database (applies all migrations)
supabase db reset

# Start local Supabase
supabase start

# Stop local Supabase
supabase stop
```

---

## 7. Security Best Practices

1. **Never commit passwords** - Use environment variables
2. **Change default password** - `admin123` is for development only
3. **Use strong passwords** - Minimum 8 characters, mixed case, numbers
4. **Rotate service role keys** - Regularly in production
5. **Limit superadmin access** - Only grant to trusted developers
6. **Use local Supabase for dev** - Avoid using production credentials

---

## 8. Troubleshooting

### Check Supabase Auth Users

```sql
-- Using Supabase MCP or direct SQL
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'jackwee2020@gmail.com';
```

### Check vmp_vendor_users

```sql
SELECT id, email, is_super_admin, is_internal, scope_group_id, scope_company_id
FROM vmp_vendor_users 
WHERE email = 'jackwee2020@gmail.com';
```

### Check Mapping

```sql
SELECT * FROM vmp_auth_user_mapping 
WHERE email = 'jackwee2020@gmail.com';
```

---

## Summary

**Key Points:**
1. ✅ Superadmin must exist in **both** `vmp_vendor_users` AND `auth.users`
2. ✅ Use `create-super-admin.js` script to create user in Supabase Auth
3. ✅ Superadmin requires `scope_group_id = NULL` and `scope_company_id = NULL`
4. ✅ For local dev, use `supabase-local` MCP server
5. ✅ Always verify setup with `validate-super-admin.js`

**Quick Start:**
```bash
# 1. Start local Supabase
supabase start

# 2. Create superadmin
node scripts/create-super-admin.js jackwee2020@gmail.com <password>

# 3. Verify
node scripts/validate-super-admin.js
```

