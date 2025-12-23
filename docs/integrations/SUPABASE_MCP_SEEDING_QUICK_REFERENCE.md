# Supabase MCP Seeding - Quick Reference

**Purpose:** Quick decision guide for when to use Static Migration vs Dynamic API

---

## 🎯 Decision Matrix

### Use Static SQL Migration (Supabase MCP) When:

✅ **Initial database setup**
- Fresh environment
- Baseline demo data
- One-time execution

✅ **Fixed UUIDs acceptable**
- Consistent test scenarios
- Scripted demos
- Documentation examples

✅ **Admin/DevOps execution**
- Not user-triggered
- Controlled environment
- Migration history

**Example:**
```bash
# Apply via Supabase MCP
mcp_supabase_apply_migration({
  name: "027_vmp_seed_onboarding_demo",
  query: seedSQL
});
```

---

### Use Dynamic API Routes (Supabase JS Client) When:

✅ **User-triggered operations**
- UI "Seed" button
- User wants demo data
- Training scenarios

✅ **Multiple concurrent users**
- User A and User B both seed
- No UUID conflicts
- Isolated data per user

✅ **Dynamic data generation**
- UUIDs generated per user
- User-scoped (vendor_id)
- Tagged for safe deletion

**Example:**
```javascript
// POST /api/demo/seed
app.post('/api/demo/seed', requireAuth, async (req, res) => {
  const vendorId = req.user.vendorId;
  const demoCaseId = randomUUID(); // Dynamic UUID
  // ... create user-scoped demo data
});
```

---

## 📊 Comparison Table

| Feature | Static Migration (MCP) | Dynamic API (JS Client) |
|---------|------------------------|------------------------|
| **Execution** | One-time, manual | On-demand, user-triggered |
| **UUIDs** | Fixed (hardcoded) | Dynamic (generated) |
| **Concurrency** | ❌ Fails if run twice | ✅ Safe for multiple users |
| **User Scope** | Global (all users) | Per-user (vendor_id) |
| **Use Case** | Initial setup | Flight Simulator mode |
| **Tool** | `mcp_supabase_apply_migration` | Supabase JS Client |
| **Safety** | ⚠️ Can affect all users | ✅ User-isolated |

---

## ✅ Recommended Approach: Hybrid

**Use BOTH methods:**

1. **Static Migration** → Initial database setup
   - Applied once via Supabase MCP
   - Creates baseline demo data
   - Fixed UUIDs for consistency

2. **Dynamic API** → User-triggered seeding
   - UI "Launch Simulator" button
   - Dynamic UUIDs per user
   - User-scoped and tagged

**Benefits:**
- ✅ Best of both worlds
- ✅ Initial setup is consistent
- ✅ User operations are safe
- ✅ No conflicts or data loss

---

## 🚀 Implementation Checklist

### Static Migration (Already Done ✅)
- [x] Create SQL migration file
- [x] Apply via Supabase MCP
- [x] Verify data creation
- [x] Document test credentials

### Dynamic API (Next Steps)
- [ ] Add API routes to `server.js`
- [ ] Implement user-scoped seeding
- [ ] Add tagging for safe deletion
- [ ] Test concurrent operations

### Frontend (After Backend)
- [ ] Create demo control panel component
- [ ] Add "Launch Simulator" button
- [ ] Add "Reset Scenario" button
- [ ] Add "Exit Simulation" button
- [ ] Add simulation mode banner

---

## 🔒 Safety Rules

1. **Always use `vendor_id` filtering** in API routes
2. **Always tag demo data** with `tags @> ARRAY['demo_data']`
3. **Always use dynamic UUIDs** in user-triggered operations
4. **Never use fixed UUIDs** in API endpoints
5. **Always verify user authentication** with `requireAuth`
6. **Always delete by tags** (never TRUNCATE in production)

---

**Status:** ✅ Static Migration Complete | ⏳ Dynamic API Next  
**Priority:** High (Critical for training and sales)

