# Testing & Optimization Plan — Days 5-8

**Date:** 2025-12-22  
**Status:** Ready for Testing  
**Scope:** Case Detail Refactoring + Core Cells (Days 5-8)

---

## 🎯 **Testing Strategy**

### **Priority 1: Manual End-to-End Testing** (30 minutes)
Test the complete user workflow to ensure everything works together.

### **Priority 2: Optimization Check** (15 minutes)
Review code for performance, security, and maintainability issues.

### **Priority 3: Edge Cases** (15 minutes)
Test error handling, empty states, and boundary conditions.

---

## ✅ **Testing Checklist**

### **1. Authentication & Access** (5 min)

- [ ] **Login works:**
  - Navigate to `/login`
  - Enter: `admin@acme.com` / `testpassword123`
  - ✅ Should redirect to `/home`
  - ✅ User info visible in sidebar

- [ ] **Protected routes:**
  - Logout, then try `/home`
  - ✅ Should redirect to `/login`

---

### **2. Case Inbox → Case Detail Flow** (10 min)

- [ ] **Open case from inbox:**
  - Navigate to `/home`
  - Click on a case in the inbox
  - ✅ Case detail should load on the right
  - ✅ All 4 cells should load (thread, checklist, evidence, escalation)

- [ ] **Empty states:**
  - Open a case with no messages
  - ✅ Thread should show "NO MESSAGES" empty state
  - ✅ Checklist should show steps (auto-generated) or empty state
  - ✅ Evidence should show "NO EVIDENCE" empty state
  - ✅ Escalation should show 3-level hierarchy

---

### **3. Thread Cell (Day 6)** (10 min)

- [ ] **View messages:**
  - Open a case with messages
  - ✅ Messages should display in chronological order
  - ✅ Sender party and channel source visible
  - ✅ Timestamps displayed

- [ ] **Post message:**
  - Type a message in the input field
  - Press Enter or click send button
  - ✅ Message should appear immediately (HTMX update)
  - ✅ Input field should clear after sending
  - ✅ Loading indicator should show while sending

- [ ] **Empty state:**
  - Open a case with no messages
  - ✅ Should show "NO MESSAGES" with helpful text

---

### **4. Checklist Cell (Day 7)** (10 min)

- [ ] **Auto-generation:**
  - Open an invoice case
  - ✅ Should show 3 steps: Invoice PDF, PO Number, Signed GRN
  - ✅ Steps should have correct status badges

- [ ] **Status badges:**
  - ✅ Pending steps show yellow pulse dot + "UPLOAD" button
  - ✅ Submitted steps show "PENDING" button
  - ✅ Verified steps show green checkmark + strikethrough

- [ ] **Upload button:**
  - Click "UPLOAD" on a pending step
  - ✅ Should trigger evidence upload (Day 8 feature)

---

### **5. Evidence Cell (Day 8)** (15 min)

- [ ] **View evidence:**
  - Open a case with uploaded evidence
  - ✅ Evidence files should display in grid
  - ✅ File type icons correct (PDF, image, etc.)
  - ✅ File sizes formatted correctly (KB, MB)
  - ✅ Version numbers shown (if version > 1)

- [ ] **Download evidence:**
  - Click on an evidence file
  - ✅ Should open/download file (signed URL works)
  - ✅ File should be accessible

- [ ] **Upload evidence:**
  - Click "UPLOAD" button in checklist
  - Select a PDF file (< 50MB)
  - Submit form
  - ✅ File should upload successfully
  - ✅ Evidence cell should refresh with new file
  - ✅ Checklist step status should update to "submitted"
  - ✅ File should appear in evidence grid

- [ ] **Versioning:**
  - Upload same evidence type again (e.g., upload invoice.pdf twice)
  - ✅ Should create version 2
  - ✅ Both versions should be visible
  - ✅ Version numbers should be correct

- [ ] **File validation:**
  - Try uploading file > 50MB
  - ✅ Should show error
  - Try uploading invalid file type (e.g., .exe)
  - ✅ Should show error

- [ ] **Empty state:**
  - Open a case with no evidence
  - ✅ Should show "NO EVIDENCE" with helpful text

---

### **6. Integration Tests** (10 min)

- [ ] **Complete workflow:**
  1. Login
  2. Open case from inbox
  3. Post a message
  4. Upload evidence
  5. Verify checklist updates
  6. Download evidence
  - ✅ All steps should work seamlessly

- [ ] **HTMX updates:**
  - Post message → thread updates without page reload
  - Upload evidence → evidence cell updates without page reload
  - ✅ No full page refreshes

- [ ] **Error handling:**
  - Try accessing case that doesn't exist
  - ✅ Should show appropriate error
  - Try uploading without file
  - ✅ Should handle gracefully

---

## 🔍 **Optimization Checklist**

### **1. Performance**

- [ ] **Database queries:**
  - Check if queries are optimized (indexes used)
  - ✅ All foreign keys have indexes (Day 3 optimization)
  - ✅ Queries use proper WHERE clauses

- [ ] **HTMX loading:**
  - Check if cells load in parallel or sequentially
  - ✅ All 4 cells should load in parallel (they do - separate HTMX calls)

- [ ] **Signed URL generation:**
  - Check if signed URLs are generated efficiently
  - ⚠️ **Potential optimization:** Batch signed URL generation
  - Current: Loop through evidence, generate one by one
  - Better: Generate all at once (if Supabase supports)

- [ ] **File upload:**
  - Check memory usage for large files
  - ✅ Using multer memory storage (good for < 50MB)
  - ⚠️ **Consider:** Stream to Supabase for very large files (future)

---

### **2. Security**

- [ ] **File upload validation:**
  - ✅ Multer validates file size (50MB limit)
  - ✅ Multer validates MIME types
  - ✅ Filename sanitization in storage path

- [ ] **Case access control:**
  - ✅ POST /cases/:id/messages verifies case belongs to vendor
  - ✅ POST /cases/:id/evidence verifies case belongs to vendor
  - ✅ GET routes use vendor context from auth middleware

- [ ] **Storage security:**
  - ✅ Private bucket (not public)
  - ✅ Signed URLs with expiry (1 hour)
  - ⚠️ **Check:** Supabase Storage bucket `vmp-evidence` exists

- [ ] **Input validation:**
  - ✅ Message body trimmed
  - ✅ Evidence type validated
  - ✅ Case ID validated

---

### **3. Error Handling**

- [ ] **Adapter methods:**
  - ✅ All methods have try/catch
  - ✅ All methods have timeout protection
  - ✅ Errors are logged

- [ ] **Route handlers:**
  - ✅ All routes have error handling
  - ✅ Errors return appropriate status codes
  - ✅ Error messages are user-friendly

- [ ] **Edge cases:**
  - ✅ Empty states handled
  - ✅ Null/undefined values handled
  - ✅ Missing data handled gracefully

---

### **4. Code Quality**

- [ ] **Linter:**
  - Run `npm run lint`
  - ✅ Fix any errors

- [ ] **Type safety:**
  - Check for any type issues
  - ⚠️ **Note:** 2 pre-existing linter errors (unrelated to Days 5-8)

- [ ] **Code duplication:**
  - Check for repeated code patterns
  - ✅ Adapter methods are well-structured
  - ✅ Routes follow consistent patterns

---

## 🐛 **Known Issues to Check**

### **1. Supabase Storage Bucket**
- ⚠️ **Action Required:** Verify `vmp-evidence` bucket exists
- Check: Supabase Dashboard → Storage
- If missing: Create bucket (see `STORAGE_SETUP.md`)

### **2. Signed URL Generation**
- ⚠️ **Potential Issue:** Loop generates signed URLs one by one
- **Impact:** Slow if many evidence files
- **Fix:** Consider batching (if Supabase supports)

### **3. Checklist Step Status Update**
- ⚠️ **Check:** Does checklist step status update correctly after evidence upload?
- **Expected:** Status should change from 'pending' to 'submitted'
- **Test:** Upload evidence linked to checklist step

---

## 🚀 **Quick Test Script**

### **Manual Test (5 minutes)**

```bash
# 1. Start server
npm run dev

# 2. In browser:
# - Navigate to http://localhost:9000/login
# - Login: admin@acme.com / testpassword123
# - Click case in inbox
# - Post a message
# - Upload a PDF file
# - Verify all cells update
```

---

## 📊 **Performance Benchmarks**

### **Target Metrics:**
- Case detail load: < 500ms
- Message post: < 300ms
- Evidence upload: < 2s (for 1MB file)
- Evidence list load: < 400ms

### **How to Measure:**
- Open browser DevTools → Network tab
- Check timing for HTMX requests
- Verify targets are met

---

## ✅ **Pre-Continue Checklist**

Before proceeding to next batch, verify:

- [ ] All manual tests pass
- [ ] No critical errors in console
- [ ] Supabase Storage bucket exists
- [ ] File uploads work end-to-end
- [ ] Versioning works correctly
- [ ] Checklist auto-generation works
- [ ] HTMX updates work smoothly
- [ ] Error handling is robust
- [ ] Security checks are in place

---

## 🎯 **Recommended Action**

**Option A: Quick Test (15 min)**
- Run manual test script above
- Fix any critical issues found
- Proceed to next batch

**Option B: Full Test + Optimize (45 min)**
- Complete all testing checklist items
- Run optimization checks
- Fix issues and optimize
- Proceed to next batch

**Option C: Continue (Risky)**
- Skip testing
- Proceed to next batch
- ⚠️ Risk: Issues may compound

---

**Recommendation:** **Option A** - Quick test to verify core functionality works, then continue.

---

**Next Steps After Testing:**
- If all tests pass → Proceed to Days 9-10 (Internal Ops + Escalation)
- If issues found → Fix issues, then continue
- If major issues → Optimize and retest

