# Edge Functions Environment & Secrets Management Guide

**Date:** 2025-01-XX  
**Status:** ✅ Production Ready  
**Project:** VMP (Vendor Management Platform)

---

## Overview

This guide provides practical steps for managing environment variables and secrets in Supabase Edge Functions, specifically for the VMP project. It covers both local development and production environments.

---

## Current Edge Functions

### Active Functions

- **`process-document`** - Processes documents and generates embeddings
  - Status: ACTIVE
  - JWT Verification: Enabled
  - Uses: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (default secrets)

---

## Default Secrets (Always Available)

These secrets are automatically available to all Edge Functions:

| Secret | Description | Example Usage |
|--------|-------------|---------------|
| `SUPABASE_URL` | API gateway URL | `https://vrawceruzokxitybkufk.supabase.co` |
| `SUPABASE_ANON_KEY` | Anonymous key (RLS-aware) | User-facing operations |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Admin operations |
| `SUPABASE_DB_URL` | Direct Postgres connection | Direct database queries |

**Hosted Environment Variables:**
- `SB_REGION` - Region where function was invoked
- `SB_EXECUTION_ID` - UUID of function instance
- `DENO_DEPLOYMENT_ID` - Function version identifier

---

## Quick Decision: Do I Need `.env.local`?

**Short Answer:** Only if you're developing/testing Edge Functions **locally**.

### When You NEED `.env.local`

✅ **You need it if:**
1. **Testing Edge Functions locally:**
   ```bash
   supabase functions serve process-document --env-file .env.local
   ```

2. **Running local Supabase instance:**
   ```bash
   supabase start
   supabase functions serve process-document
   ```

3. **Developing new Edge Functions:**
   - Need to test with custom secrets (OpenAI, Stripe, etc.)
   - Want to use different values than production

### When You DON'T Need `.env.local`

❌ **You don't need it if:**
1. **Only deploying to production:**
   - Production secrets are set via `supabase secrets set` or Dashboard
   - No local file needed

2. **Not developing Edge Functions:**
   - If you're only using the Express server (Node.js)
   - Edge Functions are deployed and working in production

3. **Using production secrets only:**
   - Secrets are managed in Supabase Dashboard
   - No local development/testing needed

### Decision Tree

```
Are you developing/testing Edge Functions locally?
│
├─ YES → You need .env.local
│   └─ Use: supabase functions serve <function> --env-file .env.local
│
└─ NO → You don't need .env.local
    └─ Production secrets are set via:
        - supabase secrets set KEY=value
        - Supabase Dashboard → Edge Functions → Secrets Management
```

**Bottom Line:** `.env.local` is a **development convenience**, not a requirement. Production Edge Functions use secrets from Supabase (set via CLI or Dashboard), not from files.

---

## Local Development Setup

### 1. Create Local Environment File

Create `.env` file in `supabase/functions/` directory:

```bash
# supabase/functions/.env
# Default secrets (automatically loaded from Supabase CLI)
# SUPABASE_URL=https://localhost:54321
# SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Custom secrets for local development
OPENAI_API_KEY=sk-test-...
STRIPE_SECRET_KEY=sk_test_...
EXTERNAL_API_KEY=dev-api-key
```

### 2. Add to .gitignore

Ensure `.env` files are never committed:

```gitignore
# Supabase Edge Functions
supabase/functions/.env
supabase/functions/.env.local
supabase/functions/.env.*
```

### 3. Load Environment Variables

**Automatic loading (default `.env`):**
```bash
supabase start
supabase functions serve process-document
```

**Custom environment file:**
```bash
supabase functions serve process-document --env-file .env.local
```

---

## Production Secrets Management

### Method 1: Supabase Dashboard (Recommended for UI)

1. Navigate to your Supabase project dashboard
2. Go to **Edge Functions** → **Secrets Management**
3. Add secrets as Key-Value pairs:
   ```
   OPENAI_API_KEY = sk-...
   STRIPE_SECRET_KEY = sk_live_...
   EXTERNAL_API_KEY = prod-api-key
   ```
4. Click **Save**

**Benefits:**
- Visual interface
- Can paste multiple secrets at once
- Immediate availability (no redeploy needed)

### Method 2: Supabase CLI (Recommended for Automation)

**Set secrets from `.env` file:**
```bash
# Create .env file with production secrets
cat > .env.production << EOF
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
EXTERNAL_API_KEY=prod-api-key
EOF

# Deploy all secrets at once
supabase secrets set --env-file .env.production
```

**Set secrets individually:**
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set EXTERNAL_API_KEY=prod-api-key
```

**List all secrets:**
```bash
supabase secrets list
```

**⚠️ Security Note:** Never commit `.env.production` to Git!

---

## Example: Updating `process-document` Function

### Current Implementation

The current `process-document` function uses default secrets:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  // ... rest of function
})
```

### Enhanced Version with Custom Secrets

Here's how to add custom secrets (e.g., for OpenAI API):

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // Validate required default secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Access custom secrets (with validation)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Use custom secrets
    if (openaiApiKey) {
      // Example: Use OpenAI for enhanced processing
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: 'Your text here',
        }),
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      // Process embedding data...
    }
    
    // Rest of function logic...
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## Best Practices

### 1. Secret Validation

Always validate that required secrets exist:

```typescript
const requiredSecrets = {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
}

const missingSecrets = Object.entries(requiredSecrets)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingSecrets.length > 0) {
  return new Response(
    JSON.stringify({ 
      error: `Missing required secrets: ${missingSecrets.join(', ')}` 
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  )
}
```

### 2. Never Log Secrets

```typescript
// ❌ BAD - Never do this
console.log('API Key:', Deno.env.get('OPENAI_API_KEY'))

// ✅ GOOD - Check if secret exists without exposing it
console.log('OpenAI API Key configured:', !!Deno.env.get('OPENAI_API_KEY'))
```

### 3. Use Different Secrets Per Environment

```typescript
// Determine environment
const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID')?.includes('prod') ?? false

// Use appropriate secrets
const apiKey = isProduction 
  ? Deno.env.get('PROD_API_KEY')
  : Deno.env.get('DEV_API_KEY')
```

### 4. Error Handling for Missing Secrets

```typescript
const getSecret = (key: string, required = true): string | undefined => {
  const value = Deno.env.get(key)
  
  if (required && !value) {
    throw new Error(`Required secret ${key} is not configured`)
  }
  
  return value
}

// Usage
const apiKey = getSecret('OPENAI_API_KEY', true) // Throws if missing
const optionalKey = getSecret('OPTIONAL_KEY', false) // Returns undefined if missing
```

---

## Common Use Cases

### 1. External API Integration (Stripe, OpenAI, etc.)

```typescript
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
if (!stripeKey) {
  throw new Error('STRIPE_SECRET_KEY not configured')
}

const response = await fetch('https://api.stripe.com/v1/charges', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${stripeKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'amount=1000&currency=usd',
})
```

### 2. Database Connection String

```typescript
const dbUrl = Deno.env.get('SUPABASE_DB_URL')
if (!dbUrl) {
  throw new Error('Database URL not configured')
}

// Use for direct Postgres connection if needed
```

### 3. Feature Flags

```typescript
const enableFeatureX = Deno.env.get('ENABLE_FEATURE_X') === 'true'
const maxRetries = parseInt(Deno.env.get('MAX_RETRIES') || '3', 10)
```

---

## Troubleshooting

### Issue: Secret not available in function

**Symptoms:**
- `Deno.env.get('SECRET_NAME')` returns `undefined`
- Function fails with "missing configuration" error

**Solutions:**
1. **Check secret is set:**
   ```bash
   supabase secrets list
   ```

2. **Verify secret name (case-sensitive):**
   ```typescript
   // Secret name must match exactly
   const key = Deno.env.get('OPENAI_API_KEY') // ✅ Correct
   const key = Deno.env.get('openai_api_key') // ❌ Wrong (case mismatch)
   ```

3. **Redeploy function (not required, but can help):**
   ```bash
   supabase functions deploy process-document
   ```

4. **Check function logs:**
   ```bash
   supabase functions logs process-document
   ```

### Issue: Secret works locally but not in production

**Solutions:**
1. Ensure secret is set in production:
   ```bash
   supabase secrets set SECRET_NAME=value --project-ref your-project-ref
   ```

2. Verify you're using the correct project:
   ```bash
   supabase projects list
   ```

3. Check environment variable names match exactly

---

## Security Checklist

- [ ] All `.env` files are in `.gitignore`
- [ ] Production secrets are set via Dashboard or CLI (not in code)
- [ ] Secrets are validated before use
- [ ] No secrets are logged or exposed in responses
- [ ] Different secrets used for dev/staging/production
- [ ] Secrets are rotated regularly
- [ ] Access to secrets is limited to necessary functions only

---

## Related Documentation

- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md) - Complete MCP integration guide
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets) - Official documentation
- [Error Handling Guide](../development/ERROR_HANDLING.md) - Structured error handling

---

## Quick Reference

### Set Production Secret
```bash
supabase secrets set KEY_NAME=value
```

### List All Secrets
```bash
supabase secrets list
```

### Access Secret in Function
```typescript
const value = Deno.env.get('KEY_NAME')
```

### Validate Secret Exists
```typescript
const value = Deno.env.get('KEY_NAME')
if (!value) {
  throw new Error('KEY_NAME not configured')
}
```

---

**Last Updated:** 2025-01-XX

