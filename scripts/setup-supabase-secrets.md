# Supabase Secrets Setup Guide

Quick reference for setting up and managing Edge Function secrets.

## Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   supabase link --project-ref vrawceruzokxitybkufk
   ```

## Quick Setup

### 1. Create Local Environment File

```bash
# Copy example file
cp supabase/functions/env.example supabase/functions/.env.local

# Edit with your local secrets
# (Use your preferred editor)
```

### 2. Set Production Secrets

**Option A: Using Script (Recommended)**

**PowerShell:**
```powershell
.\scripts\supabase-secrets-setup.ps1 -Environment production
```

**Bash:**
```bash
./scripts/supabase-secrets-setup.sh production
```

**Option B: Using CLI Directly**

```bash
# Set individual secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set EXTERNAL_API_KEY=your-api-key

# Or set from file
supabase secrets set --env-file supabase/functions/.env.production
```

**Option C: Using Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** → **Secrets Management**
4. Add secrets as Key-Value pairs
5. Click **Save**

## Verify Secrets

### List All Secrets

```bash
supabase secrets list
```

### Test in Function

Deploy a test function or use the example:

```bash
supabase functions deploy example-with-secrets
```

Then call it to see which secrets are configured (values are never exposed).

## Common Commands

```bash
# List secrets
supabase secrets list

# Set single secret
supabase secrets set KEY_NAME=value

# Set from file
supabase secrets set --env-file path/to/.env

# Deploy function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name
```

## Environment Files

- `.env.local` - Local development (not committed)
- `.env.staging` - Staging environment (not committed)
- `.env.production` - Production environment (not committed)
- `env.example` - Example template (safe to commit)

## Troubleshooting

### "Secret not found" error

1. Verify secret is set:
   ```bash
   supabase secrets list
   ```

2. Check secret name is exact (case-sensitive):
   ```typescript
   // ✅ Correct
   Deno.env.get('OPENAI_API_KEY')
   
   // ❌ Wrong
   Deno.env.get('openai_api_key')
   ```

3. Ensure you're linked to correct project:
   ```bash
   supabase projects list
   ```

### Secret works locally but not in production

1. Set secret in production:
   ```bash
   supabase secrets set KEY_NAME=value --project-ref your-project-ref
   ```

2. Verify project reference:
   ```bash
   supabase link --project-ref vrawceruzokxitybkufk
   ```

## Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use different secrets per environment
- ✅ Rotate secrets regularly
- ✅ Validate secrets before use
- ✅ Never log secret values
- ✅ Use least privilege principle

