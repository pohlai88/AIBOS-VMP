# Edge Function Migration Guide

**Date:** 2025-01-XX  
**Status:** ✅ Active Migration  
**Project:** VMP (Vendor Management Platform)

---

## Overview

This guide helps migrate from old Edge Function patterns to the new standardized routing architecture.

---

## Migration Status

| Function | Old Pattern | New Pattern | Status |
|----------|-------------|-------------|--------|
| `process-document` | Single-purpose | Migrated to `documents` function | ✅ **DEPRECATED** |
| `example-with-secrets` | Action-based (manual) | Refactored with EdgeRouter | ✅ **REFACTORED** |
| External APIs | Mixed in example | New `integrations` function | ✅ **NEW** |

---

## 1. Migrating from `process-document` to `documents`

### Before (Old Pattern)

```bash
POST /functions/v1/process-document
```

**Request:**
```json
{
  "document_id": "uuid-here",
  "name": "Document.pdf",
  "category": "invoice",
  "tenant_id": "uuid-here",
  "organization_id": "uuid-here"
}
```

### After (New Pattern)

```bash
POST /functions/v1/documents
```

**Request:**
```json
{
  "action": "process",
  "document_id": "uuid-here",
  "name": "Document.pdf",
  "category": "invoice",
  "tenant_id": "uuid-here",
  "organization_id": "uuid-here"
}
```

### Code Changes

**Before:**
```javascript
const response = await fetch(
  'https://vrawceruzokxitybkufk.supabase.co/functions/v1/process-document',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_id,
      name,
      category,
      tenant_id,
      organization_id,
    }),
  }
)
```

**After:**
```javascript
const response = await fetch(
  'https://vrawceruzokxitybkufk.supabase.co/functions/v1/documents',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'process', // ← Add action field
      document_id,
      name,
      category,
      tenant_id,
      organization_id,
    }),
  }
)
```

### Migration Steps

1. **Update API calls** - Change endpoint from `/process-document` to `/documents`
2. **Add action field** - Include `"action": "process"` in request body
3. **Test thoroughly** - Verify all document processing still works
4. **Remove old function** - Once verified, the `process-document` function can be deprecated

### Timeline

- **Week 1:** Update all API calls to use new endpoint
- **Week 2:** Monitor for any issues
- **Week 3:** Deprecate `process-document` function (if no issues)

---

## 2. Migrating External API Operations

### Before (Old Pattern)

Using `example-with-secrets` for external API operations:

```bash
POST /functions/v1/example-with-secrets
{
  "action": "generate-embedding",
  "data": { "text": "Hello" }
}
```

### After (New Pattern)

Use the new `integrations` function:

```bash
POST /functions/v1/integrations
{
  "action": "generate-embedding",
  "text": "Hello"
}
```

### Available Actions in `integrations`

- `generate-embedding` - OpenAI embeddings
- `create-payment` - Stripe payment intents
- `call-external-api` - Generic external API calls
- `secrets-status` - Check configured secrets

### Code Changes

**Before:**
```javascript
const response = await fetch(
  'https://vrawceruzokxitybkufk.supabase.co/functions/v1/example-with-secrets',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'generate-embedding',
      data: { text: 'Hello, world!' },
    }),
  }
)
```

**After:**
```javascript
const response = await fetch(
  'https://vrawceruzokxitybkufk.supabase.co/functions/v1/integrations',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'generate-embedding',
      text: 'Hello, world!', // ← Direct field, no nested data
    }),
  }
)
```

---

## 3. Response Format Changes

### Old Response Format

```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### New Standardized Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Success",
  "timestamp": "2025-01-XX...",
  "request_id": "uuid-here"
}
```

### Error Format

**Old:**
```json
{
  "success": false,
  "error": "Error message"
}
```

**New:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-01-XX...",
  "request_id": "uuid-here",
  "data": {
    "errors": [
      {
        "field": "document_id",
        "message": "document_id is required",
        "code": "REQUIRED"
      }
    ]
  }
}
```

---

## 4. Validation Changes

### Before (Manual Validation)

```typescript
if (!document_id || !tenant_id) {
  return new Response(
    JSON.stringify({ error: 'Missing required fields' }),
    { status: 400 }
  )
}
```

### After (Schema-Based Validation)

```typescript
import { validateRequest } from '../_shared/utils.ts'
import { documentSchemas } from '../_shared/schemas.ts'

const validation = validateRequest(data, documentSchemas.process)
if (!validation.valid) {
  return createErrorResponse('Validation failed', 400, {
    errors: validation.errors,
  })
}
```

---

## 5. Error Handling Changes

### Before (Manual Error Responses)

```typescript
return new Response(
  JSON.stringify({ error: 'Something went wrong' }),
  { status: 500, headers: { 'Content-Type': 'application/json' } }
)
```

### After (Standardized Error Responses)

```typescript
import { createErrorResponse } from '../_shared/utils.ts'

return createErrorResponse('Something went wrong', 500)
```

---

## 6. Authentication Changes

### Before (Manual JWT Check)

```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401 }
  )
}
// ... manual token verification
```

### After (Middleware Pattern)

```typescript
import { verifyAuth } from '../_shared/utils.ts'

router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse(auth.error || 'Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})
```

---

## Migration Checklist

### For Each Function Migration

- [ ] Update endpoint URL
- [ ] Add `action` field to request body (if using action-based routing)
- [ ] Update response parsing to handle new format
- [ ] Update error handling to use new error format
- [ ] Test all operations
- [ ] Update documentation
- [ ] Update frontend/client code
- [ ] Monitor for issues
- [ ] Deprecate old function (after verification)

---

## Rollback Plan

If issues arise:

1. **Keep old functions active** during migration period
2. **Use feature flags** to switch between old/new endpoints
3. **Monitor error rates** and rollback if needed
4. **Gradual migration** - migrate one operation at a time

---

## Testing

### Test Each Migration

```bash
# Test documents function
curl -X POST https://vrawceruzokxitybkufk.supabase.co/functions/v1/documents \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "process",
    "document_id": "test-id",
    "tenant_id": "test-tenant"
  }'

# Test integrations function
curl -X POST https://vrawceruzokxitybkufk.supabase.co/functions/v1/integrations \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "secrets-status"
  }'
```

---

## Support

For issues during migration:

1. Check function logs: `supabase functions logs <function-name>`
2. Review error responses for validation details
3. Verify secrets are configured correctly
4. Check authentication tokens are valid

---

## Related Documentation

- [Edge Function Routing Evaluation](./EDGE_FUNCTION_ROUTING_EVALUATION.md)
- [Edge Function Solution Summary](./EDGE_FUNCTION_SOLUTION_SUMMARY.md)
- [Documents Function README](../../supabase/functions/documents/README.md)
- [Integrations Function README](../../supabase/functions/integrations/README.md)

---

**Last Updated:** 2025-01-XX  
**Migration Status:** In Progress

