# Architecture Assessment: Group of Companies Support

**Date:** 2025-12-21  
**Status:** 📊 Analysis Complete  
**Requirement:** Hierarchical Tenant Model (Tenant → Group → Company)

---

## Executive Summary

**Current State:** ⚠️ **PARTIALLY SUPPORTED** - Missing the **Group layer** and **RBAC scoping**

**What Works:**
- ✅ Vendors are tenant-scoped (not company-scoped) - supports "One Vendor Master"
- ✅ `vmp_vendor_company_links` exists - supports many-to-many vendor-company relationships
- ✅ Cases have `company_id` - supports company-specific cases
- ✅ Multi-tenant structure exists

**What's Missing:**
- ❌ `vmp_groups` table (the "Alias" layer for Director View)
- ❌ `group_id` in `vmp_companies` (links companies to groups)
- ❌ `group_id` in `vmp_cases` (denormalized for fast Director View filtering)
- ❌ Legal entity fields in `vmp_companies` (legal_name, tax_id, country_code, currency_code)
- ❌ `erp_vendor_code` in `vmp_vendor_company_links` (for ERP mapping)
- ❌ RBAC scoping fields (scope_group_id, scope_company_id) in user tables

---

## Current Schema Analysis

### ✅ What Already Exists

#### 1. Tenant Structure
```sql
vmp_tenants (id, name)
  └─ vmp_companies (id, tenant_id, name)  -- ✅ Exists
  └─ vmp_vendors (id, tenant_id, name)    -- ✅ Tenant-scoped (GOOD!)
```

#### 2. Vendor-Company Links
```sql
vmp_vendor_company_links (vendor_id, company_id)  -- ✅ Exists
```
**Status:** ✅ Supports "One Vendor, Many Companies" pattern

#### 3. Cases Structure
```sql
vmp_cases (id, tenant_id, company_id, vendor_id)  -- ✅ Has company_id
```
**Status:** ✅ Cases are company-specific (correct for legal entity tracking)

---

## Missing Components

### ❌ 1. Group Layer (The "Alias")

**Required:**
```sql
vmp_groups (id, tenant_id, name, code)
```

**Purpose:** Logical grouping for "Director View" across multiple legal entities

**Impact:** Without this, Directors cannot see aggregated views across companies

---

### ❌ 2. Company-Group Link

**Required:**
```sql
ALTER TABLE vmp_companies
  ADD COLUMN group_id UUID REFERENCES vmp_groups(id);
```

**Purpose:** Links companies to their logical group

**Impact:** Cannot group companies for monitoring

---

### ❌ 3. Legal Entity Fields

**Current:** `vmp_companies` only has `name`

**Required:**
```sql
ALTER TABLE vmp_companies
  ADD COLUMN legal_name TEXT NOT NULL,
  ADD COLUMN tax_id TEXT,
  ADD COLUMN country_code TEXT NOT NULL,
  ADD COLUMN currency_code TEXT DEFAULT 'USD';
```

**Purpose:** 
- `legal_name`: Official registered name
- `tax_id`: UEN/VAT number for tax compliance
- `country_code`: Determines checklist rules (VMP-01-03)
- `currency_code`: For payment/invoice display

**Impact:** Cannot support country-specific logic or tax compliance

---

### ❌ 4. Group ID in Cases (Denormalized)

**Required:**
```sql
ALTER TABLE vmp_cases
  ADD COLUMN group_id UUID REFERENCES vmp_groups(id);
```

**Purpose:** Fast filtering for Director View (avoid JOINs)

**Impact:** Director queries will be slower without denormalization

---

### ❌ 5. ERP Vendor Code Mapping

**Current:** `vmp_vendor_company_links` has no ERP mapping

**Required:**
```sql
ALTER TABLE vmp_vendor_company_links
  ADD COLUMN erp_vendor_code TEXT;
```

**Purpose:** Map same vendor to different ERP codes per company

**Impact:** Cannot integrate with ERPs that use different vendor codes per company

---

### ❌ 6. RBAC Scoping

**Current:** `vmp_internal_users` exists but no scope fields

**Required:**
```sql
ALTER TABLE vmp_internal_users
  ADD COLUMN scope_group_id UUID REFERENCES vmp_groups(id),
  ADD COLUMN scope_company_id UUID REFERENCES vmp_companies(id);
```

**Purpose:** 
- `scope_group_id`: Director can see all companies in group
- `scope_company_id`: Manager can see only their company

**Impact:** Cannot implement "Director View" vs "Manager View" RBAC

---

## Migration Plan

### Sprint 2: Add Group Layer

**Migration:** `migrations/014_vmp_multi_company_groups.sql`

**Tasks:**
1. Create `vmp_groups` table
2. Add `group_id` to `vmp_companies`
3. Add legal entity fields to `vmp_companies`
4. Add `group_id` to `vmp_cases` (denormalized)
5. Add `erp_vendor_code` to `vmp_vendor_company_links`
6. Add RBAC scoping to `vmp_internal_users`
7. Update `vmp_invoices` to include `company_id` (for legal entity tracking)

---

## Architecture Compatibility

### ✅ Compatible Patterns

1. **One Vendor Master:** ✅ Already supported
   - Vendors are tenant-scoped
   - `vmp_vendor_company_links` provides many-to-many

2. **Company-Specific Cases:** ✅ Already supported
   - Cases have `company_id`
   - Invoices will have `company_id` (Sprint 2)

3. **Multi-Tenant Isolation:** ✅ Already supported
   - All tables have `tenant_id`

### ⚠️ Needs Enhancement

1. **Director View:** ❌ Missing `group_id` in cases
2. **RBAC Scoping:** ❌ Missing scope fields in users
3. **Legal Entity Tracking:** ❌ Missing legal fields in companies
4. **ERP Integration:** ❌ Missing ERP vendor code mapping

---

## Recommendation

**Status:** ✅ **ARCHITECTURE CAN SUPPORT IT** with migration

**Action Required:**
1. Add migration `014_vmp_multi_company_groups.sql` to Sprint 2
2. Update Sprint 2 tasks to include group layer setup
3. Update adapter methods to support group filtering
4. Add RBAC checks for Director vs Manager views

**Risk Level:** 🟢 **LOW** - All changes are additive (no breaking changes)

---

**Document Status:** ✅ Complete  
**Next Step:** Generate migration SQL

