# Sprint Development Plan: Flight Simulator Demo Mode

**Date:** 2025-01-21  
**Status:** 📋 Ready for Development  
**Priority:** 🔴 High (Critical for training and sales demos)  
**Epic:** Demo Data Management & User Experience

---

## 🎯 Sprint Goal

Implement a safe, user-scoped "Flight Simulator" mode that allows suppliers to seed, reset, and clear demo data through a UI control panel. This enables training scenarios and sales demonstrations without affecting production data.

---

## ✅ Completed (Pre-Sprint)

- [x] **Database Schema:** Added `tags` column to `vmp_cases` (migration `028`)
- [x] **Documentation:** Created implementation guide and quick reference
- [x] **Architecture:** Designed two-tier approach (Static Migration + Dynamic API)

---

## 📋 Sprint Tasks

### Task 1: Implement Backend API Routes

**Story Points:** 5  
**Effort:** 4-6 hours  
**Priority:** 🔴 Critical  
**Dependencies:** None

#### Description
Add four API endpoints to `server.js` for demo mode operations: status check, seed, reset, and clear.

#### Acceptance Criteria
- [ ] `GET /api/demo/status` returns `{ hasDemoData: boolean }`
- [ ] `POST /api/demo/seed` creates user-scoped demo data with dynamic UUIDs
- [ ] `POST /api/demo/reset` clears and re-seeds demo data
- [ ] `DELETE /api/demo/clear` safely removes all demo data for user
- [ ] All routes require authentication (`requireAuth`)
- [ ] All operations are vendor-scoped (filter by `vendor_id`)
- [ ] All demo data tagged with `['demo_data']`
- [ ] Error handling with proper status codes
- [ ] Logging for all operations

#### Implementation Steps

1. **Add Status Endpoint**
   ```javascript
   // Location: server.js (around line 6100+, after other API routes)
   app.get('/api/demo/status', requireAuth, async (req, res) => {
     // Check if vendor has demo-tagged cases
   });
   ```

2. **Add Seed Endpoint**
   ```javascript
   app.post('/api/demo/seed', requireAuth, async (req, res) => {
     // Generate dynamic UUIDs
     // Create Emergency Override case
     // Create Bank Change case
     // Create additional demo cases
     // Create welcome messages
   });
   ```

3. **Add Reset Endpoint**
   ```javascript
   app.post('/api/demo/reset', requireAuth, async (req, res) => {
     // Clear existing demo data
     // Re-seed demo data
   });
   ```

4. **Add Clear Endpoint**
   ```javascript
   app.delete('/api/demo/clear', requireAuth, async (req, res) => {
     // Delete all demo-tagged data for vendor
   });
   ```

#### Files to Modify
- `server.js` (add 4 new routes)

#### Files to Reference
- `FLIGHT_SIMULATOR_DEMO_MODE_GUIDE.md` (implementation details)
- `src/adapters/supabase.js` (adapter methods)
- `src/utils/route-helpers.js` (requireAuth middleware)

#### Testing Checklist
- [ ] Test status endpoint with no demo data
- [ ] Test status endpoint with demo data
- [ ] Test seed endpoint creates data
- [ ] Test seed endpoint with concurrent users (User A + User B)
- [ ] Test reset endpoint clears and re-seeds
- [ ] Test clear endpoint removes all demo data
- [ ] Test clear endpoint doesn't affect real data
- [ ] Test authentication requirement (401 if not logged in)
- [ ] Test vendor scoping (User A can't see User B's demo data)

---

### Task 2: Create Frontend Demo Control Panel Component

**Story Points:** 3  
**Effort:** 3-4 hours  
**Priority:** 🔴 Critical  
**Dependencies:** Task 1 (Backend API Routes)

#### Description
Create an Alpine.js component that provides UI controls for demo mode: launch simulator, reset scenario, and exit simulation.

#### Acceptance Criteria
- [ ] Component shows "Launch Simulator" button when inactive
- [ ] Component shows simulation banner when active
- [ ] Banner is sticky at top of page
- [ ] All buttons have loading states
- [ ] All buttons show confirmation dialogs
- [ ] Component checks status on page load
- [ ] Component refreshes page after operations
- [ ] Component uses VMP design system classes
- [ ] Component is responsive (mobile-friendly)
- [ ] Component has proper ARIA labels

#### Implementation Steps

1. **Create Component File**
   ```html
   <!-- File: src/views/partials/demo_control_panel.html -->
   <div x-data="demoControl()" x-init="checkStatus()">
     <!-- Inactive state: Launch button -->
     <!-- Active state: Simulation banner -->
   </div>
   ```

2. **Implement Alpine.js Logic**
   ```javascript
   function demoControl() {
     return {
       isActive: false,
       loading: false,
       checkStatus() { /* ... */ },
       seedDemo() { /* ... */ },
       resetDemo() { /* ... */ },
       clearDemo() { /* ... */ }
     }
   }
   ```

3. **Add Styling**
   - Use VMP design system classes
   - Amber/orange theme for simulation mode
   - Responsive layout

#### Files to Create
- `src/views/partials/demo_control_panel.html`

#### Files to Reference
- `FLIGHT_SIMULATOR_DEMO_MODE_GUIDE.md` (component code)
- `public/globals.css` (VMP design system)
- `src/views/partials/*.html` (other partial examples)

#### Testing Checklist
- [ ] Component renders correctly when inactive
- [ ] Component renders correctly when active
- [ ] Launch button triggers seed API
- [ ] Reset button triggers reset API
- [ ] Clear button triggers clear API
- [ ] Loading states display correctly
- [ ] Confirmation dialogs appear
- [ ] Page refreshes after operations
- [ ] Banner is sticky on scroll
- [ ] Component is mobile-responsive

---

### Task 3: Integrate Component into Layout/Dashboard

**Story Points:** 2  
**Effort:** 1-2 hours  
**Priority:** 🟡 High  
**Dependencies:** Task 2 (Frontend Component)

#### Description
Add the demo control panel to the main layout or dashboard page so it's visible to authenticated users.

#### Acceptance Criteria
- [ ] Component appears on dashboard/home page
- [ ] Component only shows for authenticated users
- [ ] Component doesn't interfere with existing layout
- [ ] Component is positioned appropriately (top of content area)
- [ ] Component works with existing page structure

#### Implementation Steps

1. **Add to Layout or Dashboard**
   ```html
   <!-- In src/views/layout.html or src/views/pages/home.html -->
   {% if user %}
     {% include "partials/demo_control_panel.html" %}
   {% endif %}
   ```

2. **Adjust Layout for Sticky Banner**
   ```css
   /* Add padding-top when simulation banner is active */
   body:has(.demo-control-panel [x-show="isActive"]) {
     padding-top: 80px;
   }
   ```

#### Files to Modify
- `src/views/layout.html` OR `src/views/pages/home.html` (or dashboard page)

#### Files to Reference
- `src/views/pages/home.html` (dashboard structure)
- `src/views/layout.html` (layout structure)

#### Testing Checklist
- [ ] Component appears on dashboard
- [ ] Component doesn't appear when not logged in
- [ ] Component doesn't break existing layout
- [ ] Sticky banner doesn't overlap content
- [ ] Component works on mobile devices

---

### Task 4: Add Error Handling & User Feedback

**Story Points:** 2  
**Effort:** 2-3 hours  
**Priority:** 🟡 Medium  
**Dependencies:** Task 1, Task 2

#### Description
Enhance error handling and user feedback for demo mode operations, including toast notifications and error messages.

#### Acceptance Criteria
- [ ] Success messages display after operations
- [ ] Error messages display on failures
- [ ] Loading states are clear
- [ ] Network errors are handled gracefully
- [ ] Validation errors are shown
- [ ] Toast notifications work (if toast system exists)

#### Implementation Steps

1. **Add Error Handling to API Routes**
   ```javascript
   try {
     // ... operation
     res.json({ success: true, message: '...' });
   } catch (error) {
     logError(error, { path: req.path, userId: req.user?.id });
     res.status(500).json({ error: 'Failed to ...' });
   }
   ```

2. **Add User Feedback to Frontend**
   ```javascript
   if (res.ok) {
     if (window.showToast) {
       window.showToast('Operation successful!', 'success');
     }
   } else {
     const error = await res.json();
     alert('Failed: ' + error.error);
   }
   ```

#### Files to Modify
- `server.js` (enhance error handling in API routes)
- `src/views/partials/demo_control_panel.html` (add user feedback)

#### Testing Checklist
- [ ] Success messages appear
- [ ] Error messages appear
- [ ] Network errors are handled
- [ ] Validation errors are shown
- [ ] Loading states are clear

---

### Task 5: End-to-End Testing & Verification

**Story Points:** 3  
**Effort:** 3-4 hours  
**Priority:** 🟡 High  
**Dependencies:** Task 1, Task 2, Task 3, Task 4

#### Description
Comprehensive testing of the complete demo mode flow, including concurrent user scenarios and data isolation verification.

#### Acceptance Criteria
- [ ] Single user can seed, reset, and clear demo data
- [ ] Multiple users can seed simultaneously without conflicts
- [ ] User A cannot see User B's demo data
- [ ] Real production data is never affected
- [ ] Demo data is properly tagged
- [ ] All operations complete successfully
- [ ] UI updates correctly after operations
- [ ] No console errors
- [ ] No database errors

#### Testing Scenarios

1. **Single User Flow**
   - Login as User A
   - Click "Launch Simulator"
   - Verify demo data appears
   - Click "Reset Scenario"
   - Verify data resets
   - Click "Exit Simulation"
   - Verify data is cleared

2. **Concurrent Users**
   - Login as User A in Browser 1
   - Login as User B in Browser 2
   - Both click "Launch Simulator" simultaneously
   - Verify both users get their own demo data
   - Verify no UUID conflicts
   - Verify User A can't see User B's data

3. **Data Isolation**
   - Login as User A
   - Seed demo data
   - Login as User B
   - Verify User B doesn't see User A's demo data
   - Seed demo data for User B
   - Verify both users have separate demo data

4. **Production Data Safety**
   - Create real case as User A
   - Seed demo data as User A
   - Clear demo data
   - Verify real case still exists
   - Verify demo data is removed

#### Files to Create
- `tests/e2e/demo-mode.spec.js` (optional, for automated testing)

#### Files to Reference
- `FLIGHT_SIMULATOR_DEMO_MODE_GUIDE.md` (testing scenarios)
- `tests/e2e/mobile-ux-improvements.spec.js` (E2E test examples)

#### Testing Checklist
- [ ] Single user flow works end-to-end
- [ ] Concurrent users work without conflicts
- [ ] Data isolation verified
- [ ] Production data safety verified
- [ ] All UI states work correctly
- [ ] No errors in console
- [ ] No errors in database logs

---

## 📊 Sprint Summary

| Task | Story Points | Effort | Priority | Dependencies |
|------|--------------|--------|----------|--------------|
| Task 1: Backend API Routes | 5 | 4-6h | 🔴 Critical | None |
| Task 2: Frontend Component | 3 | 3-4h | 🔴 Critical | Task 1 |
| Task 3: Integration | 2 | 1-2h | 🟡 High | Task 2 |
| Task 4: Error Handling | 2 | 2-3h | 🟡 Medium | Task 1, 2 |
| Task 5: E2E Testing | 3 | 3-4h | 🟡 High | All tasks |

**Total Story Points:** 15  
**Total Effort:** 13-19 hours  
**Sprint Duration:** 3-5 days (depending on team size)

---

## 🚨 Critical Safety Requirements

### Backend Routes
1. ✅ **Always filter by `vendor_id`** - Never query without vendor scope
2. ✅ **Always use dynamic UUIDs** - Never use fixed UUIDs in API routes
3. ✅ **Always tag demo data** - Use `tags @> ARRAY['demo_data']`
4. ✅ **Always require authentication** - Use `requireAuth` middleware
5. ✅ **Always handle errors** - Try-catch blocks with proper logging

### Frontend Component
1. ✅ **Always confirm destructive actions** - Show confirmation dialogs
2. ✅ **Always show loading states** - Disable buttons during operations
3. ✅ **Always handle errors** - Display error messages to user
4. ✅ **Always refresh after operations** - Reload page to show changes

### Database Operations
1. ✅ **Never use TRUNCATE** - Use DELETE with WHERE clauses
2. ✅ **Always delete in correct order** - Respect foreign key constraints
3. ✅ **Always verify vendor ownership** - Check vendor_id before deletion
4. ✅ **Always use tags for identification** - Never delete by ID alone

---

## 📚 Reference Documents

- **Implementation Guide:** `FLIGHT_SIMULATOR_DEMO_MODE_GUIDE.md`
- **Quick Reference:** `SUPABASE_MCP_SEEDING_QUICK_REFERENCE.md`
- **Static Migration:** `SEED_DATA_AUTO_INJECTION_ADVISORY.md`
- **MCP Guide:** `SUPABASE_MCP_SEEDING_GUIDE.md`

---

## ✅ Definition of Done

- [ ] All API routes implemented and tested
- [ ] Frontend component created and integrated
- [ ] Error handling added to all operations
- [ ] E2E testing completed
- [ ] Concurrent user scenarios verified
- [ ] Data isolation verified
- [ ] Production data safety verified
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] No linter errors
- [ ] No console errors
- [ ] No database errors

---

## 🎯 Success Criteria

1. ✅ Users can launch demo simulator with one click
2. ✅ Users can reset demo scenario with one click
3. ✅ Users can exit simulation mode with one click
4. ✅ Multiple users can use demo mode simultaneously
5. ✅ Demo data is completely isolated per user
6. ✅ Production data is never affected
7. ✅ UI clearly indicates simulation mode
8. ✅ All operations complete without errors

---

**Status:** 📋 Ready for Sprint Development  
**Next Step:** Begin with Task 1 (Backend API Routes)

