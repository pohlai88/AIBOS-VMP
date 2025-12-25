 # Nexus Demo Seed Data Cheatsheet

> **Status:** ✅ IMPLEMENTED | Last Updated: 2024-12-25

## 🔐 Demo Login Credentials

**Password for ALL demo users:** `Demo123!`

| Email | Name | Tenant | Role | Context |
|-------|------|--------|------|---------|
| alice@alpha.com | Alice Admin | Alpha Corp | owner | Pure Client |
| alex@alpha.com | Alex Associate | Alpha Corp | member | Pure Client |
| bob@beta.com | Bob Boss | Beta Services | owner | Pure Vendor |
| bella@beta.com | Bella Billing | Beta Services | admin | Pure Vendor |
| grace@gamma.com | Grace General | Gamma Group | owner | Dual (Client + Vendor) |
| gary@gamma.com | Gary Grant | Gamma Group | member | Dual (Client + Vendor) |
| dan@delta.com | Dan Director | Delta Supplies | owner | Pure Vendor |
| diana@delta.com | Diana Dispatch | Delta Supplies | admin | Pure Vendor |

---

## 🏢 Tenant & Relationship Map

```
Alpha Corp (TNT-ALPH0001) [Pure Client]
├── TC-ALPH0001 (Client Context)
├── → Beta Services (TV-BETA0001) [RELATIONSHIP: REL-AB000001]
└── → Gamma Group (TV-GAMM0001)   [RELATIONSHIP: REL-AG000001]
          └── Gamma Group (TNT-GAMM0001) [Dual Context]
                ├── TC-GAMM0001 (as Client)
                └── → Delta Supplies (TV-DELT0001) [RELATIONSHIP: REL-GD000001]

Beta Services (TNT-BETA0001) [Pure Vendor]
└── TV-BETA0001 (Vendor Context)

Delta Supplies (TNT-DELT0001) [Pure Vendor]
└── TV-DELT0001 (Vendor Context)
```

---

## 🆔 Deterministic ID Reference

| Entity | ID Pattern | Example IDs |
|--------|------------|-------------|
| Tenant | TNT-XXXX0001 | TNT-ALPH0001, TNT-BETA0001, TNT-GAMM0001, TNT-DELT0001 |
| Client Context | TC-XXXX0001 | TC-ALPH0001, TC-GAMM0001 |
| Vendor Context | TV-XXXX0001 | TV-BETA0001, TV-GAMM0001, TV-DELT0001 |
| User | USR-XXXX0001 | USR-ALIC0001, USR-ALEX0001, USR-BOBB0001, etc. |
| Relationship | REL-XX000001 | REL-AB000001, REL-AG000001, REL-GD000001 |
| Case | CASE-XX000001 | CASE-AB000001, CASE-AB000002, CASE-AG000001, CASE-GD000001 |
| Invoice | INV-XX000001 | INV-AB000001, INV-AG000001, INV-GD000001 |
| Payment | PAY-XX000001 | PAY-AB000001, PAY-AB000002, PAY-AG000001, PAY-GD000001 |
| Notification | NTF-XXXX0001 | NTF-ALIC0001, NTF-BOBB0001, etc. |
| Message | MSG-XX000001 | MSG-AB000001, MSG-AB000002, MSG-AG000001 |

---

## 📊 Demo Data Summary

| Table | Demo Count | Description |
|-------|------------|-------------|
| nexus_tenants | 4 | Alpha, Beta, Gamma, Delta |
| nexus_users | 8 | 2 users per tenant |
| nexus_tenant_relationships | 3 | Alpha→Beta, Alpha→Gamma, Gamma→Delta |
| nexus_cases | 4 | Various statuses (open, in_progress, pending_client, closed) |
| nexus_case_messages | 3 | Case communication samples |
| nexus_invoices | 3 | Sent, viewed, paid statuses |
| nexus_payments | 4 | Various amounts and statuses |
| nexus_notifications | 8 | All types and priorities |
| nexus_notification_config | 4 | One per tenant owner |

---

## 🏷️ Data Source Flagging System

All demo data is tagged with `data_source = 'demo'` for safe filtering and cleanup.

### Data Source Types
```sql
-- Enum: data_source_type
'production'  -- Real customer data (DEFAULT)
'demo'        -- Demo/sample data for testing
'test'        -- Automated test data
'migration'   -- Data from migrations
'import'      -- Bulk imported data
```

### Helper Functions

```sql
-- Get summary of all demo/test/production data counts
SELECT * FROM get_demo_data_summary();

-- Safely purge ALL demo data (requires confirmation)
SELECT purge_demo_data(true);  -- Pass 'true' to confirm

-- Clone demo data to test data with scenario name
SELECT clone_demo_to_test('regression_v2');
```

### Filtering in Queries
```sql
-- Get only demo tenants
SELECT * FROM nexus_tenants WHERE data_source = 'demo';

-- Exclude demo data from reports
SELECT * FROM nexus_cases WHERE data_source = 'production';

-- Get all non-production data
SELECT * FROM nexus_users WHERE data_source != 'production';
```

---

## 🧪 Test Scenarios

### Scenario 1: Client-Vendor Communication
1. Login as `alice@alpha.com` (client)
2. View cases with Beta Services
3. Send message on case CASE-AB000001
4. Logout, login as `bob@beta.com` (vendor)
5. Verify message received, respond

### Scenario 2: Dual-Context Tenant
1. Login as `grace@gamma.com`
2. Switch to Client context → View vendors (Delta)
3. Switch to Vendor context → View clients (Alpha)
4. Verify case CASE-AG000001 visible in both contexts

### Scenario 3: Payment Flow
1. Login as `alice@alpha.com`
2. View invoice INV-AB000001 (amount: $5,000)
3. Verify payment PAY-AB000001 shows as completed

### Scenario 4: Notification Preferences
1. Login as `alice@alpha.com`
2. Go to Settings → Notifications
3. Verify config shows: email_enabled=true, push_enabled=true
4. Change email_digest_mode from 'daily' to 'instant'

---

## 🔄 Data Refresh Commands

```sql
-- Check current demo data state
SELECT * FROM get_demo_data_summary();

-- Purge and reseed (run in order)
SELECT purge_demo_data(true);
-- Then rerun nexus_demo_seed_data migration

-- Mark existing data as demo (for manual inserts)
UPDATE nexus_tenants SET data_source = 'demo' WHERE tenant_id LIKE 'TNT-____0001';
```

---

## ⚠️ Important Notes

1. **Password Hash**: All demo users share bcrypt hash for `Demo123!`:
   ```
   $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYsKFqODf2hy
   ```

2. **ID Predictability**: All IDs are deterministic, not random UUIDs. This allows:
   - Repeatable tests
   - Hardcoded references in E2E tests
   - Easy debugging

3. **Relationship Chain**: Alpha → Gamma → Delta creates a 3-level chain for testing nested visibility.

4. **Case Statuses Used**:
   - `open` - New case, no action taken
   - `in_progress` - Work ongoing
   - `pending_client` - Waiting on client response
   - `closed` - Completed

5. **Notification Types Used**:
   - `case_created`, `case_updated`, `case_closed`
   - `invoice_sent`, `invoice_paid`
   - `payment_received`
   - `message_received`
   - `system_alert`
