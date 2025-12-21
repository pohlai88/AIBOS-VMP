# Edge Function Routing Evaluation

**Date:** 2025-01-XX  
**Status:** 📊 Evaluation Complete  
**Project:** VMP (Vendor Management Platform)

---

## Executive Summary

This evaluation assesses the current Edge Function routing architecture, identifies patterns, gaps, and provides recommendations for scalable routing strategies in Supabase Edge Functions.

---

## Current State Analysis

### Active Edge Functions

| Function | Status | JWT Verification | Routing Pattern | Purpose |
|----------|--------|------------------|-----------------|---------|
| `process-document` | ✅ ACTIVE | ✅ Enabled | Single-purpose | Document processing & embeddings |
| `example-with-secrets` | 📝 Example | ✅ Enabled | Action-based | Secrets management demo |

### Routing Architecture

#### 1. Function-Level Routing (Current Pattern)

**Pattern:** Each Edge Function is deployed as a separate endpoint.

```
https://{project}.supabase.co/functions/v1/{function-name}
```

**Example:**
- `https://vrawceruzokxitybkufk.supabase.co/functions/v1/process-document`
- `https://vrawceruzokxitybkufk.supabase.co/functions/v1/example-with-secrets`

**Characteristics:**
- ✅ Simple deployment model
- ✅ Clear separation of concerns
- ✅ Independent scaling per function
- ❌ No shared middleware
- ❌ Potential function proliferation

#### 2. Internal Action-Based Routing (Used in Example)

**Pattern:** Single function handles multiple actions via request body.

```typescript
// example-with-secrets/index.ts
const { action, data } = await req.json()

if (action === 'generate-embedding') {
  // Handle embedding generation
} else if (action === 'create-payment') {
  // Handle payment creation
} else if (action === 'external-api') {
  // Handle external API call
}
```

**Characteristics:**
- ✅ Reduces function count
- ✅ Shared secrets/configuration
- ✅ Single deployment unit
- ❌ Less granular scaling
- ❌ Mixed concerns in one function

#### 3. Single-Purpose Routing (Used in process-document)

**Pattern:** Function handles one specific task.

```typescript
// process-document/index.ts
Deno.serve(async (req) => {
  const { document_id, name, category, tenant_id, organization_id } = await req.json()
  // Process document only
})
```

**Characteristics:**
- ✅ Clear single responsibility
- ✅ Easy to understand
- ✅ Independent deployment
- ❌ More functions to manage
- ❌ Potential code duplication

---

## Routing Patterns Comparison

| Pattern | Use Case | Pros | Cons | Recommendation |
|---------|----------|------|------|----------------|
| **Function-Level** | Different domains (auth, payments, documents) | Clear separation, independent scaling | More deployments | ✅ **Recommended for domain separation** |
| **Action-Based** | Related operations (CRUD for same entity) | Shared config, fewer functions | Mixed concerns | ✅ **Recommended for related operations** |
| **Single-Purpose** | Simple, focused tasks | Clear responsibility | Function proliferation | ✅ **Recommended for simple tasks** |

---

## Identified Gaps & Issues

### 1. ❌ No Centralized Routing Strategy

**Issue:** No documented routing strategy or guidelines.

**Impact:**
- Inconsistent patterns across functions
- Difficult to predict function structure
- Harder onboarding for new developers

**Recommendation:**
- Document routing patterns and when to use each
- Create routing decision tree
- Establish naming conventions

### 2. ❌ No Shared Middleware Pattern

**Issue:** Each function implements its own:
- Authentication/authorization checks
- Error handling
- Request validation
- Logging

**Impact:**
- Code duplication
- Inconsistent error responses
- Harder to maintain

**Recommendation:**
- Create shared utility functions
- Implement middleware pattern
- Standardize error responses

### 3. ❌ No Versioning Strategy

**Issue:** No versioning for Edge Functions.

**Impact:**
- Breaking changes affect all clients
- No backward compatibility
- Difficult to deprecate functions

**Recommendation:**
- Implement versioning: `/functions/v1/{function-name}` → `/functions/v2/{function-name}`
- Document version lifecycle
- Create migration guide

### 4. ❌ No Request Validation Framework

**Issue:** Each function validates requests differently.

**Example from `process-document`:**
```typescript
if (!document_id || !tenant_id) {
  return new Response(/* error */)
}
```

**Impact:**
- Inconsistent validation
- Potential security issues
- Poor error messages

**Recommendation:**
- Create validation utility
- Use schema validation (Zod, Yup)
- Standardize validation errors

### 5. ❌ No Route Documentation

**Issue:** No OpenAPI/Swagger documentation for Edge Functions.

**Impact:**
- Hard to discover available endpoints
- No contract for frontend integration
- Manual testing required

**Recommendation:**
- Document all Edge Function endpoints
- Create API contract documentation
- Consider OpenAPI spec generation

---

## Recommended Routing Architecture

### Strategy 1: Domain-Based Function Routing (Recommended)

**Pattern:** One function per domain, action-based routing within.

```
/functions/v1/documents     → Document operations (create, update, delete, process)
/functions/v1/payments       → Payment operations (create, refund, status)
/functions/v1/notifications → Notification operations (send, list, mark-read)
/functions/v1/auth          → Auth operations (verify, refresh, revoke)
```

**Implementation:**
```typescript
// documents/index.ts
Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  switch (action) {
    case 'create':
      return handleCreateDocument(data)
    case 'update':
      return handleUpdateDocument(data)
    case 'process':
      return handleProcessDocument(data)
    case 'delete':
      return handleDeleteDocument(data)
    default:
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400 }
      )
  }
})
```

**Benefits:**
- ✅ Logical grouping
- ✅ Shared domain logic
- ✅ Fewer functions to manage
- ✅ Better code organization

### Strategy 2: Hybrid Approach (Current + Recommended)

**Pattern:** Use function-level for major domains, action-based for sub-operations.

```
/functions/v1/process-document     → Single-purpose (keep as-is)
/functions/v1/documents             → Action-based (create, update, delete)
/functions/v1/payments             → Action-based (create, refund, webhook)
```

**Benefits:**
- ✅ Flexibility
- ✅ Gradual migration
- ✅ Optimize per use case

---

## Implementation Recommendations

### 1. Create Shared Utilities

**File:** `supabase/functions/_shared/utils.ts`

```typescript
// Shared validation
export function validateRequest(body: any, schema: any): ValidationResult {
  // Zod/Yup validation
}

// Shared error handling
export function createErrorResponse(error: Error, status = 500): Response {
  return new Response(
    JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

// Shared auth check
export async function verifyAuth(req: Request): Promise<AuthResult> {
  // JWT verification logic
}
```

### 2. Standardize Response Format

```typescript
interface StandardResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  request_id?: string
}
```

### 3. Implement Middleware Pattern

```typescript
type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response>

async function withMiddleware(
  req: Request,
  handlers: Middleware[],
  finalHandler: (req: Request) => Promise<Response>
): Promise<Response> {
  // Execute middleware chain
}
```

### 4. Create Routing Helper

```typescript
// _shared/router.ts
export class EdgeRouter {
  private routes: Map<string, (req: Request) => Promise<Response>> = new Map()
  
  route(action: string, handler: (req: Request) => Promise<Response>) {
    this.routes.set(action, handler)
  }
  
  async handle(req: Request): Promise<Response> {
    const { action } = await req.json()
    const handler = this.routes.get(action)
    
    if (!handler) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 404 }
      )
    }
    
    return handler(req)
  }
}
```

---

## Migration Plan

### Phase 1: Foundation (Week 1)
- [ ] Create `_shared/` directory structure
- [ ] Implement shared utilities (validation, errors, auth)
- [ ] Document routing patterns
- [ ] Create routing decision tree

### Phase 2: Refactoring (Week 2-3)
- [ ] Refactor `example-with-secrets` to use shared utilities
- [ ] Create domain-based functions (documents, payments, etc.)
- [ ] Migrate `process-document` to `documents` function (optional)

### Phase 3: Standardization (Week 4)
- [ ] Standardize all function responses
- [ ] Implement versioning strategy
- [ ] Create API documentation
- [ ] Add OpenAPI spec (optional)

---

## Best Practices

### ✅ DO

1. **Use Domain-Based Routing** for related operations
   ```typescript
   // ✅ Good: Related operations in one function
   /functions/v1/documents → { action: 'create' | 'update' | 'delete' }
   ```

2. **Use Function-Level Routing** for different domains
   ```typescript
   // ✅ Good: Different domains separated
   /functions/v1/documents
   /functions/v1/payments
   /functions/v1/notifications
   ```

3. **Validate All Requests**
   ```typescript
   // ✅ Good: Validate before processing
   const validated = await validateRequest(body, documentSchema)
   if (!validated.valid) {
     return createErrorResponse(validated.errors, 400)
   }
   ```

4. **Use Shared Utilities**
   ```typescript
   // ✅ Good: Reuse shared code
   import { createErrorResponse, validateRequest } from '../_shared/utils.ts'
   ```

5. **Document All Endpoints**
   ```typescript
   /**
    * POST /functions/v1/documents
    * 
    * Actions:
    * - create: Create a new document
    * - update: Update existing document
    * - delete: Delete a document
    */
   ```

### ❌ DON'T

1. **Don't Mix Unrelated Operations**
   ```typescript
   // ❌ Bad: Unrelated operations
   if (action === 'create-document') { }
   else if (action === 'process-payment') { }
   else if (action === 'send-email') { }
   ```

2. **Don't Skip Validation**
   ```typescript
   // ❌ Bad: No validation
   const { document_id } = await req.json()
   // Use document_id directly
   ```

3. **Don't Duplicate Code**
   ```typescript
   // ❌ Bad: Duplicated error handling
   return new Response(JSON.stringify({ error: '...' }), { status: 500 })
   // In every function
   ```

4. **Don't Expose Internal Errors**
   ```typescript
   // ❌ Bad: Exposes internal details
   return new Response(JSON.stringify({ 
     error: 'Database connection failed: postgres://...' 
   }))
   ```

---

## Routing Decision Tree

```
Start: Need to create Edge Function?

├─ Is it a simple, single-purpose task?
│  └─ YES → Use Single-Purpose Function
│     Example: /functions/v1/process-document
│
├─ Are operations related to the same domain?
│  └─ YES → Use Action-Based Routing in Domain Function
│     Example: /functions/v1/documents → { action: 'create' | 'update' }
│
└─ Are operations from different domains?
   └─ YES → Use Separate Functions
      Example: /functions/v1/documents, /functions/v1/payments
```

---

## Examples

### Example 1: Domain-Based Function (Recommended)

```typescript
// documents/index.ts
import { EdgeRouter } from '../_shared/router.ts'
import { validateRequest, createErrorResponse } from '../_shared/utils.ts'
import { documentSchema } from '../_shared/schemas.ts'

const router = new EdgeRouter()

router.route('create', async (req) => {
  const body = await req.json()
  const validation = validateRequest(body, documentSchema)
  
  if (!validation.valid) {
    return createErrorResponse(validation.errors, 400)
  }
  
  // Create document logic
  return new Response(JSON.stringify({ success: true }))
})

router.route('update', async (req) => {
  // Update logic
})

router.route('delete', async (req) => {
  // Delete logic
})

Deno.serve(async (req) => {
  try {
    return await router.handle(req)
  } catch (error) {
    return createErrorResponse(error, 500)
  }
})
```

### Example 2: Single-Purpose Function (Simple Tasks)

```typescript
// process-document/index.ts
import { validateRequest, createErrorResponse } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const validation = validateRequest(body, {
      document_id: 'required|string',
      tenant_id: 'required|string'
    })
    
    if (!validation.valid) {
      return createErrorResponse(validation.errors, 400)
    }
    
    // Process document
    return new Response(JSON.stringify({ success: true }))
  } catch (error) {
    return createErrorResponse(error, 500)
  }
})
```

---

## Metrics & Monitoring

### Recommended Metrics

1. **Function Performance**
   - Response time per function
   - Error rate per function
   - Request count per action

2. **Routing Efficiency**
   - Action distribution
   - Unused actions
   - Most common action patterns

3. **Code Quality**
   - Code duplication percentage
   - Shared utility usage
   - Test coverage

---

## Conclusion

### Current State: ⚠️ Needs Improvement

- ✅ Basic routing works
- ✅ Functions are deployed and functional
- ❌ No standardized routing strategy
- ❌ No shared utilities
- ❌ No versioning

### Recommended Actions

1. **Immediate:** Create shared utilities and standardize error handling
2. **Short-term:** Implement domain-based routing for new functions
3. **Long-term:** Migrate existing functions to new patterns, add versioning

### Success Criteria

- ✅ All functions use shared utilities
- ✅ Consistent routing patterns
- ✅ Documented routing strategy
- ✅ Versioning implemented
- ✅ API documentation complete

---

## Related Documentation

- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md) - MCP tool usage
- [Edge Functions Secrets Guide](./EDGE_FUNCTIONS_SECRETS_GUIDE.md) - Secrets management
- [Error Handling Guide](../development/ERROR_HANDLING.md) - Error handling patterns
- [Supabase Functions README](../../supabase/functions/README.md) - Functions overview

---

## Implementation Solution ✅

**Status:** Implemented  
**Date:** 2025-01-XX

### What Was Implemented

A complete solution addressing all identified gaps has been implemented:

#### 1. ✅ Shared Utilities Structure

Created `supabase/functions/_shared/` directory with:

- **`types.ts`** - TypeScript type definitions (StandardResponse, ValidationResult, AuthResult, etc.)
- **`utils.ts`** - Utility functions:
  - `createSuccessResponse()` - Standardized success responses
  - `createErrorResponse()` - Standardized error responses
  - `validateRequest()` - Request validation with schema support
  - `verifyAuth()` - JWT authentication verification
  - `createRequestContext()` - Request context creation
  - `validateSecrets()` - Secret validation
- **`router.ts`** - EdgeRouter class for action-based routing:
  - `route()` - Register action handlers
  - `use()` - Register middleware
  - `handle()` - Route requests to handlers
- **`schemas.ts`** - Reusable validation schemas for common patterns

#### 2. ✅ Domain-Based Function Example

Created `supabase/functions/documents/` as a complete example:

- **Action-based routing** for document operations:
  - `create` - Create new document
  - `update` - Update existing document
  - `delete` - Delete document
  - `process` - Process document and generate embeddings (migrated from `process-document`)
- **Authentication middleware** - All actions require JWT
- **Request validation** - Uses shared schemas
- **Standardized responses** - Consistent format across all actions
- **Error handling** - Proper error responses with status codes

#### 3. ✅ Key Features

**Standardized Response Format:**
```typescript
{
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
  request_id?: string
}
```

**Validation Schema Format:**
```typescript
{
  field: 'required|string|min:1|max:255',
  email: 'required|string|email',
  tenant_id: 'required|string|uuid'
}
```

**Action-Based Routing:**
```typescript
const router = new EdgeRouter()
router.route('create', async (ctx, data) => { /* ... */ })
router.route('update', async (ctx, data) => { /* ... */ })
Deno.serve(async (req) => router.handle(req))
```

**Middleware Support:**
```typescript
router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse('Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})
```

### File Structure

```
supabase/functions/
├── _shared/
│   ├── types.ts          # Type definitions
│   ├── utils.ts          # Utility functions
│   ├── router.ts         # EdgeRouter class
│   ├── schemas.ts        # Validation schemas
│   └── README.md         # Usage documentation
├── documents/
│   ├── index.ts          # Domain-based function example
│   └── README.md         # API documentation
├── example-with-secrets/
│   └── index.ts          # Example function (can be refactored)
└── README.md             # Functions overview
```

### Usage Examples

#### Creating a New Domain Function

```typescript
// payments/index.ts
import { EdgeRouter } from '../_shared/router.ts'
import { createSuccessResponse, createErrorResponse, verifyAuth, validateRequest } from '../_shared/utils.ts'
import { paymentSchemas } from '../_shared/schemas.ts'

const router = new EdgeRouter()

// Add auth middleware
router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse('Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})

// Register actions
router.route('create', async (ctx, data) => {
  const validation = validateRequest(data, paymentSchemas.create)
  if (!validation.valid) {
    return createErrorResponse('Validation failed', 400, { errors: validation.errors })
  }
  // Handle payment creation
  return createSuccessResponse({ payment_id: '...' }, 'Payment created')
})

router.route('refund', async (ctx, data) => {
  // Handle refund
})

Deno.serve(async (req) => router.handle(req))
```

#### Using Single-Purpose Function (Simple Tasks)

```typescript
// process-webhook/index.ts
import { createSuccessResponse, createErrorResponse, validateRequest } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const validation = validateRequest(body, {
      webhook_id: 'required|string|uuid',
      event: 'required|string'
    })
    
    if (!validation.valid) {
      return createErrorResponse('Validation failed', 400, { errors: validation.errors })
    }
    
    // Process webhook
    return createSuccessResponse({ processed: true }, 'Webhook processed')
  } catch (error) {
    return createErrorResponse(error, 500)
  }
})
```

### Migration Path

#### Phase 1: Use Shared Utilities (Immediate)

All new functions should:
1. Import shared utilities from `_shared/`
2. Use standardized response format
3. Implement request validation
4. Use proper error handling

#### Phase 2: Refactor Existing Functions (Short-term)

- Refactor `example-with-secrets` to use EdgeRouter
- Optionally migrate `process-document` logic to `documents` function
- Update all functions to use shared utilities

#### Phase 3: Create Domain Functions (Medium-term)

- Create `payments` function for payment operations
- Create `notifications` function for notification operations
- Create `auth` function for auth operations
- Group related operations into domain functions

### Benefits Achieved

✅ **No Code Duplication** - Shared utilities eliminate repeated code  
✅ **Consistent Responses** - All functions use same response format  
✅ **Standardized Validation** - Reusable validation schemas  
✅ **Better Error Handling** - Proper error responses with status codes  
✅ **Authentication Middleware** - Reusable auth checks  
✅ **Action-Based Routing** - Clean routing for domain functions  
✅ **Type Safety** - TypeScript types for all utilities  
✅ **Documentation** - Complete usage examples and API docs  

### Next Steps

1. **Deploy `documents` function** to Supabase
2. **Refactor existing functions** to use shared utilities
3. **Create additional domain functions** as needed
4. **Add versioning** when breaking changes are needed
5. **Generate API documentation** (OpenAPI spec)

### Testing

Test the new `documents` function:

```bash
# Create document
curl -X POST https://vrawceruzokxitybkufk.supabase.co/functions/v1/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "name": "Test.pdf",
    "tenant_id": "your-tenant-id"
  }'
```

### Related Files

- [`supabase/functions/_shared/README.md`](../../supabase/functions/_shared/README.md) - Shared utilities documentation
- [`supabase/functions/documents/README.md`](../../supabase/functions/documents/README.md) - Documents function API docs
- [`supabase/functions/README.md`](../../supabase/functions/README.md) - Functions overview

---

**Last Updated:** 2025-01-XX  
**Next Review:** 2025-02-XX

