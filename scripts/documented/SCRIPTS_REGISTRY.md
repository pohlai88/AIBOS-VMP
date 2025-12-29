# Scripts Registry

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Central registry of all documented/production scripts  
**Status:** Active

---

## Registry Purpose

This registry provides:
- **Complete inventory** of all documented scripts
- **Usage instructions** and examples
- **Dependencies** and requirements
- **Maintenance status** tracking
- **Quick reference** for finding scripts

---

## Script Categories

### Database & Migrations

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `apply-migrations.js` | Apply database migrations | `node scripts/documented/apply-migrations.js [--env=production]` | Supabase MCP/CLI |
| `apply-soa-migrations.js` | Apply SOA-specific migrations | `node scripts/documented/apply-soa-migrations.js` | Supabase |

### Setup & Configuration

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `create-exec-sql-function.js` | Create SQL execution function | `node scripts/documented/create-exec-sql-function.js` | Supabase |
| `create-supabase-auth-user.js` | Create Supabase auth user | `node scripts/documented/create-supabase-auth-user.js` | Supabase |
| `create-super-admin.js` | Create super admin user | `node scripts/documented/create-super-admin.js` | Supabase |
| `generate-vapid-keys.js` | Generate VAPID keys for push notifications | `node scripts/documented/generate-vapid-keys.js` | - |
| `promote-user-to-admin.js` | Promote user to admin role | `node scripts/documented/promote-user-to-admin.js <user-id>` | Supabase |
| `reload-schema-cache.js` | Reload Supabase schema cache | `node scripts/documented/reload-schema-cache.js` | Supabase |
| `set-password.js` | Set user password | `npm run set-password` | Supabase |
| `setup-default-tenant-vendor.js` | Setup default tenant vendor | `node scripts/documented/setup-default-tenant-vendor.js` | Supabase |
| `supabase-secrets-setup.sh` | Setup Supabase secrets | `bash scripts/documented/supabase-secrets-setup.sh` | Supabase CLI |

### Data Seeding

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `seed-dev-org-tree.js` | Seed development org tree | `node scripts/documented/seed-dev-org-tree.js` | Supabase |
| `seed-vmp-data.js` | Seed VMP data | `npm run seed` | Supabase |

### Validation & Health Checks

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `check-auth-user.js` | Check auth user status | `node scripts/documented/check-auth-user.js <user-id>` | Supabase |
| `check-db-health.js` | Check database health | `node scripts/documented/check-db-health.js` | Supabase |
| `validate-docs-naming.mjs` | Validate documentation naming | `npm run validate:docs` | Node.js |
| `validate-email-config.js` | Validate email configuration | `node scripts/documented/validate-email-config.js` | Nodemailer |
| `validate-super-admin.js` | Validate super admin setup | `node scripts/documented/validate-super-admin.js` | Supabase |
| `verify-dev-account.js` | Verify development account | `node scripts/documented/verify-dev-account.js` | Supabase |
| `verify_routes.js` | Verify route definitions | `node scripts/documented/verify_routes.js` | Express |

### Utilities

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `soa-matching-engine.js` | SOA matching engine utility | `node scripts/documented/soa-matching-engine.js` | - |
| `sync-demo-auth-users.js` | Sync demo auth users | `node scripts/documented/sync-demo-auth-users.js` | Supabase |

### SQL Scripts

| Script | Purpose | Usage | Dependencies |
|--------|---------|-------|--------------|
| `cleanup-test-notifications.sql` | Cleanup test notifications | Run in Supabase SQL editor | PostgreSQL |
| `nexus-data-integrity-check.sql` | Check Nexus data integrity | Run in Supabase SQL editor | PostgreSQL |
| `nexus-post-migration-validation.sql` | Post-migration validation | Run in Supabase SQL editor | PostgreSQL |
| `nexus-pre-migration-check.sql` | Pre-migration checks | Run in Supabase SQL editor | PostgreSQL |
| `nexus-validation-single-query.sql` | Single query validation | Run in Supabase SQL editor | PostgreSQL |
| `promote-user-to-admin.sql` | SQL version of promote script | Run in Supabase SQL editor | PostgreSQL |

---

## Scripts Referenced in package.json

These scripts are available via npm commands:

| npm Command | Script | Purpose |
|------------|--------|---------|
| `npm run set-password` | `set-password.js` | Set user password |
| `npm run seed` | `seed-vmp-data.js` | Seed VMP data |
| `npm run validate:docs` | `validate-docs-naming.mjs` | Validate documentation naming |
| `npm run guardrails` | `vmp-guardrails-check.mjs` | Run guardrails check |

---

## Maintenance Guidelines

### Adding New Scripts

1. **Place in appropriate category:**
   - Production/utility scripts → `scripts/documented/`
   - One-time/cleanup scripts → `scripts/temporary/`

2. **Update this registry:**
   - Add entry with purpose, usage, dependencies
   - Include in appropriate category

3. **Add to package.json (if needed):**
   - If script should be run via npm command
   - Use descriptive command name

### Script Standards

- **Documentation:** All documented scripts must have:
  - Header comment with purpose
  - Usage instructions
  - Dependencies listed
  - Error handling

- **Naming:** Use kebab-case for script names
- **Shebang:** Include `#!/usr/bin/env node` for Node.js scripts

---

## Quick Reference

### Most Used Scripts

```bash
# Database migrations
node scripts/documented/apply-migrations.js

# Setup
npm run seed
npm run set-password

# Validation
npm run validate:docs
npm run guardrails

# Health checks
node scripts/documented/check-db-health.js
```

---

**Registry Last Updated:** 2025-12-28  
**Total Documented Scripts:** 30  
**Status:** Active

