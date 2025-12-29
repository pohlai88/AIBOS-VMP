# Application Template Quick Start

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **Quick Reference**  
**Context:** One-page guide to using application templates

---

## 🚀 Generate New Entity (30 seconds)

```bash
# Run scaffold script
node scripts/scaffold.js Invoice invoices

# This creates:
# ✅ src/services/invoices.service.js
# ✅ src/app/api/invoice/route.js
# ✅ migrations/052_create_invoices.sql (optional)
# ✅ tests/unit/invoices.service.test.js (optional)
```

---

## 📋 What Gets Generated

### 1. Service File
- Extends `BaseRepository` (gets CRUD-S for free)
- Includes `create()`, `update()`, `approve()` methods
- Hash chain integration placeholders
- Tenant isolation

### 2. Route File
- POST, GET, PUT, DELETE endpoints
- Zod validation schemas
- Auth guards
- Error handling
- Standardized response format

### 3. Migration File
- CRUD-S columns (`deleted_at`, `deleted_by`)
- RLS policies (tenant isolation, soft delete aware)
- Partial indexes (unique constraints)
- Auto-update triggers

### 4. Test File
- Supabase mocking
- Success/failure scenarios
- Soft delete testing
- Arrange-Act-Assert pattern

---

## ✏️ Customization Checklist

After generating files:

- [ ] Replace all `{{EntityName}}` → `Invoice`
- [ ] Replace all `{{entity-name}}` → `invoice`
- [ ] Replace all `{{table_name}}` → `invoices`
- [ ] Add entity-specific fields to migration
- [ ] Add validation rules to Zod schema
- [ ] Add business logic methods to service
- [ ] Add test cases
- [ ] Run migration in Supabase SQL Editor

---

## 🔐 Security Features (Automatic)

All generated code includes:

- ✅ **CRUD-S** - Soft delete with `deleted_at`, `deleted_by`
- ✅ **RLS** - Row Level Security policies
- ✅ **Validation** - Zod input validation
- ✅ **Auth** - Authentication guards
- ✅ **Audit** - Hash chain placeholders (optional)

---

## 📚 Full Documentation

- [`APPLICATION_TEMPLATE_SYSTEM.md`](./APPLICATION_TEMPLATE_SYSTEM.md) - Complete guide
- [`TEMPLATE_PATTERN_GUIDE.md`](./TEMPLATE_PATTERN_GUIDE.md) - General template pattern

---

**Last Updated:** 2025-01-22

