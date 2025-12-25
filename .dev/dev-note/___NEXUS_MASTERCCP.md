# NEXUS PORTAL - MASTER PLAN PRD

**Version:** 1.4
**Created:** 2025-12-25
**Updated:** 2025-12-26
**Status:** IN PROGRESS
**Last CCP Verified:** Phase 10 Complete (CCP-7), Phase 11 Ready

---

## Critical Control Points (CCP)

> **CCP = Checkpoint before proceeding. STOP and verify before moving forward.**

| CCP | Gate | Status | Verified |
|-----|------|--------|----------|
| CCP-1 | Schema migrations exist (040-045) | ✅ PASS | 2025-12-25 |
| CCP-2 | Adapter has all CRUD functions | ✅ PASS | 2025-12-25 |
| CCP-3 | Routes match adapter functions | ✅ PASS | 2025-12-25 |
| CCP-4 | Templates match routes | ✅ PASS | 2025-12-25 |
| CCP-5 | Migrations executed on Supabase | ✅ PASS | 2025-12-25 |
| CCP-6 | Demo seed data inserted | ✅ PASS | 2025-12-25 |
| CCP-7 | Supabase Auth integration working | ✅ PASS | 2025-12-26 |
| CCP-8 | All 10 validation checks pass | ⏳ READY | - |
| CCP-9 | Legacy removal migration ready | ❌ NOT STARTED | - |

---

## Phase Tracker

### PHASE 1: Schema & Migrations ✅ COMPLETE + OPTIMIZED
| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | Core tenant schema | migrations/040_nexus_tenant_core.sql | ✅ Done |
| 1.2 | Cases schema | migrations/041_nexus_cases.sql | ✅ Done |
| 1.3 | Payments schema | migrations/042_nexus_payments.sql | ✅ Done |
| 1.4 | Notifications schema | migrations/043_nexus_notifications.sql | ✅ Done |
| 1.5 | RLS policies | migrations/044_nexus_rls_policies.sql | ✅ Done |
| 1.6 | Optimizations | migrations/045_nexus_optimizations.sql | ✅ Done |
| 1.7 | **CONSOLIDATED** | migrations/nexus_consolidated_migration.sql | ✅ NEW |

**Validation Scripts:**
| Script | Purpose |
|--------|---------|
| scripts/nexus-validation-single-query.sql | Pre-migration check (single query) |
| scripts/nexus-pre-migration-check.sql | Detailed pre-migration validation |
| scripts/nexus-post-migration-validation.sql | Post-migration verification |
| scripts/nexus-data-integrity-check.sql | Data integrity validation |

**CCP-1: ✅ VERIFIED** - All 6 migration files + consolidated version exist

---

### PHASE 2: Backend Adapter ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 2.1 | generateId, generateTenantIds | ✅ Done |
| 2.2 | createTenant, getTenantById, updateTenant | ✅ Done |
| 2.3 | createUser, getUser, getUserByEmail, updateUser, getUsersByTenant | ✅ Done |
| 2.4 | createRelationship, getTenantRelationships, getTenantContexts | ✅ Done |
| 2.5 | createRelationshipInvite, getInviteByToken, acceptInvite | ✅ Done |
| 2.6 | createCase, getCasesByContext, getCaseById, updateCase | ✅ Done |
| 2.7 | createMessage, getCaseMessages, markMessagesRead | ✅ Done |
| 2.8 | createPayment, getPaymentsByContext, updatePaymentStatus | ✅ Done |
| 2.9 | createNotification, getNotifications, getUnreadCount, markNotificationsRead | ✅ Done |
| 2.10 | createSession, getSession, updateSessionContext, deleteSession | ✅ Done |

**CCP-2: ✅ VERIFIED** - 35 functions in src/adapters/nexus-adapter.js

---

### PHASE 3: Middleware ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 3.1 | loadNexusSession | ✅ Done |
| 3.2 | createNexusSession, destroyNexusSession | ✅ Done |
| 3.3 | requireNexusAuth | ✅ Done |
| 3.4 | requireNexusTenant | ✅ Done |
| 3.5 | requireNexusContext | ✅ Done |
| 3.6 | requireCaseAccess | ✅ Done |
| 3.7 | requirePaymentAccess | ✅ Done |
| 3.8 | switchContext | ✅ Done |
| 3.9 | injectNexusLocals | ✅ Done |
| 3.10 | hashPassword, verifyPassword | ✅ Done |

**File:** src/middleware/nexus-context.js (13 functions)

---

### PHASE 4: Routes ✅ COMPLETE
| # | Method | Path | Status |
|---|--------|------|--------|
| 4.1 | GET | /nexus/login | ✅ Done |
| 4.2 | POST | /nexus/login | ✅ Done |
| 4.3 | GET | /nexus/sign-up | ✅ Done |
| 4.4 | POST | /nexus/sign-up | ✅ Done |
| 4.5 | GET | /nexus/accept | ✅ Done |
| 4.6 | POST | /nexus/accept | ✅ Done |
| 4.7 | GET/POST | /nexus/logout | ✅ Done |
| 4.8 | GET | /nexus/portal | ✅ Done |
| 4.9 | POST | /nexus/portal/switch | ✅ Done |
| 4.10 | GET | /nexus/inbox | ✅ Done |
| 4.11 | GET | /nexus/cases/:id | ✅ Done |
| 4.12 | GET | /nexus/cases/:id/thread | ✅ Done |
| 4.13 | POST | /nexus/cases/:id/messages | ✅ Done |
| 4.14 | POST | /nexus/cases/new | ✅ Done |
| 4.15 | GET | /nexus/payments | ✅ Done |
| 4.16 | GET | /nexus/payments/:id | ✅ Done |
| 4.17 | POST | /nexus/payments/:id/status | ✅ Done |
| 4.18 | GET | /nexus/relationships | ✅ Done |
| 4.19 | POST | /nexus/relationships/invite | ✅ Done |
| 4.20 | GET | /nexus/notifications | ✅ Done |
| 4.21 | GET | /nexus/api/notifications/unread | ✅ Done |
| 4.22 | POST | /nexus/api/notifications/read | ✅ Done |
| 4.23 | GET | /nexus/settings | ✅ Done |
| 4.24 | POST | /nexus/settings/notifications | ✅ Done |

**CCP-3: ✅ VERIFIED** - 25 routes in src/routes/nexus-portal.js

---

### PHASE 5: DevOps Utilities ✅ COMPLETE
| # | Task | File | Status |
|---|------|------|--------|
| 5.1 | Structured logger | src/utils/nexus-logger.js | ✅ Done |
| 5.2 | Error handling | src/utils/nexus-errors.js | ✅ Done |
| 5.3 | Health checks | src/utils/nexus-health.js | ✅ Done |
| 5.4 | Circuit breaker | src/utils/nexus-circuit-breaker.js | ✅ Done |

---

### PHASE 6: Server ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 6.1 | Standalone server on port 3001 | ✅ Done |
| 6.2 | Health endpoints (/health, /health/live, /health/ready) | ✅ Done |
| 6.3 | Graceful shutdown | ✅ Done |
| 6.4 | Dev bypass (/dev/portal) | ✅ Done |
| 6.5 | Mount nexus routes at /nexus | ✅ Done |

**File:** nexus-server.js

---

### PHASE 7: Templates ✅ COMPLETE
| # | Template | Route | Status |
|---|----------|-------|--------|
| 7.1 | layout.html | - | ✅ Done |
| 7.2 | pages/login.html | /nexus/login | ✅ Done |
| 7.3 | pages/sign-up.html | /nexus/sign-up | ✅ Done |
| 7.4 | pages/accept.html | /nexus/accept | ✅ Done |
| 7.5 | pages/role-dashboard.html | /nexus/portal | ✅ Done |
| 7.6 | pages/inbox.html | /nexus/inbox | ✅ Done |
| 7.7 | pages/payments.html | /nexus/payments | ✅ Done |
| 7.8 | pages/relationships.html | /nexus/relationships | ✅ Done |
| 7.9 | pages/error.html | (errors) | ✅ Done |
| 7.10 | pages/case-detail.html | /nexus/cases/:id | ✅ Done |
| 7.11 | partials/case-thread.html | /nexus/cases/:id/thread | ✅ Done |
| 7.12 | pages/payment-detail.html | /nexus/payments/:id | ✅ Done |
| 7.13 | pages/notifications.html | /nexus/notifications | ✅ Done |
| 7.14 | pages/settings.html | /nexus/settings | ✅ Done |

**CCP-4: ✅ VERIFIED** - All 14 templates complete

---

### PHASE 8: Execute Migrations ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 8.0 | **Pre-Migration Validation** | ✅ Clean Slate Verified |
| 8.1 | Run nexus_schema_core_tables on Supabase | ✅ Done |
| 8.2 | Run nexus_schema_payments_notifications on Supabase | ✅ Done |
| 8.3 | Run nexus_schema_functions_triggers on Supabase | ✅ Done |
| 8.4 | Run nexus_schema_rls_security on Supabase | ✅ Done |
| 8.5 | **Post-Migration Validation** | ✅ All Checks Pass |

**Migration Results (via Supabase MCP):**
| Migration | Tables | Functions | Indexes | Status |
|-----------|--------|-----------|---------|--------|
| nexus_schema_core_tables | 11 | 2 | 40+ | ✅ |
| nexus_schema_payments_notifications | 9 | 0 | 30+ | ✅ |
| nexus_schema_functions_triggers | 0 | 10 | 0 | ✅ |
| nexus_schema_rls_security | 0 | 0 | 0 | ✅ |

**Post-Migration Verification:**
- ✅ 20 tables created
- ✅ 20/20 RLS enabled (100% security)
- ✅ 20 service_role bypass policies
- ✅ 105 indexes created
- ✅ 12 functions deployed
- ✅ 11 triggers active
- ✅ 3 realtime tables configured
- ✅ Storage bucket `nexus-evidence` created (50MB, private)

**CCP-5: ✅ VERIFIED** - All migrations executed successfully

---

### PHASE 9: Demo Seed Data ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 9.1 | Create deterministic demo seed migration | ✅ Done |
| 9.2 | Tenant: Alpha Corp (TNT-ALPH0001, TC-ALPH0001) - Pure Client | ✅ Done |
| 9.3 | Tenant: Beta Services (TNT-BETA0001, TV-BETA0001) - Pure Vendor | ✅ Done |
| 9.4 | Tenant: Gamma Group (TNT-GAMM0001, TC-GAMM0001, TV-GAMM0001) - Dual | ✅ Done |
| 9.5 | Tenant: Delta Supplies (TNT-DELT0001, TV-DELT0001) - Pure Vendor | ✅ Done |
| 9.6 | Relationships: Alpha→Beta, Alpha→Gamma, Gamma→Delta | ✅ Done |
| 9.7 | Users: 8 demo users (2 per tenant) | ✅ Done |
| 9.8 | Cases: 4 cases with varied statuses | ✅ Done |
| 9.9 | Payments: 4 payments with varied amounts | ✅ Done |
| 9.10 | Notifications: 8 notifications across types | ✅ Done |
| 9.11 | Data source flagging system | ✅ Done |

**Demo Seed Results:**
| Table | Count | Notes |
|-------|-------|-------|
| nexus_tenants | 4 | Alpha, Beta, Gamma, Delta |
| nexus_users | 8 | 2 per tenant, password: Demo123! |
| nexus_tenant_relationships | 3 | 3-level chain for testing |
| nexus_cases | 4 | open, in_progress, pending_client, closed |
| nexus_case_messages | 3 | Threaded conversation samples |
| nexus_invoices | 3 | sent, viewed, paid statuses |
| nexus_payments | 4 | Various amounts $500-$5000 |
| nexus_notifications | 8 | All types and priorities |
| nexus_notification_config | 4 | One per tenant owner |

**Data Source Flagging:**
- ✅ `data_source_type` enum created
- ✅ `data_source` column added to 9 core tables
- ✅ All demo rows flagged as `data_source = 'demo'`
- ✅ Helper functions: `get_demo_data_summary()`, `purge_demo_data()`, `clone_demo_to_test()`
- ✅ Partial indexes for fast non-production filtering

**Reference:** See `.dev/dev-note/DEMO_CHEATSHEET.md` for login credentials and test scenarios

**CCP-6: ✅ VERIFIED** - Demo seed data and flagging system complete

---

### PHASE 10: Supabase Auth Integration ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| 10.1 | Add auth_user_id column to nexus_users | ✅ Done |
| 10.2 | Create unique index on auth_user_id | ✅ Done |
| 10.3 | Create auth.users for 8 demo users | ✅ Done |
| 10.4 | Link nexus_users to auth.users | ✅ Done (8/8) |
| 10.5 | Verify adapter auth methods exist | ✅ Done |
| 10.6 | Verify login route uses Supabase Auth | ✅ Done |
| 10.7 | Verify OAuth routes exist | ✅ Done |
| 10.8 | Verify password reset routes exist | ✅ Done |
| 10.9 | Verify OAuth buttons in templates | ✅ Done |
| 10.10 | Test login with alice@alpha.com | ✅ Done |

**Implementation Details:**
- Schema: `auth_user_id UUID REFERENCES auth.users(id)`
- Demo Users: 8 created with password "Demo123!" (bcrypt)
- Dual Auth: Supabase Auth primary, bcrypt fallback
- OAuth: Routes ready, needs provider config in Supabase Dashboard
- Password Reset: /nexus/forgot-password, /nexus/reset-password

**CCP-7: ✅ VERIFIED** - Supabase Auth integration complete, login tested successfully

**Reference:** See `.dev/dev-note/___NEXUS_OAUTH_EMAIL.md` for detailed implementation summary

---

### PHASE 11: End-to-End Validation ⏳ READY TO START
| # | Validation Check | Status |
|---|-----------------|--------|
| 11.1 | /nexus/sign-up creates TNT-, TC-, TV- IDs | ⏳ Ready |
| 11.2 | Relationship links use TC-* ↔ TV-* | ⏳ Ready |
| 11.3 | Role Dashboard shows correct contexts | ⏳ Ready |
| 11.4 | Inbox filters by active context | ⏳ Ready |
| 11.5 | Cases reference correct IDs | ⏳ Ready |
| 11.6 | Payments flow with correct from/to | ⏳ Ready |
| 11.7 | Realtime notifications work | ⏳ Phase 12 |
| 11.8 | Notification config cascade works | ⏳ Ready |
| 11.9 | All CRUD operations work | ⏳ Ready |
| 11.10 | RLS policies enforce isolation | ⏳ Ready |

**CCP-8: ⏳ READY TO EXECUTE** - All prerequisites complete (CCP-1 through CCP-7)

---

### PHASE 12: Realtime Integration ❌ NOT STARTED
| # | Task | Status |
|---|------|--------|
| 12.1 | Create public/js/nexus/realtime-client.js | ❌ Todo |
| 12.2 | Subscribe to nexus_notifications | ❌ Todo |
| 12.3 | Update notification bell in real-time | ❌ Todo |
| 12.4 | Payment priority sound alerts | ❌ Todo |

---

### PHASE 13: Legacy Removal ❌ NOT STARTED
| # | Task | Status |
|---|------|--------|
| 13.1 | Create migrations/099_remove_legacy_vmp.sql | ❌ Todo |
| 13.2 | DROP all vmp_* tables | ❌ Todo |
| 13.3 | Remove legacy route imports from server.js | ❌ Todo |
| 13.4 | Mount nexus routes at / (root) | ❌ Todo |
| 13.5 | Delete legacy src files | ❌ Todo |
| 13.6 | Final cleanup commit | ❌ Todo |

**CCP-9: ❌ NOT VERIFIED** - Requires CCP-8 first

---

## Current Blocker

```
┌─────────────────────────────────────────────────────┐
│  ✅ CCP-5 CLEARED: All migrations executed         │
│                                                     │
│  POST-MIGRATION SUMMARY:                           │
│  • 20 tables created with 100% RLS coverage        │
│  • 105 indexes for optimal query performance       │
│  • 12 functions + 11 triggers deployed             │
│  • Realtime enabled on 3 key tables                │
│  • Storage bucket ready for evidence uploads       │
│                                                     │
│  NEXT: Phase 9 - Create demo seed data to enable   │
│        end-to-end validation testing               │
└─────────────────────────────────────────────────────┘
```

---

## File Inventory

### Migrations (5 files) ✅
```
migrations/
├── 040_nexus_tenant_core.sql      ✅
├── 041_nexus_cases.sql            ✅
├── 042_nexus_payments.sql         ✅
├── 043_nexus_notifications.sql    ✅
└── 044_nexus_rls_policies.sql     ✅
```

### Source (8 files) ✅
```
nexus-server.js                           ✅ 314 lines
src/adapters/nexus-adapter.js             ✅ 1101 lines
src/middleware/nexus-context.js           ✅ 400+ lines
src/routes/nexus-portal.js                ✅ 835 lines
src/utils/nexus-logger.js                 ✅ 340 lines
src/utils/nexus-errors.js                 ✅ 398 lines
src/utils/nexus-health.js                 ✅ 294 lines
src/utils/nexus-circuit-breaker.js        ✅ 353 lines
```

### Templates (14 total) ✅ COMPLETE
```
src/views/nexus/
├── layout.html                    ✅
├── pages/
│   ├── login.html                 ✅
│   ├── sign-up.html               ✅
│   ├── accept.html                ✅
│   ├── role-dashboard.html        ✅
│   ├── inbox.html                 ✅
│   ├── payments.html              ✅
│   ├── relationships.html         ✅
│   ├── error.html                 ✅
│   ├── case-detail.html           ✅
│   ├── payment-detail.html        ✅
│   ├── notifications.html         ✅
│   └── settings.html              ✅
└── partials/
    ├── context-badge.html         ✅
    ├── notification-bell.html     ✅
    └── case-thread.html           ✅
```

---

## Database Tables (20)

| Table | Purpose |
|-------|---------|
| nexus_tenants | Master tenant records |
| nexus_tenant_relationships | Client-vendor links |
| nexus_relationship_invites | Pending invitations |
| nexus_users | User accounts |
| nexus_sessions | Auth sessions |
| nexus_cases | Cases between parties |
| nexus_case_messages | Case thread |
| nexus_case_evidence | Attachments |
| nexus_case_checklist | Tasks |
| nexus_case_activity | Audit |
| nexus_invoices | Vendor invoices |
| nexus_payments | Client payments |
| nexus_payment_schedule | Recurring |
| nexus_payment_activity | Payment audit |
| nexus_notifications | Notifications |
| nexus_notification_config | Tenant settings |
| nexus_user_notification_prefs | User overrides |
| nexus_notification_queue | Async queue |
| nexus_push_subscriptions | WebPush |
| nexus_audit_log | Audit trail |

---

## Ship Criteria

Before running migration 099:

- [x] CCP-4: All templates exist
- [x] CCP-5: All migrations executed ✅ 2025-12-25
- [ ] CCP-6: Demo seed data in place
- [ ] CCP-7: Email integration working
- [ ] CCP-8: All 10 validation checks pass
- [ ] Tested in mini browser end-to-end

---

## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2025-12-25 | 1-6 | Phases 1-6 complete |
| 2025-12-25 | 7 | 9/14 templates done, 5 missing |
| 2025-12-25 | - | PRD created with CCP tracking |
| 2025-12-25 | 7 | ✅ COMPLETE - All 14 templates created |
| 2025-12-25 | 8 | ✅ COMPLETE - All migrations via Supabase MCP |
| 2025-12-25 | 8 | Post-migration: 20 tables, 105 indexes, 12 functions |

---

## Resume Point

**CONTINUE FROM:** Phase 9.1 - Create demo seed data (046_nexus_demo_seed.sql)
