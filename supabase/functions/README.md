# Supabase Edge Functions

This directory contains Supabase Edge Functions for the VMP project.

## Directory Structure

```
supabase/functions/
├── _shared/              # Shared utilities (types, validation, router, schemas)
│   ├── types.ts          # TypeScript type definitions
│   ├── utils.ts          # Utility functions (validation, errors, auth)
│   ├── router.ts         # EdgeRouter class for action-based routing
│   ├── schemas.ts        # Validation schemas
│   └── README.md         # Shared utilities documentation
├── documents/            # Domain-based function example
│   ├── index.ts          # Document operations (create, update, delete, process)
│   └── README.md         # API documentation
├── example-with-secrets/ # Example function
│   └── index.ts
├── .env.example          # Example environment variables (safe to commit)
├── .env.local            # Local development secrets (DO NOT COMMIT)
└── README.md             # This file
```

## Routing Architecture

This project uses a **domain-based routing** strategy with action-based routing within each function:

- **Domain Functions** - One function per domain (documents, payments, notifications)
- **Action-Based Routing** - Multiple operations per function via `action` field
- **Shared Utilities** - Common code in `_shared/` directory

See [Edge Function Routing Evaluation](../../docs/integrations/EDGE_FUNCTION_ROUTING_EVALUATION.md) for complete architecture details.

## Current Functions

- **documents** - Domain-based function for document operations (create, update, delete, process) ✅ **NEW**
- **process-document** - Processes documents and generates embeddings (Active - can migrate to `documents` function)
- **example-with-secrets** - Example function demonstrating secrets management

## Environment Variables & Secrets

### Default Secrets (Auto-available)

These are automatically provided by Supabase:

- `SUPABASE_URL` - API gateway URL
- `SUPABASE_ANON_KEY` - Anonymous key (RLS-aware)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `SUPABASE_DB_URL` - Direct Postgres connection URL

### Custom Secrets

Add custom secrets for your functions:

- `OPENAI_API_KEY` - For AI/ML features
- `STRIPE_SECRET_KEY` - For payment processing
- `EXTERNAL_API_KEY` - For third-party integrations
- `SENDGRID_API_KEY` - For email services
- `RESEND_API_KEY` - Alternative email service
- `WEBHOOK_SECRET` - For webhook verification

## Local Development

### 1. Setup Environment File

Copy the example file and fill in your values:

```bash
cp supabase/functions/.env.example supabase/functions/.env.local
# Edit .env.local with your local development secrets
```

### 2. Start Supabase Locally

```bash
supabase start
```

### 3. Serve Function Locally

```bash
# Using default .env file
supabase functions serve process-document

# Using custom environment file
supabase functions serve process-document --env-file .env.local
```

## Production Secrets Management

### Method 1: Using Scripts (Recommended)

**PowerShell (Windows):**
```powershell
# List all secrets
.\scripts\supabase-secrets-setup.ps1 -List

# Set secrets for production
.\scripts\supabase-secrets-setup.ps1 -Environment production
```

**Bash (Linux/Mac):**
```bash
# List all secrets
./scripts/supabase-secrets-setup.sh dev list

# Set secrets for production
./scripts/supabase-secrets-setup.sh production
```

### Method 2: Using Supabase CLI Directly

```bash
# Set individual secret
supabase secrets set OPENAI_API_KEY=sk-...

# Set from .env file
supabase secrets set --env-file supabase/functions/.env.production

# List all secrets
supabase secrets list
```

### Method 3: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Secrets Management**
3. Add secrets as Key-Value pairs
4. Click **Save**

## Accessing Secrets in Functions

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Access default secrets
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  // Access custom secrets
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  
  // Validate required secrets
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  // Use secrets...
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

## Best Practices

1. **Never commit `.env` files** - They contain sensitive secrets
2. **Use different secrets per environment** - Dev, staging, production
3. **Validate secrets exist** - Check before using in functions
4. **Never log secrets** - Don't expose them in console.log or responses
5. **Rotate secrets regularly** - Update them periodically for security

## Troubleshooting

### Secret not available in function

1. Verify secret is set:
   ```bash
   supabase secrets list
   ```

2. Check secret name (case-sensitive):
   ```typescript
   // ✅ Correct
   Deno.env.get('OPENAI_API_KEY')
   
   // ❌ Wrong (case mismatch)
   Deno.env.get('openai_api_key')
   ```

3. Check function logs:
   ```bash
   supabase functions logs process-document
   ```

### Secret works locally but not in production

1. Ensure secret is set in production:
   ```bash
   supabase secrets set SECRET_NAME=value --project-ref your-project-ref
   ```

2. Verify you're using the correct project:
   ```bash
   supabase projects list
   ```

## Related Documentation

- [Edge Functions Secrets Guide](../../docs/integrations/EDGE_FUNCTIONS_SECRETS_GUIDE.md)
- [Supabase MCP Guide](../../docs/integrations/SUPABASE_MCP_GUIDE.md)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)

