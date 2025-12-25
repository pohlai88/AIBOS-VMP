# Production Optimization Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Production Ready

---

## 📋 Overview

This guide covers production optimization strategies for VMP, including database migrations, seed data management, and test coverage.

---

## 🗄️ Database Optimization

### Migration Management

**Best Practices:**
1. ✅ All migrations are idempotent (safe to re-run)
2. ✅ Migrations are versioned and ordered (001-034)
3. ✅ Seed data is **EXCLUDED** from production
4. ✅ Production safety checks are built-in

**Apply Migrations:**
```bash
# Using Supabase CLI (recommended)
supabase db push

# Using migration script
node scripts/apply-migrations.js --env=production
```

**Verify Migrations:**
```bash
# Check migration status
supabase migration list

# Verify schema
supabase db diff
```

### Index Optimization

Migration `008_vmp_performance_indexes.sql` adds:
- Foreign key indexes (10 indexes)
- Query optimization indexes (status, created_at, etc.)
- Composite indexes for common query patterns
- **Impact:** 5-10x faster queries

**Verify Indexes:**
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Security Hardening

1. **RLS Enabled:** Migration `009_vmp_security_rls.sql`
2. **Function Security:** Migration `010_vmp_function_security.sql`
3. **Cascade Rules:** Migration `011_vmp_foreign_key_cascade_fix.sql`

**Verify Security:**
```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'vmp_%';
```

---

## 🌱 Seed Data Management

### ⚠️ CRITICAL: Production Safety

**Seed data (`035_vmp_seed_demo_data.sql`) MUST NEVER be applied to production.**

**Production Safety Check:**
```sql
-- Built into seed migration
DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'Seed data migration cannot be applied to production';
  END IF;
END $$;
```

### Seed Data Application

**Development/Staging Only:**
```bash
# Using Supabase CLI
NODE_ENV=development supabase db push --include-seed

# Using migration script
node scripts/apply-migrations.js --env=development --include-seed
```

---

## 🧪 Test Coverage Optimization

### Coverage Targets

- **Unit Tests:** 95% coverage
- **Integration Tests:** 90% coverage
- **E2E Tests:** 100% (critical paths)
- **Overall:** 95% coverage

### Test Execution

**Run All Tests:**
```bash
# Unit + Integration + E2E
npm run test:all

# With coverage report
npm run test:coverage
```

**Run Specific Suites:**
```bash
# Components
npm run test:components

# Adapters
npm run test:adapters

# E2E
npm run test:e2e
```

### Coverage Reports

**Generate Report:**
```bash
npm run test:coverage
```

**View Report:**
```bash
# HTML report
open coverage/index.html
```

---

## 🚀 Performance Optimization

### Database Queries

**Optimization Strategies:**
1. Use indexes for frequently queried columns
2. Use composite indexes for common query patterns
3. Batch operations when possible
4. Use connection pooling

**Query Performance:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM vmp_cases WHERE vendor_id = '...';

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

### Application Performance

**Optimization Strategies:**
1. Use async/await for I/O operations
2. Implement request timeouts
3. Use caching for frequently accessed data
4. Optimize HTMX partial updates

**Performance Monitoring:**
```javascript
// Add performance logging
console.time('operation');
await performOperation();
console.timeEnd('operation');
```

---

## 🔒 Security Optimization

### Authentication

**Best Practices:**
1. Use bcrypt for password hashing (10 rounds)
2. Implement session expiration
3. Use secure session storage (PostgreSQL)
4. Implement rate limiting

**Verify Security:**
```bash
# Check password hashing
node scripts/verify-password-hashing.js

# Check session storage
psql -c "SELECT COUNT(*) FROM session;"
```

### Data Protection

**Best Practices:**
1. Enable RLS on all tables
2. Use tenant-based isolation
3. Implement audit logging
4. Encrypt sensitive data

**Verify Protection:**
```sql
-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

---

## 📊 Monitoring & Logging

### Application Logging

**Winston Configuration:**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Database Monitoring

**Query Performance:**
```sql
-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Connection Monitoring:**
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;
```

---

## ✅ Production Checklist

### Pre-Deployment

- [ ] All migrations applied and verified
- [ ] Seed data excluded from production
- [ ] Indexes created and verified
- [ ] RLS policies production-ready
- [ ] Security hardening verified
- [ ] Test coverage meets threshold (95%)
- [ ] Performance benchmarks met
- [ ] Backup strategy verified

### Post-Deployment

- [ ] Migration history verified
- [ ] Database schema validated
- [ ] Performance monitoring active
- [ ] Error logging configured
- [ ] Security audit passed
- [ ] Backup verification successful

---

## 📚 Related Documentation

- `docs/integrations/SUPABASE_MCP_MIGRATION_GUIDE.md` - Migration guide
- `docs/development/TESTING_GUIDE.md` - Testing guide
- `migrations/README.md` - Migration reference
- `tests/COVERAGE_PLAN.md` - Coverage plan

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-01-22

