# RLS Coverage (Detailed Policy Definitions)

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** ✅ Active  
**Purpose:** Detailed Row Level Security policy definitions for all tenant-scoped tables  
**Aligned To:** [PRD_DB_SCHEMA.md](../../development/prds/PRD_DB_SCHEMA.md) | [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md)

---

## 📋 Overview

This document provides detailed RLS policy definitions for all tenant-scoped tables. All policies are tested in integration tests and validated in CI/CD.

**Coverage:** 100% (20/20 tables)

---

## Threat Model Covered

This RLS implementation addresses the following security threats:

- **Cross-tenant reads** - Users cannot access data belonging to other tenants
- **Cross-tenant writes** - Users cannot modify or delete data belonging to other tenants
- **Privilege escalation via derived joins** - Users cannot bypass RLS by joining through foreign key relationships
- **Service role misuse** - Service role bypasses RLS only for legitimate backend operations (documented and audited)

**Coverage:** All 20 tenant-scoped tables have RLS policies that prevent these threats.

**Testing:** Integration tests verify each threat vector is blocked. See `tests/integration/rls/` for test coverage.

---

---

## Policy Definitions

### 1. nexus_tenants

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:tenant_isolation`
```sql
CREATE POLICY tenant_isolation ON nexus_tenants
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL (SELECT, INSERT, UPDATE, DELETE)
- **Rule:** Users can only access their own tenant
- **Tested:** ✅ Yes (`tests/integration/rls/nexus_tenants.test.js`)

#### `rls:tenant_service_bypass`
```sql
CREATE POLICY tenant_service_bypass ON nexus_tenants
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL (SELECT, INSERT, UPDATE, DELETE)
- **Rule:** Service role bypasses RLS (backend access)
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 2. nexus_tenant_relationships

**Tenant Scope:** `derived:client_id/vendor_id` (derived via FK)

**Policies:**

#### `rls:relationship_isolation`
```sql
CREATE POLICY relationship_isolation ON nexus_tenant_relationships
    FOR SELECT
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );
```
- **Operation:** SELECT
- **Rule:** Users can see relationships where their tenant is either client or vendor
- **Tested:** ✅ Yes

#### `rls:relationship_create`
```sql
CREATE POLICY relationship_create ON nexus_tenant_relationships
    FOR INSERT
    WITH CHECK (client_id = current_user_client_id());
```
- **Operation:** INSERT
- **Rule:** Users can create relationships where they are the client (inviting vendors)
- **Tested:** ✅ Yes

#### `rls:relationship_service_bypass`
```sql
CREATE POLICY relationship_service_bypass ON nexus_tenant_relationships
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 3. nexus_users

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:user_isolation`
```sql
CREATE POLICY user_isolation ON nexus_users
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access users in their own tenant
- **Tested:** ✅ Yes

#### `rls:user_service_bypass`
```sql
CREATE POLICY user_service_bypass ON nexus_users
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 4. nexus_cases

**Tenant Scope:** `derived:client_id/vendor_id` (derived via FK)

**Policies:**

#### `rls:case_isolation`
```sql
CREATE POLICY case_isolation ON nexus_cases
    FOR SELECT
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );
```
- **Operation:** SELECT
- **Rule:** Users can see cases where their tenant is either client or vendor
- **Tested:** ✅ Yes

#### `rls:case_create`
```sql
CREATE POLICY case_create ON nexus_cases
    FOR INSERT
    WITH CHECK (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );
```
- **Operation:** INSERT
- **Rule:** Users can create cases where they are client or vendor
- **Tested:** ✅ Yes

#### `rls:case_service_bypass`
```sql
CREATE POLICY case_service_bypass ON nexus_cases
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 5. nexus_case_messages

**Tenant Scope:** `derived:case_id→client_id/vendor_id` (nested FK chain)

**Policies:**

#### `rls:message_isolation`
```sql
CREATE POLICY message_isolation ON nexus_case_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases
            WHERE nexus_cases.case_id = nexus_case_messages.case_id
            AND (
                nexus_cases.client_id = current_user_client_id() OR
                nexus_cases.vendor_id = current_user_vendor_id()
            )
        )
    );
```
- **Operation:** ALL
- **Rule:** Users can access messages for cases they have access to (via case_id → client_id/vendor_id)
- **Tested:** ✅ Yes

#### `rls:message_service_bypass`
```sql
CREATE POLICY message_service_bypass ON nexus_case_messages
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 6. nexus_case_evidence

**Tenant Scope:** `derived:case_id→client_id/vendor_id` (nested FK chain)

**Policies:**

#### `rls:evidence_isolation`
```sql
CREATE POLICY evidence_isolation ON nexus_case_evidence
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases
            WHERE nexus_cases.case_id = nexus_case_evidence.case_id
            AND (
                nexus_cases.client_id = current_user_client_id() OR
                nexus_cases.vendor_id = current_user_vendor_id()
            )
        )
    );
```
- **Operation:** ALL
- **Rule:** Users can access evidence for cases they have access to
- **Tested:** ✅ Yes

#### `rls:evidence_service_bypass`
```sql
CREATE POLICY evidence_service_bypass ON nexus_case_evidence
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 7. nexus_case_checklist

**Tenant Scope:** `derived:case_id→client_id/vendor_id` (nested FK chain)

**Policies:**

#### `rls:checklist_isolation`
```sql
CREATE POLICY checklist_isolation ON nexus_case_checklist
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases
            WHERE nexus_cases.case_id = nexus_case_checklist.case_id
            AND (
                nexus_cases.client_id = current_user_client_id() OR
                nexus_cases.vendor_id = current_user_vendor_id()
            )
        )
    );
```
- **Operation:** ALL
- **Rule:** Users can access checklist items for cases they have access to
- **Tested:** ✅ Yes

#### `rls:checklist_service_bypass`
```sql
CREATE POLICY checklist_service_bypass ON nexus_case_checklist
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 8. nexus_case_activity

**Tenant Scope:** `derived:case_id→client_id/vendor_id` (nested FK chain)

**Policies:**

#### `rls:activity_isolation`
```sql
CREATE POLICY activity_isolation ON nexus_case_activity
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_cases
            WHERE nexus_cases.case_id = nexus_case_activity.case_id
            AND (
                nexus_cases.client_id = current_user_client_id() OR
                nexus_cases.vendor_id = current_user_vendor_id()
            )
        )
    );
```
- **Operation:** ALL
- **Rule:** Users can access activity logs for cases they have access to
- **Tested:** ✅ Yes

#### `rls:activity_service_bypass`
```sql
CREATE POLICY activity_service_bypass ON nexus_case_activity
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 9. nexus_invoices

**Tenant Scope:** `derived:client_id/vendor_id` (derived via FK)

**Policies:**

#### `rls:invoice_isolation`
```sql
CREATE POLICY invoice_isolation ON nexus_invoices
    FOR ALL
    USING (
        client_id = current_user_client_id() OR
        vendor_id = current_user_vendor_id()
    );
```
- **Operation:** ALL
- **Rule:** Users can access invoices where their tenant is either client or vendor
- **Tested:** ✅ Yes

#### `rls:invoice_service_bypass`
```sql
CREATE POLICY invoice_service_bypass ON nexus_invoices
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 10. nexus_payments

**Tenant Scope:** `derived:from_id/to_id` (derived via FK)

**Policies:**

#### `rls:payment_isolation`
```sql
CREATE POLICY payment_isolation ON nexus_payments
    FOR ALL
    USING (
        from_id = current_user_client_id() OR
        to_id = current_user_vendor_id()
    );
```
- **Operation:** ALL
- **Rule:** Users can access payments where their tenant is either payer (from_id) or payee (to_id)
- **Tested:** ✅ Yes

#### `rls:payment_service_bypass`
```sql
CREATE POLICY payment_service_bypass ON nexus_payments
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 11. nexus_payment_schedule

**Tenant Scope:** `derived:from_id/to_id` (derived via FK)

**Policies:**

#### `rls:schedule_isolation`
```sql
CREATE POLICY schedule_isolation ON nexus_payment_schedule
    FOR ALL
    USING (
        from_id = current_user_client_id() OR
        to_id = current_user_vendor_id()
    );
```
- **Operation:** ALL
- **Rule:** Users can access schedules where their tenant is either payer or payee
- **Tested:** ✅ Yes

#### `rls:schedule_service_bypass`
```sql
CREATE POLICY schedule_service_bypass ON nexus_payment_schedule
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 12. nexus_payment_activity

**Tenant Scope:** `derived:payment_id→from_id/to_id` (nested FK chain)

**Policies:**

#### `rls:pay_activity_isolation`
```sql
CREATE POLICY pay_activity_isolation ON nexus_payment_activity
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM nexus_payments
            WHERE nexus_payments.payment_id = nexus_payment_activity.payment_id
            AND (
                nexus_payments.from_id = current_user_client_id() OR
                nexus_payments.to_id = current_user_vendor_id()
            )
        )
    );
```
- **Operation:** ALL
- **Rule:** Users can access payment activity for payments they have access to
- **Tested:** ✅ Yes

#### `rls:pay_activity_service_bypass`
```sql
CREATE POLICY pay_activity_service_bypass ON nexus_payment_activity
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 13. nexus_notifications

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:notification_isolation`
```sql
CREATE POLICY notification_isolation ON nexus_notifications
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access notifications in their own tenant
- **Tested:** ✅ Yes

#### `rls:notification_service_bypass`
```sql
CREATE POLICY notification_service_bypass ON nexus_notifications
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 14. nexus_notification_config

**Tenant Scope:** `tenant_id` (PK)

**Policies:**

#### `rls:notif_config_isolation`
```sql
CREATE POLICY notif_config_isolation ON nexus_notification_config
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access notification config for their own tenant
- **Tested:** ✅ Yes

#### `rls:notif_config_service_bypass`
```sql
CREATE POLICY notif_config_service_bypass ON nexus_notification_config
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 15. nexus_user_notification_prefs

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:user_prefs_isolation`
```sql
CREATE POLICY user_prefs_isolation ON nexus_user_notification_prefs
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access notification preferences in their own tenant
- **Tested:** ✅ Yes

#### `rls:user_prefs_service_bypass`
```sql
CREATE POLICY user_prefs_service_bypass ON nexus_user_notification_prefs
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 16. nexus_notification_queue

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:queue_isolation`
```sql
CREATE POLICY queue_isolation ON nexus_notification_queue
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access notification queue items in their own tenant
- **Tested:** ✅ Yes

#### `rls:queue_service_bypass`
```sql
CREATE POLICY queue_service_bypass ON nexus_notification_queue
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 17. nexus_push_subscriptions

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:push_sub_isolation`
```sql
CREATE POLICY push_sub_isolation ON nexus_push_subscriptions
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access push subscriptions in their own tenant
- **Tested:** ✅ Yes

#### `rls:push_sub_service_bypass`
```sql
CREATE POLICY push_sub_service_bypass ON nexus_push_subscriptions
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 18. nexus_audit_log

**Tenant Scope:** `derived:actor_tenant_id` (derived via FK)

**Policies:**

#### `rls:audit_isolation`
```sql
CREATE POLICY audit_isolation ON nexus_audit_log
    FOR ALL
    USING (actor_tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access audit logs for their own tenant
- **Tested:** ✅ Yes

#### `rls:audit_service_bypass`
```sql
CREATE POLICY audit_service_bypass ON nexus_audit_log
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 19. nexus_relationship_invites

**Tenant Scope:** `derived:inviting_tenant_id` (derived via FK)

**Policies:**

#### `rls:invite_isolation`
```sql
CREATE POLICY invite_isolation ON nexus_relationship_invites
    FOR ALL
    USING (inviting_tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access invites sent by their own tenant
- **Tested:** ✅ Yes

#### `rls:invite_service_bypass`
```sql
CREATE POLICY invite_service_bypass ON nexus_relationship_invites
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

### 20. nexus_sessions

**Tenant Scope:** `tenant_id` (direct)

**Policies:**

#### `rls:session_isolation`
```sql
CREATE POLICY session_isolation ON nexus_sessions
    FOR ALL
    USING (tenant_id = current_user_tenant_id());
```
- **Operation:** ALL
- **Rule:** Users can only access sessions in their own tenant
- **Tested:** ✅ Yes

#### `rls:session_service_bypass`
```sql
CREATE POLICY session_service_bypass ON nexus_sessions
    FOR ALL
    TO service_role
    USING (true);
```
- **Operation:** ALL
- **Rule:** Service role bypasses RLS
- **Tested:** ✅ Yes

**Status:** ✅ Compliant

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Tables | 20 |
| Tenant-Scoped | 20 (100%) |
| RLS Enabled | 20 (100%) |
| Policies Defined | 40 (2 per table: isolation + service_bypass) |
| Tested | 20 (100%) |
| **Coverage** | **✅ 100% Compliant** |

---

## Testing

All RLS policies are tested in integration tests:

**Test Location:** `tests/integration/rls/`

**Test Pattern:**
```javascript
describe('RLS: nexus_cases', () => {
  it('should prevent User A from viewing User B cases', async () => {
    // Create test users
    const userA = await createTestUser({ tenantId: 'TNT-AAAA' });
    const userB = await createTestUser({ tenantId: 'TNT-BBBB' });
    
    // Create cases
    const caseA = await createCase({ clientId: 'TC-AAAA' });
    const caseB = await createCase({ clientId: 'TC-BBBB' });
    
    // Log in as User A
    const sessionA = await login(userA);
    
    // Attempt to fetch User B's case
    const { data, error } = await supabase
      .from('nexus_cases')
      .select('*')
      .eq('case_id', caseB.case_id)
      .single();
    
    // Assert: Should be empty or forbidden
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});
```

---

## Maintenance

### Adding New Tables

1. Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
2. Create isolation policy (using tenant_id or derived pattern)
3. Create service_bypass policy
4. Add entry to this document
5. Add entry to [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md) Section D
6. Write integration tests
7. Update coverage summary

### Modifying Policies

1. Document change in this file
2. Update policy SQL
3. Test in staging
4. Update tests
5. Deploy migration

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22  
**Maintained By:** Architecture Team

