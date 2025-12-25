# Group of Companies Implementation Summary

**Date:** 2025-12-21  
**Status:** ✅ Architecture Assessment Complete + Migration Created  
**Requirement:** Hierarchical Tenant Model (Tenant → Group → Company)

---

## Assessment Result

✅ **ARCHITECTURE CAN SUPPORT IT** - Migration created and Sprint 2 updated

---

## What Was Done

### 1. Architecture Assessment
- ✅ Analyzed current schema
- ✅ Identified missing components
- ✅ Created assessment document: `ARCHITECTURE_GROUP_OF_COMPANIES_ASSESSMENT.md`

### 2. Migration Created
- ✅ Created `migrations/014_vmp_multi_company_groups.sql`
- ✅ Includes all required components:
  - `vmp_groups` table (the "Alias" layer)
  - `group_id` in `vmp_companies`
  - Legal entity fields (legal_name, tax_id, country_code, currency_code)
  - `group_id` in `vmp_cases` (denormalized)
  - `erp_vendor_code` in `vmp_vendor_company_links`
  - RBAC scoping (scope_group_id, scope_company_id)

### 3. Sprint Plan Updated
- ✅ Added Task 2.1: Multi-Company Groups to Sprint 2
- ✅ Updated CSV ingest to include Company Code mapping
- ✅ Updated acceptance criteria
- ✅ Renumbered subsequent migrations (015-023)

---

## Current Architecture Support

### ✅ Already Supported
1. **One Vendor Master:** Vendors are tenant-scoped (not company-scoped)
2. **Many-to-Many:** `vmp_vendor_company_links` exists
3. **Company-Specific Cases:** Cases have `company_id`
4. **Multi-Tenant:** All tables have `tenant_id`

### ✅ Now Added (Sprint 2)
1. **Group Layer:** `vmp_groups` table for logical grouping
2. **Director View:** `group_id` in cases for fast filtering
3. **RBAC Scoping:** User scope fields for Director vs Manager views
4. **Legal Entity Fields:** Tax ID, country code, currency
5. **ERP Mapping:** Vendor codes per company

---

## Migration Details

**File:** `migrations/014_vmp_multi_company_groups.sql`

**Creates:**
- `vmp_groups` table
- Adds `group_id` to `vmp_companies`
- Adds legal entity fields to `vmp_companies`
- Adds `group_id` to `vmp_cases` (with backfill)
- Adds `erp_vendor_code` to `vmp_vendor_company_links`
- Adds RBAC scoping to `vmp_vendor_users`
- Creates indexes for performance

**Impact:** All changes are **additive** (no breaking changes)

---

## Usage Patterns

### Director View (Group Scope)
```sql
-- User has scope_group_id = 'group-uuid'
SELECT * FROM vmp_cases 
WHERE group_id = 'group-uuid';
-- Result: Sees cases from all companies in the group
```

### Manager View (Company Scope)
```sql
-- User has scope_company_id = 'company-uuid'
SELECT * FROM vmp_cases 
WHERE company_id = 'company-uuid';
-- Result: Sees only their company's cases
```

### One Vendor, Many Companies
```sql
-- Vendor exists once at tenant level
SELECT v.*, vcl.company_id, vcl.erp_vendor_code
FROM vmp_vendors v
JOIN vmp_vendor_company_links vcl ON v.id = vcl.vendor_id
WHERE v.tenant_id = 'tenant-uuid';
-- Result: Same vendor, different ERP codes per company
```

---

## Next Steps

1. **Sprint 2:** Run migration `014_vmp_multi_company_groups.sql`
2. **Sprint 2:** Update adapter methods to support group filtering
3. **Sprint 2:** Add RBAC checks for Director vs Manager views
4. **Sprint 2:** Update CSV ingest to map Company Code

---

## Files Created/Modified

### Created
- `migrations/014_vmp_multi_company_groups.sql`
- `.dev/dev-note/ARCHITECTURE_GROUP_OF_COMPANIES_ASSESSMENT.md`
- `.dev/dev-note/GROUP_OF_COMPANIES_IMPLEMENTATION_SUMMARY.md` (this file)

### Modified
- `.dev/dev-note/__SPRINT_DEVELOPMENT_PLAN.md` (Sprint 2 updated)

---

**Document Status:** ✅ Complete  
**Ready for Implementation:** ✅ Yes

