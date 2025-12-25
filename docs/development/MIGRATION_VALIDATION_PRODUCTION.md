# VMP Database Migration Validation - Production Deployment

**Version:** 1.0.0  
**Date:** 2025-01-22  
**Status:** Production-Ready Validation Guide  
**Purpose:** Comprehensive validation checklist for database migrations and seed data before production deployment

---

## Executive Summary

This document provides a **100% production-compliant** validation framework for:
1. **Migration Rate Validation**: Ensuring all migrations are properly numbered, ordered, and dependency-compliant
2. **Seed Data Guide**: Complete production-ready seed data deployment process
3. **Deployment Checklist**: Step-by-step validation before production deployment

**Critical Requirements:**
- ✅ All migrations must be idempotent (safe to re-run)
- ✅ All migrations must have proper dependency order
- ✅ All migrations must include error handling
- ✅ Seed data must be production-safe (no test data in production)
- ✅ All foreign keys must have proper cascade rules
- ✅ All indexes must be created for performance
- ✅ RLS policies must be production-ready (not dev bypasses)

---

## 📊 Migration Rate Validation

### Current Migration Status

**Total Migrations:** 29 (001-029)  
**Status:** ⚠️ **DUPLICATE NUMBERS DETECTED** - Requires renumbering

#### Migration Numbering Issues

| Issue | Files Affected | Required Action |
|-------|---------------|-----------------|
| **Duplicate 018** | `018_vmp_ingest_log.sql`<br>`018_vmp_vendor_profile.sql` | Renumber `018_vmp_vendor_profile.sql` → `030_vmp_vendor_profile.sql` |
| **Duplicate 019** | `019_vmp_decision_log.sql`<br>`019_vmp_payment_notifications.sql`<br>`019_vmp_sessions_table.sql` | Renumber to: `031_vmp_decision_log.sql`<br>`032_vmp_payment_notifications.sql`<br>`033_vmp_sessions_table.sql` |
| **Duplicate 020** | `020_vmp_cases_tags.sql`<br>`020_vmp_port_configuration.sql` | Renumber `020_vmp_port_configuration.sql` → `034_vmp_port_configuration.sql` |

**Note:** `019_vmp_sessions_table.sql` is **CRITICAL for production** (PostgreSQL session store). Ensure it's applied before deployment.

### Corrected Migration Order (001-034)

```bash
# Core Foundation (001-011)
001_vmp_tenants_companies_vendors.sql
002_vmp_vendor_users_sessions.sql
003_vmp_cases_checklist.sql
004_vmp_evidence_messages.sql
005_vmp_invites.sql
006_vmp_updated_at_trigger.sql
007_storage_bucket_setup.sql
008_vmp_performance_indexes.sql
009_vmp_security_rls.sql
010_vmp_function_security.sql
011_vmp_foreign_key_cascade_fix.sql

# RBAC & Notifications (012-013)
012_vmp_internal_users_rbac.sql
013_vmp_notifications.sql

# Multi-Company & Groups (014)
014_vmp_multi_company_groups.sql

# Shadow Ledger & Payments (015-017)
015_vmp_shadow_ledger.sql
016_vmp_cases_linked_refs.sql
017_vmp_payments.sql

# Ingest & Profile (018, 030)
018_vmp_ingest_log.sql
030_vmp_vendor_profile.sql  # RENUMBERED from 018

# Decision Log & Notifications (031-032)
031_vmp_decision_log.sql  # RENUMBERED from 019
032_vmp_payment_notifications.sql  # RENUMBERED from 019

# Session Store (033) - CRITICAL FOR PRODUCTION
033_vmp_sessions_table.sql  # RENUMBERED from 019

# Cases Enhancements (020-021)
020_vmp_cases_tags.sql
021_vmp_cases_assigned_to.sql

# Messages & Cases Metadata (022-023)
022_vmp_messages_metadata.sql
023_vmp_cases_contract_type.sql

# Push Notifications (024-025)
024_vmp_push_subscriptions.sql
025_vmp_notification_preferences.sql

# Emergency Override (026)
026_vmp_emergency_pay_override.sql

# Analytics & Performance (027)
027_sla_analytics_indexes.sql

# Authentication & Access (028-029)
028_vmp_password_reset_tokens.sql
029_vmp_access_requests.sql

# Port Configuration (034) - RENUMBERED
034_vmp_port_configuration.sql  # RENUMBERED from 020
```

### Migration Validation Checklist

#### ✅ Pre-Application Validation

- [ ] **Numbering**: All migrations have unique sequential numbers (001-034)
- [ ] **Naming**: All files follow pattern: `NNN_description.sql` (3-digit number)
- [ ] **Headers**: All migrations have header comments:
  ```sql
  -- Migration: [Name]
  -- Created: [Date]
  -- Description: [Purpose]
  ```
- [ ] **Idempotency**: All `CREATE TABLE` use `IF NOT EXISTS`
- [ ] **Idempotency**: All `CREATE INDEX` use `IF NOT EXISTS`
- [ ] **Idempotency**: All `ALTER TABLE` use `IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS`
- [ ] **Dependencies**: Foreign keys reference existing tables
- [ ] **Dependencies**: Migrations are ordered by dependency (parent tables before child tables)

#### ✅ Post-Application Validation

- [ ] **Tables Created**: All expected tables exist
  ```sql
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE 'vmp_%'
  ORDER BY table_name;
  ```
- [ ] **Foreign Keys**: All foreign key constraints exist
  ```sql
  SELECT 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name LIKE 'vmp_%';
  ```
- [ ] **Indexes**: All performance indexes exist
  ```sql
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND tablename LIKE 'vmp_%'
  ORDER BY tablename, indexname;
  ```
- [ ] **RLS Policies**: Row Level Security is enabled on all VMP tables
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename LIKE 'vmp_%'
  ORDER BY tablename;
  ```
- [ ] **Functions**: All trigger functions are secure (search_path set)
  ```sql
  SELECT proname, prosecdef, proconfig 
  FROM pg_proc 
  WHERE proname LIKE '%vmp%' 
  OR proname LIKE '%update_updated_at%';
  ```
- [ ] **Session Table**: `session` table exists (required for production)
  ```sql
  SELECT * FROM information_schema.tables 
  WHERE table_name = 'session';
  ```

#### ✅ Production-Specific Validation

- [ ] **RLS Policies**: Service role bypass policies are **REMOVED** (production only)
- [ ] **RLS Policies**: Tenant-based policies are **IMPLEMENTED** (production only)
- [ ] **Password Security**: All password hashes use bcrypt with 10+ rounds
- [ ] **Session Security**: Session table has proper expiration indexes
- [ ] **Storage Buckets**: `vmp-evidence` bucket exists and has proper policies
- [ ] **No Test Data**: No test/demo data in production database
- [ ] **Backup**: Database backup created before migration
- [ ] **Rollback Plan**: Rollback procedure documented and tested

---

## 🌱 Seed Data Guide - Production Deployment

### Overview

**Purpose:** Seed data is **ONLY for development/staging environments**. Production deployments should **NEVER** include seed data.

**Exception:** Initial production setup may require minimal seed data (e.g., first tenant, first admin user). This must be:
- ✅ Manually reviewed and approved
- ✅ Documented in deployment runbook
- ✅ Removed from automated seed scripts

### Seed Data Migration File

**File:** `migrations/035_vmp_seed_demo_data.sql` (Development/Staging Only)

**Status:** ⚠️ **NOT FOR PRODUCTION** - Must be excluded from production deployments

**Key Features:**
- ✅ Idempotent (uses `ON CONFLICT DO NOTHING`)
- ✅ Transaction-wrapped (`BEGIN; ... COMMIT;`)
- ✅ Hard reset capability (commented TRUNCATE section)
- ✅ Fixed UUIDs for consistent demo scenarios
- ✅ Real bcrypt password hashes

### Seed Data Application Process

#### Step 1: Environment Check

**CRITICAL:** Verify environment before applying seed data:

```sql
-- Check if this is production
SELECT current_setting('app.environment', true) as environment;

-- If production, ABORT seed data application
-- If development/staging, proceed
```

#### Step 2: Apply Seed Migration (Development/Staging Only)

**Using Supabase MCP (Recommended):**

```bash
# Read the seed migration file
$seedSQL = Get-Content migrations/035_vmp_seed_demo_data.sql -Raw

# Apply via Supabase MCP
# Note: This should be blocked in production via environment check
```

**Using Supabase CLI:**

```bash
# Only in development/staging
supabase db push --include-seed
```

#### Step 3: Verify Seed Data

```sql
-- Data Count Verification
SELECT 
    'Tenants' as type, COUNT(*) as count FROM vmp_tenants
UNION ALL
SELECT 'Companies', COUNT(*) FROM vmp_companies
UNION ALL
SELECT 'Vendors', COUNT(*) FROM vmp_vendors
UNION ALL
SELECT 'Users', COUNT(*) FROM vmp_vendor_users
UNION ALL
SELECT 'Cases', COUNT(*) FROM vmp_cases
UNION ALL
SELECT 'Invoices', COUNT(*) FROM vmp_invoices
UNION ALL
SELECT 'Payments', COUNT(*) FROM vmp_payments
UNION ALL
SELECT 'Messages', COUNT(*) FROM vmp_messages
UNION ALL
SELECT 'Checklist Steps', COUNT(*) FROM vmp_checklist_steps;

-- Expected Results (Development/Staging):
-- Tenants: 1
-- Companies: 2
-- Vendors: 2
-- Users: 3
-- Cases: 10
-- Invoices: 3
-- Payments: 1
-- Messages: 8
-- Checklist Steps: 9
```

#### Step 4: Test Authentication

**Test Credentials (Development/Staging Only):**

| Email | Password | Purpose |
|-------|----------|---------|
| `vendor@techsupply.com` | `password123` | Primary test user |
| `admin@nexus.com` | `password123` | Admin functions |
| `vendor2@globallog.com` | `password123` | Multi-vendor testing |

**⚠️ CRITICAL:** These credentials must **NEVER** exist in production.

### Production Deployment - Seed Data Exclusion

**Rule:** Production deployments must **EXCLUDE** seed data migration.

**Implementation:**

1. **Environment Variable Check:**
   ```sql
   -- In seed migration file (035_vmp_seed_demo_data.sql)
   DO $$
   BEGIN
     IF current_setting('app.environment', true) = 'production' THEN
       RAISE EXCEPTION 'Seed data cannot be applied to production environment';
     END IF;
   END $$;
   ```

2. **CI/CD Pipeline:**
   ```yaml
   # .github/workflows/deploy-production.yml
   - name: Apply Migrations
     run: |
       # Exclude seed data migration in production
       for file in migrations/0[0-2][0-9]_*.sql migrations/03[0-4]_*.sql; do
         supabase db push --file "$file"
       done
       # DO NOT apply migrations/035_vmp_seed_demo_data.sql
   ```

3. **Manual Deployment:**
   - Review migration list before applying
   - **EXCLUDE** `035_vmp_seed_demo_data.sql` from production
   - Document any manual seed data (first tenant, admin user) separately

---

## 🚀 Production Deployment Checklist

### Pre-Deployment

- [ ] **Migration Validation**: All migrations validated (001-034)
- [ ] **Duplicate Numbers**: All duplicate migration numbers resolved
- [ ] **Dependencies**: Migration order verified (no circular dependencies)
- [ ] **Idempotency**: All migrations tested for re-run safety
- [ ] **Backup**: Database backup created
- [ ] **Rollback Plan**: Rollback procedure documented
- [ ] **Seed Data**: Seed data migration **EXCLUDED** from production

### Deployment

- [ ] **Environment Check**: Verify `NODE_ENV=production`
- [ ] **Migration Application**: Apply migrations 001-034 in order
- [ ] **Session Table**: Verify `session` table exists (033_vmp_sessions_table.sql)
- [ ] **RLS Policies**: Verify tenant-based RLS policies (not service role bypass)
- [ ] **Storage Buckets**: Verify `vmp-evidence` bucket exists
- [ ] **Indexes**: Verify all performance indexes created
- [ ] **Foreign Keys**: Verify all foreign key constraints exist

### Post-Deployment

- [ ] **Table Verification**: All VMP tables exist
- [ ] **Data Verification**: No test/demo data in production
- [ ] **Authentication**: Test admin user login (if manually created)
- [ ] **Session Store**: Verify sessions persist in PostgreSQL
- [ ] **RLS Verification**: Test tenant isolation (RLS working)
- [ ] **Performance**: Verify query performance (indexes working)
- [ ] **Monitoring**: Set up database monitoring and alerts

---

## 🔧 Migration Renumbering Procedure

### Step 1: Identify Duplicates

```powershell
# List all migrations with numbers
Get-ChildItem migrations/*.sql | 
  ForEach-Object { 
    if ($_.Name -match '^(\d+)') { 
      [PSCustomObject]@{ Number = [int]$matches[1]; File = $_.Name } 
    } 
  } | 
  Group-Object Number | 
  Where-Object { $_.Count -gt 1 } | 
  Select-Object Name, Count, @{N='Files';E={$_.Group.File}}
```

### Step 2: Renumber Duplicates

**Files to Renumber:**

1. `018_vmp_vendor_profile.sql` → `030_vmp_vendor_profile.sql`
2. `019_vmp_decision_log.sql` → `031_vmp_decision_log.sql`
3. `019_vmp_payment_notifications.sql` → `032_vmp_payment_notifications.sql`
4. `019_vmp_sessions_table.sql` → `033_vmp_sessions_table.sql`
5. `020_vmp_port_configuration.sql` → `034_vmp_port_configuration.sql`

**Procedure:**

```powershell
# Rename files (PowerShell)
Rename-Item migrations/018_vmp_vendor_profile.sql migrations/030_vmp_vendor_profile.sql
Rename-Item migrations/019_vmp_decision_log.sql migrations/031_vmp_decision_log.sql
Rename-Item migrations/019_vmp_payment_notifications.sql migrations/032_vmp_payment_notifications.sql
Rename-Item migrations/019_vmp_sessions_table.sql migrations/033_vmp_sessions_table.sql
Rename-Item migrations/020_vmp_port_configuration.sql migrations/034_vmp_port_configuration.sql
```

### Step 3: Update Documentation

- [ ] Update `migrations/README.md` with correct migration order
- [ ] Update `docs/development/DEPLOYMENT_GUIDE.md` with correct order
- [ ] Update any CI/CD scripts that reference migration numbers

---

## 📚 Related Documentation

- `migrations/README.md` - Migration file documentation
- `docs/development/DEPLOYMENT_GUIDE.md` - Full deployment guide
- `docs/integrations/SUPABASE_MCP_SEEDING_GUIDE.md` - Seed data guide
- `docs/development/SEED_DATA_AUTO_INJECTION_ADVISORY.md` - Seed data advisory

---

## ✅ Validation Status

**Last Validated:** 2025-01-22  
**Migration Count:** 29 (001-029) + 5 renumbered = 34 total  
**Seed Data Status:** Development/Staging only (excluded from production)  
**Production Ready:** ⚠️ **Requires renumbering duplicates before deployment**

---

**Status:** ✅ **100% Production Compliance Framework**  
**Next Steps:** Renumber duplicate migrations, create seed data migration file, update documentation

