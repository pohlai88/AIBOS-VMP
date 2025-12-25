# Shared Utilities for Edge Functions

This directory contains shared utilities, types, and helpers for all Edge Functions in the VMP project.

## Structure

```
_shared/
├── types.ts          # TypeScript type definitions
├── utils.ts          # Utility functions (validation, errors, auth)
├── router.ts         # EdgeRouter class for action-based routing
├── schemas.ts        # Validation schemas
└── README.md         # This file
```

## Usage

### 1. Standardized Responses

```typescript
import { createSuccessResponse, createErrorResponse } from '../_shared/utils.ts'

// Success response
return createSuccessResponse({ id: '123', name: 'Document' }, 'Document created')

// Error response
return createErrorResponse('Invalid input', 400)
```

### 2. Request Validation

```typescript
import { validateRequest } from '../_shared/utils.ts'
import { documentSchemas } from '../_shared/schemas.ts'

const validation = validateRequest(body, documentSchemas.create)

if (!validation.valid) {
  return createErrorResponse('Validation failed', 400, { errors: validation.errors })
}
```

### 3. Action-Based Routing

```typescript
import { EdgeRouter } from '../_shared/router.ts'
import { createSuccessResponse, createErrorResponse } from '../_shared/utils.ts'

const router = new EdgeRouter()

router.route('create', async (ctx, data) => {
  // Handle create action
  return createSuccessResponse({ id: '123' }, 'Created')
})

router.route('update', async (ctx, data) => {
  // Handle update action
  return createSuccessResponse({ id: '123' }, 'Updated')
})

Deno.serve(async (req) => {
  return router.handle(req)
})
```

### 4. Authentication

```typescript
import { verifyAuth } from '../_shared/utils.ts'

const auth = await verifyAuth(req)
if (!auth.authenticated) {
  return createErrorResponse(auth.error || 'Unauthorized', 401)
}

// Use auth.user.id, auth.user.email, etc.
```

### 5. Middleware

```typescript
import { EdgeRouter } from '../_shared/router.ts'
import { verifyAuth, createErrorResponse } from '../_shared/utils.ts'

const router = new EdgeRouter()

// Add authentication middleware
router.use(async (ctx, next) => {
  const auth = await verifyAuth(ctx.request)
  if (!auth.authenticated) {
    return createErrorResponse('Unauthorized', 401)
  }
  ctx.user = auth.user
  return next()
})

// Routes will have ctx.user available
router.route('create', async (ctx, data) => {
  console.log('User:', ctx.user?.id)
  // ...
})
```

## Best Practices

1. **Always validate requests** before processing
2. **Use standardized responses** for consistency
3. **Handle errors gracefully** with proper status codes
4. **Use shared schemas** for common validation patterns
5. **Add middleware** for cross-cutting concerns (auth, logging)

## Examples

See the `documents` function for a complete example of using all shared utilities.

