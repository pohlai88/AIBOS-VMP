# UI Entry Points: Quick Reference

**Version:** 1.0.0  
**Date:** 2025-01-21

---

## 🎯 Primary Entry Points

### **Canvas OS (Supplier Dashboard)**

**URL:** `/supplier/dashboard`  
**Full URL:** `http://localhost:3000/supplier/dashboard`  
**Access:** Vendor users only (after login)

**What Loads:**
- ✅ Canvas OS spatial layout
- ✅ The Uplink panel (open by default)
- ✅ Posture Rail (desktop only)
- ✅ Dock navigation
- ✅ Cases pre-loaded (server-side, no flicker)

---

## 🔗 Navigation Entry Points

### **From Login**
```
POST /login (success)
    ↓
Redirect: /home (vendor) or /ops/dashboard (internal)
    ↓
Navigate: /supplier/dashboard
```

### **From Mobile Menu**
```
Click "Canvas" link
    ↓
Navigate: /supplier/dashboard
```

### **From Sidebar** (if available)
```
Click "Supplier Dashboard" or "Canvas"
    ↓
Navigate: /supplier/dashboard
```

---

## 📱 Mobile Entry Point

**Same URL:** `/supplier/dashboard`  
**Behavior:**
- Panels become full-screen
- Tab switcher mode
- Background grid hidden
- Posture Rail hidden

---

## 🧪 Testing Entry Points

### **1. Direct URL Access**
```
http://localhost:3000/supplier/dashboard
```

### **2. After Login Flow**
```
1. http://localhost:3000/login
2. Login with vendor credentials
3. Redirected to /home
4. Navigate to /supplier/dashboard
```

### **3. Mobile Menu**
```
1. Click hamburger menu (mobile)
2. Click "Canvas"
3. Navigate to /supplier/dashboard
```

---

## 🔄 HTMX Entry Points

### **Thread View (Dynamic Load)**
```
User clicks case in list
    ↓
HTMX: GET /partials/case-thread.html?case_id={uuid}
    ↓
Thread view displayed
```

### **Message Creation (Dynamic Update)**
```
User submits message form
    ↓
HTMX: POST /cases/{uuid}/messages
    ↓
Thread refreshed with new message(s)
```

---

## 📊 Route Summary

| Route | Method | Purpose | Entry Point |
|-------|--------|---------|-------------|
| `/supplier/dashboard` | GET | Main Canvas OS page | ✅ Primary |
| `/partials/case-thread.html` | GET | Load thread view | HTMX |
| `/cases/:id/messages` | POST | Create message | HTMX |
| `/partials/supplier-case-list.html` | GET | Case list partial | Server-side include |

---

## 🚀 Quick Start

1. **Start server:** `npm start`
2. **Login:** `http://localhost:3000/login`
3. **Access Canvas:** `http://localhost:3000/supplier/dashboard`
4. **Test Uplink:** Click any case → Thread view opens

---

**Status:** ✅ All entry points validated

