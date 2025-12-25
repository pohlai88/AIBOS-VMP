# Supabase MCP Setup & Usage Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Production Ready

---

## 📋 Overview

This guide helps you set up and use Supabase MCP (Model Context Protocol) for database migrations and operations in the VMP project.

---

## 🔧 Setup Supabase MCP

### Option 1: Using Supabase MCP Server (If Available)

If you have Supabase MCP server configured, you can use it directly:

```javascript
// Example usage (if MCP server is configured)
const migrationSQL = await readFile('migrations/031_vmp_soa_tables.sql');
await mcp_supabase_apply_migration({
  name: "031_vmp_soa_tables",
  query: migrationSQL
});
```

### Option 2: Using Supabase JS Client (Current Implementation)

Since MCP server may not be configured, we use the Supabase JS client directly:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Apply migration
const { error } = await supabase.rpc('exec_sql', { 
  sql_query: migrationSQL 
});
```

---

## 🚀 Quick Start

### Apply All Migrations

```bash
# Using the migration script
node scripts/apply-migrations.js --env=development

# Or using Supabase CLI
supabase db push
```

### Apply Specific Migration

```bash
# Read migration file
cat migrations/031_vmp_soa_tables.sql

# Apply via script
node scripts/apply-migrations.js --migration=031_vmp_soa_tables.sql
```

### Apply Seed Data (Development Only)

```bash
# Using script (includes production check)
node scripts/apply-migrations.js --env=development --include-seed

# Or directly
node scripts/seed-vmp-data.js
```

---

## 📊 Available Tools

### 1. Migration Application Script

**File:** `scripts/apply-migrations.js`

**Features:**
- ✅ Environment-aware (production/development/staging)
- ✅ Migration tracking
- ✅ Production safety checks
- ✅ Error handling

**Usage:**
```bash
# Apply all migrations (production)
node scripts/apply-migrations.js --env=production

# Apply all migrations (development)
node scripts/apply-migrations.js --env=development

# Apply with seed data (development only)
node scripts/apply-migrations.js --env=development --include-seed
```

### 2. Seed Data Script

**File:** `scripts/seed-vmp-data.js`

**Features:**
- ✅ Production safety check
- ✅ Idempotent (safe to re-run)
- ✅ Transaction-wrapped

**Usage:**
```bash
# Apply seed data (development/staging only)
node scripts/seed-vmp-data.js
```

---

## 🔍 Migration Operations

### List Migrations

```bash
# Check migration files
ls -la migrations/*.sql

# Check applied migrations (if tracking table exists)
psql $DATABASE_URL -c "SELECT * FROM _migrations ORDER BY applied_at;"
```

### Verify Migration Status

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'vmp_soa_items'
);

-- Check migration tracking
SELECT * FROM _migrations ORDER BY applied_at DESC LIMIT 10;
```

### Rollback Migration

```bash
# Using Supabase CLI
supabase migration down

# Or manually (if needed)
psql $DATABASE_URL -f migrations/rollback_031_vmp_soa_tables.sql
```

---

## 🌱 Seed Data Operations

### Apply Seed Data

```bash
# Method 1: Using migration script
node scripts/apply-migrations.js --env=development --include-seed

# Method 2: Using seed script
node scripts/seed-vmp-data.js

# Method 3: Direct SQL (development only)
psql $DATABASE_URL -f migrations/035_vmp_seed_demo_data.sql
```

### Verify Seed Data

```sql
-- Check tenants
SELECT COUNT(*) FROM vmp_tenants;

-- Check vendors
SELECT COUNT(*) FROM vmp_vendors;

-- Check users
SELECT email, is_active FROM vmp_vendor_users;

-- Check cases
SELECT COUNT(*) FROM vmp_cases;
```

### Reset Seed Data

```sql
-- ⚠️ WARNING: This will delete all data
-- Uncomment in migrations/035_vmp_seed_demo_data.sql:
TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, vmp_companies, 
vmp_tenants CASCADE;
```

---

## 🔒 Production Safety

### Production Checklist

Before applying to production:

- [ ] All migrations tested on staging
- [ ] Seed data excluded (`035_vmp_seed_demo_data.sql`)
- [ ] RLS policies verified
- [ ] Indexes created
- [ ] Backup taken
- [ ] Rollback plan ready

### Production Safety Checks

The seed migration includes automatic production check:

```sql
-- Built into migrations/035_vmp_seed_demo_data.sql
DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'Seed data migration cannot be applied to production';
  END IF;
END $$;
```

---

## 📚 Related Documentation

- `docs/integrations/SUPABASE_MCP_MIGRATION_GUIDE.md` - Complete migration guide
- `docs/integrations/SUPABASE_MCP_SEEDING_GUIDE.md` - Seed data guide
- `migrations/README.md` - Migration reference
- `scripts/apply-migrations.js` - Migration script

---

## 🐛 Troubleshooting

### Migration Fails

**Issue:** Migration fails with "already exists" error

**Solution:** Migrations are idempotent - this is expected. Check if migration was already applied.

### Seed Data Fails in Production

**Issue:** Seed data migration aborts in production

**Solution:** This is by design. Seed data should never be applied to production.

### Connection Errors

**Issue:** Cannot connect to Supabase

**Solution:** 
1. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
2. Verify network connectivity
3. Check Supabase project status

---

## ✅ Quick Reference

### Common Commands

```bash
# Apply all migrations
node scripts/apply-migrations.js --env=development

# Apply seed data
node scripts/seed-vmp-data.js

# Check migration status
supabase migration list

# Verify schema
psql $DATABASE_URL -c "\d vmp_soa_items"
```

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NODE_ENV=development  # or production, staging
```

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-01-22

