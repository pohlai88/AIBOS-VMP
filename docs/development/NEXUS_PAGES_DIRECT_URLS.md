# Direct URLs for Nexus Pages

**Date:** 2025-01-22  
**Server:** Temporary Minimal Server  
**Base URL:** `http://localhost:9000`

---

## 📄 Page URLs

### 1. Complete Profile Page
**Template:** `client-approval-dashboard.html`  
**URL:** `http://localhost:9000/nexus/complete-profile`  
**Method:** GET  
**Auth Required:** No (public route)  
**Purpose:** OAuth profile completion form

**POST URL (for form submission):**  
`http://localhost:9000/nexus/complete-profile` (POST)

---

### 2. Client Dashboard
**Template:** `client-dashboard.html`  
**URL:** `http://localhost:9000/nexus/client`  
**Method:** GET  
**Auth Required:** ✅ Yes (Nexus authentication + client context)  
**Purpose:** Client command center with metrics and recent activity

**Note:** Requires:
- Nexus user authentication
- Active client context (TC-* tenant_client_id)

---

### 3. Payment Detail Page
**Template:** `client-payment-detail.html`  
**URL:** `http://localhost:9000/nexus/client/payments/{payment_id}`  
**Method:** GET  
**Auth Required:** ✅ Yes (Nexus authentication + client context)  
**Purpose:** View payment details with approval workflow

**Example:**
```
http://localhost:9000/nexus/client/payments/550e8400-e29b-41d4-a716-446655440000
```

**Note:** 
- Replace `{payment_id}` with actual payment UUID
- Requires client context to access payment

---

### 4. Approval Dashboard
**Template:** `client-approval-dashboard.html`  
**URL:** `http://localhost:9000/nexus/client/approvals`  
**Method:** GET  
**Auth Required:** ✅ Yes (Nexus authentication + client context)  
**Purpose:** Dashboard showing pending approvals requiring action

---

## 🔐 Authentication Flow

### For Public Pages (Complete Profile)
1. Navigate directly to: `http://localhost:9000/nexus/complete-profile`
2. No authentication required

### For Protected Pages (Client Routes)
1. **First, authenticate:**
   ```
   http://localhost:9000/nexus/login
   ```

2. **Then access client pages:**
   - Dashboard: `http://localhost:9000/nexus/client`
   - Payment Detail: `http://localhost:9000/nexus/client/payments/{payment_id}`
   - Approval Dashboard: `http://localhost:9000/nexus/client/approvals`

---

## 📋 Quick Reference

| Page | URL | Auth Required |
|------|-----|---------------|
| **Complete Profile** | `http://localhost:9000/nexus/complete-profile` | ❌ No |
| **Client Dashboard** | `http://localhost:9000/nexus/client` | ✅ Yes |
| **Payment Detail** | `http://localhost:9000/nexus/client/payments/{id}` | ✅ Yes |
| **Approval Dashboard** | `http://localhost:9000/nexus/client/approvals` | ✅ Yes |

---

## 🚨 Common Issues

### 404 Error
- **Cause:** Route not found
- **Fix:** Verify server is running and route is correct

### 401/403 Error
- **Cause:** Not authenticated or missing client context
- **Fix:** Login at `/nexus/login` first, ensure you have client context

### Payment Not Found
- **Cause:** Invalid payment_id or payment doesn't belong to your client context
- **Fix:** Use a valid payment UUID that belongs to your client tenant

---

**Last Updated:** 2025-01-22

