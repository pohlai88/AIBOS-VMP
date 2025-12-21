# What's Next — VMP Sprint Progress

**Last Updated:** 2025-12-22  
**Status:** Day 2 Complete ✅

---

## ✅ Just Completed

### Day 2 — Authentication Implementation (COMPLETE)

**What Was Done:**
- ✅ Real session-based authentication (replaced mock auth)
- ✅ Login/logout handlers with password verification
- ✅ Session management in `vmp_sessions` table
- ✅ User context loading via middleware
- ✅ Login pages (`/login`, `/login3`) with error handling
- ✅ Logout button in sidebar
- ✅ Helper script for password management

**Files Created/Modified:**
- `src/adapters/supabase.js` — Added 6 auth methods
- `server.js` — Added login/logout routes, real auth middleware
- `src/views/pages/login.html` — Updated form submission
- `src/views/pages/login3.html` — Updated form submission
- `src/views/layout.html` — Added user info and logout
- `scripts/set-password.js` — Password management helper
- `package.json` — Added bcrypt dependency

---

## 🎯 Immediate Next Steps (Priority Order)

### 1. **Test Authentication** ✅ **COMPLETE & VERIFIED**

**Status:** ✅ Password set and login flow tested successfully (2025-12-22)

**Test Credentials (Verified Working):**
- Email: `admin@acme.com`
- Password: `testpassword123`

**Test Results:**
- ✅ Login successful
- ✅ Session persistence confirmed
- ✅ Logout working
- ✅ Unauthorized redirect working

**Test Checklist:** ✅ All tests passed
- [ ] Navigate to `/login` or `/login3`
- [ ] Enter email: `admin@acme.com`
- [ ] Enter password: `testpassword123`
- [ ] Verify redirect to `/home` on success
- [ ] Verify error message on wrong password
- [ ] Click "Sign Out" in sidebar
- [ ] Verify redirect to `/login`
- [ ] Try accessing `/home` while logged out
- [ ] Verify redirect to `/login`

**Why This First:**
- Auth is the foundation for all other features
- Need to verify it works before building on top
- Quick validation (5 minutes)

---

### 2. **Day 3 — Database Migrations (CRITICAL BLOCKER)**

**Status:** ⚠️ **BLOCKER** — Tables exist but migrations not formalized

**What's Needed:**
- Create migration SQL files for all VMP tables
- Document migration procedure
- Create seed data script
- Configure Supabase Storage bucket for evidence files

**Tables to Migrate:**
- `vmp_vendors` ✅ (exists)
- `vmp_vendor_users` ✅ (exists)
- `vmp_companies` ✅ (exists)
- `vmp_cases` ✅ (exists)
- `vmp_messages` ❌ (needs migration)
- `vmp_evidence` ❌ (needs migration)
- `vmp_checklist_steps` ✅ (exists)
- `vmp_sessions` ✅ (exists)
- `vmp_invites` ✅ (exists)

**Why This Next:**
- Other features depend on complete database schema
- Need migrations for production deployment
- Seed data needed for testing

**Estimated Time:** 2-3 hours

---

### 3. **Day 5 — Refactor Case Detail**

**Status:** ⚠️ **PARTIAL** — Shell exists but has hardcoded content

**What's Needed:**
- Extract hardcoded thread/checklist/evidence into separate cell files
- Update case-detail endpoint to use HTMX containers
- Connect to real case data via `vmpAdapter.getCaseDetail()`
- Create separate cells: `case_thread.html`, `case_checklist.html`, `case_evidence.html`, `escalation.html`

**Why This Next:**
- Case detail is the core user workflow
- Currently using static content, needs to be dynamic
- Blocks Day 6-8 work (thread, checklist, evidence)

**Estimated Time:** 2-3 hours

---

### 4. **Day 6 — Thread Cell + Post Message**

**Status:** ❌ **NOT STARTED**

**What's Needed:**
- Create `case_thread.html` partial
- Implement `GET /partials/case-thread` endpoint
- Implement `POST /cases/:id/messages` endpoint
- Add `getMessages()` and `createMessage()` to adapter

**Why This Next:**
- Core collaboration feature
- Users need to communicate about cases
- Foundation for WhatsApp/Email integration

**Estimated Time:** 3-4 hours

---

### 5. **Day 7 — Checklist Cell + Evidence Rules**

**Status:** ❌ **NOT STARTED**

**What's Needed:**
- Create `case_checklist.html` partial
- Implement `GET /partials/case-checklist` endpoint
- Implement checklist rules engine (case-type-specific requirements)
- Add `getChecklistSteps()` to adapter

**Why This Next:**
- Evidence-first doctrine requires checklist
- Users need to see what's required
- Blocks evidence upload (Day 8)

**Estimated Time:** 3-4 hours

---

### 6. **Day 8 — Evidence Upload + Versioning**

**Status:** ❌ **NOT STARTED**

**What's Needed:**
- Create `case_evidence.html` partial
- Implement `GET /partials/case-evidence` endpoint
- Implement `POST /cases/:id/evidence` with file upload (multer)
- Add `getEvidence()`, `uploadEvidence()`, `computeChecksum()` to adapter
- Configure Supabase Storage bucket

**Why This Next:**
- Core feature: "No evidence, no movement"
- Users need to upload documents
- Versioning ensures audit trail

**Estimated Time:** 4-5 hours

---

## 📊 Sprint Progress Summary

### ✅ Completed (3 days)
- **Day 1:** Shell structure, layout, CONTRACT-001 compliance
- **Day 2:** Authentication (login/logout/sessions) ✅ **JUST COMPLETED**
- **Day 4:** Case inbox cell (working, needs triage tabs)

### ⚠️ Partial (2 days)
- **Day 5:** Case detail shell (hardcoded content)
- **Day 12:** Timeout protection (audit logging pending)

### ❌ Not Started (10 days)
- **Day 3:** Database migrations (BLOCKER)
- **Day 6:** Thread cell + post message
- **Day 7:** Checklist cell + evidence rules
- **Day 8:** Evidence upload + versioning
- **Day 9:** Internal ops mode
- **Day 10:** Escalation cell
- **Day 11:** Notifications + SLA fields
- **Day 13:** Design consistency pass
- **Day 14:** Demo script + seed scenarios
- **Day 15:** MVP freeze + release toggle

---

## 🚀 Recommended Workflow

### This Week (Days 3-5)
1. **Today:** Test auth, then start Day 3 (migrations)
2. **Tomorrow:** Complete Day 3, start Day 5 (refactor case detail)
3. **Day After:** Complete Day 5, start Day 6 (thread cell)

### Next Week (Days 6-10)
4. **Day 6:** Thread cell + post message
5. **Day 7:** Checklist cell + evidence rules
6. **Day 8:** Evidence upload + versioning
7. **Day 9:** Internal ops mode
8. **Day 10:** Escalation cell

### Final Week (Days 11-15)
9. **Day 11:** Notifications + SLA
10. **Day 12:** Complete quality gates
11. **Day 13:** Design consistency
12. **Day 14:** Demo script
13. **Day 15:** MVP freeze

---

## 🎯 MVP Acceptance Checklist

Before MVP freeze, verify:

- [x] Supplier can: login → view inbox → open case
- [ ] Supplier can: chat → upload evidence
- [ ] Evidence always attaches to a case; versioning works
- [ ] Internal can: verify/reject evidence + reassign ownership + resolve case
- [ ] Escalation path exists and is visible
- [ ] Audit trail exists for all key actions
- [ ] UX is "NexusCanon luxury shell", not KPI-card SaaS

**Current Status:** 1/6 complete (login works)

---

## 💡 Quick Wins (If Ahead of Schedule)

- Add triage tabs to case inbox (action/waiting/resolved filters)
- Add rate limiting to login endpoint
- Add password reset flow
- Add login attempt logging
- Create password reset tokens table

---

## 📝 Notes

- **Auth is complete** — Ready for testing
- **Database tables exist** — But migrations need formalization
- **Case detail needs refactoring** — Extract hardcoded content into cells
- **Evidence upload is critical** — Core to "evidence-first" doctrine
- **Internal ops mode needed** — For verification workflow

---

**Next Action:** Test authentication, then proceed with Day 3 (migrations)

