# Nexus Portal Implementation Summary

## Overview

The Nexus Portal is a new tenant-centric, bidirectional multi-tenant system built alongside (not replacing) the legacy VMP system. It treats every organization as a **Tenant** with contextual roles - the same tenant can act as both Client (facing down to vendors) and Vendor (facing up to clients).

## Architecture

### ID Conventions
- **TNT-XXXXXXXX**: Master Tenant ID (unique per organization)
- **TC-XXXXXXXX**: Tenant Client ID (used when acting as client)
- **TV-XXXXXXXX**: Tenant Vendor ID (used when acting as vendor)
- **USR-XXXXXXXX**: User ID
- **CASE-XXXXXXXX**: Case ID
- **PAY-XXXXXXXX**: Payment ID
- **REL-XXXXXXXX**: Relationship ID
- **INV-XXXXXXXX**: Invoice ID

### Database Schema (nexus_* tables)

New tables are completely separate from legacy vmp_* tables:

1. **nexus_tenants** - Core tenant records with TNT-, TC-, TV- IDs
2. **nexus_tenant_relationships** - Client→Vendor links (client_id, vendor_id)
3. **nexus_relationship_invites** - Invitation tokens for vendor onboarding
4. **nexus_users** - Users belong to tenants
5. **nexus_sessions** - Authentication sessions
6. **nexus_cases** - Cases between client_id and vendor_id
7. **nexus_case_messages** - Thread messages with sender context
8. **nexus_case_evidence** - File attachments
9. **nexus_case_checklist** - Task checklists
10. **nexus_case_activity** - Audit log
11. **nexus_invoices** - Invoices from vendor to client
12. **nexus_payments** - Payments from client to vendor
13. **nexus_payment_schedule** - Scheduled/recurring payments
14. **nexus_payment_activity** - Payment audit log
15. **nexus_notifications** - User notifications
16. **nexus_notification_config** - Tenant-level notification settings
17. **nexus_user_notification_prefs** - User-level overrides
18. **nexus_notification_queue** - Async delivery queue
19. **nexus_push_subscriptions** - WebPush subscriptions

### Migrations Created

| File | Purpose |
|------|---------|
| 040_nexus_tenant_core.sql | Core tenant, user, session tables |
| 041_nexus_cases.sql | Cases and related tables |
| 042_nexus_payments.sql | Payments and invoices |
| 043_nexus_notifications.sql | Notification system |
| 044_nexus_rls_policies.sql | Row-level security policies |

## Code Structure

### Backend

```
src/
├── adapters/
│   └── nexus-adapter.js       # Data access layer (~600 lines)
├── middleware/
│   └── nexus-context.js       # Auth, session, context switching (~300 lines)
├── routes/
│   └── nexus-portal.js        # Express routes at /nexus/* (~650 lines)
└── views/nexus/
    ├── layout.html            # Base layout with nav
    ├── pages/
    │   ├── login.html
    │   ├── sign-up.html
    │   ├── accept.html        # Invitation acceptance
    │   ├── role-dashboard.html # Dual-context selection
    │   ├── inbox.html         # Unified case inbox
    │   ├── payments.html      # Payment dashboard
    │   ├── relationships.html # Manage connections
    │   └── error.html
    └── partials/
        ├── context-badge.html     # Client/Vendor toggle
        └── notification-bell.html # Realtime notifications
```

### Frontend

```
public/
├── css/
│   └── nexus.css              # Complete styling (~1200 lines)
└── js/nexus/
    ├── core.js                # Dropdowns, modals, toasts
    └── realtime-notifications.js # Supabase realtime subscription
```

## Key Features

### 1. Bidirectional Relationships
- Any tenant can be both Client AND Vendor
- Context determined by active view (facing "down" = client, facing "up" = vendor)
- Same tenant appears in different relationship rows as client or vendor

### 2. Unified Inbox
- Cases filtered by active context
- Context badge shows current view (Client/Vendor)
- Unread counts per context

### 3. Payment Notifications (Phase 1 Priority)
- Critical priority for all payment events
- Realtime updates via Supabase subscriptions
- Browser notifications with sound
- Prominent UI for payment alerts

### 4. Auto-Onboarding
- Vendors can sign up with client code
- Invitation links for faster onboarding
- No approval required (auto-active relationships)

### 5. Context Switching
- Dual-context tenants see Role Dashboard
- One-click switch between Client/Vendor views
- Context persisted in session

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /nexus/login | Login page |
| POST | /nexus/login | Process login |
| GET | /nexus/sign-up | Registration with role selection |
| POST | /nexus/sign-up | Create account |
| GET | /nexus/accept | Accept invitation page |
| POST | /nexus/accept | Process invitation |
| GET/POST | /nexus/logout | Sign out |
| GET | /nexus/portal | Role Dashboard (or redirect) |
| POST | /nexus/portal/switch | Switch context |
| GET | /nexus/inbox | Unified case inbox |
| GET | /nexus/cases/:id | Case detail |
| POST | /nexus/cases/new | Create case |
| POST | /nexus/cases/:id/messages | Send message |
| GET | /nexus/payments | Payment dashboard |
| GET | /nexus/payments/:id | Payment detail |
| POST | /nexus/payments/:id/status | Update payment |
| GET | /nexus/relationships | Manage connections |
| POST | /nexus/relationships/invite | Send invitation |
| GET | /nexus/notifications | All notifications |
| GET | /nexus/api/notifications/unread | Badge counts |
| POST | /nexus/api/notifications/read | Mark as read |
| GET | /nexus/settings | User settings |
| POST | /nexus/settings/notifications | Update prefs |

## Notification Config Cascade

1. **System defaults** (payment_always: true, realtime: true)
2. **Tenant config** (nexus_notification_config)
3. **User prefs** (nexus_user_notification_prefs)

Function `get_effective_notification_config(user_id)` resolves the cascade.

## RLS Policies

All nexus_* tables have row-level security:
- Tenants see only their own data
- Relationships visible to both parties
- Cases accessible to client_id OR vendor_id
- Payments accessible to from_id OR to_id
- Notifications restricted to user_id owner

## Next Steps

1. **Run migrations** against Supabase
2. **Test the portal** at /nexus/login
3. **Configure Supabase URL/Key** in environment for realtime
4. **Seed initial data** for testing
5. **Plan legacy migration** - gradually move vmp_* data to nexus_*

## Legacy Cleanup (Future)

Once Nexus is stable:
1. Create migration scripts from vmp_* → nexus_*
2. Update any external integrations
3. Archive legacy tables
4. Remove legacy routes

---

*Built with explicit ID prefixes, bidirectional tenant relationships, and payment-priority notifications.*
