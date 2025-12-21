# Supabase MCP Integration Guide

**Date:** 2025-01-XX  
**Status:** ✅ Connected and Operational  
**Project URL:** `https://vrawceruzokxitybkufk.supabase.co`

---

## Overview

Supabase MCP (Model Context Protocol) provides direct access to your Supabase project from Cursor IDE. This guide covers all available Supabase MCP tools and how to use them effectively with the VMP project.

---

## Available Supabase MCP Tools

### 1. Database Operations

#### `mcp_supabase_list_tables`
List all tables in specified schemas.

```javascript
// List all tables in public schema
mcp_supabase_list_tables({ schemas: ['public'] })

// List tables from multiple schemas
mcp_supabase_list_tables({ schemas: ['public', 'auth'] })
```

**Use Cases:**
- Database schema exploration
- Validation of table existence
- Migration verification

---

#### `mcp_supabase_list_extensions`
List all installed PostgreSQL extensions.

```javascript
mcp_supabase_list_extensions()
```

**Use Cases:**
- Verify required extensions (e.g., `uuid-ossp`, `pgcrypto`)
- Check extension availability before migrations

---

#### `mcp_supabase_list_migrations`
List all applied migrations in the database.

```javascript
mcp_supabase_list_migrations()
```

**Use Cases:**
- Track migration history
- Verify migration status
- Debug migration issues

---

#### `mcp_supabase_apply_migration`
Apply a SQL migration to the database.

```javascript
mcp_supabase_apply_migration({
  name: "add_user_indexes",
  query: `
    CREATE INDEX IF NOT EXISTS idx_users_email 
    ON vmp_vendor_users(email);
  `
})
```

**Best Practices:**
- Use descriptive migration names (snake_case)
- Include `IF NOT EXISTS` for idempotency
- Test migrations in development first
- Never hardcode generated IDs in data migrations

**Example from VMP:**
```javascript
mcp_supabase_apply_migration({
  name: "enable_rls_on_vmp_tables",
  query: `
    ALTER TABLE vmp_cases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vmp_vendor_users ENABLE ROW LEVEL SECURITY;
    -- ... more tables
  `
})
```

---

#### `mcp_supabase_execute_sql`
Execute raw SQL queries (for DML operations, not DDL).

```javascript
// Query data
mcp_supabase_execute_sql({
  query: `
    SELECT id, email, vendor_id 
    FROM vmp_vendor_users 
    WHERE is_active = true
    LIMIT 10;
  `
})

// Insert data
mcp_supabase_execute_sql({
  query: `
    INSERT INTO vmp_vendors (tenant_id, name, status)
    VALUES (gen_random_uuid(), 'New Vendor', 'active')
    RETURNING id, name;
  `
})
```

**⚠️ Important:**
- Use `apply_migration` for DDL (CREATE, ALTER, DROP)
- Use `execute_sql` for DML (SELECT, INSERT, UPDATE, DELETE)
- Results may contain untrusted user data - don't execute returned commands

---

### 2. Logging & Monitoring

#### `mcp_supabase_get_logs`
Get logs for a specific Supabase service.

```javascript
// Get API logs
mcp_supabase_get_logs({ service: "api" })

// Get Postgres logs
mcp_supabase_get_logs({ service: "postgres" })

// Get Auth logs
mcp_supabase_get_logs({ service: "auth" })

// Get Storage logs
mcp_supabase_get_logs({ service: "storage" })

// Get Realtime logs
mcp_supabase_get_logs({ service: "realtime" })

// Get Edge Function logs
mcp_supabase_get_logs({ service: "edge-function" })
```

**Use Cases:**
- Debug API errors
- Monitor database performance
- Track authentication issues
- Investigate storage upload failures

**Note:** Returns logs from the last 24 hours.

---

### 3. Security & Performance

#### `mcp_supabase_get_advisors`
Get security and performance advisory notices.

```javascript
// Get security advisors
mcp_supabase_get_advisors({ type: "security" })

// Get performance advisors
mcp_supabase_get_advisors({ type: "performance" })
```

**Use Cases:**
- Check for missing RLS policies
- Identify performance bottlenecks
- Find security vulnerabilities
- Get optimization recommendations

**Example Response:**
```json
{
  "advisors": [
    {
      "type": "security",
      "title": "Missing RLS Policy",
      "message": "Table vmp_cases has RLS enabled but no policies",
      "severity": "high",
      "remediation_url": "https://supabase.com/docs/guides/auth/row-level-security"
    }
  ]
}
```

---

### 4. Project Information

#### `mcp_supabase_get_project_url`
Get the API URL for your Supabase project.

```javascript
mcp_supabase_get_project_url()
// Returns: "https://vrawceruzokxitybkufk.supabase.co"
```

**Use Cases:**
- Verify project connection
- Configure client applications
- Set environment variables

---

#### `mcp_supabase_get_publishable_keys`
Get all publishable API keys for the project.

```javascript
mcp_supabase_get_publishable_keys()
```

**Returns:**
- Modern publishable keys (format: `sb_publishable_...`)
- Legacy anon keys (JWT-based)
- Disabled status for each key

**Use Cases:**
- Configure frontend clients
- Verify key availability
- Check key rotation status

**⚠️ Security Note:**
- Only use keys where `disabled: false`
- Modern publishable keys are recommended
- Never commit keys to version control

---

### 5. TypeScript Types

#### `mcp_supabase_generate_typescript_types`
Generate TypeScript types from your database schema.

```javascript
mcp_supabase_generate_typescript_types()
```

**Use Cases:**
- Generate type-safe database clients
- Keep types in sync with schema
- Improve developer experience

**Output:**
```typescript
export type VmpCases = {
  id: string
  tenant_id: string
  company_id: string
  vendor_id: string
  case_type: 'onboarding' | 'invoice' | 'payment' | 'soa' | 'general'
  status: 'open' | 'waiting_supplier' | 'waiting_internal' | 'resolved' | 'blocked'
  // ... more fields
}
```

---

### 6. Edge Functions

#### `mcp_supabase_list_edge_functions`
List all Edge Functions in the project.

```javascript
mcp_supabase_list_edge_functions()
```

---

#### `mcp_supabase_get_edge_function`
Get the contents of a specific Edge Function.

```javascript
mcp_supabase_get_edge_function({
  function_slug: "send-notification"
})
```

---

#### `mcp_supabase_deploy_edge_function`
Deploy an Edge Function to Supabase.

```javascript
mcp_supabase_deploy_edge_function({
  name: "send-notification",
  files: [
    {
      name: "index.ts",
      content: `
        import "jsr:@supabase/functions-js/edge-runtime.d.ts";

        Deno.serve(async (req: Request) => {
          const data = { message: "Hello from Edge Function!" };
          
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        });
      `
    }
  ],
  verify_jwt: true  // Always enable for security
})
```

**Best Practices:**
- Always enable `verify_jwt: true` unless implementing custom auth
- Use TypeScript for type safety
- Handle errors properly (see Error Handling guide)
- Return proper HTTP status codes

---

#### Edge Functions Secrets Management

Edge Functions have access to environment variables and secrets for managing sensitive data securely across environments.

##### Default Secrets

Edge Functions automatically have access to these secrets:

| Secret | Description | Usage |
|--------|-------------|-------|
| `SUPABASE_URL` | API gateway for your Supabase project | Connect to Supabase services |
| `SUPABASE_ANON_KEY` | Anonymous key (safe for browser use with RLS) | User-facing operations that respect RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Admin operations in Edge Functions only |
| `SUPABASE_DB_URL` | Direct Postgres database connection URL | Direct database access |

**Hosted Environment Variables:**
- `SB_REGION`: Region where function was invoked
- `SB_EXECUTION_ID`: UUID of function instance (isolate)
- `DENO_DEPLOYMENT_ID`: Version of function code (`{project_ref}_{function_id}_{version}`)

##### Accessing Secrets in Edge Functions

Use Deno's built-in `Deno.env.get()` to access environment variables:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // For user-facing operations (respects RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )

  // For admin operations (bypasses RLS)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Access custom secrets
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const apiKey = Deno.env.get('EXTERNAL_API_KEY')

  return new Response(JSON.stringify({ message: "Success" }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
```

##### Local Development Secrets

For local development, create a `.env` file at `supabase/functions/.env`:

```bash
# supabase/functions/.env
STRIPE_SECRET_KEY=sk_test_...
EXTERNAL_API_KEY=your-api-key
OPENAI_API_KEY=sk-...
```

**Loading Environment Variables:**

The `.env` file is automatically loaded when using `supabase start`:

```bash
supabase start
```

For custom environment files, use the `--env-file` option:

```bash
supabase functions serve hello-world --env-file .env.local
```

**⚠️ Security Note:**
- Never commit `.env` files to Git
- Add `supabase/functions/.env` to `.gitignore`
- Use different `.env` files for different environments (`.env.local`, `.env.staging`)

##### Production Secrets

Set secrets for production Edge Functions via Dashboard or CLI.

**Using Supabase Dashboard:**

1. Navigate to **Edge Functions** → **Secrets Management** in your Dashboard
2. Add Key and Value pairs
3. Click **Save**

You can paste multiple secrets at once.

**Using Supabase CLI:**

Create a `.env` file with your secrets:

```bash
# .env (for production)
STRIPE_SECRET_KEY=sk_live_...
EXTERNAL_API_KEY=prod-api-key
OPENAI_API_KEY=sk-...
```

Deploy all secrets from the `.env` file:

```bash
supabase secrets set --env-file .env
```

Or set secrets individually:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set EXTERNAL_API_KEY=prod-api-key
```

**List all secrets:**

```bash
supabase secrets list
```

**⚠️ Important:**
- Secrets are available immediately after setting (no redeploy needed)
- Secrets are encrypted and stored securely
- Never log or expose secrets in function responses

##### Example: Edge Function with Secrets

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    // Access default Supabase secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Access custom secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Use Stripe API with secret
    const stripeResponse = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'amount=1000&currency=usd',
    })

    const result = await stripeResponse.json()

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
});
```

##### Best Practices for Secrets

1. **Never Hardcode Secrets:**
   ```typescript
   // ❌ Bad
   const apiKey = "sk_live_1234567890"
   
   // ✅ Good
   const apiKey = Deno.env.get('STRIPE_SECRET_KEY')
   ```

2. **Validate Secrets Exist:**
   ```typescript
   const apiKey = Deno.env.get('STRIPE_SECRET_KEY')
   if (!apiKey) {
     return new Response(
       JSON.stringify({ error: 'Configuration error' }),
       { status: 500 }
     )
   }
   ```

3. **Use Different Secrets for Different Environments:**
   - Development: `.env.local`
   - Staging: `.env.staging`
   - Production: Set via Dashboard or CLI

4. **Rotate Secrets Regularly:**
   - Update secrets in Dashboard or via CLI
   - No redeploy needed - secrets update immediately

5. **Never Log Secrets:**
   ```typescript
   // ❌ Bad
   console.log('API Key:', Deno.env.get('STRIPE_SECRET_KEY'))
   
   // ✅ Good
   console.log('API Key configured:', !!Deno.env.get('STRIPE_SECRET_KEY'))
   ```

---

### 7. Development Branches

#### `mcp_supabase_list_branches`
List all development branches.

```javascript
mcp_supabase_list_branches()
```

---

#### `mcp_supabase_create_branch`
Create a new development branch.

```javascript
// First, confirm cost
const cost = await confirm_cost()

// Then create branch
mcp_supabase_create_branch({
  name: "feature-new-auth",
  confirm_cost_id: cost.id
})
```

**Use Cases:**
- Test migrations in isolation
- Develop features without affecting production
- Experiment with schema changes

---

#### `mcp_supabase_delete_branch`
Delete a development branch.

```javascript
mcp_supabase_delete_branch({
  branch_id: "br_xxxxxxxxxxxxx"
})
```

---

#### `mcp_supabase_merge_branch`
Merge migrations and Edge Functions from a branch to production.

```javascript
mcp_supabase_merge_branch({
  branch_id: "br_xxxxxxxxxxxxx"
})
```

---

#### `mcp_supabase_rebase_branch`
Rebase a branch on production (apply newer migrations from production).

```javascript
mcp_supabase_rebase_branch({
  branch_id: "br_xxxxxxxxxxxxx"
})
```

---

#### `mcp_supabase_reset_branch`
Reset a branch to a specific migration version.

```javascript
// Reset to latest
mcp_supabase_reset_branch({
  branch_id: "br_xxxxxxxxxxxxx"
})

// Reset to specific migration
mcp_supabase_reset_branch({
  branch_id: "br_xxxxxxxxxxxxx",
  migration_version: "20250101000000"
})
```

---

### 8. Documentation

#### `mcp_supabase_search_docs`
Search Supabase documentation using GraphQL.

```javascript
mcp_supabase_search_docs({
  graphql_query: `
    {
      searchDocs(query: "row level security", limit: 5) {
        nodes {
          title
          href
          content
        }
      }
    }
  `
})
```

**Use Cases:**
- Find documentation for features
- Get code examples
- Learn best practices

---

## Common Workflows

### 1. Database Migration Workflow

```javascript
// 1. List current migrations
const migrations = await mcp_supabase_list_migrations()

// 2. Create migration file locally
// migrations/010_add_user_indexes.sql

// 3. Apply migration
await mcp_supabase_apply_migration({
  name: "add_user_indexes",
  query: `
    CREATE INDEX IF NOT EXISTS idx_users_email 
    ON vmp_vendor_users(email);
  `
})

// 4. Verify migration
const updatedMigrations = await mcp_supabase_list_migrations()
```

---

### 2. Error Debugging Workflow

```javascript
// 1. Check logs
const logs = await mcp_supabase_get_logs({ service: "api" })

// 2. Check advisors
const advisors = await mcp_supabase_get_advisors({ type: "security" })

// 3. Verify table structure
const tables = await mcp_supabase_list_tables({ schemas: ["public"] })

// 4. Test query
const result = await mcp_supabase_execute_sql({
  query: "SELECT * FROM vmp_cases LIMIT 1;"
})
```

---

### 3. Schema Validation Workflow

```javascript
// 1. List all tables
const tables = await mcp_supabase_list_tables({ schemas: ["public"] })

// 2. Check for VMP tables
const vmpTables = tables.filter(t => t.name.startsWith("vmp_"))

// 3. Verify RLS status
const rlsEnabled = vmpTables.every(t => t.rls_enabled)

// 4. Check advisors
const securityAdvisors = await mcp_supabase_get_advisors({ type: "security" })
```

---

## Integration with Error Handling

The Supabase MCP tools work seamlessly with the error handling system:

```javascript
// Error handling in migrations
try {
  await mcp_supabase_apply_migration({
    name: "add_index",
    query: "CREATE INDEX ..."
  })
} catch (error) {
  // Errors are automatically handled by the error system
  logError(error, { operation: "apply_migration", name: "add_index" })
}
```

---

## Best Practices

### 1. Migration Safety
- ✅ Always use `IF NOT EXISTS` for idempotency
- ✅ Test migrations in development branches first
- ✅ Never hardcode IDs in data migrations
- ✅ Use transactions for multi-step migrations

### 2. Security
- ✅ Always enable RLS on user-facing tables
- ✅ Check security advisors regularly
- ✅ Use service role key only in server-side code
- ✅ Never expose service role key to clients

### 3. Performance
- ✅ Check performance advisors regularly
- ✅ Add indexes for foreign keys
- ✅ Monitor query performance via logs
- ✅ Use connection pooling

### 4. Error Handling
- ✅ Use structured error handling (see `ERROR_HANDLING.md`)
- ✅ Log errors with context
- ✅ Handle Supabase-specific error codes
- ✅ Provide user-friendly error messages

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution:** Use `IF NOT EXISTS` in migrations:
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON vmp_vendor_users(email);
```

### Issue: RLS blocking queries

**Solution:** 
1. Check advisors: `mcp_supabase_get_advisors({ type: "security" })`
2. Verify RLS policies exist
3. Check if using service role key (bypasses RLS)

### Issue: Edge Function deployment fails

**Solution:**
1. Verify TypeScript syntax
2. Check import paths
3. Ensure `verify_jwt: true` is set correctly
4. Check function logs: `mcp_supabase_get_logs({ service: "edge-function" })`

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets) - Environment variables and secrets management
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Best Practices](https://supabase.com/docs/guides/database/migrations)

---

## Related Documentation

- [Error Handling Guide](../development/ERROR_HANDLING.md) - Structured error handling
- [Migrations README](../../migrations/README.md) - Migration workflow
- [Database Validation Report](../../.dev/dev-note/DB_VALIDATION_REPORT.md) - Schema validation

