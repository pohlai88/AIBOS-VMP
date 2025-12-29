# Application Template System

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **Active**  
**Context:** Operational templates that enforce sustainability and security architectures

---

## 📋 Executive Summary

The **Application Template System** operationalizes the "Sustainability" and "Security" architectures (CRUD-S, Hash Chains, Pre-signed URLs) into **copy-pasteable standards**. By adhering to these templates, every new feature automatically inherits security hardening and soft-delete logic.

### Key Benefits

- ✅ **Automatic Security** - Templates enforce CRUD-S, RLS, and audit patterns
- ✅ **Consistency** - All features follow same structure
- ✅ **Speed** - Copy template, customize, done
- ✅ **Quality** - Best practices built-in
- ✅ **Sustainability** - Long-term maintainability
- ✅ **Governance** - Templates as explicit contracts (v1.1.0)

---

## 🚫 Non-Negotiables

**These rules are mandatory and non-negotiable:**

1. **DO NOT bypass Application Templates** - All new entities must use templates
2. **DO NOT add tables without CRUD-S** - `deleted_at`, `deleted_by` required
3. **DO NOT disable RLS** - Row Level Security is mandatory
4. **DO NOT skip validation** - Zod schemas required for all inputs
5. **DO NOT remove auth guards** - Authentication required for all routes
6. **DO NOT modify templates directly** - Templates are read-only references
7. **DO NOT skip state transitions** - If entity has status, define transitions
8. **DO NOT skip domain declaration** - Domain context required in scaffold

---

## 🏗️ Template Architecture

### Directory Structure

```
src/
├── templates/                    # Application templates (operational)
│   ├── route.template.js         # Next.js API route template
│   ├── service.template.js       # Service layer template
│   ├── migration.template.sql   # Database migration template
│   └── test.template.js         # Test template
│
├── services/                     # Generated services (from templates)
├── app/api/                     # Generated routes (from templates)
└── ...

migrations/                       # Generated migrations (from templates)
tests/                           # Generated tests (from templates)
```

**Note:** Templates are in `src/templates/` (operational templates) vs `src/views/templates/` (view boilerplates).

---

## 📚 Template Catalog

### 1. Route Templates (Express SSR)

**Purpose:** Express routes for SSR pages and JSON API endpoints

**Two Templates Available:**

#### A. Route Page Template (`src/templates/route.page.template.js`)
**For:** Server-side rendered pages (SSR with Nunjucks)

**Key Features:**
- ✅ Express Router (not Next.js)
- ✅ Server-side rendering with `res.render()`
- ✅ HTMX integration for dynamic updates
- ✅ Domain awareness
- ✅ Tenant isolation via `requireTenant` middleware
- ✅ Adapter-only database access

**Usage:**
```bash
cp src/templates/route.page.template.js src/routes/{{entity-name}}.js
# Mount in server.js: app.use('/{{entity-name}}', {{entityName}}Router);
```

#### B. Route API Template (`src/templates/route.api.template.js`)
**For:** JSON API endpoints

**Key Features:**
- ✅ Express Router (not Next.js)
- ✅ JSON responses: `{ data, error, metadata }`
- ✅ Domain awareness
- ✅ Tenant isolation via `requireTenant` middleware
- ✅ Adapter-only database access
- ✅ Storage/attachment patterns included

**Usage:**
```bash
cp src/templates/route.api.template.js src/routes/{{entity-name}}-api.js
# Mount in server.js: app.use('/api/{{entity-name}}', {{entityName}}ApiRouter);
```

**⚠️ Important:** These templates use **Express SSR**, not Next.js. Do not use Next.js patterns.

**Template Structure:**
```javascript
// 1. Validation Schema (Zod)
// 2. Auth & Context Guard
// 3. Input Validation
// 4. Service Execution
// 5. Success Response
// 6. Error Handling
```

---

### 2. Service Template (`src/templates/service.template.js`)

**Purpose:** Business logic layer extending `BaseRepository`

**Key Features:**
- ✅ **Template Contract** header (explicit contract)
- ✅ **Domain awareness** (finance, vendor, client, compliance, system)
- ✅ **State transition validation** (if entity has status field)
- ✅ Inherits CRUD-S operations (softDelete, restore, findById)
- ✅ Audit integration placeholders (Hash Chain)
- ✅ Tenant isolation
- ✅ Error handling
- ✅ Custom business methods

**State Transition Pattern:**
```javascript
static ALLOWED_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['POSTED', 'REJECTED'],
  POSTED: [], // Terminal state
};

// Validate transitions
this.assertTransition(currentStatus, 'APPROVED');
```

**Usage:**
```bash
# Use scaffold script (recommended)
node scripts/scaffold.js finance Invoice invoices

# Or manual copy
cp src/templates/service.template.js src/services/{{entity-name}}.service.js

# Replace placeholders and:
# 1. Define state transitions (if entity has status)
# 2. Add business logic methods
```

**Inheritance:**
```javascript
class {{EntityName}}Service extends BaseRepository {
  // Automatically gets:
  // - softDelete(id, userId)
  // - restore(id)
  // - findById(id)
  // - findAllActive()
  // - countActive()
}
```

---

### 3. Migration Template (`src/templates/migration.template.sql`)

**Purpose:** Database schema with CRUD-S and security built-in

**Key Features:**
- ✅ **Template Contract** header (explicit contract)
- ✅ **Domain awareness** (finance, vendor, client, compliance, system)
- ✅ CRUD-S columns (`deleted_at`, `deleted_by`) included
- ✅ RLS policies pre-written
- ✅ Partial indexes for unique constraints
- ✅ Performance indexes
- ✅ Audit columns (`created_at`, `created_by`, `updated_at`)
- ✅ Multi-tenancy support

**Usage:**
```bash
# Use scaffold script (recommended)
node scripts/scaffold.js finance Invoice invoices

# Or manual copy
cp src/templates/migration.template.sql migrations/052_create_{{table_name}}.sql

# Replace placeholders and customize fields
```

**Standard Columns:**
```sql
-- CRUD-S (Soft Delete)
deleted_at timestamptz default null,
deleted_by uuid references auth.users(id),

-- Audit
created_at timestamptz not null default now(),
created_by uuid references auth.users(id),
updated_at timestamptz not null default now(),

-- Multi-tenancy
tenant_id uuid not null,
```

---

### 4. Test Template (`src/templates/test.template.js`)

**Purpose:** Vitest test structure with mocking patterns

**Key Features:**
- ✅ **Template Contract** header (explicit contract)
- ✅ **Domain awareness** (finance, vendor, client, compliance, system)
- ✅ Supabase client mocking
- ✅ Success scenarios
- ✅ Auth failure scenarios
- ✅ Validation failure scenarios
- ✅ Soft delete testing
- ✅ **State transition testing**
- ✅ Arrange-Act-Assert pattern

**Usage:**
```bash
# Use scaffold script (recommended)
node scripts/scaffold.js finance Invoice invoices

# Or manual copy
cp src/templates/test.template.js tests/unit/{{entity-name}}.service.test.js

# Replace placeholders and add test cases
```

---

## 🚀 Scaffolding Script

### Automation Script (`scripts/scaffold.js`)

**Purpose:** Automatically generate files from templates with domain awareness

**Usage:**
```bash
# Generate Invoice entity files (with domain)
node scripts/scaffold.js finance Invoice invoices

# Domain options:
# - finance (Financial transactions, invoices, payments)
# - vendor (Vendor management, relationships)
# - client (Client management, cases)
# - compliance (Audit, governance, regulatory)
# - system (Infrastructure, configuration)

# This creates:
# - src/services/invoices.service.js (with domain context)
# - src/routes/invoices.js (SSR page routes - Express)
# - src/routes/invoices-api.js (JSON API routes - Express)
# - migrations/052_create_invoices.sql (with domain in comments)
# - tests/unit/invoices.service.test.js (with domain context)
```

**Domain Injection:**
- Service templates: `static DOMAIN = 'finance'`
- Route templates: Domain in contract header
- Migration templates: Domain in comments
- Test templates: Domain in contract header

**⚠️ Important:** Scaffold generates **Express routes**, not Next.js routes. All routes use Express Router and SSR with Nunjucks.

**Features:**
- ✅ Automatic placeholder replacement
- ✅ Directory creation
- ✅ File generation
- ✅ Validation

---

## 📋 Template Usage Workflow

### Step 1: Generate Files

```bash
# Run scaffold script
node scripts/scaffold.js Invoice invoices
```

### Step 2: Customize Service

```javascript
// src/services/invoice.service.js
export class InvoiceService extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'invoices');
  }

  // Add invoice-specific methods
  async calculateTotal(invoiceId) {
    // Business logic
  }
}
```

### Step 3: Customize Route

```javascript
// src/app/api/invoice/route.js
// Update validation schema
const createSchema = z.object({
  invoice_number: z.string().min(1),
  amount: z.number().positive(),
  // ... invoice-specific fields
});
```

### Step 4: Customize Migration

```sql
-- migrations/052_create_invoices.sql
-- Add invoice-specific fields
invoice_number text not null,
amount numeric not null,
due_date date,
-- ... etc
```

### Step 5: Customize Tests

```javascript
// tests/unit/invoice.service.test.js
// Add invoice-specific test cases
it('should calculate total correctly', async () => {
  // Test logic
});
```

---

## 🔐 Security Features (Built-In)

### Automatic Security

All templates include:

1. **CRUD-S (Soft Delete)**
   - `deleted_at`, `deleted_by` columns
   - RLS policies hide deleted records
   - `softDelete()` and `restore()` methods

2. **Row Level Security (RLS)**
   - Tenant isolation
   - Active records only (soft delete aware)
   - Service role access for admin

3. **Input Validation**
   - Zod schemas
   - Type checking
   - Required field validation

4. **Authentication**
   - Auth guards in routes
   - User context extraction
   - Tenant ID validation

5. **Audit Trail** (Optional)
   - Hash chain integration placeholders
   - `created_by`, `updated_by` tracking
   - Timestamp tracking

---

## 📊 Template Comparison

| Feature | Route Template | Service Template | Migration Template | Test Template |
|---------|---------------|------------------|-------------------|---------------|
| **CRUD-S** | ✅ Via service | ✅ Inherited | ✅ Columns + RLS | ✅ Tested |
| **RLS** | ✅ Context | ✅ Tenant aware | ✅ Policies | ✅ Mocked |
| **Validation** | ✅ Zod | ✅ Service layer | ✅ Constraints | ✅ Tested |
| **Auth** | ✅ Guards | ✅ User context | ✅ References | ✅ Mocked |
| **Error Handling** | ✅ Try/catch | ✅ BaseRepository | ✅ Constraints | ✅ Scenarios |
| **Audit** | 🔄 Optional | 🔄 Placeholder | 🔄 Columns | 🔄 Tested |

---

## 🎯 Template Customization Guide

### When to Customize

**✅ Customize:**
- Business logic (service methods)
- Validation rules (Zod schemas)
- Database fields (migration)
- Test scenarios (test cases)

**❌ Don't Customize:**
- Response format structure
- Error handling patterns
- Auth guard patterns
- RLS policy structure
- BaseRepository inheritance

### Customization Examples

#### Example 1: Add Custom Service Method

```javascript
// src/services/invoice.service.js
export class InvoiceService extends BaseRepository {
  // ... existing code ...

  /**
   * Custom: Calculate invoice total with tax
   */
  async calculateTotalWithTax(invoiceId) {
    const invoice = await this.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    
    const tax = invoice.subtotal * 0.1; // 10% tax
    return invoice.subtotal + tax;
  }
}
```

#### Example 2: Add Custom Validation

```javascript
// src/app/api/invoice/route.js
const createSchema = z.object({
  invoice_number: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string().refine(
    (date) => new Date(date) > new Date(),
    { message: 'Due date must be in the future' }
  ),
});
```

#### Example 3: Add Custom Database Field

```sql
-- migrations/052_create_invoices.sql
create table if not exists public.invoices (
  -- ... standard fields ...
  
  -- Custom invoice fields
  invoice_number text not null unique,
  subtotal numeric not null,
  tax_rate numeric default 0.1,
  total numeric generated always as (subtotal * (1 + tax_rate)) stored,
  
  -- ... rest of template ...
);
```

---

## 🔄 Integration with Existing Patterns

### BaseRepository Integration

Service templates extend `BaseRepository`, which provides:
- `softDelete(id, userId)` - Soft delete with audit
- `restore(id)` - Restore soft-deleted record
- `findById(id)` - Find active record (RLS aware)
- `findAllActive()` - List all active records
- `countActive()` - Count active records

### Hash Chain Integration

Templates include placeholders for audit chain:

```javascript
// In service template
async create(payload) {
  const data = await this.insert(payload);
  
  // Optional: Log to hash chain
  // await this.logAuditChain(data.id, payload);
  
  return data;
}
```

### Pre-signed URL Integration

Templates can be extended for file uploads:

```javascript
// In route template
import { generatePresignedPostUrl } from '@/utils/s3-encryption';

export async function POST(request) {
  // ... existing code ...
  
  // If entity has file uploads
  if (validation.data.file) {
    const presignedUrl = await generatePresignedPostUrl(
      bucketName,
      key,
      validation.data.file.type
    );
    // ... handle upload ...
  }
}
```

---

## 📝 Template Maintenance

### Update Process

1. **Identify Pattern Improvement**
   - Notice pattern that should be standardized
   - Document improvement rationale

2. **Update Template**
   - Modify template file
   - Update documentation
   - Test template generation

3. **Notify Team**
   - Announce template update
   - Provide migration guide if needed

4. **Update Existing Code** (if critical)
   - If pattern is security-critical, update existing code
   - Otherwise, new code uses updated template

### Version Control

- Templates are versioned with architecture
- Template changes = Architecture version bump
- Document template versions in architecture docs

---

## ✅ Template Checklist

### Before Using Template

- [ ] Understand entity requirements
- [ ] Identify required fields
- [ ] Plan business logic methods
- [ ] Identify relationships (parent-child)

### After Generating Files

- [ ] Replace all placeholders (`{{EntityName}}`, `{{entity-name}}`, `{{table_name}}`)
- [ ] Customize validation schema
- [ ] Add business logic methods
- [ ] Add database fields
- [ ] Write test cases
- [ ] Verify RLS policies
- [ ] Test soft delete functionality

### Code Review Checklist

- [ ] Follows template structure
- [ ] All placeholders replaced
- [ ] Validation implemented
- [ ] Error handling present
- [ ] Tests written
- [ ] RLS policies correct
- [ ] Soft delete works

---

## 🚨 Critical Rules

### ✅ DO

1. **Always use templates** for new features
2. **Replace all placeholders** before committing
3. **Customize business logic** as needed
4. **Keep template structure** intact
5. **Test generated code** thoroughly

### ❌ DON'T

1. **Modify templates directly** (they are read-only)
2. **Skip placeholder replacement**
3. **Remove security patterns** (RLS, auth, validation)
4. **Bypass BaseRepository** inheritance
5. **Commit template files** with placeholders

---

## 📚 Related Documentation

### Core Documents
- [`TEMPLATE_CONSTITUTION.md`](./TEMPLATE_CONSTITUTION.md) - **System-grade template doctrine** (v1.1.0)
- [`TEMPLATE_PATTERN_GUIDE.md`](./TEMPLATE_PATTERN_GUIDE.md) - General template pattern
- [`TEMPLATE_SYSTEM_SUMMARY.md`](./TEMPLATE_SYSTEM_SUMMARY.md) - Complete system overview

### Architecture
- [`SOFT_DELETE_CRUD_S_ARCHITECTURE.md`](./SOFT_DELETE_CRUD_S_ARCHITECTURE.md) - CRUD-S pattern
- [`ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md`](./ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md) - Clean stack
- [`CRYPTOGRAPHIC_FINALIZATION_REPORT.md`](../CRYPTOGRAPHIC_FINALIZATION_REPORT.md) - Hash chain and security patterns

### Implementation
- [`BaseRepository`](../../src/services/core/base-repository.js) - Base service class

---

## 🎓 Examples

### Example: Invoice Entity

**Generated Files:**
- `src/services/invoice.service.js`
- `src/app/api/invoice/route.js`
- `migrations/052_create_invoices.sql`
- `tests/unit/invoice.service.test.js`

**Customizations:**
- Added `calculateTotal()` method
- Added `invoice_number` validation
- Added `amount`, `due_date` fields
- Added invoice-specific test cases

---

## ⚠️ Important Notes

### Linter Errors in Templates

**Expected Behavior:** Template files (`*.template.js`, `*.template.sql`) will show linter/TypeScript errors because they contain placeholders like `{{EntityName}}` that are not valid JavaScript/SQL syntax.

**This is Normal:** These errors disappear after running the scaffold script, which replaces all placeholders with actual values.

**To Suppress (Optional):**
- Add to `.eslintignore`: `**/*.template.*`
- Add to `tsconfig.json` exclude: `["**/*.template.*"]`
- Or simply ignore template files in your IDE

**After Scaffolding:** Generated files (without `.template` in name) should have no linter errors.

---

**Document Status:** ✅ **Active**  
**Last Updated:** 2025-01-22  
**Version:** 1.0.0  
**Owner:** Architecture Team

