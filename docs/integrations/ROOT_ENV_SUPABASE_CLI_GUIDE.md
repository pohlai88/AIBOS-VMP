# Root .env and Supabase CLI Integration Guide

**Date:** 2025-01-XX  
**Status:** ✅ Production Ready  
**Project:** VMP (Vendor Management Platform)

---

## Overview

This guide explains how the root `.env` file (used by Express server) relates to Supabase CLI configuration and Edge Functions secrets.

---

## Environment File Locations

### 1. Root `.env` (Express Server)

**Location:** `C:\AI-BOS\AIBOS-VMP\.env`

**Used by:**
- Express server (`server.js`)
- Supabase adapter (`src/adapters/supabase.js`)
- Node.js application

**Contains:**
```bash
SUPABASE_URL=https://vrawceruzokxitybkufk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEMO_VENDOR_ID=your-vendor-id
SESSION_SECRET=your-session-secret
PORT=9000
NODE_ENV=development
VMP_HOME_PAGE=home5
VMP_LOGIN_PAGE=login3
```

### 2. Edge Functions `.env` (Supabase CLI)

**Location:** `supabase/functions/.env` or `supabase/functions/.env.local`

**Used by:**
- Supabase Edge Functions
- Supabase CLI (`supabase functions serve`)
- Deno runtime

**Contains:**
```bash
# Default secrets (auto-loaded when using supabase start)
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Custom secrets for Edge Functions
OPENAI_API_KEY=sk-test-...
STRIPE_SECRET_KEY=sk_test_...
EXTERNAL_API_KEY=dev-api-key
```

---

## Key Differences

| Aspect | Root `.env` | Edge Functions `.env` |
|--------|-------------|----------------------|
| **Purpose** | Express server config | Edge Functions secrets |
| **Runtime** | Node.js | Deno |
| **Loaded by** | `dotenv.config()` | Supabase CLI |
| **Location** | Project root | `supabase/functions/` |
| **Scope** | Application-wide | Edge Functions only |

---

## Using Root .env Values with Supabase CLI

### Option 1: Link Supabase CLI to Your Project

The Supabase CLI can use your project's existing configuration:

```bash
# Link to your project (uses project ref from root .env)
supabase link --project-ref vrawceruzokxitybkufk
```

This connects the CLI to your project, and it will use the project's secrets automatically.

### Option 2: Sync Root .env to Edge Functions .env

Create a script to sync relevant values:

```powershell
# PowerShell script to sync root .env to Edge Functions .env
$rootEnv = Get-Content .env | Where-Object { $_ -match '^SUPABASE_' }
$rootEnv | Out-File -FilePath "supabase/functions/.env.local" -Append
```

### Option 3: Use Environment Variables Directly

Set environment variables from root `.env` before running Supabase CLI:

```powershell
# PowerShell: Load root .env and use with Supabase CLI
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Now Supabase CLI commands will use these variables
supabase functions serve process-document
```

---

## Common Supabase CLI Commands

### Project Management

```bash
# Login to Supabase
supabase login

# Link to your project (uses project ref)
supabase link --project-ref vrawceruzokxitybkufk

# Check current project
supabase projects list

# Get project status
supabase status
```

### Edge Functions

```bash
# List all functions
supabase functions list

# Deploy a function
supabase functions deploy process-document

# Serve function locally
supabase functions serve process-document

# Serve with custom env file
supabase functions serve process-document --env-file supabase/functions/.env.local

# View function logs
supabase functions logs process-document
```

### Secrets Management

```bash
# List all secrets
supabase secrets list

# Set a secret
supabase secrets set OPENAI_API_KEY=sk-...

# Set from .env file
supabase secrets set --env-file supabase/functions/.env.production

# Unset a secret
supabase secrets unset OPENAI_API_KEY
```

### Database

```bash
# Start local Supabase (includes local .env loading)
supabase start

# Stop local Supabase
supabase stop

# Reset local database
supabase db reset

# Run migrations
supabase db push
```

---

## Recommended Setup

### 1. Keep Root .env for Express Server

The root `.env` should contain:
- `SUPABASE_URL` - Your production Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- Application-specific variables (`DEMO_VENDOR_ID`, `SESSION_SECRET`, etc.)

### 2. Create Separate Edge Functions .env

Create `supabase/functions/.env.local` for local Edge Functions development:

```bash
# Copy from example
cp supabase/functions/env.example supabase/functions/.env.local

# Add your custom secrets
# OPENAI_API_KEY=sk-test-...
# STRIPE_SECRET_KEY=sk_test_...
```

### 3. Use Supabase CLI Secrets for Production

For production Edge Functions, use Supabase CLI or Dashboard:

```bash
# Set production secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
```

---

## Integration Script

Create a helper script to sync root `.env` values to Edge Functions:

**`scripts/sync-env-to-supabase.ps1`:**

```powershell
# Sync relevant values from root .env to Edge Functions .env.local
param(
    [switch]$Force
)

$rootEnvPath = ".env"
$edgeEnvPath = "supabase/functions/.env.local"

if (-not (Test-Path $rootEnvPath)) {
    Write-Host "❌ Root .env file not found: $rootEnvPath" -ForegroundColor Red
    exit 1
}

# Read root .env
$rootEnv = Get-Content $rootEnvPath

# Filter Supabase-related variables
$supabaseVars = $rootEnv | Where-Object {
    $_ -match '^SUPABASE_' -and 
    $_ -notmatch '^\s*#' -and
    $_ -notmatch '^\s*$'
}

if ($supabaseVars.Count -eq 0) {
    Write-Host "⚠️  No SUPABASE_ variables found in root .env" -ForegroundColor Yellow
    exit 0
}

# Create or update Edge Functions .env.local
if (Test-Path $edgeEnvPath) {
    if (-not $Force) {
        Write-Host "⚠️  Edge Functions .env.local already exists. Use -Force to overwrite." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "📝 Updating existing Edge Functions .env.local..." -ForegroundColor Cyan
} else {
    Write-Host "📝 Creating Edge Functions .env.local..." -ForegroundColor Cyan
}

# Write Supabase variables
$supabaseVars | Out-File -FilePath $edgeEnvPath -Encoding utf8

Write-Host "✅ Synced $($supabaseVars.Count) SUPABASE_ variables to $edgeEnvPath" -ForegroundColor Green
Write-Host "   Remember to add custom Edge Function secrets manually!" -ForegroundColor Yellow
```

---

## Quick Reference

### Check Supabase CLI Connection

```bash
# Verify you're linked to the correct project
supabase projects list

# Check project status
supabase status
```

### Use Root .env Values

```bash
# Option 1: Link CLI to project (recommended)
supabase link --project-ref vrawceruzokxitybkufk

# Option 2: Use sync script
.\scripts\sync-env-to-supabase.ps1 -Force

# Option 3: Manual copy (selective)
# Copy SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to supabase/functions/.env.local
```

### Deploy with Secrets

```bash
# 1. Set secrets via CLI
supabase secrets set OPENAI_API_KEY=sk-...

# 2. Deploy function
supabase functions deploy process-document

# Secrets are automatically available in the deployed function
```

---

## Troubleshooting

### Issue: Supabase CLI not using root .env values

**Solution:**
1. Link CLI to your project:
   ```bash
   supabase link --project-ref vrawceruzokxitybkufk
   ```

2. Or sync values manually:
   ```powershell
   .\scripts\sync-env-to-supabase.ps1 -Force
   ```

### Issue: Edge Function can't access secrets

**Solution:**
1. Verify secrets are set:
   ```bash
   supabase secrets list
   ```

2. Check secret names match exactly (case-sensitive)

3. Ensure function is deployed:
   ```bash
   supabase functions deploy function-name
   ```

### Issue: Local function can't connect to Supabase

**Solution:**
1. Ensure root `.env` has correct `SUPABASE_URL`
2. Sync to Edge Functions `.env.local`:
   ```powershell
   .\scripts\sync-env-to-supabase.ps1 -Force
   ```
3. Or start local Supabase:
   ```bash
   supabase start
   ```

---

## Best Practices

1. **Separate Concerns:**
   - Root `.env` → Express server configuration
   - Edge Functions `.env` → Edge Functions secrets only

2. **Use Supabase CLI for Production:**
   - Set secrets via `supabase secrets set`
   - Don't rely on `.env` files in production

3. **Sync When Needed:**
   - Use sync script to copy `SUPABASE_*` variables
   - Add custom Edge Function secrets separately

4. **Never Commit Secrets:**
   - Both `.env` files should be in `.gitignore`
   - Use `.env.example` files for templates

---

## Related Documentation

- [Edge Functions Secrets Guide](./EDGE_FUNCTIONS_SECRETS_GUIDE.md)
- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md)
- [Supabase Functions README](../../supabase/functions/README.md)

---

**Last Updated:** 2025-01-XX

