# NEXUS GLOBALCONFIG - Admin & Configuration Architecture

> **Positioning:** Platform Spine + Tenant Orchestrator + ERP Ecosystem Gateway

**Document Status:** SSOT Architecture Document  
**Last Updated:** 2025-12-26  
**Version:** v0.1.0  
**Scope:** Super Admin, Global Configuration, Multi-Canon Integration

---

## 0) One-liner

**NexusGlobalConfig** is the **administrative backbone** that provisions tenants, configures workflows, manages integrations, and connects NexusCanon (VMP/CMP) to the broader **AI-BOS ERP Ecosystem**—ensuring consistent governance across all tenant instances.

---

## 1) Purpose

### 1.1 What GlobalConfig Controls
- **Tenant Provisioning** - Create, configure, suspend tenants
- **User Management** - Super admin users, role templates
- **Workflow Configuration** - Approval chains, SLA rules, escalation paths
- **Integration Management** - ERP adapters, API keys, webhooks
- **System Configuration** - Feature flags, global settings, rate limits
- **Audit & Compliance** - System-wide audit logs, compliance reports

### 1.2 What GlobalConfig Does NOT Do
- ❌ Process individual invoices (that's CMP)
- ❌ Handle vendor communications (that's VMP)
- ❌ Execute payments (that's Finance Canon)
- ❌ Own business data (that belongs to tenants)

---

## 2) Architecture Overview

### 2.1 System Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXUS GLOBALCONFIG (Super Admin)                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Tenant Management    • Integration Registry    • Audit Logs │ │
│  │ • Workflow Templates   • Feature Flags           • Analytics  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   TENANT INSTANCE   │   │   TENANT INSTANCE   │   │   TENANT INSTANCE   │
│   (Alpha Corp)      │   │   (Beta Services)   │   │   (Gamma Group)     │
├─────────────────────┤   ├─────────────────────┤   ├─────────────────────┤
│ ┌─────┐   ┌─────┐  │   │ ┌─────┐   ┌─────┐  │   │ ┌─────┐   ┌─────┐  │
│ │ CMP │   │ VMP │  │   │ │ CMP │   │ VMP │  │   │ │ CMP │   │ VMP │  │
│ │Client│   │Vendor│  │   │Client│   │Vendor│  │   │Client│   │Vendor│  │
│ └─────┘   └─────┘  │   └─────┘   └─────┘  │   └─────┘   └─────┘  │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AI-BOS ERP ECOSYSTEM                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Finance Canon│  │Inventory Canon│  │ HR Canon    │  (Future)    │
│  │ (AP/AR/GL)   │  │ (Stock/WMS)  │  │ (Payroll)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Multi-Tenancy Model

```
GLOBAL (Platform Level)
├── nexus_platform_config      # System-wide settings
├── nexus_feature_flags        # Feature toggles
├── nexus_integration_registry # ERP adapter configs
├── nexus_workflow_templates   # Reusable workflow definitions
└── nexus_super_admins         # Platform administrators

TENANT (Instance Level) - Already exists in nexus_*
├── nexus_tenants              # Tenant profiles
├── nexus_users                # Tenant users
├── nexus_notification_config  # Tenant notification settings
└── [All other nexus_* tables]
```

---

## 3) GlobalConfig Domain Objects

### 3.1 Platform Configuration

```sql
-- nexus_platform_config
CREATE TABLE nexus_platform_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key      TEXT UNIQUE NOT NULL,
    config_value    JSONB NOT NULL,
    description     TEXT,
    is_sensitive    BOOLEAN DEFAULT false,  -- Mask in UI
    updated_at      TIMESTAMPTZ DEFAULT now(),
    updated_by      UUID  -- super_admin user
);

-- Example configs:
-- platform.name: "NexusCanon VMP"
-- platform.version: "1.0.0"
-- session.timeout_minutes: 30
-- rate_limit.requests_per_minute: 100
-- maintenance.scheduled: null
```

### 3.2 Feature Flags

```sql
-- nexus_feature_flags
CREATE TABLE nexus_feature_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key        TEXT UNIQUE NOT NULL,
    enabled         BOOLEAN DEFAULT false,
    
    -- Targeting
    scope           TEXT DEFAULT 'global',  -- global | tenant | user
    tenant_ids      TEXT[],                 -- If scope = tenant
    user_ids        TEXT[],                 -- If scope = user
    
    -- Rollout
    rollout_percent INTEGER DEFAULT 100,    -- Gradual rollout
    
    -- Metadata
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Example flags:
-- feature.realtime_notifications: true (global)
-- feature.soa_reconciliation: true (tenant-specific)
-- feature.ai_agent: false (beta users only)
-- feature.payment_run_v2: 50% rollout
```

### 3.3 Integration Registry

```sql
-- nexus_integration_registry
CREATE TABLE nexus_integration_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Integration identity
    integration_key TEXT UNIQUE NOT NULL,   -- e.g., "erp.autocount", "erp.sap"
    display_name    TEXT NOT NULL,
    category        TEXT NOT NULL,          -- erp | payment | notification | storage
    
    -- Connection config (encrypted)
    config          JSONB NOT NULL,         -- {base_url, api_version, ...}
    credentials     JSONB,                  -- Encrypted: {api_key, secret, ...}
    
    -- Status
    status          TEXT DEFAULT 'inactive',-- inactive | active | error
    last_health_check TIMESTAMPTZ,
    health_status   TEXT,                   -- healthy | degraded | down
    
    -- Tenant assignment
    scope           TEXT DEFAULT 'global',  -- global | tenant-specific
    tenant_ids      TEXT[],                 -- Which tenants use this
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Example integrations:
-- erp.autocount: Legacy ERP adapter
-- erp.aibos_finance: AI-BOS Finance Canon
-- payment.wise: Wise payment gateway
-- notification.twilio: WhatsApp/SMS
-- storage.supabase: File storage
```

### 3.4 Workflow Templates

```sql
-- nexus_workflow_templates
CREATE TABLE nexus_workflow_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    template_key    TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    category        TEXT NOT NULL,          -- invoice | payment | onboarding | document
    
    -- Definition (JSONB workflow DSL)
    definition      JSONB NOT NULL,
    /*
    {
      "states": ["draft", "pending_approval", "approved", "rejected"],
      "transitions": [
        {"from": "draft", "to": "pending_approval", "action": "submit"},
        {"from": "pending_approval", "to": "approved", "action": "approve", "conditions": ["amount < 5000"]},
        {"from": "pending_approval", "to": "rejected", "action": "reject"}
      ],
      "approvers": {
        "level_1": {"threshold": 5000, "roles": ["ap_clerk"]},
        "level_2": {"threshold": 25000, "roles": ["ap_manager"]},
        "level_3": {"threshold": null, "roles": ["finance_director"]}
      }
    }
    */
    
    -- Versioning
    version         INTEGER DEFAULT 1,
    is_active       BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Super Admins

```sql
-- nexus_super_admins (Platform-level admins, NOT tenant users)
CREATE TABLE nexus_super_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    admin_id        TEXT UNIQUE NOT NULL,   -- SADM-XXXXXXXX
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    
    -- Profile
    display_name    TEXT NOT NULL,
    phone           TEXT,
    
    -- Permissions
    permissions     TEXT[] DEFAULT ARRAY['read'],
    -- Possible: read, write, tenant_manage, integration_manage, super
    
    -- Status
    status          TEXT DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    
    -- Audit
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      UUID
);
```

---

## 4) GlobalConfig Canon Map

### Molecule GC-01 — Tenant Management
- GC-01-01 Tenant List (all tenants in platform)
- GC-01-02 Tenant Detail (profile, config, usage)
- GC-01-03 Tenant Provisioning (create new tenant)
- GC-01-04 Tenant Suspension/Reactivation
- GC-01-05 Tenant Data Export
- GC-01-06 Tenant Deletion (with audit trail)

### Molecule GC-02 — User Administration
- GC-02-01 Super Admin Management
- GC-02-02 Role Template Configuration
- GC-02-03 Cross-Tenant User Search
- GC-02-04 User Impersonation (for support)
- GC-02-05 Password Policy Configuration

### Molecule GC-03 — Workflow Configuration
- GC-03-01 Workflow Template Library
- GC-03-02 Template Editor (visual or YAML)
- GC-03-03 Template Assignment to Tenants
- GC-03-04 Workflow Analytics (bottlenecks, timing)
- GC-03-05 Template Versioning

### Molecule GC-04 — Integration Management
- GC-04-01 Integration Registry
- GC-04-02 Integration Configuration
- GC-04-03 Health Monitoring Dashboard
- GC-04-04 Credential Rotation
- GC-04-05 Integration Logs & Debugging

### Molecule GC-05 — System Configuration
- GC-05-01 Platform Settings
- GC-05-02 Feature Flag Management
- GC-05-03 Rate Limit Configuration
- GC-05-04 Maintenance Mode Toggle
- GC-05-05 Backup & Recovery

### Molecule GC-06 — Audit & Compliance
- GC-06-01 Global Audit Log Viewer
- GC-06-02 Compliance Report Generator
- GC-06-03 Data Retention Policies
- GC-06-04 GDPR/Privacy Tools
- GC-06-05 Security Incident Logs

### Molecule GC-07 — Analytics & Monitoring
- GC-07-01 Platform Health Dashboard
- GC-07-02 Tenant Usage Analytics
- GC-07-03 Performance Metrics
- GC-07-04 Error Rate Monitoring
- GC-07-05 Cost/Resource Tracking

---

## 5) ERP Ecosystem Integration Architecture

### 5.1 Adapter Pattern (Hexagonal)

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS CORE                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    PORT INTERFACES                          ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ││
│  │  │InvoicePort │ │PaymentPort │ │ VendorPort │ │StoragePort││
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  ADAPTER    │       │  ADAPTER    │       │  ADAPTER    │
│ Autocount   │       │ AI-BOS      │       │ SAP B1      │
│ (Legacy)    │       │ Finance     │       │ (Future)    │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                     │
       ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Autocount  │       │  AI-BOS     │       │  SAP B1     │
│  Database   │       │  Finance    │       │  API        │
└─────────────┘       └─────────────┘       └─────────────┘
```

### 5.2 Port Interface Definitions

```typescript
// Invoice Port - What Nexus needs from ERP
interface InvoicePort {
  // Inbound (ERP → Nexus)
  getOpenInvoices(vendorId: string): Promise<Invoice[]>;
  getInvoiceDetail(invoiceId: string): Promise<Invoice>;
  
  // Outbound (Nexus → ERP)
  syncInvoiceStatus(invoiceId: string, status: string): Promise<void>;
  createInvoice(invoice: Invoice): Promise<string>;
}

// Payment Port - What Nexus needs from ERP
interface PaymentPort {
  // Inbound
  getPaymentHistory(vendorId: string): Promise<Payment[]>;
  getPaymentDetail(paymentId: string): Promise<Payment>;
  
  // Outbound
  schedulePayment(payment: Payment): Promise<string>;
  cancelPayment(paymentId: string): Promise<void>;
  getRemittanceAdvice(paymentId: string): Promise<RemittanceAdvice>;
}

// Vendor Port - What Nexus needs from ERP
interface VendorPort {
  // Inbound
  getVendorMaster(vendorId: string): Promise<VendorMaster>;
  searchVendors(query: string): Promise<VendorMaster[]>;
  
  // Outbound
  createVendor(vendor: VendorMaster): Promise<string>;
  updateVendor(vendorId: string, updates: Partial<VendorMaster>): Promise<void>;
}

// Storage Port - File management
interface StoragePort {
  upload(file: Buffer, path: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
}
```

### 5.3 Adapter Implementation Example

```javascript
// src/adapters/erp/aibos-finance-adapter.js

const { InvoicePort, PaymentPort, VendorPort } = require('../ports');

class AIBOSFinanceAdapter {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;
  }

  // Implements InvoicePort
  async getOpenInvoices(vendorId) {
    const response = await this.request('GET', `/invoices?vendor=${vendorId}&status=open`);
    return response.data.map(this.mapInvoice);
  }

  // Implements PaymentPort
  async schedulePayment(payment) {
    const response = await this.request('POST', '/payments', {
      vendor_id: payment.vendorId,
      invoice_refs: payment.invoiceRefs,
      amount: payment.amount,
      payment_date: payment.scheduledDate,
    });
    return response.data.payment_id;
  }

  // Implements VendorPort
  async getVendorMaster(vendorId) {
    const response = await this.request('GET', `/vendors/${vendorId}`);
    return this.mapVendor(response.data);
  }

  // Internal helpers
  async request(method, path, body = null) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Tenant-ID': this.tenantId,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });
    
    if (!response.ok) {
      throw new IntegrationError(`AIBOS Finance: ${response.statusText}`);
    }
    
    return response.json();
  }

  mapInvoice(raw) {
    return {
      invoiceId: raw.invoice_id,
      vendorId: raw.vendor_id,
      invoiceNumber: raw.invoice_num,
      amount: parseFloat(raw.amount),
      currency: raw.currency,
      status: raw.status,
      dueDate: new Date(raw.due_date),
    };
  }

  mapVendor(raw) {
    return {
      vendorId: raw.vendor_id,
      name: raw.company_name,
      email: raw.contact_email,
      taxId: raw.tax_id,
      bankDetails: raw.bank_info,
    };
  }
}

module.exports = { AIBOSFinanceAdapter };
```

### 5.4 Adapter Factory

```javascript
// src/adapters/erp/adapter-factory.js

const { AIBOSFinanceAdapter } = require('./aibos-finance-adapter');
const { AutocountAdapter } = require('./autocount-adapter');
const { ManualAdapter } = require('./manual-adapter');

class AdapterFactory {
  static create(integrationKey, config) {
    switch (integrationKey) {
      case 'erp.aibos_finance':
        return new AIBOSFinanceAdapter(config);
      case 'erp.autocount':
        return new AutocountAdapter(config);
      case 'erp.manual':
        return new ManualAdapter(config);
      default:
        throw new Error(`Unknown integration: ${integrationKey}`);
    }
  }

  static async getForTenant(tenantId) {
    // Look up tenant's configured integration
    const config = await nexusAdapter.getTenantIntegration(tenantId);
    return this.create(config.integrationKey, config.settings);
  }
}

module.exports = { AdapterFactory };
```

---

## 6) GlobalConfig Routes

### 6.1 Route Structure

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /admin | Dashboard | super_admin |
| GET | /admin/tenants | Tenant list | super_admin |
| GET | /admin/tenants/:id | Tenant detail | super_admin |
| POST | /admin/tenants | Create tenant | super_admin |
| PUT | /admin/tenants/:id | Update tenant | super_admin |
| POST | /admin/tenants/:id/suspend | Suspend tenant | super_admin |
| GET | /admin/users | Super admin list | super_admin |
| POST | /admin/users | Create admin | super_admin |
| GET | /admin/workflows | Workflow templates | super_admin |
| POST | /admin/workflows | Create template | super_admin |
| GET | /admin/integrations | Integration registry | super_admin |
| POST | /admin/integrations | Register integration | super_admin |
| POST | /admin/integrations/:id/test | Test connection | super_admin |
| GET | /admin/config | Platform config | super_admin |
| PUT | /admin/config/:key | Update config | super_admin |
| GET | /admin/flags | Feature flags | super_admin |
| PUT | /admin/flags/:key | Toggle flag | super_admin |
| GET | /admin/audit | Audit logs | super_admin |

**File:** `src/routes/nexus-admin.js`

---

## 7) Security Model

### 7.1 Super Admin Authentication
- Separate authentication from tenant users
- MFA required for all super admins
- Session timeout: 15 minutes
- IP allowlist (optional)

### 7.2 Permission Levels
```yaml
permissions:
  read:
    - View all dashboards
    - View tenant list
    - View audit logs
  
  write:
    - Update configurations
    - Manage feature flags
    - Edit workflow templates
  
  tenant_manage:
    - Create/suspend tenants
    - Impersonate users (for support)
  
  integration_manage:
    - Register integrations
    - Rotate credentials
    - View sensitive configs
  
  super:
    - Manage super admins
    - Access all functions
    - Emergency operations
```

### 7.3 Audit Trail
Every GlobalConfig action is logged:
```sql
-- nexus_admin_audit_log
CREATE TABLE nexus_admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        TEXT NOT NULL,          -- SADM-XXXXXXXX
    action          TEXT NOT NULL,          -- tenant.create, config.update, etc.
    target_type     TEXT,                   -- tenant, config, integration
    target_id       TEXT,                   -- ID of affected resource
    details         JSONB,                  -- Before/after values
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 8) Implementation Phases

### Phase GC-1: Foundation (Sprint 1)
- [ ] Super admin authentication
- [ ] Basic admin dashboard
- [ ] Tenant list view
- [ ] Platform config viewer

### Phase GC-2: Tenant Management (Sprint 2)
- [ ] Tenant provisioning wizard
- [ ] Tenant configuration editor
- [ ] Tenant suspension workflow
- [ ] User impersonation

### Phase GC-3: Integration Framework (Sprint 3)
- [ ] Integration registry UI
- [ ] Adapter factory pattern
- [ ] AI-BOS Finance adapter (first)
- [ ] Health check dashboard

### Phase GC-4: Workflow Engine (Sprint 4)
- [ ] Workflow template schema
- [ ] Template editor (basic)
- [ ] Template assignment to tenants
- [ ] Workflow execution engine

### Phase GC-5: Monitoring & Analytics (Sprint 5)
- [ ] Platform health dashboard
- [ ] Tenant usage metrics
- [ ] Error rate monitoring
- [ ] Performance tracking

### Phase GC-6: Compliance & Audit (Sprint 6)
- [ ] Audit log viewer
- [ ] Compliance report generator
- [ ] Data retention automation
- [ ] GDPR tools

---

## 9) Database Migration Plan

### 9.1 New Tables (GlobalConfig-specific)

```
migrations/
├── 060_nexus_platform_config.sql
├── 061_nexus_feature_flags.sql
├── 062_nexus_integration_registry.sql
├── 063_nexus_workflow_templates.sql
├── 064_nexus_super_admins.sql
└── 065_nexus_admin_audit_log.sql
```

### 9.2 Schema Extensions (Existing tables)

```sql
-- Add to nexus_tenants
ALTER TABLE nexus_tenants ADD COLUMN
    integration_key TEXT DEFAULT 'erp.manual',  -- Which ERP adapter
    workflow_config JSONB DEFAULT '{}',         -- Tenant-specific overrides
    feature_overrides JSONB DEFAULT '{}',       -- Feature flag overrides
    usage_stats JSONB DEFAULT '{}';             -- Usage tracking
```

---

## 10) Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tenant provisioning time | < 5 minutes | Wizard to active |
| Integration health uptime | > 99.9% | Health check success rate |
| Admin action audit coverage | 100% | All actions logged |
| Mean time to impersonate | < 30 seconds | Support efficiency |
| Config change rollback time | < 2 minutes | Recovery speed |

---

## 11) Companion Documents

| Document | Purpose |
|----------|---------|
| `__nexus_canon_vmp_consolidated_final_paper.md` | Vendor-facing PRD |
| `___NEXUS_CLIENT_PRD.md` | Client-facing PRD |
| `___NEXUS_CLIENT_MASTERCCP.md` | Client implementation CCP |
| `___NEXUS_MASTERCCP.md` | Vendor implementation CCP |
| `___NEXUS_GLOBALCONFIG.md` | This document |

---

## 12) Changelog

| Date | Version | Change |
|------|---------|--------|
| 2025-12-26 | v0.1.0 | Initial GlobalConfig architecture document |

---

**Document Status:** SSOT Architecture Document  
**Last Updated:** 2025-12-26  
**Version:** v0.1.0
