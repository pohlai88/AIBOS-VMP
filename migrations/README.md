# VMP Database Migrations

**Last Updated:** 2025-01-22  
**Status:** Production Ready (with renumbering required)  
**Total Migrations:** 35 (001-035, including seed data)

---

## 📋 Overview

This directory contains SQL migration files for the VMP (Vendor Management Portal) database schema. All migrations are designed to be idempotent (safe to run multiple times).

**⚠️ IMPORTANT:** Some migrations have duplicate numbers that need to be renumbered before production deployment. See `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` for details.

---

## 🗂️ Migration Files (001-035)

### Core Foundation (001-011)

#### 001_vmp_tenants_companies_vendors.sql
Creates the foundational multi-tenant structure:
- `vmp_tenants` - Top-level tenant isolation
- `vmp_companies` - Companies within tenants
- `vmp_vendors` - Vendor master data
- `vmp_vendor_company_links` - Many-to-many vendor-company relationships

#### 002_vmp_vendor_users_sessions.sql
Creates authentication tables:
- `vmp_vendor_users` - User accounts with credentials
- `vmp_sessions` - Active user sessions

#### 003_vmp_cases_checklist.sql
Creates case management tables:
- `vmp_cases` - Case tracking (onboarding, invoice, payment, etc.)
- `vmp_checklist_steps` - Evidence checklist steps per case

#### 004_vmp_evidence_messages.sql
Creates evidence and messaging tables:
- `vmp_evidence` - Versioned evidence files with checksums
- `vmp_messages` - Multi-channel messaging (portal, WhatsApp, email, Slack)

#### 005_vmp_invites.sql
Creates invitation system:
- `vmp_invites` - Vendor invitation tokens

#### 006_vmp_updated_at_trigger.sql
Creates automatic timestamp updates:
- Trigger function for `updated_at` columns

#### 007_storage_bucket_setup.sql
Documents Supabase Storage bucket configuration:
- `vmp-evidence` bucket setup instructions
- Storage policies documentation

#### 008_vmp_performance_indexes.sql ⚡ **OPTIMIZATION**
Adds missing indexes for query performance:
- Foreign key indexes (10 indexes)
- Query optimization indexes (status, created_at, etc.)
- Composite indexes for common query patterns
- **Impact:** 5-10x faster queries

#### 009_vmp_security_rls.sql 🔒 **SECURITY**
Enables Row Level Security (RLS):
- Enables RLS on all 11 VMP tables
- Adds service role bypass policies (temporary for dev)
- **TODO:** Replace with tenant-based policies in production

#### 010_vmp_function_security.sql 🔒 **SECURITY**
Fixes function security issue:
- Secures `update_updated_at_column()` function
- Sets `search_path` to prevent injection

#### 011_vmp_foreign_key_cascade_fix.sql 🔧 **DATA INTEGRITY**
Fixes foreign key cascade rules:
- Updates `vmp_cases` foreign keys to use CASCADE
- Ensures proper data cleanup on delete

### RBAC & Notifications (012-013)

#### 012_vmp_internal_users_rbac.sql
Creates internal user RBAC system:
- `vmp_internal_users` - Internal staff accounts
- Role-based access control tables

#### 013_vmp_notifications.sql
Creates notification system:
- `vmp_notifications` - User notifications table

### Multi-Company & Groups (014)

#### 014_vmp_multi_company_groups.sql
Creates multi-company group structure:
- Company grouping and hierarchy tables

### Shadow Ledger & Payments (015-017)

#### 015_vmp_shadow_ledger.sql
Creates shadow ledger for invoice tracking:
- `vmp_invoices` - Invoice shadow ledger

#### 016_vmp_cases_linked_refs.sql
Adds linked references to cases:
- Case reference linking tables

#### 017_vmp_payments.sql
Creates payment tracking:
- `vmp_payments` - Payment shadow ledger

### Ingest & Profile (018, 030)

#### 018_vmp_ingest_log.sql
Creates ingest log for CSV uploads:
- `vmp_ingest_log` - CSV upload tracking

#### 030_vmp_vendor_profile.sql ⚠️ **RENUMBERED FROM 018**
Adds profile fields to vendors:
- Vendor profile columns (address, contact, compliance, bank details)

### Decision Log & Notifications (031-032)

#### 031_vmp_decision_log.sql ⚠️ **RENUMBERED FROM 019**
Creates decision log for case tracking:
- `vmp_decision_log` - Case decision audit trail

#### 032_vmp_payment_notifications.sql ⚠️ **RENUMBERED FROM 019**
Adds payment notification types:
- Payment notification support

### Session Store (033) - **CRITICAL FOR PRODUCTION**

#### 033_vmp_sessions_table.sql ⚠️ **RENUMBERED FROM 019** 🚨 **PRODUCTION REQUIRED**
Creates PostgreSQL session store:
- `session` table for `connect-pg-simple`
- **Required for production** (replaces MemoryStore)

### Cases Enhancements (020-021)

#### 020_vmp_cases_tags.sql
Adds tagging to cases:
- Case tagging functionality

#### 021_vmp_cases_assigned_to.sql
Adds assignment tracking:
- Case assignment fields

### Messages & Cases Metadata (022-023)

#### 022_vmp_messages_metadata.sql
Adds metadata to messages:
- Message metadata support

#### 023_vmp_cases_contract_type.sql
Adds contract type to cases:
- Case contract type fields

### Push Notifications (024-025)

#### 024_vmp_push_subscriptions.sql
Creates push notification subscriptions:
- Push subscription tables

#### 025_vmp_notification_preferences.sql
Creates notification preferences:
- User notification preferences

### Emergency Override (026)

#### 026_vmp_emergency_pay_override.sql
Adds emergency payment override:
- Emergency override functionality

### Analytics & Performance (027)

#### 027_sla_analytics_indexes.sql
Adds SLA analytics indexes:
- Performance indexes for SLA queries

### Authentication & Access (028-029)

#### 028_vmp_password_reset_tokens.sql
Creates password reset tokens:
- `vmp_password_reset_tokens` - Password reset tracking

#### 029_vmp_access_requests.sql
Creates access request system:
- `vmp_access_requests` - Vendor access request tracking

### Port Configuration (034)

#### 034_vmp_port_configuration.sql ⚠️ **RENUMBERED FROM 020**
Adds port configuration:
- Port configuration tables

### Seed Data (035) - **DEVELOPMENT/STAGING ONLY**

#### 035_vmp_seed_demo_data.sql ⚠️ **NOT FOR PRODUCTION**
Seeds demo data for development/staging:
- Comprehensive demo data (tenants, companies, vendors, users, cases)
- **Includes production safety check** (aborts if applied to production)
- **MUST BE EXCLUDED** from production deployments

---

## 🚀 How to Apply Migrations

### ⚠️ IMPORTANT: Migration Renumbering Required

**Before production deployment**, renumber duplicate migrations:
- `018_vmp_vendor_profile.sql` → `030_vmp_vendor_profile.sql`
- `019_vmp_decision_log.sql` → `031_vmp_decision_log.sql`
- `019_vmp_payment_notifications.sql` → `032_vmp_payment_notifications.sql`
- `019_vmp_sessions_table.sql` → `033_vmp_sessions_table.sql`
- `020_vmp_port_configuration.sql` → `034_vmp_port_configuration.sql`

See `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` for detailed procedure.

### Option 1: Using Supabase MCP (Recommended)

```bash
# Apply all migrations in order (001-034, EXCLUDE 035 for production)
for file in migrations/0[0-2][0-9]_*.sql migrations/03[0-4]_*.sql; do
  echo "Applying $file..."
  # Use Supabase MCP apply_migration tool
done

# For development/staging only, apply seed data:
# migrations/035_vmp_seed_demo_data.sql
```

### Option 2: Using Supabase CLI

```bash
# Apply migrations via Supabase CLI (excludes seed data by default)
supabase db push

# For development/staging only, include seed data:
supabase db push --include-seed
```

### Option 3: Manual Application

1. Connect to your Supabase database
2. Run each migration file in order (001 → 034)
3. **For production:** EXCLUDE `035_vmp_seed_demo_data.sql`
4. **For development/staging:** Include `035_vmp_seed_demo_data.sql` if needed
5. Verify no errors occurred

---

## 🌱 Seed Data

### ⚠️ CRITICAL: Development/Staging Only

**Seed data migration `035_vmp_seed_demo_data.sql` is FOR DEVELOPMENT/STAGING ONLY.**

**Production Deployment:** Seed data migration **MUST BE EXCLUDED** from production. See `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` for production deployment procedures.

### Applying Seed Data (Development/Staging)

**Option 1: Migration-Based (Recommended)**

Apply migration `035_vmp_seed_demo_data.sql` via Supabase MCP:

```bash
# Read and apply seed migration
mcp_supabase_apply_migration({
  name: "035_vmp_seed_demo_data",
  query: seedSQL
})
```

**Option 2: Node.js Script (Alternative)**

```bash
node scripts/seed-vmp-data.js
```

### Seed Data Contents

The seed migration creates:
- 1 Tenant (Nexus Group)
- 2 Companies (Nexus Manufacturing, Nexus Distribution)
- 2 Vendors (TechSupply Co., Global Logistics)
- 3 Users (vendor@techsupply.com, admin@nexus.com, vendor2@globallog.com)
- 10 Cases (including 2 sprint test cases)
- Checklist steps for cases
- Messages for cases
- 3 Invoices (shadow ledger)
- 1 Payment (shadow ledger)

**Test Credentials (Development/Staging Only):**
- Email: `vendor@techsupply.com` | Password: `password123`
- Email: `admin@nexus.com` | Password: `password123`
- Email: `vendor2@globallog.com` | Password: `password123`

**⚠️ WARNING:** These credentials must **NEVER** exist in production.

---

## 📊 Database Schema

### Entity Relationships

```
vmp_tenants (1) ──< (N) vmp_companies
vmp_tenants (1) ──< (N) vmp_vendors
vmp_vendors (1) ──< (N) vmp_vendor_users
vmp_vendors (1) ──< (N) vmp_cases
vmp_companies (1) ──< (N) vmp_cases
vmp_cases (1) ──< (N) vmp_checklist_steps
vmp_cases (1) ──< (N) vmp_evidence
vmp_cases (1) ──< (N) vmp_messages
vmp_vendor_users (1) ──< (N) vmp_sessions
vmp_vendor_users (1) ──< (N) vmp_messages
vmp_checklist_steps (1) ──< (N) vmp_evidence
```

### Key Constraints

- **Multi-tenancy:** All tables include `tenant_id` for isolation
- **Cascade deletes:** Related records are automatically cleaned up
- **Check constraints:** Enforce valid enum values (status, case_type, etc.)
- **Unique constraints:** Prevent duplicates (email, token, etc.)
- **Foreign keys:** Maintain referential integrity

---

## 🔒 Security Notes

- **RLS (Row Level Security):** ✅ Enabled via Migration 009 (with service role bypass for dev)
  - **TODO:** Replace service role policies with tenant-based policies for production
- **Password hashing:** Uses `bcrypt` with 10 rounds
- **Session expiration:** Sessions expire after configured time
- **Evidence checksums:** SHA-256 checksums for file integrity
- **Function Security:** ✅ Secured via Migration 010 (search_path fixed)

---

## 📝 Migration Best Practices

1. **Always test migrations** on a development database first
2. **Backup before applying** to production
3. **Run migrations in order** (001 → 006)
4. **Verify indexes** are created correctly
5. **Check foreign key constraints** are working

---

## 🐛 Troubleshooting

### Migration Fails with "Already Exists"
- Migrations use `CREATE TABLE IF NOT EXISTS` - safe to re-run
- If you see this error, the table already exists (OK)

### Foreign Key Violations
- Ensure parent tables exist before creating child tables
- Run migrations in order (001 → 006)

### Index Creation Fails
- Indexes use `CREATE INDEX IF NOT EXISTS` - safe to re-run
- If index exists, migration will skip it

---

## 📚 Related Documentation

- `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` - **Production deployment validation guide**
- `docs/integrations/SUPABASE_MCP_SEEDING_GUIDE.md` - Seed data guide (100% production compliant)
- `docs/development/SEED_DATA_AUTO_INJECTION_ADVISORY.md` - Seed data advisory
- `docs/development/DEPLOYMENT_GUIDE.md` - Full deployment guide
- `.dev/dev-note/VMP 21Sprint.md` - Sprint planning
- `src/adapters/supabase.js` - Database adapter implementation

---

## 🚨 Production Deployment Notes

**Before deploying to production:**

1. ✅ Renumber duplicate migrations (see `docs/development/MIGRATION_VALIDATION_PRODUCTION.md`)
2. ✅ Verify all migrations are idempotent
3. ✅ **EXCLUDE** `035_vmp_seed_demo_data.sql` from production
4. ✅ Verify RLS policies are production-ready (not service role bypass)
5. ✅ Ensure `033_vmp_sessions_table.sql` is applied (required for production)
6. ✅ Run migration validation checklist

See `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` for complete production deployment procedures.

---

## ✅ Migration Checklist

### Core Foundation (001-011)
- [x] 001 - Tenants, Companies, Vendors
- [x] 002 - Vendor Users, Sessions
- [x] 003 - Cases, Checklist Steps
- [x] 004 - Evidence, Messages
- [x] 005 - Invites
- [x] 006 - Updated At Trigger
- [x] 007 - Storage Bucket Setup (Documentation)
- [x] 008 - Performance Indexes ⚡
- [x] 009 - Row Level Security 🔒
- [x] 010 - Function Security 🔒
- [x] 011 - Foreign Key Cascade Fix 🔧

### RBAC & Notifications (012-013)
- [x] 012 - Internal Users RBAC
- [x] 013 - Notifications

### Multi-Company & Groups (014)
- [x] 014 - Multi-Company Groups

### Shadow Ledger & Payments (015-017)
- [x] 015 - Shadow Ledger
- [x] 016 - Cases Linked Refs
- [x] 017 - Payments

### Ingest & Profile (018, 030)
- [x] 018 - Ingest Log
- [x] 030 - Vendor Profile ⚠️ (Renumbered from 018)

### Decision Log & Notifications (031-032)
- [x] 031 - Decision Log ⚠️ (Renumbered from 019)
- [x] 032 - Payment Notifications ⚠️ (Renumbered from 019)

### Session Store (033) - **CRITICAL FOR PRODUCTION**
- [x] 033 - Sessions Table ⚠️ (Renumbered from 019) 🚨

### Cases Enhancements (020-021)
- [x] 020 - Cases Tags
- [x] 021 - Cases Assigned To

### Messages & Cases Metadata (022-023)
- [x] 022 - Messages Metadata
- [x] 023 - Cases Contract Type

### Push Notifications (024-025)
- [x] 024 - Push Subscriptions
- [x] 025 - Notification Preferences

### Emergency Override (026)
- [x] 026 - Emergency Pay Override

### Analytics & Performance (027)
- [x] 027 - SLA Analytics Indexes

### Authentication & Access (028-029)
- [x] 028 - Password Reset Tokens
- [x] 029 - Access Requests

### Port Configuration (034)
- [x] 034 - Port Configuration ⚠️ (Renumbered from 020)

### Seed Data (035) - **DEVELOPMENT/STAGING ONLY**
- [x] 035 - Seed Demo Data ⚠️ **NOT FOR PRODUCTION**

### Future Migrations
- [ ] Tenant-based RLS Policies (Production)
- [ ] Audit Logging (Future)

