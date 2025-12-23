# Supabase MCP Quick Start Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Production Ready

---

## 🚀 Quick Start

### Current Setup (Supabase JS Client)

Your project uses **Supabase JS Client** directly (not MCP server). This is the recommended approach.

### Apply Migrations

```bash
# Apply all migrations (development)
node scripts/apply-migrations.js --env=development

# Apply all migrations (production - excludes seed data)
node scripts/apply-migrations.js --env=production

# Apply with seed data (development only)
node scripts/apply-migrations.js --env=development --include-seed
```

### Apply Seed Data

```bash
# Using seed script (includes production check)
node scripts/seed-vmp-data.js
```

---

## 📊 Migration Operations

### List All Migrations

```bash
# View migration files
ls -la migrations/*.sql

# Check applied migrations (if tracking enabled)
psql $DATABASE_URL -c "SELECT * FROM _migrations ORDER BY applied_at;"
```

### Apply Specific Migration

```bash
# Read migration file
cat migrations/031_vmp_soa_tables.sql

# Apply via Supabase dashboard SQL editor
# Or use the migration script (applies all in order)
```

### Verify Migration Status

```sql
-- Check if SOA tables exist
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'vmp_soa_items'
);

-- Check all VMP tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'vmp_%'
ORDER BY table_name;
```

---

## 🌱 Seed Data Operations

### Apply Seed Data (Development Only)

```bash
# Method 1: Using seed script
node scripts/seed-vmp-data.js

# Method 2: Using migration script
node scripts/apply-migrations.js --env=development --include-seed

# Method 3: Direct SQL (via Supabase dashboard)
# Copy contents of migrations/035_vmp_seed_demo_data.sql
# Paste into Supabase SQL Editor and run
```

### Verify Seed Data

```sql
-- Check tenants
SELECT id, name FROM vmp_tenants;

-- Check vendors
SELECT id, name, status FROM vmp_vendors;

-- Check users
SELECT email, is_active, vendor_id FROM vmp_vendor_users;

-- Check cases
SELECT id, case_type, status, vendor_id FROM vmp_cases LIMIT 10;
```

### Test Credentials (Development Only)

After applying seed data:

- **Email:** `vendor@techsupply.com` | **Password:** `password123`
- **Email:** `admin@nexus.com` | **Password:** `password123`
- **Email:** `vendor2@globallog.com` | **Password:** `password123`

**⚠️ WARNING:** These credentials must **NEVER** exist in production.

---

## 🔧 Using Supabase Dashboard

### Apply Migration via Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy migration SQL from `migrations/XXX_migration_name.sql`
4. Paste into editor
5. Click "Run" (or press `Ctrl+Enter`)

### Apply Seed Data via Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy seed SQL from `migrations/035_vmp_seed_demo_data.sql`
4. **⚠️ VERIFY:** Environment is NOT production
5. Paste into editor
6. Click "Run"

---

## 🔒 Production Safety

### Before Production Deployment

- [ ] All migrations tested on staging
- [ ] Seed data **EXCLUDED** (`035_vmp_seed_demo_data.sql`)
- [ ] RLS policies verified
- [ ] Indexes created
- [ ] Backup taken

### Production Safety Check

The seed migration automatically aborts in production:

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

## 📚 Common Tasks

### Check Database Schema

```sql
-- List all VMP tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'vmp_%'
ORDER BY table_name;

-- Check table structure
\d vmp_soa_items

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'vmp_%';
```

### Check Migration Status

```sql
-- If migration tracking table exists
SELECT filename, applied_at 
FROM _migrations 
ORDER BY applied_at DESC 
LIMIT 10;
```

### Reset Development Database

```sql
-- ⚠️ WARNING: This deletes ALL data
-- Only use in development/staging

-- Option 1: Truncate all tables (keeps schema)
TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, vmp_companies, 
vmp_tenants CASCADE;

-- Option 2: Drop and recreate (nuclear option)
-- Drop all VMP tables, then re-run migrations
```

---

## 🐛 Troubleshooting

### Migration Fails with "Already Exists"

**Solution:** This is expected. Migrations use `IF NOT EXISTS` and are idempotent.

### Seed Data Fails in Production

**Solution:** This is by design. Seed data should never be applied to production.

### Connection Errors

**Solution:** 
1. Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Verify Supabase project is active
3. Check network connectivity

### Missing Tables

**Solution:** 
1. Verify migrations were applied in order (001 → 034)
2. Check migration files exist
3. Re-run migrations if needed

---

## ✅ Quick Reference

### Essential Commands

```bash
# Apply all migrations
node scripts/apply-migrations.js --env=development

# Apply seed data
node scripts/seed-vmp-data.js

# Check environment
echo $NODE_ENV

# Verify Supabase connection
node -e "console.log(process.env.SUPABASE_URL)"
```

### Environment Variables

```bash
# Required in .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NODE_ENV=development  # or production, staging
```

---

## 📖 Related Documentation

- `docs/integrations/SUPABASE_MCP_MIGRATION_GUIDE.md` - Complete migration guide
- `docs/integrations/SUPABASE_MCP_SEEDING_GUIDE.md` - Seed data guide
- `migrations/README.md` - Migration reference
- `scripts/apply-migrations.js` - Migration script source

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-01-22

