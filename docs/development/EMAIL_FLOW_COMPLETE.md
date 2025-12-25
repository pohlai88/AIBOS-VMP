# Complete Email Flow: Registration to Password Reset

**Version:** 1.0.0  
**Date:** 2025-12-22  
**Status:** Production Configuration Guide

---

## Overview

This document provides the **complete email configuration** for the entire user journey from registration (invite) through password reset. It covers all email types, configuration options, and implementation details.

---

## Email Flow Diagram

```
1. REGISTRATION (Invite)
   └─> Internal admin creates invite
   └─> Invite link generated (NO EMAIL SENT CURRENTLY)
   └─> Admin copies link manually or uses API response

2. INVITE ACCEPTANCE
   └─> User visits /accept?token=...
   └─> User creates account with password
   └─> Account created in Supabase Auth
   └─> User logged in automatically

3. PASSWORD RESET REQUEST
   └─> User visits /forgot-password
   └─> User enters email
   └─> Supabase Auth sends reset email (via configured SMTP)
   └─> Email contains reset link

4. PASSWORD RESET COMPLETION
   └─> User clicks reset link
   └─> User enters new password
   └─> Password updated in Supabase Auth
   └─> User redirected to login
```

---

## 1. REGISTRATION (Invite Email) - ⚠️ NOT IMPLEMENTED

### Current Status
**❌ Invite emails are NOT sent automatically**

When an internal admin creates an invite via `/ops/invites`:
- Invite record is created in `vmp_invites` table
- Invite token is generated
- Invite URL is returned in JSON response
- **NO EMAIL IS SENT** - admin must manually copy/paste the link

### Code Location
- **Route:** `POST /ops/invites` (server.js:4535)
- **Adapter:** `vmpAdapter.createInvite()` (src/adapters/supabase.js:3280)
- **Response:** JSON with invite link (server.js:4634)

### Current Implementation
```javascript
// server.js:4624-4649
const invite = await vmpAdapter.createInvite(
  vendorId,
  email,
  companyIdsArray,
  req.user.id
);

const inviteUrl = `${req.protocol}://${req.get('host')}${invite.invite_url}`;

// Returns JSON - NO EMAIL SENT
res.status(201).json({
  success: true,
  invite: {
    link: inviteUrl,  // Admin must copy this manually
    email: invite.email,
    // ...
  }
});
```

### To Implement Invite Email Sending

**Step 1:** Add invite email function to `src/utils/notifications.js`:

```javascript
/**
 * Send vendor invite email
 * @param {string} userEmail - Vendor email address
 * @param {string} inviteUrl - Full invite URL with token
 * @param {string} vendorName - Vendor name
 * @param {string} tenantName - Tenant/organization name
 * @returns {Promise<Object>} Email send result
 */
export async function sendInviteEmail(userEmail, inviteUrl, vendorName, tenantName) {
  const emailService = process.env.EMAIL_SERVICE || 'console';
  
  const emailContent = {
    to: userEmail,
    subject: `You're Invited to Join ${tenantName} — NexusCanon VMP`,
    html: generateInviteEmailHTML(inviteUrl, vendorName, tenantName),
    text: generateInviteEmailText(inviteUrl, vendorName, tenantName)
  };

  if (!emailService || emailService === 'console') {
    console.log('[Email] Invite (console mode):');
    console.log(`  To: ${userEmail}`);
    console.log(`  Subject: ${emailContent.subject}`);
    console.log(`  Invite URL: ${inviteUrl}`);
    return { success: true, mode: 'console', emailContent };
  }

  // Production mode - send via email service
  try {
    switch (emailService.toLowerCase()) {
      case 'sendgrid':
        return await sendInviteViaSendGrid(userEmail, emailContent);
      case 'resend':
        return await sendInviteViaResend(userEmail, emailContent);
      case 'smtp':
        return await sendInviteViaSMTP(userEmail, emailContent);
      default:
        console.warn(`[Email] Unknown email service: ${emailService}, falling back to console`);
        return { success: true, mode: 'console', emailContent };
    }
  } catch (error) {
    logError(error, { operation: 'sendInviteEmail', userEmail });
    throw error;
  }
}
```

**Step 2:** Update `POST /ops/invites` route to send email:

```javascript
// After creating invite (server.js:4624)
const invite = await vmpAdapter.createInvite(...);

const inviteUrl = `${req.protocol}://${req.get('host')}${invite.invite_url}`;

// Send invite email
try {
  const vendorName = vendor_name.trim();
  const tenantName = userContext.vmp_vendors?.vmp_tenants?.name || 'Organization';
  await sendInviteEmail(invite.email, inviteUrl, vendorName, tenantName);
} catch (emailError) {
  logError(emailError, { path: req.path, operation: 'sendInviteEmail' });
  // Don't fail invite creation if email fails - invite link is still valid
}

res.status(201).json({ ... });
```

---

## 2. INVITE ACCEPTANCE (Account Creation)

### Flow
1. User visits `/accept?token=...`
2. System validates token
3. User enters password and display name
4. Account created in Supabase Auth
5. User automatically logged in

### Code Location
- **Route:** `GET /accept` (server.js:4659), `POST /accept` (server.js:4733)
- **Adapter:** `vmpAdapter.acceptInviteAndCreateUser()` (src/adapters/supabase.js:3501)

### Email Status
**✅ No email needed** - User is logged in immediately after account creation

---

## 3. PASSWORD RESET REQUEST

### Flow
1. User visits `/forgot-password`
2. User enters email address
3. System calls Supabase Auth `resetPasswordForEmail()`
4. **Supabase Auth sends email automatically** (via configured SMTP in Supabase Dashboard)
5. User receives email with reset link

### Code Location
- **Route:** `POST /forgot-password` (server.js:470)
- **Implementation:** Uses Supabase Auth (server.js:497)

### Current Implementation
```javascript
// server.js:497-502
const { error } = await supabaseAuth.auth.resetPasswordForEmail(
  email.toLowerCase().trim(),
  {
    redirectTo: `${env.BASE_URL}/reset-password`
  }
);
```

### Configuration

**Supabase Dashboard Configuration:**
1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider:
   - **Host:** `smtp.sendgrid.net` (or your SMTP host)
   - **Port:** `587` (TLS) or `465` (SSL)
   - **User:** `apikey` (for SendGrid) or your SMTP username
   - **Password:** Your SendGrid API key or SMTP password
   - **Sender Email:** `noreply@yourdomain.com`
   - **Sender Name:** `NexusCanon VMP`

**Email Template Customization:**
1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **Email Templates**
2. Customize the **"Reset Password"** template
3. Available variables:
   - `{{ .ConfirmationURL }}` - Reset link
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .Email }}` - User email

### Environment Variables
```env
# Base URL for reset links (used in redirectTo)
BASE_URL=http://localhost:9000  # Development
BASE_URL=https://vmp.nexuscanon.com  # Production
```

**Note:** The actual email sending is handled by Supabase Auth using the SMTP settings configured in the Supabase Dashboard. No additional environment variables are needed for password reset emails.

---

## 4. PASSWORD RESET COMPLETION

### Flow
1. User clicks reset link in email
2. Supabase redirects to `/reset-password` with token in URL hash
3. Client-side JavaScript extracts token from hash
4. User enters new password
5. System verifies token and updates password via Supabase Auth
6. User redirected to login with success message

### Code Location
- **Route:** `GET /reset-password` (server.js:524), `POST /reset-password` (server.js:583)
- **Implementation:** Uses Supabase Auth (server.js:628-651)

### Current Implementation
```javascript
// GET /reset-password - Extract token from URL hash
// Token format: #access_token=...&type=recovery (implicit flow)
// or: #token_hash=...&type=recovery (PKCE flow)

// POST /reset-password - Update password
const { data: { session }, error: sessionError } = await supabaseAuth.auth.setSession({
  access_token: token,
  refresh_token: ''
});

const { data, error } = await supabaseAuth.auth.updateUser({
  password: password
});
```

### Email Status
**✅ No email needed** - Password reset is complete, user is redirected to login

---

## Email Service Configuration

### Current System Architecture

The application uses **TWO different email systems**:

1. **Supabase Auth Email System** (for password reset)
   - Configured in Supabase Dashboard
   - Uses SMTP settings from Supabase Dashboard
   - Handles password reset emails automatically
   - **No code changes needed** - works out of the box

2. **Custom Email System** (for invites, payment notifications, etc.)
   - Configured via `EMAIL_SERVICE` environment variable
   - Supports: SendGrid, Resend, SMTP, Console (development)
   - Located in `src/utils/notifications.js`
   - **Currently NOT used for invites** (invite emails not implemented)

### Environment Variables for Custom Email System

```env
# Email Service Selection
EMAIL_SERVICE=console        # Development: logs to console
EMAIL_SERVICE=smtp          # Production: use SMTP
EMAIL_SERVICE=sendgrid      # Production: use SendGrid API
EMAIL_SERVICE=resend        # Production: use Resend API

# Base URL (for reset links in emails)
BASE_URL=http://localhost:9000
SITE_URL=http://localhost:9000  # Alternative name

# SendGrid Configuration
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Resend Configuration
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM_EMAIL=NexusCanon VMP <noreply@yourdomain.com>

# SMTP Configuration (if using custom SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-sendgrid-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=NexusCanon VMP
SMTP_SECURE=false           # true for port 465, false for 587
SMTP_REQUIRE_TLS=true       # Force TLS for port 587
```

### Recommended Configuration

**For Production:**
1. **Password Reset Emails:** Use Supabase Auth SMTP (configured in Supabase Dashboard)
   - No environment variables needed
   - Works automatically with `resetPasswordForEmail()`

2. **Invite Emails (when implemented):** Use same SMTP as Supabase Auth
   - Set `EMAIL_SERVICE=smtp`
   - Use same SMTP credentials from Supabase Dashboard
   - This ensures consistent email delivery

**For Development:**
- Set `EMAIL_SERVICE=console`
- Check server console for email content
- Password reset emails still use Supabase Auth (check Supabase Dashboard → Auth → Logs)

---

## Email Templates

### Password Reset Email (Supabase Auth)

**Location:** Supabase Dashboard → Settings → Auth → Email Templates → "Reset Password"

**Default Template:**
```
Subject: Reset Your Password

Click the link below to reset your password:
{{ .ConfirmationURL }}

If you didn't request this, you can safely ignore this email.
```

**Customization:**
- Can use HTML
- Can customize styling
- Variables: `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`

### Invite Email (Not Implemented - Template Needed)

**Proposed Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to bottom, rgba(96, 255, 198, 0.1), transparent); border: 1px solid rgba(96, 255, 198, 0.2); border-radius: 12px; padding: 32px; margin: 20px 0;">
    <h2 style="color: #060607; margin-top: 0; font-size: 24px; font-weight: 500;">You're Invited to Join {{ tenantName }}</h2>
    
    <p style="color: #666; font-size: 14px; margin: 16px 0;">
      {{ vendorName }} has invited you to join the NexusCanon VMP platform. Click the button below to create your account:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ inviteUrl }}" style="display: inline-block; background: hsl(155, 100%, 69%); color: #050506; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 0 15px rgba(96, 255, 198, 0.2);">
        Accept Invite
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid #eee; padding-top: 16px;">
      This invite will expire in 7 days. If you didn't expect this invite, you can safely ignore this email.
    </p>
    
    <p style="color: #999; font-size: 11px; margin: 16px 0 0 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="{{ inviteUrl }}" style="color: hsl(155, 100%, 69%); word-break: break-all;">{{ inviteUrl }}</a>
    </p>
  </div>
  
  <p style="color: #999; font-size: 11px; text-align: center; margin-top: 32px;">
    NexusCanon VMP • Enterprise Settlement Governance
  </p>
</body>
</html>
```

---

## Testing Email Configuration

### Test Password Reset Flow

**Option 1: Using Supabase Dashboard**
1. Request password reset via `/forgot-password`
2. Check **Supabase Dashboard** → **Auth** → **Logs**
3. Look for email delivery status

**Option 2: Using Test Script**
```bash
node scripts/test-forgot-password-flow.js
```

### Test Invite Email (When Implemented)

**Option 1: Development Mode (Console)**
1. Set `EMAIL_SERVICE=console`
2. Create invite via `/ops/invites`
3. Check server console for email content

**Option 2: Production Mode (SMTP)**
1. Set `EMAIL_SERVICE=smtp` with proper SMTP credentials
2. Create invite via `/ops/invites`
3. Check email inbox for invite email

---

## Troubleshooting

### Password Reset Emails Not Sending

**Check 1: Supabase SMTP Configuration**
- Go to Supabase Dashboard → Settings → Auth → SMTP Settings
- Verify SMTP credentials are correct
- Test SMTP connection

**Check 2: Supabase Auth Logs**
- Go to Supabase Dashboard → Auth → Logs
- Look for email delivery errors
- Check if emails are being sent but not delivered (spam folder)

**Check 3: Email Template**
- Go to Supabase Dashboard → Settings → Auth → Email Templates
- Verify "Reset Password" template is configured
- Check that `{{ .ConfirmationURL }}` is included

### Invite Emails Not Sending (When Implemented)

**Check 1: Environment Variables**
```bash
# Verify EMAIL_SERVICE is set
echo $EMAIL_SERVICE

# Verify SMTP credentials (if using SMTP)
echo $SMTP_HOST
echo $SMTP_USER
```

**Check 2: Server Logs**
- Check server console for email errors
- Look for `[Email]` log messages
- Check for SMTP connection errors

**Check 3: Email Service Configuration**
- Verify API keys are correct (SendGrid/Resend)
- Verify SMTP credentials are correct
- Test email service connection

---

## Summary

### Current Status

| Email Type | Status | Configuration Location |
|------------|--------|------------------------|
| **Invite Email** | ❌ Not Implemented | N/A |
| **Password Reset Email** | ✅ Working | Supabase Dashboard → Auth → SMTP |
| **Payment Notification Email** | ✅ Implemented | `EMAIL_SERVICE` env var |

### Next Steps

1. **Implement Invite Email Sending**
   - Add `sendInviteEmail()` function to `src/utils/notifications.js`
   - Update `POST /ops/invites` route to send email
   - Test invite email delivery

2. **Unify Email Configuration**
   - Consider using same SMTP for all emails (Supabase Auth SMTP)
   - Or use Supabase Auth for all transactional emails

3. **Email Template Management**
   - Create centralized email template system
   - Ensure consistent branding across all emails

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-12-22  
**Maintainer:** Development Team

