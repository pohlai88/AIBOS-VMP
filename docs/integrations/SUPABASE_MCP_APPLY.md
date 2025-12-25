# Apply Migrations via Supabase

**Quick Reference:** How to apply migrations using Supabase

---

## 🚀 Quick Apply

### Apply SOA Migrations (031, 032)

```bash
# Set environment variables first
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Or add to .env file:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Apply SOA migrations
node scripts/apply-soa-migrations.js
```

### Apply All Migrations

```bash
node scripts/apply-migrations.js --env=development
```

---

## 📋 Manual Application (Supabase Dashboard)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy SQL from migration file
4. Paste and click **Run**

### Migration Files to Apply

- `migrations/031_vmp_soa_tables.sql` - SOA reconciliation tables
- `migrations/032_vmp_debit_notes.sql` - Debit Notes table

---

## ✅ Verify

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'vmp_soa_items',
  'vmp_soa_matches', 
  'vmp_soa_discrepancies',
  'vmp_soa_acknowledgements',
  'vmp_debit_notes'
)
ORDER BY table_name;
```

---

**Status:** Ready to apply  
**Last Updated:** 2025-01-22

