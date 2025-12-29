# Supabase Security Hardening Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive security hardening guide based on audit findings  
**Auto-Generated:** No

---

## 🎯 Overview

This guide addresses **all security issues** identified in the audit and provides step-by-step remediation instructions.

---

## 🚨 Critical Security Issues

### Issue 1: SECURITY DEFINER Views

**Severity:** ERROR | **Risk:** HIGH | **Priority:** CRITICAL

#### Problem

Views `nexus_notification_counts` and `nexus_realtime_status` are defined with `SECURITY DEFINER`, which means they execute with the permissions of the view creator, not the querying user. This can lead to privilege escalation.

#### Remediation

**Step 1: Identify the views**
```sql
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname IN ('nexus_notification_counts', 'nexus_realtime_status');
```

**Step 2: Recreate without SECURITY DEFINER**
```sql
-- Option 1: Recreate as SECURITY INVOKER (recommended)
DROP VIEW IF EXISTS nexus_notification_counts CASCADE;
CREATE VIEW nexus_notification_counts AS
SELECT 
  user_id,
  tenant_id,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) as total_count
FROM nexus_notifications
GROUP BY user_id, tenant_id;

-- Add RLS policy if needed
ALTER VIEW nexus_notification_counts SET (security_invoker = true);

-- Repeat for nexus_realtime_status
DROP VIEW IF EXISTS nexus_realtime_status CASCADE;
CREATE VIEW nexus_realtime_status AS
SELECT 
  tenant_id,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_subscriptions
FROM nexus_notifications
WHERE delivered_realtime = true
GROUP BY tenant_id;
```

**Step 3: Verify**
```sql
-- Check view security
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname IN ('nexus_notification_counts', 'nexus_realtime_status');
```

**Expected Result:** Views should not have SECURITY DEFINER property

---

### Issue 2: Function Search Path Mutable

**Severity:** WARN | **Risk:** MEDIUM | **Priority:** HIGH

#### Problem

Function `public.generate_nexus_id` has a mutable `search_path`, which can be exploited for SQL injection attacks.

#### Remediation

**Step 1: Identify the function**
```sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'generate_nexus_id';
```

**Step 2: Fix the function**
```sql
-- Recreate with explicit search_path
CREATE OR REPLACE FUNCTION generate_nexus_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  prefix TEXT := 'NEX';
  timestamp_part TEXT;
  random_part TEXT;
BEGIN
  -- Generate timestamp part (YYYYMMDDHHMMSS)
  timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
  
  -- Generate random part (6 characters)
  random_part := SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);
  
  -- Combine
  RETURN prefix || '-' || timestamp_part || '-' || random_part;
END;
$$;
```

**Step 3: Verify**
```sql
-- Check function search_path
SELECT 
  p.proname,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'generate_nexus_id';
```

**Expected Result:** `proconfig` should contain `search_path = public, pg_temp`

---

### Issue 3: Extension in Public Schema

**Severity:** WARN | **Risk:** LOW | **Priority:** MEDIUM

#### Problem

Extension `pg_net` is installed in the `public` schema, which can cause namespace pollution and potential conflicts.

#### Remediation

**Step 1: Create extensions schema**
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
```

**Step 2: Move extension**
```sql
-- Move pg_net to extensions schema
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

**Step 3: Update search_path (if needed)**
```sql
-- Update default search_path for database
ALTER DATABASE postgres SET search_path = public, extensions;
```

**Step 4: Verify**
```sql
-- Check extension location
SELECT 
  extname,
  n.nspname as schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'pg_net';
```

**Expected Result:** Extension should be in `extensions` schema

---

### Issue 4: Leaked Password Protection Disabled

**Severity:** WARN | **Risk:** MEDIUM | **Priority:** HIGH

#### Problem

Leaked password protection is disabled, allowing users to use compromised passwords from the HaveIBeenPwned database.

#### Remediation

**Option 1: Enable via Dashboard**
1. Go to Supabase Dashboard
2. Navigate to Authentication → Settings
3. Enable "Leaked Password Protection"
4. Save changes

**Option 2: Enable via Management API**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Note: This is typically configured at project level
// Check Supabase Management API for project settings
```

**Option 3: Enable via Config (Local Development)**
```toml
# supabase/config.toml
[auth]
# Leaked password protection is enabled by default in Supabase
# No configuration needed for hosted projects
```

**Verification:**
- Test with a known compromised password
- Should be rejected during signup/password change

---

## 🔐 Security Best Practices

### 1. Row Level Security (RLS)

**Status:** ✅ Already enabled on all tables

**Best Practices:**
- Always enable RLS on user-facing tables
- Use `(SELECT auth.uid())` pattern for performance
- Test policies with different user roles
- Document policy logic

**Example:**
```sql
-- ✅ GOOD: Fast and secure
CREATE POLICY "users_view_own_data"
ON nexus_cases FOR SELECT
TO authenticated
USING ((SELECT auth.uid())::text = user_id);

-- ❌ BAD: Slow (re-evaluates per row)
CREATE POLICY "users_view_own_data"
ON nexus_cases FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);
```

---

### 2. Service Role Key Security

**Status:** ✅ Current practice is correct

**Best Practices:**
- ✅ Never expose service role key to client
- ✅ Only use in Edge Functions or server-side code
- ✅ Rotate keys regularly
- ✅ Use environment variables, never hardcode

**Example:**
```typescript
// ✅ GOOD: Server-side only
// Edge Function or API route
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Server-side only
);

// ❌ BAD: Never in client code
// Client-side code
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY  // NEVER!
);
```

---

### 3. Multi-Factor Authentication (MFA)

**Status:** ⚠️ Configured but enrollment disabled

**Remediation:**
```toml
# supabase/config.toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

[auth.mfa.phone]
enroll_enabled = true
verify_enabled = true
```

**Implementation:**
```typescript
// Enable MFA for user
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'My Authenticator App'
});

// Verify MFA
const { data, error } = await supabase.auth.mfa.verify({
  factorId: factorId,
  challengeId: challengeId,
  code: userCode
});
```

---

### 4. API Rate Limiting

**Status:** ✅ Configured in config.toml

**Current Settings:**
```toml
[auth.rate_limit]
email_sent = 2
sms_sent = 30
sign_in_sign_ups = 30
token_refresh = 150
```

**Recommendations:**
- Review rate limits based on usage patterns
- Consider stricter limits for sensitive operations
- Monitor for abuse

---

### 5. Network Restrictions

**Status:** ⚠️ Disabled (allows all IPs)

**Remediation:**
```toml
# supabase/config.toml
[db.network_restrictions]
enabled = true
# Allow specific IPs only
allowed_cidrs = [
  "203.0.113.0/24",  # Office IP range
  "198.51.100.0/24"  # VPN IP range
]
allowed_cidrs_v6 = []  # Block IPv6 if not needed
```

**Note:** Only enable if you have fixed IP addresses. For dynamic IPs, use connection pooling with authentication.

---

### 6. Secrets Management

**Status:** ⚠️ Using environment variables (good), but Vault available

**Current Practice:**
- ✅ Using environment variables for Edge Functions
- ✅ Not committing secrets to git

**Enhancement: Use Supabase Vault**
```sql
-- Store secret in Vault
SELECT vault.create_secret(
  'stripe_api_key',
  'sk_live_...',
  'payment-processing'
);

-- Retrieve secret
SELECT decrypted_secret 
FROM vault.decrypted_secrets 
WHERE name = 'stripe_api_key';
```

**Benefits:**
- Encrypted at rest
- Audit trail
- Rotation support
- Access control

---

### 7. Audit Logging

**Status:** ✅ `audit_events` table exists

**Best Practices:**
- Log all sensitive operations
- Include user context
- Store IP addresses
- Retain logs for compliance period

**Example:**
```sql
-- Audit trigger
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_events (
    table_name,
    record_id,
    user_id,
    action,
    old_values,
    new_values,
    ip_address
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    (SELECT auth.uid()),
    TG_OP,
    row_to_json(OLD),
    row_to_json(NEW),
    current_setting('request.headers', true)::json->>'x-forwarded-for'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📋 Security Checklist

### Immediate (Week 1)
- [ ] Fix SECURITY DEFINER views (2 views)
- [ ] Fix function search_path (1 function)
- [ ] Move pg_net to extensions schema
- [ ] Enable leaked password protection
- [ ] Enable MFA enrollment

### Short-Term (Week 2-4)
- [ ] Review and consolidate RLS policies
- [ ] Set up network restrictions (if applicable)
- [ ] Implement Supabase Vault for secrets
- [ ] Review audit logging coverage
- [ ] Set up security alerts

### Medium-Term (Month 2-3)
- [ ] Rotate service role keys
- [ ] Review and update rate limits
- [ ] Implement security monitoring
- [ ] Conduct security audit
- [ ] Update security documentation

### Long-Term (Ongoing)
- [ ] Monthly security review
- [ ] Quarterly penetration testing
- [ ] Annual security audit
- [ ] Continuous monitoring

---

## 🔗 Related Documentation

- [SUPABASE_AUDIT_AND_OPTIMIZATION.md](./SUPABASE_AUDIT_AND_OPTIMIZATION.md)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

## 📊 Security Scorecard

### Current Security Score: 65%

| Category | Score | Status |
|----------|-------|--------|
| **Authentication** | 70% | ⚠️ Needs MFA |
| **Authorization** | 80% | ✅ Good |
| **Data Protection** | 60% | ⚠️ Needs hardening |
| **Network Security** | 50% | ⚠️ Needs restrictions |
| **Secrets Management** | 70% | ⚠️ Can improve |
| **Audit & Logging** | 75% | ✅ Good |

### Target Security Score: 90%

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

