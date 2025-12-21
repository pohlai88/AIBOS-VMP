# Authentication Testing Guide

**Date:** 2025-12-22  
**Status:** ✅ Password Set, Ready for Testing

---

## Test Credentials

- **Email:** `admin@acme.com`
- **Password:** `testpassword123`
- **User ID:** `0bf802f3-38b1-40ed-88f7-45bff4150e16`
- **Vendor ID:** `11fd9cff-a017-4708-a2f6-3575ba4827d5`

---

## Testing Steps

### 1. Test Login Flow

1. **Navigate to login page:**
   - Go to `http://localhost:9000/login` or `http://localhost:9000/login3`

2. **Enter credentials:**
   - Email: `admin@acme.com`
   - Password: `testpassword123`

3. **Submit form:**
   - Click "INITIATE SESSION" button
   - Should redirect to `/home`

4. **Verify success:**
   - ✅ Should see user email in sidebar
   - ✅ Should see "Sign Out" button in sidebar
   - ✅ Should be able to access `/home` without redirect

### 2. Test Failed Login

1. **Wrong password:**
   - Email: `admin@acme.com`
   - Password: `wrongpassword`
   - ✅ Should show error message: "Invalid email or password"
   - ✅ Should stay on login page

2. **Wrong email:**
   - Email: `wrong@email.com`
   - Password: `testpassword123`
   - ✅ Should show error message: "Invalid email or password"
   - ✅ Should stay on login page

3. **Empty fields:**
   - Leave email/password empty
   - ✅ Browser should show HTML5 validation (required fields)

### 3. Test Session Persistence

1. **After successful login:**
   - Refresh the page (`F5` or `Ctrl+R`)
   - ✅ Should stay logged in
   - ✅ Should not redirect to `/login`

2. **Navigate to different pages:**
   - Go to `/home`, `/home5`, etc.
   - ✅ Should work without redirect
   - ✅ User info should persist in sidebar

### 4. Test Logout

1. **Click "Sign Out" button:**
   - Located in sidebar (bottom)
   - ✅ Should redirect to `/login`

2. **Try accessing protected route:**
   - After logout, try `/home`
   - ✅ Should redirect to `/login`
   - ✅ Should not show user info

### 5. Test Session Expiration

1. **Check session expiry:**
   - Sessions expire after 24 hours
   - Can manually test by updating `expires_at` in database:
     ```sql
     UPDATE vmp_sessions 
     SET expires_at = NOW() - INTERVAL '1 hour'
     WHERE user_id = '0bf802f3-38b1-40ed-88f7-45bff4150e16';
     ```
   - Then try accessing `/home`
   - ✅ Should redirect to `/login`

### 6. Test Public Routes

1. **Access public routes while logged out:**
   - `/login` ✅ Should work
   - `/login3` ✅ Should work
   - `/` ✅ Should work (landing page)
   - `/health` ✅ Should work

2. **Access protected routes while logged out:**
   - `/home` ❌ Should redirect to `/login`
   - `/home5` ❌ Should redirect to `/login`
   - `/partials/case-inbox` ❌ Should redirect to `/login`

---

## Expected Behavior

### ✅ Success Indicators

- Login redirects to `/home` on success
- User email/name appears in sidebar
- "Sign Out" button visible in sidebar
- Session persists across page refreshes
- Protected routes accessible when logged in
- Logout clears session and redirects to `/login`
- Unauthorized access redirects to `/login`

### ❌ Error Indicators

- Login fails with wrong credentials (shows error)
- Empty fields show browser validation
- Expired sessions redirect to login
- Logged-out users can't access protected routes

---

## Troubleshooting

### Issue: Login doesn't redirect

**Check:**
- Server is running (`npm run dev`)
- No console errors in browser
- Check server logs for errors

### Issue: Session not persisting

**Check:**
- Cookie is set in browser (DevTools → Application → Cookies)
- Cookie name: `vmp_session`
- Session exists in database: `SELECT * FROM vmp_sessions WHERE user_id = '...'`

### Issue: Always redirects to login

**Check:**
- Session exists in `vmp_sessions` table
- Session `expires_at` is in the future
- `req.session.sessionId` is set in cookie
- Auth middleware is not blocking

### Issue: Password verification fails

**Check:**
- Password hash is set in database
- Hash is valid bcrypt hash
- Password comparison is working (check server logs)

---

## Database Verification

### Check Session Created

```sql
SELECT id, user_id, expires_at, created_at 
FROM vmp_sessions 
WHERE user_id = '0bf802f3-38b1-40ed-88f7-45bff4150e16'
ORDER BY created_at DESC;
```

### Check User Status

```sql
SELECT id, email, is_active, password_hash IS NOT NULL as has_password
FROM vmp_vendor_users 
WHERE email = 'admin@acme.com';
```

---

## Next Steps After Testing

Once authentication is verified:

1. ✅ Proceed to **Day 3** (Database Migrations)
2. ✅ Proceed to **Day 5** (Refactor Case Detail)
3. ✅ Proceed to **Day 6** (Thread Cell)

---

## Notes

- **Session Duration:** 24 hours
- **Cookie Security:** httpOnly, secure in production
- **Password Hashing:** bcrypt with 10 salt rounds
- **Error Messages:** Generic (don't reveal if email exists)

