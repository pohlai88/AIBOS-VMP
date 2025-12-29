# Email Configuration Guide

## Current Status

**Default Mode:** `console` (Development)
- Emails are **NOT sent** - they are logged to the server console
- Check your server console output for reset URLs

## How to Get Password Reset Links (Development)

### Option 1: Check Server Console
When you request a password reset, check your server console for output like:
```
[Email] Password reset (console mode):
  To: jackwee2020@gmail.com
  Subject: Reset Your Password — NexusCanon VMP
  Reset URL: http://localhost:9000/reset-password?token=...
```

### Option 2: Query Database Directly
Use Supabase MCP to query the database for active tokens:
```sql
SELECT 
    CONCAT('http://localhost:9000/reset-password?token=', token) as reset_url,
    expires_at,
    created_at
FROM vmp_password_reset_tokens
WHERE user_id = (SELECT id FROM vmp_vendor_users WHERE email = 'your-email@example.com')
    AND used_at IS NULL
    AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;
```

## Configure Email Service (Production)

To actually send emails, set `EMAIL_SERVICE` in your `.env` file:

### Option 1: SendGrid
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Option 2: Resend
```env
EMAIL_SERVICE=resend
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM_EMAIL=NexusCanon VMP <noreply@yourdomain.com>
```

### Option 3: SMTP (Recommended - Use Supabase SMTP Settings)
You can use **Supabase's SMTP configuration** or any SMTP provider (SendGrid SMTP, AWS SES, etc.).

**Using Supabase's SMTP Settings:**
1. Go to your Supabase Dashboard → Settings → Auth → SMTP Settings
2. Configure your SMTP provider (SendGrid, AWS SES, etc.)
3. Copy the SMTP credentials to your `.env` file:

```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.sendgrid.net          # From Supabase SMTP settings
SMTP_PORT=587                         # Usually 587 (TLS) or 465 (SSL)
SMTP_USER=apikey                      # From Supabase SMTP settings
SMTP_PASSWORD=SG.your-sendgrid-key   # From Supabase SMTP settings
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=NexusCanon VMP
SMTP_SECURE=false                     # true for port 465, false for 587
SMTP_REQUIRE_TLS=true                 # Force TLS for port 587
```

**Using Any SMTP Provider Directly:**
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=NexusCanon VMP
```

**Note:** You don't need a separate SendGrid API key when using SMTP. Just configure SMTP in Supabase dashboard and use those credentials here.

## Environment Variables

Required for email sending:
- `EMAIL_SERVICE` - One of: `sendgrid`, `resend`, `smtp`, or `console` (default)
- `SITE_URL` or `BASE_URL` - Base URL for reset links (defaults to `http://localhost:9000`)

Service-specific variables:
- **SendGrid:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`

## Testing

After configuring email service, test with:
```bash
node scripts/test-forgot-password-flow.js
```

This will create a token and attempt to send an email using your configured service.

