# Supabase MPC Invitation Activation Fix

**Date:** 2025-12-22  
**Issue:** Supabase MPC invitation emails redirect to `localhost:3000` but server runs on port 9000  
**Status:** Fixed

## Problem Description

When users receive Supabase MPC (Magic Passwordless Connection) invitation emails, clicking the activation link redirects to `localhost:3000` instead of the correct server port (default: 9000), resulting in `ERR_CONNECTION_REFUSED`.

## Root Cause

The Supabase Auth redirect URLs are configured in the Supabase Dashboard to point to `localhost:3000`, but the application server runs on port 9000 (or the port specified in the `PORT` environment variable).

## Solution

### Step 1: Update Supabase Dashboard Redirect URLs

1. **Go to Supabase Dashboard:**
   - Navigate to your project
   - Go to **Settings** → **Auth** → **URL Configuration**

2. **Update Site URL:**
   - **Development:** `http://localhost:9000`
   - **Production:** `https://yourdomain.com`

3. **Update Redirect URLs:**
   Add the following redirect URLs (one per line):
   ```
   http://localhost:9000/supabase-invite
   http://localhost:9000/accept
   http://localhost:9000/reset-password
   http://localhost:9000/verify
   ```
   
   **IMPORTANT:** The redirect URLs must match your `BASE_URL` environment variable exactly. If your server runs on a different port, update both the Supabase Dashboard and your `.env` file.

   For production, replace `localhost:9000` with your production domain:
   ```
   https://yourdomain.com/supabase-invite
   https://yourdomain.com/accept
   https://yourdomain.com/reset-password
   https://yourdomain.com/verify
   ```

4. **Save Changes**

### Step 2: Verify Environment Variables

Ensure your `.env` file has the correct `BASE_URL`:

```env
# Development
BASE_URL=http://localhost:9000
PORT=9000

# Production
BASE_URL=https://yourdomain.com
PORT=9000
```

### Step 3: Restart Server

After updating Supabase configuration, restart your server:

```bash
# Stop the server (Ctrl+C)
# Start the server again
npm start
# or
node server.js
```

### Step 4: Test Invitation Flow

1. Create a new invitation through the `/ops/invites` endpoint
2. Check the invitation email
3. Click the activation link
4. Verify it redirects to `http://localhost:9000/supabase-invite` (or your configured port)
5. Verify the invitation activates successfully

## How It Works

### Invitation Flow

1. **Invitation Created:**
   - Admin creates invitation via `POST /ops/invites`
   - System creates invite record in `vmp_invites` table
   - System calls Supabase Auth to send invitation email

2. **User Clicks Email Link:**
   - Supabase redirects to configured redirect URL: `http://localhost:9000/supabase-invite#access_token=...&type=invite`
   - The `#access_token` is in the URL hash (client-side only)

3. **Token Extraction:**
   - `/supabase-invite` route renders `supabase_invite_handler.html`
   - Client-side JavaScript extracts tokens from URL hash
   - Redirects to `/accept?access_token=...&type=invite`

4. **Account Activation:**
   - `/accept` route validates the access token
   - If user exists: Logs them in and redirects to `/home`
   - If new user: Shows sign-up form with invite details
   - User completes sign-up and account is activated

### Code Routes

- **`GET /supabase-invite`** - Handles Supabase invite links with tokens in URL hash
- **`GET /accept`** - Handles both custom invites (token) and Supabase invites (access_token)
- **`POST /accept`** - Processes account creation for new users

## Password Reset Flow

The password reset flow uses the same redirect URL configuration:

1. **User requests password reset** via `/forgot-password`
2. **Supabase sends email** with reset link
3. **User clicks link** → Supabase redirects to configured redirect URL
4. **Token extraction** happens client-side from URL hash (`#access_token=...&type=recovery`)
5. **Password change form** is displayed automatically

**If password reset doesn't show the change password screen:**
- Check Supabase Dashboard redirect URLs include `http://localhost:9000/reset-password`
- Verify `BASE_URL` in `.env` matches your server port
- Check browser console for JavaScript errors
- Verify the reset link in email contains the correct redirect URL

## Troubleshooting

### Issue: Password reset not showing change password screen

**Symptoms:**
- Clicking reset link doesn't show password form
- Page loads but form is hidden
- Error message appears instead of form

**Solution:**
1. Check Supabase Dashboard redirect URLs include: `http://localhost:9000/reset-password`
2. Verify `BASE_URL` in `.env` matches: `http://localhost:9000`
3. Check browser console (F12) for JavaScript errors
4. Verify the reset link URL in the email - it should redirect to your server
5. Clear browser cache and try again

### Issue: Still redirecting to wrong port

**Solution:**
1. Clear browser cache
2. Verify Supabase Dashboard redirect URLs are saved
3. Check that `BASE_URL` environment variable matches your server URL
4. Ensure server is running on the correct port

### Issue: "Invalid or expired invite link"

**Possible Causes:**
1. Token expired (invites expire after configured time)
2. Token already used
3. Email doesn't match invite record

**Solution:**
1. Create a new invitation
2. Verify email matches the invite record
3. Check invite expiration time in database

### Issue: "No invite found for this email"

**Possible Causes:**
1. Invite record not created in `vmp_invites` table
2. Email mismatch between Supabase Auth and invite record

**Solution:**
1. Verify invite exists: `SELECT * FROM vmp_invites WHERE email = 'user@example.com'`
2. Ensure email addresses match exactly (case-sensitive in some cases)
3. Create new invitation if needed

### Issue: Server not running

**Solution:**
1. Check if server is running: `Get-NetTCPConnection -LocalPort 9000`
2. Start server: `npm start` or `node server.js`
3. Verify port is not in use by another process

## Prevention

To prevent this issue in the future:

1. **Document Default Port:** Always document the default server port in project documentation
2. **Environment Variables:** Use `BASE_URL` environment variable consistently
3. **Configuration Validation:** Add startup checks to validate `BASE_URL` matches server port
4. **Dashboard Sync:** Keep Supabase Dashboard redirect URLs in sync with environment configuration

## Related Files

- `server.js:4926` - `/supabase-invite` route handler
- `server.js:4937` - `/accept` route handler
- `src/views/pages/supabase_invite_handler.html` - Client-side token extraction
- `src/views/pages/accept.html` - Account activation form

## References

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/auth-helpers/redirect-urls)
- [MPC (Magic Passwordless Connection) Documentation](https://supabase.com/docs/guides/auth/auth-magic-link)

