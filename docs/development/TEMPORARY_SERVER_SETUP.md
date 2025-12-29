# Temporary Minimal Server Setup

**Date:** 2025-01-22  
**Status:** ✅ **ACTIVE**  
**Purpose:** Clean temporary server to view specific Nexus pages only

---

## 📋 What Was Done

### 1. Legacy Server Archived
- ✅ `server.js` → `server.js.legacy`
- Legacy server preserved for reference

### 2. New Minimal Server Created
- ✅ Created clean `server.js` with minimal dependencies
- ✅ Only mounts required Nexus routes

---

## 🎯 Supported Pages

The temporary server supports viewing these 4 Nexus pages:

| Page | Route | Template |
|------|-------|----------|
| **Complete Profile** | `GET /nexus/complete-profile` | `nexus/pages/complete-profile.html` |
| **Complete Profile (POST)** | `POST /nexus/complete-profile` | OAuth profile completion |
| **Client Dashboard** | `GET /nexus/client` | `nexus/pages/client-dashboard.html` |
| **Payment Detail** | `GET /nexus/client/payments/:payment_id` | `nexus/pages/client-payment-detail.html` |
| **Approval Dashboard** | `GET /nexus/client/approvals` | `nexus/pages/client-approval-dashboard.html` |

---

## 🏗️ Server Architecture

### Minimal Setup
- ✅ Express.js
- ✅ Nunjucks template engine
- ✅ Static file serving (`public/`)
- ✅ Cookie parser (for OAuth)
- ✅ JSON/URL-encoded body parsing

### Routers Mounted
1. **Nexus Portal Router** (`/nexus`)
   - Handles: `/nexus/complete-profile` (GET, POST)

2. **Nexus Client Router** (`/nexus/client`)
   - Handles: `/nexus/client` (dashboard)
   - Handles: `/nexus/client/payments/:payment_id`
   - Handles: `/nexus/client/approvals`

### What's NOT Included
- ❌ Legacy VMP routes
- ❌ Legacy `vmpAdapter`
- ❌ Legacy middleware
- ❌ Complex error handling
- ❌ Rate limiting (handled by routers)
- ❌ Session management (handled by routers)

---

## 🚀 Usage

### Start Server
```bash
npm start
# or
node server.js
```

### Access Pages
- Complete Profile: `http://localhost:9000/nexus/complete-profile`
- Client Dashboard: `http://localhost:9000/nexus/client`
- Payment Detail: `http://localhost:9000/nexus/client/payments/{payment_id}`
- Approval Dashboard: `http://localhost:9000/nexus/client/approvals`

---

## ⚠️ Important Notes

1. **Authentication Required**
   - Client routes require Nexus authentication
   - Use `/nexus/login` to authenticate first

2. **Context Required**
   - Client routes require client context (TC-*)
   - Must have active client tenant relationship

3. **Minimal Error Handling**
   - Basic error pages only
   - No complex error recovery

4. **No Legacy Support**
   - All legacy routes removed
   - Only Nexus routes active

---

## 🔄 Restore Legacy Server

To restore the legacy server:

```bash
# Backup current temporary server
Move-Item server.js server.js.temp

# Restore legacy server
Move-Item server.js.legacy server.js
```

---

## 📊 File Structure

```
server.js                    # Temporary minimal server (ACTIVE)
server.js.legacy            # Legacy server (ARCHIVED)
src/routes/
  ├── nexus-portal.js      # Portal routes (mounted at /nexus)
  └── nexus-client.js       # Client routes (mounted at /nexus/client)
```

---

**Status:** ✅ **READY**  
**Last Updated:** 2025-01-22

