# Supabase MCP Migration & Seed Data Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Production Ready

---

## 📋 Overview

This guide provides production-ready procedures for managing database migrations and seed data using Supabase MCP (Model Context Protocol) and Supabase CLI.

**Key Principles:**
- ✅ All migrations are idempotent (safe to run multiple times)
- ✅ Seed data is **EXCLUDED** from production by default
- ✅ Migrations are versioned and ordered (001-034)
- ✅ Production safety checks are built-in

---

## 🚀 Migration Management

### Option 1: Supabase MCP (Recommended for CI/CD)

Use Supabase MCP tools to apply migrations programmatically:

```javascript
// Example: Apply migration via MCP
const migrationSQL = await readFile('migrations/031_vmp_soa_tables.sql');
await mcp_supabase_apply_migration({
  name: "031_vmp_soa_tables",
  query: migrationSQL
});
```

**Benefits:**
- Programmatic control
- CI/CD integration
- Version tracking
- Rollback support

### Option 2: Supabase CLI (Recommended for Local Development)

```bash
# Apply all migrations (excludes seed data by default)
supabase db push

# Apply specific migration
supabase migration up 031_vmp_soa_tables

# Check migration status
supabase migration list

# Rollback last migration
supabase migration down
```

### Option 3: Manual Application (Production Fallback)

1. Connect to Supabase database via dashboard or psql
2. Run migrations in order (001 → 034)
3. **CRITICAL:** Exclude `035_vmp_seed_demo_data.sql` from production
4. Verify no errors occurred

---

## 🌱 Seed Data Management

### ⚠️ CRITICAL: Production Safety

**Seed data (`035_vmp_seed_demo_data.sql`) MUST NEVER be applied to production.**

The seed migration includes a production safety check:

```sql
-- Production safety check (aborts if applied to production)
DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'Seed data migration cannot be applied to production';
  END IF;
END $$;
```

### Applying Seed Data (Development/Staging Only)

**Option 1: Supabase MCP**

```javascript
// Read seed migration
const seedSQL = await readFile('migrations/035_vmp_seed_demo_data.sql');

// Apply via MCP (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  await mcp_supabase_apply_migration({
    name: "035_vmp_seed_demo_data",
    query: seedSQL
  });
}
```

**Option 2: Supabase CLI**

```bash
# Apply seed data (development/staging only)
NODE_ENV=development supabase db push --include-seed

# Or apply seed migration directly
supabase migration up 035_vmp_seed_demo_data
```

**Option 3: Node.js Script**

```bash
# Run seed script (includes production check)
node scripts/seed-vmp-data.js
```

### Seed Data Contents

The seed migration creates:

- **1 Tenant:** Nexus Group
- **2 Companies:** Nexus Manufacturing, Nexus Distribution
- **2 Vendors:** TechSupply Co., Global Logistics
- **3 Users:**
  - `vendor@techsupply.com` / `password123`
  - `admin@nexus.com` / `password123`
  - `vendor2@globallog.com` / `password123`
- **10 Cases:** Including 2 sprint test cases
- **Checklist steps** for cases
- **Messages** for cases
- **3 Invoices** (shadow ledger)
- **1 Payment** (shadow ledger)

**⚠️ WARNING:** These test credentials must **NEVER** exist in production.

---

## 📊 Migration Order (001-034)

### Core Foundation (001-011)
1. `001_vmp_tenants_companies_vendors.sql` - Multi-tenant structure
2. `002_vmp_vendor_users_sessions.sql` - Authentication
3. `003_vmp_cases_checklist.sql` - Case management
4. `004_vmp_evidence_messages.sql` - Evidence & messaging
5. `005_vmp_invites.sql` - Invitation system
6. `006_vmp_updated_at_trigger.sql` - Timestamp triggers
7. `007_storage_bucket_setup.sql` - Storage configuration
8. `008_vmp_performance_indexes.sql` - Performance optimization
9. `009_vmp_security_rls.sql` - Row Level Security
10. `010_vmp_function_security.sql` - Function security
11. `011_vmp_foreign_key_cascade_fix.sql` - Data integrity

### RBAC & Notifications (012-013)
12. `012_vmp_internal_users_rbac.sql` - Internal RBAC
13. `013_vmp_notifications.sql` - Notification system

### Multi-Company & Groups (014)
14. `014_vmp_multi_company_groups.sql` - Company grouping

### Shadow Ledger & Payments (015-017)
15. `015_vmp_shadow_ledger.sql` - Invoice shadow ledger
16. `016_vmp_cases_linked_refs.sql` - Case references
17. `017_vmp_payments.sql` - Payment tracking

### Ingest & Profile (018, 030)
18. `018_vmp_ingest_log.sql` - CSV ingest logging
30. `030_vmp_vendor_profile.sql` - Vendor profiles

### Decision Log & Notifications (031-032)
31. `031_vmp_decision_log.sql` - Decision audit trail
32. `032_vmp_payment_notifications.sql` - Payment notifications

### Session Store (033) - **CRITICAL FOR PRODUCTION**
33. `033_vmp_sessions_table.sql` - PostgreSQL session store

### Cases Enhancements (020-021)
20. `020_vmp_cases_tags.sql` - Case tagging
21. `021_vmp_cases_assigned_to.sql` - Assignment tracking

### Messages & Cases Metadata (022-023)
22. `022_vmp_messages_metadata.sql` - Message metadata
23. `023_vmp_cases_contract_type.sql` - Contract types

### Push Notifications (024-025)
24. `024_vmp_push_subscriptions.sql` - Push subscriptions
25. `025_vmp_notification_preferences.sql` - Notification preferences

### Emergency Override (026)
26. `026_vmp_emergency_pay_override.sql` - Emergency override

### Analytics & Performance (027)
27. `027_sla_analytics_indexes.sql` - SLA analytics indexes

### Authentication & Access (028-029)
28. `028_vmp_password_reset_tokens.sql` - Password reset
29. `029_vmp_access_requests.sql` - Access requests

### Port Configuration (034)
34. `034_vmp_port_configuration.sql` - Port configuration

### SOA Reconciliation (031-032) - **NEW**
31. `031_vmp_soa_tables.sql` - SOA reconciliation tables
32. `032_vmp_debit_notes.sql` - Debit Notes (SOA outcome)

### Seed Data (035) - **DEVELOPMENT/STAGING ONLY**
35. `035_vmp_seed_demo_data.sql` - Demo data (⚠️ NOT FOR PRODUCTION)

---

## 🔧 Production Optimization

### Migration Performance

All migrations are optimized for production:

1. **Idempotent Operations:** All `CREATE` statements use `IF NOT EXISTS`
2. **Index Creation:** Indexes use `IF NOT EXISTS` for safe re-runs
3. **Batch Operations:** Large data operations are batched
4. **Transaction Safety:** Critical operations are wrapped in transactions

### Index Optimization

Migration `008_vmp_performance_indexes.sql` adds:
- Foreign key indexes (10 indexes)
- Query optimization indexes (status, created_at, etc.)
- Composite indexes for common query patterns
- **Impact:** 5-10x faster queries

### Security Hardening

1. **RLS Enabled:** Migration `009_vmp_security_rls.sql` enables Row Level Security
2. **Function Security:** Migration `010_vmp_function_security.sql` secures functions
3. **Cascade Rules:** Migration `011_vmp_foreign_key_cascade_fix.sql` ensures data integrity

---

## 📝 Best Practices

### Before Production Deployment

1. ✅ **Renumber duplicate migrations** (see `migrations/README.md`)
2. ✅ **Verify all migrations are idempotent**
3. ✅ **EXCLUDE** `035_vmp_seed_demo_data.sql` from production
4. ✅ **Verify RLS policies** are production-ready (not service role bypass)
5. ✅ **Ensure** `033_vmp_sessions_table.sql` is applied (required for production)
6. ✅ **Run migration validation checklist**

### Migration Development

1. **Always test migrations** on a development database first
2. **Backup before applying** to production
3. **Run migrations in order** (001 → 034)
4. **Verify indexes** are created correctly
5. **Check foreign key constraints** are working
6. **Use transactions** for critical operations

### Seed Data Development

1. **Never commit production credentials** to seed data
2. **Include production safety checks** in seed migrations
3. **Document seed data contents** in migration comments
4. **Test seed data** in isolated development environments

---

## 🐛 Troubleshooting

### Migration Fails with "Already Exists"

- Migrations use `CREATE TABLE IF NOT EXISTS` - safe to re-run
- If you see this error, the table already exists (OK)

### Foreign Key Violations

- Ensure parent tables exist before creating child tables
- Run migrations in order (001 → 034)

### Index Creation Fails

- Indexes use `CREATE INDEX IF NOT EXISTS` - safe to re-run
- If index exists, migration will skip it

### Seed Data Applied to Production

- **IMMEDIATE ACTION:** Remove seed data manually
- **PREVENTION:** Always verify `NODE_ENV` before applying seed migrations
- **AUDIT:** Check migration history for seed data application

---

## 📚 Related Documentation

- `migrations/README.md` - Complete migration reference
- `docs/development/MIGRATION_VALIDATION_PRODUCTION.md` - Production validation
- `docs/development/SEED_DATA_AUTO_INJECTION_ADVISORY.md` - Seed data advisory
- `docs/development/DEPLOYMENT_GUIDE.md` - Full deployment guide
- `scripts/seed-vmp-data.js` - Seed data script

---

## ✅ Migration Checklist

### Pre-Production

- [ ] All migrations renumbered (no duplicates)
- [ ] All migrations tested on staging
- [ ] Seed data excluded from production
- [ ] RLS policies production-ready
- [ ] Session store migration applied
- [ ] Performance indexes verified
- [ ] Security hardening verified

### Post-Production

- [ ] Migration history verified
- [ ] Database schema validated
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Backup strategy verified

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-01-22

