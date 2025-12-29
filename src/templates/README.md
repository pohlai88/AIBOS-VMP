# Application Templates

**Purpose:** Operational templates that enforce sustainability and security architectures

**Status:** ✅ Active

---

## 📋 Template Files

| File | Purpose | Usage |
|------|---------|-------|
| `route.page.template.js` | Express SSR page route template | Copy to `src/routes/{{entity-name}}.js` |
| `route.api.template.js` | Express JSON API route template | Copy to `src/routes/{{entity-name}}-api.js` |
| `service.template.js` | Service layer template | Copy to `src/services/{{entity-name}}.service.js` |
| `migration.template.sql` | Database migration template | Copy to `migrations/XXX_create_{{table_name}}.sql` |
| `test.template.js` | Test template | Copy to `tests/unit/{{entity-name}}.service.test.js` |

---

## 🚀 Quick Start

### Option 1: Use Scaffold Script (Recommended)

```bash
# Generate all files automatically (with domain)
node scripts/scaffold.js finance Invoice invoices
```

### Option 2: Manual Copy

```bash
# 1. Copy service template
cp src/templates/service.template.js src/services/invoice.service.js

# 2. Copy route templates (choose based on need)
cp src/templates/route.page.template.js src/routes/invoice.js      # SSR pages
cp src/templates/route.api.template.js src/routes/invoice-api.js   # JSON API

# 3. Replace placeholders:
# {{EntityName}} → Invoice
# {{entity-name}} → invoice
# {{table_name}} → invoices
# {{Domain}} → finance

# 4. Mount routes in server.js:
# app.use('/invoice', invoiceRouter);
# app.use('/api/invoice', invoiceApiRouter);

# 5. Customize for your entity
```

---

## 🔄 Placeholders

All templates use these placeholders that must be replaced:

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{{EntityName}}` | `Invoice` | PascalCase entity name |
| `{{entity-name}}` | `invoice` | kebab-case entity name |
| `{{table_name}}` | `invoices` | snake_case table name |
| `{{Date}}` | `2025-01-22` | Current date (auto-replaced by scaffold) |
| `{{Description}}` | `Invoice entity` | Entity description |
| `{{EntityDescription}}` | `invoice` | Lowercase entity description |

---

## ⚠️ Important Notes

1. **Template Files Are Read-Only** - Never modify templates directly
2. **Linter Errors Expected** - Templates have placeholders that cause linter errors until replaced
3. **Replace All Placeholders** - Before using generated files, replace all `{{...}}` placeholders
4. **Customize After Generation** - Add entity-specific logic after generating from template

---

## 📚 Documentation

- [`APPLICATION_TEMPLATE_SYSTEM.md`](../../docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md) - Complete guide
- [`TEMPLATE_PATTERN_GUIDE.md`](../../docs/architecture/TEMPLATE_PATTERN_GUIDE.md) - General template pattern

---

**Last Updated:** 2025-01-22

