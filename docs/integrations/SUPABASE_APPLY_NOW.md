# Apply SOA Migrations Now

**Quick Apply:** Copy-paste ready SQL for Supabase Dashboard

---

## 🚀 Apply via Supabase Dashboard

1. **Open Supabase Dashboard** → **SQL Editor**
2. **Click "New Query"**
3. **Copy entire contents** of `migrations/031-032_soa_complete.sql`
4. **Paste into editor**
5. **Click "Run"** (or press `Ctrl+Enter`)

---

## ✅ Verify

After applying, run this in SQL Editor:

```sql
-- Check tables created
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

-- Should return 5 rows
```

---

**File:** `migrations/031-032_soa_complete.sql`  
**Status:** Ready to apply

