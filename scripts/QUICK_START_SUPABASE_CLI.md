# Quick Start: Root .env and Supabase CLI

## Current Setup ✅

Your root `.env` file contains:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

## Quick Commands

### 1. Sync Root .env to Edge Functions

```powershell
# Sync SUPABASE_* variables to Edge Functions .env.local
.\scripts\sync-env-to-supabase.ps1

# Force overwrite existing file
.\scripts\sync-env-to-supabase.ps1 -Force
```

### 2. Link Supabase CLI to Your Project

```bash
# Link to your project (uses project ref from URL)
supabase link --project-ref vrawceruzokxitybkufk
```

### 3. Verify Connection

```bash
# Check linked project
supabase projects list

# Check project status
supabase status
```

### 4. Manage Edge Function Secrets

```bash
# List all secrets
supabase secrets list

# Set a secret
supabase secrets set OPENAI_API_KEY=sk-...

# Deploy function
supabase functions deploy process-document
```

### 5. Serve Function Locally

```bash
# After syncing .env, serve with local secrets
supabase functions serve process-document --env-file supabase/functions/.env.local
```

## Workflow

1. **Sync root .env values:**
   ```powershell
   .\scripts\sync-env-to-supabase.ps1 -Force
   ```

2. **Add custom Edge Function secrets:**
   Edit `supabase/functions/.env.local` and add:
   ```
   OPENAI_API_KEY=sk-test-...
   STRIPE_SECRET_KEY=sk_test_...
   ```

3. **Test locally:**
   ```bash
   supabase functions serve process-document --env-file supabase/functions/.env.local
   ```

4. **Deploy to production:**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase functions deploy process-document
   ```

## Files

- **Root `.env`** - Express server config (already exists ✅)
- **`supabase/functions/.env.local`** - Edge Functions local secrets (created by sync script)
- **`supabase/functions/env.example`** - Template (safe to commit)

## Documentation

- [Root .env and Supabase CLI Guide](../docs/integrations/ROOT_ENV_SUPABASE_CLI_GUIDE.md)
- [Edge Functions Secrets Guide](../docs/integrations/EDGE_FUNCTIONS_SECRETS_GUIDE.md)
- [Supabase MCP Guide](../docs/integrations/SUPABASE_MCP_GUIDE.md)

