# Copilot Instructions for Nexus VMP

## Architecture Overview

This is a **Node.js Express + Nunjucks + HTMX** Vendor Management Platform with two parallel systems:
- **Legacy VMP** (`vmp_*` tables, `vmpAdapter`, routes in `server.js`)
- **Nexus Portal** (`nexus_*` tables, `nexusAdapter`, routes in `src/routes/nexus-portal.js`)

### Key Architectural Principle
> "Everyone is a Tenant. Role is contextual based on relationship."

Tenants have both `tenant_client_id` (TC-*) and `tenant_vendor_id` (TV-*). Whether they act as client or vendor depends on their relationship with the counterparty.

## Critical Patterns

### Route-First Development
**Never create HTML without its route first.** Routes must exist before templates.

```javascript
// Route in server.js or nexus-portal.js FIRST
app.get('/case-dashboard', async (req, res) => {
  res.render('pages/case_dashboard.html', { data });
});
```

### File Naming Convention (Strict)
| Context | Style | Example |
|---------|-------|---------|
| Route URL | `kebab-case` | `/partials/case-detail.html` |
| File name | `snake_case` | `case_detail.html` |
| Render call | `snake_case` | `res.render('partials/case_detail.html')` |

### View Locations
- **Pages**: `src/views/pages/` - Full layouts extending `layout.html`
- **Partials**: `src/views/partials/` - HTMX fragments
- **Nexus**: `src/views/nexus/pages/` and `src/views/nexus/partials/`

## Adapter Layer Pattern

**Never call Supabase directly in routes.** Use adapters:
- `vmpAdapter` (src/adapters/supabase.js) - Legacy VMP tables
- `nexusAdapter` (src/adapters/nexus-adapter.js) - Nexus tables

```javascript
// ✅ Correct
const cases = await nexusAdapter.getCases(tenantVendorId);

// ❌ Wrong - direct Supabase call in route
const { data } = await supabase.from('nexus_cases').select('*');
```

## Nexus ID Prefixes

All Nexus entities use explicit prefixed IDs:
- `TNT-` - Tenant ID
- `TC-` - Tenant Client ID
- `TV-` - Tenant Vendor ID
- `USR-` - User ID
- `CASE-` - Case ID
- `PAY-` - Payment ID
- `INV-` - Invoice ID

## Route Implementation Standard

Every route must follow this structure:

```javascript
router.get('/route', async (req, res) => {
  try {
    // 1. Auth check
    if (!req.nexus?.user) return res.redirect('/nexus/login');

    // 2. Input validation
    const { id } = req.params;
    if (!id) return res.status(400).render('nexus/pages/error.html', { error: 'Invalid ID' });

    // 3. Authorization (can user access this resource?)

    // 4. Business logic via adapter
    const data = await nexusAdapter.getData(id);

    // 5. Render
    res.render('nexus/pages/template.html', { data });
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Server error' });
  }
});
```

## Testing Commands

```bash
npm test              # Run Vitest unit tests
npm run test:e2e      # Run Playwright E2E tests
npm run test:coverage # Coverage report
npm run guardrails    # Run project guardrail checks
```

## Local Development

```bash
npm run dev           # Start with nodemon
npx supabase start    # Start local Supabase (Docker required)
npx supabase db reset # Apply migrations from supabase/migrations/
```

Environment files: `.env.local` (local Supabase) overrides `.env` (production).

## Anti-Patterns to Avoid

- ❌ Never use `TODO`, stubs, or placeholder code
- ❌ Never skip error handling or try-catch blocks
- ❌ Never create files in `src/views/` root (use subfolders)
- ❌ Never use inline styles for data presentation (use `.vmp-*` classes)
- ❌ Never leave routes without corresponding templates

## Design System

Use VMP semantic classes for data presentation:
- Typography: `.vmp-h1`, `.vmp-h2`, `.vmp-body`, `.vmp-label`
- Status: `.vmp-text-ok`, `.vmp-text-warning`, `.vmp-text-danger`
- Components: `.vmp-panel`, `.vmp-card`, `.vmp-btn`

For creative/marketing content, add `.vmp-creative` class - then inline styles are allowed.

## Key Files Reference

| Purpose | File |
|---------|------|
| Main server | `server.js` (~11k lines, contains legacy VMP routes) |
| Nexus routes | `src/routes/nexus-portal.js` |
| Nexus adapter | `src/adapters/nexus-adapter.js` |
| Nexus middleware | `src/middleware/nexus-context.js` |
| Design system | `public/globals.css`, `public/css/nexus.css` |
| Migrations | `migrations/*.sql`, `supabase/migrations/` |
