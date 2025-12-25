# Error Handling Guide

**Date:** 2025-01-XX  
**Status:** ✅ Implemented  
**Reference:** [Supabase Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling)

---

## Overview

This project implements structured error handling based on Supabase's best practices for Edge Functions. The error handling system provides:

- ✅ **Proper HTTP status codes** for different error types
- ✅ **Structured error responses** with consistent format
- ✅ **Error logging** with context for debugging
- ✅ **Custom error classes** for different scenarios
- ✅ **Supabase error mapping** for database operations

---

## Error Classes

### Base Error: `VMPError`

All custom errors extend `VMPError`, which provides:

```javascript
{
  error: {
    message: string,
    code: string,
    status: number,
    timestamp: string,
    details?: object
  }
}
```

### Available Error Classes

| Class | Status | Code | Use Case |
|-------|--------|------|----------|
| `ClientError` | 400 | `BAD_REQUEST` | Invalid input, validation failures |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Input validation with field details |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| `ForbiddenError` | 403 | `FORBIDDEN` | Authenticated but lacks permission |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `ConflictError` | 409 | `CONFLICT` | Resource already exists, state conflict |
| `DatabaseError` | 500 | `DATABASE_ERROR` | Database/Supabase operation failure |
| `StorageError` | 500 | `STORAGE_ERROR` | Supabase Storage operation failure |
| `TimeoutError` | 504 | `TIMEOUT` | Operation exceeded timeout |

---

## Usage Examples

### 1. Throwing Errors in Adapters

```javascript
import { DatabaseError, NotFoundError, StorageError } from '../utils/errors.js';

// Database operation failure
if (error) {
    throw new DatabaseError('Failed to fetch user', error);
}

// Resource not found
if (!user) {
    throw new NotFoundError('User');
}

// Storage operation failure
if (error) {
    throw new StorageError('Failed to upload file', error, {
        storagePath,
        mimeType
    });
}
```

### 2. Handling Supabase Errors

```javascript
import { handleSupabaseError } from '../utils/errors.js';

const { data, error } = await supabase.from('table').select();

if (error) {
    const handledError = handleSupabaseError(error, 'operationName');
    if (handledError) throw handledError;
    // Returns null for PGRST116 (no rows) - not an error
}
```

### 3. Route Error Handling

```javascript
import { createErrorResponse, logError } from '../utils/errors.js';

app.get('/api/resource', async (req, res) => {
  try {
    const data = await vmpAdapter.getResource();
    res.json(data);
  } catch (error) {
    logError(error, { path: req.path, userId: req.user?.id });
    const errorResponse = createErrorResponse(error, req);
    res.status(errorResponse.status).json(errorResponse.body);
  }
});
```

### 4. Global Error Handler

The global error handler in `server.js` automatically:

- Logs errors with context
- Creates standardized responses
- Renders error pages with proper status codes
- Hides sensitive details in production

```javascript
app.use((err, req, res, next) => {
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  const errorResponse = createErrorResponse(err, req);
  res.status(errorResponse.status).render('pages/error.html', {
    error: {
      status: errorResponse.status,
      message: errorResponse.body.error.message,
      code: errorResponse.body.error.code
    }
  });
});
```

---

## Supabase Error Code Mapping

The `handleSupabaseError` function automatically maps Supabase error codes:

### PostgREST Error Codes

| Supabase Code | VMP Error | Description | HTTP Status |
|---------------|-----------|-------------|-------------|
| `PGRST116` | `null` (not an error) | No rows returned (use `.single()`) | N/A |
| `PGRST301` | `NotFoundError` | Resource not found | 404 |
| `PGRST202` | `ClientError` | Precondition failed | 412 |

### PostgreSQL Error Codes

| Supabase Code | VMP Error | Description | HTTP Status |
|---------------|-----------|-------------|-------------|
| `23505` | `ConflictError` | Unique constraint violation | 409 |
| `23503` | `ClientError` | Foreign key violation | 400 |
| `23502` | `ValidationError` | Not null violation | 400 |
| `23514` | `ValidationError` | Check constraint violation | 400 |
| `42P01` | `DatabaseError` | Table does not exist | 500 |
| `42P02` | `DatabaseError` | Column does not exist | 500 |
| `42501` | `ForbiddenError` | Insufficient privilege | 403 |
| `28P01` | `UnauthorizedError` | Invalid password | 401 |
| `3D000` | `DatabaseError` | Database does not exist | 500 |
| `08003` | `DatabaseError` | Connection does not exist | 500 |
| `08006` | `DatabaseError` | Connection failure | 500 |

### Storage Error Codes

| Error Type | VMP Error | Description | HTTP Status |
|------------|-----------|-------------|-------------|
| `BucketNotFound` | `StorageError` | Storage bucket not found | 404 |
| `ObjectNotFound` | `NotFoundError` | File not found in storage | 404 |
| `PayloadTooLarge` | `ClientError` | File size exceeds limit | 413 |
| `InvalidInput` | `ValidationError` | Invalid file type or name | 400 |
| `Unauthorized` | `UnauthorizedError` | Storage access denied | 401 |

### Timeout Errors

| Error Type | VMP Error | Description | HTTP Status |
|------------|-----------|-------------|-------------|
| Query timeout | `TimeoutError` | Database query exceeded timeout | 504 |
| Storage timeout | `TimeoutError` | Storage operation exceeded timeout | 504 |
| Network timeout | `TimeoutError` | Network request exceeded timeout | 504 |

---

## Error Response Format

All errors follow this consistent format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "status": 400,
    "timestamp": "2025-01-XXT00:00:00.000Z",
    "details": {
      "field": "optional field name",
      "additional": "context"
    }
  }
}
```

### Production vs Development

- **Production**: Only `message`, `code`, `status`, `timestamp`
- **Development**: Includes `details` and `stack` trace

---

## Best Practices

### 1. Use Appropriate Error Types

```javascript
// ❌ Bad
throw new Error('User not found');

// ✅ Good
throw new NotFoundError('User');
```

### 2. Include Context

```javascript
// ❌ Bad
throw new DatabaseError('Operation failed');

// ✅ Good
throw new DatabaseError('Failed to create session', originalError, {
    userId,
    operation: 'createSession'
});
```

### 3. Log Errors with Context

```javascript
// ❌ Bad
console.error('Error:', error);

// ✅ Good
logError(error, {
    path: req.path,
    userId: req.user?.id,
    operation: 'createMessage'
});
```

### 4. Handle Supabase Errors Properly

```javascript
// ❌ Bad
if (error) throw error;

// ✅ Good
if (error) {
    const handledError = handleSupabaseError(error, 'operationName');
    if (handledError) throw handledError;
    // Returns null for PGRST116 - not an error
}
```

### 5. Use HTTP Status Codes Correctly

| Status | Meaning | Use Case |
|--------|---------|----------|
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Authenticated but no permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Internal server error |
| 504 | Gateway Timeout | Operation timed out |

---

## Error Logging

Errors are logged with structured context:

```javascript
{
  "timestamp": "2025-01-XXT00:00:00.000Z",
  "error": {
    "name": "DatabaseError",
    "message": "Failed to fetch user",
    "code": "DATABASE_ERROR",
    "status": 500
  },
  "context": {
    "path": "/api/users",
    "method": "GET",
    "userId": "user-123"
  }
}
```

---

## Migration Guide

### Before (Old Pattern)

```javascript
// Adapter
if (error) {
    console.error('Error:', error);
    throw new Error(`Failed: ${error.message}`);
}

// Route
try {
    const data = await adapter.getData();
    res.json(data);
} catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
}
```

### After (New Pattern)

```javascript
// Adapter
if (error) {
    const handledError = handleSupabaseError(error, 'getData');
    if (handledError) throw handledError;
    throw new DatabaseError('Failed to get data', error);
}

// Route
try {
    const data = await adapter.getData();
    res.json(data);
} catch (error) {
    logError(error, { path: req.path });
    const errorResponse = createErrorResponse(error, req);
    res.status(errorResponse.status).json(errorResponse.body);
}
```

---

## Testing Error Handling

Error handling is tested in:

- `tests/server-error-paths.test.js` - Server error scenarios
- `tests/adapters-supabase-error-paths.test.js` - Adapter error scenarios

---

## Supabase-Specific Error Handling

### 1. Database Query Errors

```javascript
// Example from vmpAdapter.getUserByEmail
const { data, error } = await withTimeout(
    supabase
        .from('vmp_vendor_users')
        .select('*')
        .eq('email', email)
        .single(),
    10000,
    `getUserByEmail(${email})`
);

if (error) {
    const handledError = handleSupabaseError(error, 'getUserByEmail');
    if (handledError === null) {
        // PGRST116 - No rows returned (not an error)
        return null;
    }
    throw handledError;
}
```

### 2. Storage Operation Errors

```javascript
// Example from vmpAdapter.uploadEvidenceToStorage
const { data, error } = await supabase.storage
    .from('vmp-evidence')
    .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
    });

if (error) {
    throw new StorageError('Failed to upload to storage', error, {
        storagePath,
        mimeType
    });
}
```

### 3. Auth Operation Errors

```javascript
// Example from login route
try {
    const user = await vmpAdapter.getUserByEmail(email);
    
    if (!user) {
        return res.render('pages/login3.html', {
            error: 'Invalid email or password'
        });
    }
    
    const isValid = await vmpAdapter.verifyPassword(user.id, password);
    
    if (!isValid) {
        return res.render('pages/login3.html', {
            error: 'Invalid email or password'
        });
    }
    
    // Create session
    const { sessionId } = await vmpAdapter.createSession(user.id);
    req.session.sessionId = sessionId;
    res.redirect('/home');
} catch (error) {
    logError(error, { path: '/login', email });
    res.render('pages/login3.html', {
        error: 'An error occurred during login. Please try again.'
    });
}
```

### 4. Client-Side Error Handling

When using Supabase JS client in the browser, handle these error types:

```javascript
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'

const { data, error } = await supabase.functions.invoke('hello', {
    body: { foo: 'bar' }
})

if (error instanceof FunctionsHttpError) {
    // Function executed but returned error (4xx/5xx)
    const errorMessage = await error.context.json()
    console.error('Function error:', errorMessage)
    // Handle based on status code
    if (error.context.status === 404) {
        // Handle not found
    } else if (error.context.status === 500) {
        // Handle server error
    }
} else if (error instanceof FunctionsRelayError) {
    // Network issue between client and Supabase
    console.error('Relay error:', error.message)
} else if (error instanceof FunctionsFetchError) {
    // Function couldn't be reached
    console.error('Fetch error:', error.message)
}
```

### 5. RLS (Row Level Security) Errors

When RLS blocks a query, you'll get a `42501` error:

```javascript
const { data, error } = await supabase
    .from('vmp_cases')
    .select('*')

if (error) {
    const handledError = handleSupabaseError(error, 'getCases');
    if (handledError instanceof ForbiddenError) {
        // RLS policy blocked access
        // Check if user has proper permissions
        // Verify RLS policies are correctly configured
    }
    throw handledError;
}
```

---

## Real-World Examples from VMP

### Example 1: Case Detail Loading

```javascript
// From server.js - /partials/case-detail.html route
app.get('/partials/case-detail.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    if (!caseId) {
      return res.render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        isInternal: req.user?.isInternal || false
      });
    }

    // Fetch case detail from adapter
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
    } catch (adapterError) {
      // Adapter error is already handled and logged
      // Continue with null caseDetail - template handles it gracefully
      console.error('Adapter error:', adapterError);
    }

    res.render('partials/case_detail.html', {
      caseId,
      caseDetail,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    logError(error, { path: req.path, caseId: req.query.case_id });
    res.status(500).render('partials/case_detail.html', {
      caseId: null,
      caseDetail: null,
      error: error.message
    });
  }
});
```

### Example 2: Evidence Upload with Error Recovery

```javascript
// From server.js - POST /cases/:id/evidence
app.post('/cases/:id/evidence', upload.single('file'), async (req, res) => {
  try {
    const caseId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'File is required'
      });
    }

    // Upload evidence
    try {
      await vmpAdapter.uploadEvidence(
        caseId,
        { buffer: file.buffer, originalname: file.originalname, ... },
        evidence_type,
        checklist_step_id,
        'vendor',
        user.id
      );
    } catch (uploadError) {
      // StorageError or DatabaseError already logged
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: `Failed to upload evidence: ${uploadError.message}`
      });
    }

    // Return refreshed evidence
    try {
      const evidence = await vmpAdapter.getEvidence(caseId);
      // Generate signed URLs...
      return res.render('partials/case_evidence.html', { caseId, evidence });
    } catch (error) {
      // Even if refresh fails, upload succeeded
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence uploaded but failed to refresh view'
      });
    }
  } catch (error) {
    logError(error, { path: req.path, caseId: req.params.id });
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.params.id || null,
      evidence: [],
      error: error.message
    });
  }
});
```

---

## Troubleshooting Supabase Errors

### Issue: "PGRST116" when using `.single()`

**Problem:** Query returns no rows but you're using `.single()`

**Solution:**
```javascript
// ❌ Bad
const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single(); // Throws PGRST116 if no rows

// ✅ Good
const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle(); // Returns null if no rows

// Or handle PGRST116
if (error && error.code === 'PGRST116') {
    return null; // Not found
}
```

### Issue: RLS blocking queries

**Problem:** Getting `42501` (insufficient privilege) errors

**Solution:**
1. Check RLS policies: `mcp_supabase_get_advisors({ type: "security" })`
2. Verify you're using service role key for server-side operations
3. Check RLS policies allow the operation:
```sql
-- Example: Allow users to read their own cases
CREATE POLICY "Users can read own vendor cases"
ON vmp_cases FOR SELECT
USING (
    vendor_id IN (
        SELECT vendor_id FROM vmp_vendor_users WHERE id = auth.uid()
    )
);
```

### Issue: Storage upload fails silently

**Problem:** Storage upload returns error but not caught

**Solution:**
```javascript
// ✅ Always check error
const { data, error } = await supabase.storage
    .from('bucket')
    .upload(path, file);

if (error) {
    throw new StorageError('Upload failed', error, { path, bucket: 'bucket' });
}
```

### Issue: Timeout errors

**Problem:** Queries timing out frequently

**Solution:**
1. Increase timeout in `withTimeout` wrapper
2. Optimize queries (add indexes)
3. Check database performance: `mcp_supabase_get_advisors({ type: "performance" })`
4. Use pagination for large datasets

---

## Error Monitoring with Supabase

### Using Supabase Logs

```javascript
// Get recent errors
const logs = await mcp_supabase_get_logs({ service: "api" });

// Filter for errors
const errors = logs.filter(log => 
    log.level === 'error' || 
    log.message.includes('error') ||
    log.message.includes('failed')
);
```

### Using Supabase Advisors

```javascript
// Check for security issues
const securityAdvisors = await mcp_supabase_get_advisors({ type: "security" });

// Check for performance issues
const performanceAdvisors = await mcp_supabase_get_advisors({ type: "performance" });

// Address each advisor
securityAdvisors.forEach(advisor => {
    console.log(`${advisor.severity}: ${advisor.title}`);
    console.log(`Fix: ${advisor.remediation_url}`);
});
```

---

## References

- [Supabase Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling)
- [Supabase JS Client Error Handling](https://supabase.com/docs/reference/javascript/error-handling)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- [PostgREST Error Codes](https://postgrest.org/en/stable/api.html#errors-and-http-status-codes)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)

---

## Future Improvements

- [ ] Integrate error tracking (Sentry, etc.)
- [ ] Add request ID for error correlation
- [ ] Implement error rate limiting
- [ ] Add error metrics/monitoring
- [ ] Create error recovery strategies

