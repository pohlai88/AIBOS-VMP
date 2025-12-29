# Supabase Authentication: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Authentication - all auth methods, MFA, and advanced features  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Email/Password Auth](#emailpassword-auth)
3. [Magic Links](#magic-links)
4. [OAuth Providers](#oauth-providers)
5. [SMS Auth](#sms-auth)
6. [Multi-Factor Authentication](#multi-factor-authentication)
7. [Session Management](#session-management)
8. [User Management](#user-management)
9. [Advanced Features](#advanced-features)
10. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is Supabase Auth?

Supabase Auth provides a **complete authentication system** with:
- ✅ **Email/Password** - Traditional authentication
- ✅ **Magic Links** - Passwordless authentication
- ✅ **OAuth** - Social login (Google, GitHub, etc.)
- ✅ **SMS** - Phone number authentication
- ✅ **MFA** - Multi-factor authentication
- ✅ **Session Management** - JWT tokens with refresh
- ✅ **User Metadata** - Custom user attributes
- ✅ **Webhooks** - Auth event webhooks

---

## 📧 Email/Password Auth

### Sign Up

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe',
      tenant_id: 'tenant_123'
    }
  }
})

if (error) {
  console.error('Sign up error:', error)
} else {
  console.log('User created:', data.user)
}
```

### Sign In

```javascript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

if (error) {
  console.error('Sign in error:', error)
} else {
  console.log('Session:', data.session)
  console.log('User:', data.user)
}
```

### Sign Out

```javascript
// Sign out
const { error } = await supabase.auth.signOut()
```

---

## 🔗 Magic Links

### Send Magic Link

```javascript
// Send magic link
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'https://yourapp.com/callback'
  }
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Magic link sent!')
}
```

### Verify Magic Link

```javascript
// Verify magic link (automatic on redirect)
// Or verify token manually
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',
  type: 'email'
})
```

---

## 🌐 OAuth Providers

### Google OAuth

```javascript
// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://yourapp.com/callback',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent'
    }
  }
})
```

### GitHub OAuth

```javascript
// Sign in with GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'https://yourapp.com/callback',
    scopes: 'read:user user:email'
  }
})
```

### Available Providers

- Google
- GitHub
- Azure
- Apple
- Discord
- Facebook
- Twitter
- Slack
- Spotify
- Twitch
- And more...

### Custom OAuth

```javascript
// Custom OAuth provider
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'custom',
  options: {
    redirectTo: 'https://yourapp.com/callback',
    scopes: 'openid profile email'
  }
})
```

---

## 📱 SMS Auth

### Send SMS OTP

```javascript
// Send SMS OTP
const { data, error } = await supabase.auth.signInWithOtp({
  phone: '+1234567890',
  options: {
    channel: 'sms'
  }
})
```

### Verify SMS OTP

```javascript
// Verify SMS OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+1234567890',
  token: '123456',
  type: 'sms'
})
```

---

## 🔐 Multi-Factor Authentication

### Enable MFA

```javascript
// Enable MFA for user
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp'
})

if (data) {
  // Show QR code to user
  console.log('QR Code:', data.qr_code)
  console.log('Secret:', data.secret)
}
```

### Verify MFA

```javascript
// Verify MFA during sign in
const { data, error } = await supabase.auth.mfa.verify({
  factorId: 'factor_id',
  challengeId: 'challenge_id',
  code: '123456'
})
```

### List MFA Factors

```javascript
// List user's MFA factors
const { data, error } = await supabase.auth.mfa.listFactors()
```

---

## 🎫 Session Management

### Get Current Session

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession()

if (session) {
  console.log('User:', session.user)
  console.log('Access token:', session.access_token)
}
```

### Get Current User

```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser()

if (user) {
  console.log('User ID:', user.id)
  console.log('Email:', user.email)
  console.log('Metadata:', user.user_metadata)
}
```

### Refresh Session

```javascript
// Refresh session
const { data, error } = await supabase.auth.refreshSession()

if (data) {
  console.log('New session:', data.session)
}
```

### Session Events

```javascript
// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event)
  console.log('Session:', session)
  
  if (event === 'SIGNED_IN') {
    // User signed in
  } else if (event === 'SIGNED_OUT') {
    // User signed out
  } else if (event === 'TOKEN_REFRESHED') {
    // Token refreshed
  }
})
```

---

## 👤 User Management

### Update User

```javascript
// Update user metadata
const { data, error } = await supabase.auth.updateUser({
  data: {
    full_name: 'John Doe',
    avatar_url: 'https://...'
  }
})
```

### Update Email

```javascript
// Update email
const { data, error } = await supabase.auth.updateUser({
  email: 'newemail@example.com'
})
```

### Update Password

```javascript
// Update password
const { data, error } = await supabase.auth.updateUser({
  password: 'new-secure-password'
})
```

### Password Reset

```javascript
// Send password reset email
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: 'https://yourapp.com/reset-password'
  }
)
```

### Admin User Operations

```javascript
// Using service role key (admin)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// List users
const { data, error } = await supabaseAdmin.auth.admin.listUsers()

// Get user by ID
const { data, error } = await supabaseAdmin.auth.admin.getUserById('user_id')

// Create user
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure-password',
  email_confirm: true
})

// Update user
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  'user_id',
  {
    user_metadata: { role: 'admin' }
  }
)

// Delete user
const { data, error } = await supabaseAdmin.auth.admin.deleteUser('user_id')
```

---

## 🚀 Advanced Features

### Custom Email Templates

Configure custom email templates in Supabase Dashboard:
- Confirmation emails
- Password reset emails
- Magic link emails
- Email change notifications

### Custom SMTP

Use your own SMTP server:
```javascript
// Configure in Supabase Dashboard
// Settings > Auth > SMTP Settings
```

### Webhooks

Listen to auth events:

```javascript
// Configure webhook in Supabase Dashboard
// Settings > API > Webhooks

// Events:
// - user.created
// - user.updated
// - user.deleted
// - user.signed_in
// - user.signed_out
```

### Row Level Security Integration

Auth integrates with RLS:

```sql
-- Use auth.uid() in RLS policies
CREATE POLICY "Users see own data"
ON nexus_cases FOR SELECT
USING (auth.uid() = user_id);
```

### Organization Management

```javascript
// Create organization
const { data, error } = await supabase
  .from('organizations')
  .insert({
    name: 'My Organization',
    owner_id: user.id
  })

// Add member to organization
const { data, error } = await supabase
  .from('organization_members')
  .insert({
    organization_id: orgId,
    user_id: userId,
    role: 'member'
  })
```

---

## 📊 Best Practices

### 1. Secure Password Requirements

```javascript
// Enforce strong passwords
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

if (!passwordRegex.test(password)) {
  throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character')
}
```

### 2. Rate Limiting

```javascript
// Implement rate limiting on client
let lastAttempt = 0
const RATE_LIMIT_MS = 1000

async function signIn(email, password) {
  const now = Date.now()
  if (now - lastAttempt < RATE_LIMIT_MS) {
    throw new Error('Rate limit exceeded')
  }
  lastAttempt = now
  
  return await supabase.auth.signInWithPassword({ email, password })
}
```

### 3. Session Security

```javascript
// Use secure session storage
// Never store tokens in localStorage (XSS risk)
// Use httpOnly cookies or secure session storage
```

### 4. Email Verification

```javascript
// Require email verification
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    emailRedirectTo: 'https://yourapp.com/verify-email'
  }
})

// Check if email is verified
if (data.user && !data.user.email_confirmed_at) {
  // Show "Please verify your email" message
}
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [RLS Policies](./database/RLS_POLICIES.md) - Row Level Security
- [Auth Official Docs](https://supabase.com/docs/guides/auth) - Official documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

