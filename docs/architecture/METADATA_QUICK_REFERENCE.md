# Metadata Control Protocol: Quick Reference

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Quick reference card for Metadata-Driven Architecture  
**Related:** [METADATA_CONTROL_PROTOCOL.md](./METADATA_CONTROL_PROTOCOL.md)  
**Auto-Generated:** No

---

## 🎯 Core Concept

> **"Metadata is the Control Plane"** - Business controls rules, Database enforces structure, Code obeys both.

---

## 📐 Three-Layer Governance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL CHECK constraints | Hard stop - prevents invalid data |
| **Application** | Zod schemas | Validator - enforces structure |
| **Adapter** | Parse functions | Gatekeeper - ensures typed data |

---

## 🔧 Common Patterns

### 1. Parse Metadata in Adapter

```javascript
import { parseOrgMetadata } from '@/schemas/metadata.schema.js';

export function adaptTenant(row) {
  const safeMetadata = parseOrgMetadata(row.metadata);
  return { ...row, config: safeMetadata };
}
```

### 2. Check Quota in Middleware

```javascript
import { checkQuota } from '@/middleware/governance.js';

app.post('/api/users', 
  authenticate,
  checkQuota('users'),
  userController.create
);
```

### 3. Require Feature Flag

```javascript
import { requireFeature } from '@/middleware/governance.js';

app.post('/api/reports/advanced', 
  authenticate,
  requireFeature('ai_reports'),
  reportController.createAdvanced
);
```

### 4. Update Metadata via Admin API

```javascript
PATCH /api/admin/organizations/:tenantId/metadata
{
  "plan_config": { "max_users": 100 },
  "feature_flags": { "ai_reports": true }
}
```

---

## 📊 Metadata Structure

### Organization Metadata (`nexus_tenants.metadata`)

```json
{
  "plan_config": {
    "max_users": 10,
    "retention_days": 30,
    "can_export": false,
    "max_storage_gb": 5,
    "tier": "basic"
  },
  "feature_flags": {
    "beta_dashboard": false,
    "ai_reports": false
  },
  "ui_preferences": {
    "theme": "system",
    "primary_color": "#0066CC"
  }
}
```

### User Preferences (`nexus_users.preferences`)

```json
{
  "ui": {
    "theme": "dark",
    "sidebar_collapsed": false,
    "dashboard_layout": "grid"
  },
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  },
  "limits": {
    "reports_per_day": 10
  }
}
```

---

## 🚨 Common Issues & Solutions

### Issue: Zod validation errors

**Solution:** Add error handling in parse functions:

```javascript
export function parseOrgMetadata(raw) {
  try {
    return OrgMetadataSchema.parse(raw || {});
  } catch (error) {
    console.error('Metadata validation failed:', error);
    return OrgMetadataSchema.parse({}); // Return defaults
  }
}
```

### Issue: Middleware not blocking

**Check:**
- Is `req.user.organization` populated?
- Is `org.config` the parsed metadata (not raw JSONB)?

### Issue: Admin updates not working

**Check:**
- Is metadata being merged correctly?
- Are adapters re-parsing on next request?

---

## 📝 Quick Checklist

- [ ] Zod installed: `npm install zod`
- [ ] Schemas activated in `src/schemas/metadata.schema.js`
- [ ] Adapters updated to use parse functions
- [ ] Middleware created (`checkQuota`, `requireFeature`)
- [ ] Admin API created for metadata updates
- [ ] Tests written (unit, integration, E2E)

---

## 🔗 Related Documentation

- [Full Protocol](./METADATA_CONTROL_PROTOCOL.md) - Complete governance framework
- [Implementation Guide](./METADATA_IMPLEMENTATION_GUIDE.md) - Step-by-step setup
- [Database Standards](./DATABASE_STANDARDS.md) - Database design principles

---

**Document Status:** ✅ Active  
**Last Updated:** 2025-01-22

