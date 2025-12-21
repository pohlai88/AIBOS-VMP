# Quick Test Guide — Days 5-8

**Time Required:** 15 minutes  
**Priority:** High (Before continuing)

---

## 🚀 **Quick Test (15 min)**

### **1. Start Server** (1 min)
```bash
npm run dev
```

### **2. Login** (2 min)
- Navigate to: `http://localhost:9000/login`
- Email: `admin@acme.com`
- Password: `testpassword123`
- ✅ Should redirect to `/home`

### **3. Open Case** (2 min)
- Click on a case in the inbox
- ✅ Case detail should load on right
- ✅ All 4 cells should show loading, then content/empty states

### **4. Test Thread** (3 min)
- Type a message: "Test message"
- Press Enter or click send
- ✅ Message should appear immediately
- ✅ Input field should clear

### **5. Test Checklist** (2 min)
- ✅ Checklist should show steps (auto-generated based on case type)
- ✅ Steps should have correct status badges

### **6. Test Evidence Upload** (5 min)
- Click "UPLOAD" on a pending checklist step
- Select a PDF file (< 5MB for quick test)
- Submit
- ✅ File should upload
- ✅ Evidence cell should refresh with new file
- ✅ Checklist step should update to "submitted"

---

## ✅ **Success Criteria**

If all 6 steps work:
- ✅ **Continue to next batch** (Days 9-10)

If any step fails:
- ⚠️ **Fix issue first**, then continue

---

## 🐛 **Common Issues**

### **"Bucket not found"**
- **Fix:** Create `vmp-evidence` bucket in Supabase Dashboard
- **Guide:** See `.dev/dev-note/STORAGE_SETUP.md`

### **"Case not found"**
- **Fix:** Run seed script: `npm run seed`
- **Or:** Create test case manually

### **HTMX not loading**
- **Check:** Browser console for errors
- **Check:** Server logs for errors
- **Fix:** Verify routes are correct

---

## 📊 **Performance Check**

While testing, check:
- ✅ Case detail loads in < 1 second
- ✅ Message post responds in < 500ms
- ✅ Evidence upload completes in < 3 seconds (for small file)
- ✅ No console errors

---

**Status:** Ready to test

