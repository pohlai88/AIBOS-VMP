# Nexus Error Handling Playbook

> A concise guide for developers on when and how to use the Nexus Error Classes.

---

## 🎯 Purpose

- Ensure **consistent error handling** across the codebase
- Provide **clear, actionable error messages** for both developers and users
- Simplify **debugging and monitoring** by categorizing errors
- Enable **traceability** via correlation IDs and error codes

---

## 🛠️ Error Categories

| Category | HTTP Range | Description | Alert Level |
|----------|------------|-------------|-------------|
| `CLIENT` | 4xx | Errors caused by invalid input or user actions | Low |
| `SERVER` | 5xx | Internal application or infrastructure failures | High |
| `DEPENDENCY` | 5xx/504 | Failures in external services or APIs | Medium-High |
| `BUSINESS` | 4xx/409/422 | Domain-specific rules or state conflicts | Medium |

---

## 📌 When to Use Each Error Class

### Client Errors (4xx)

| Error Class | Status | When to Use |
|-------------|--------|-------------|
| `ValidationError` | 400 | Input validation failures (missing fields, invalid format) |
| `AuthenticationError` | 401 | Missing or invalid authentication credentials |
| `AuthorizationError` | 403 | Authenticated but lacks permission |
| `NotFoundError` | 404 | Resource not found (include resource type and ID) |
| `RateLimitError` | 429 | Too many requests (include `retryAfter`) |

### Server Errors (5xx)

| Error Class | Status | When to Use |
|-------------|--------|-------------|
| `DatabaseError` | 500 | Database query or connection failures |
| `InternalError` | 500 | Unexpected server-side issues not covered by other classes |

### Dependency Errors (5xx)

| Error Class | Status | When to Use |
|-------------|--------|-------------|
| `ExternalServiceError` | 502 | Third-party API/service failure |
| `SupabaseError` | 502 | Supabase-specific failures (include code, message, details, hint) |
| `TimeoutError` | 504 | Operation exceeded allowed time (include retryable flag) |

### Business Logic Errors (4xx)

| Error Class | Status | When to Use |
|-------------|--------|-------------|
| `BusinessRuleError` | 422 | Violation of domain rules (e.g., invalid workflow) |
| `InvalidStateError` | 409 | Resource in unexpected state vs expected state |
| `DuplicateError` | 409 | Resource already exists with conflicting field/value |

---

## 🔧 Best Practices

### ✅ DO

```javascript
// Always include error codes and categories for traceability
throw new ValidationError('Email is required', { field: 'email' });

// Add details (resource, field, ID, etc.) to aid debugging
throw new NotFoundError('Invoice', 'INV-001234');

// Use correlation IDs in middleware for request tracking
logger.error('Operation failed', { correlationId: req.correlationId });

// Log errors with toLog() for structured monitoring
logger.error(nexusError.message, nexusError.toLog());

// Wrap async handlers to catch unhandled rejections
router.get('/users', asyncHandler(async (req, res) => { ... }));
```

### ❌ DON'T

```javascript
// Don't use generic Error - no categorization or code
throw new Error('Something went wrong'); // ❌

// Don't expose stack traces in production
res.json({ stack: error.stack }); // ❌ (only in dev)

// Don't use console.log for errors
console.error('Error:', err); // ❌ Use logger.error()

// Don't swallow errors silently
try { await db.query() } catch (e) { /* silent */ } // ❌
```

---

## 📋 Error Code Reference

### Client Errors (`ERR_CLIENT_*`)
| Code | Description |
|------|-------------|
| `ERR_CLIENT_VALIDATION` | Input validation failed |
| `ERR_CLIENT_AUTH_REQUIRED` | No authentication provided |
| `ERR_CLIENT_AUTH_INVALID` | Invalid credentials |
| `ERR_CLIENT_PERMISSION_DENIED` | Permission denied |
| `ERR_CLIENT_NOT_FOUND` | Resource not found |
| `ERR_CLIENT_RATE_LIMITED` | Rate limit exceeded |

### Server Errors (`ERR_SERVER_*`)
| Code | Description |
|------|-------------|
| `ERR_SERVER_INTERNAL` | Unexpected internal error |
| `ERR_SERVER_DB` | Generic database error |
| `ERR_SERVER_DB_CONNECTION` | Database connection failed |
| `ERR_SERVER_DB_QUERY` | Database query failed |
| `ERR_SERVER_DB_TIMEOUT` | Database query timed out |

### External Errors (`ERR_EXTERNAL_*`)
| Code | Description |
|------|-------------|
| `ERR_EXTERNAL_API` | Generic external API failure |
| `ERR_EXTERNAL_SUPABASE` | Supabase-specific failure |
| `ERR_EXTERNAL_PAYMENT` | Payment provider failure |
| `ERR_EXTERNAL_EMAIL` | Email service failure |
| `ERR_EXTERNAL_STORAGE` | Storage service failure |
| `ERR_EXTERNAL_CIRCUIT_OPEN` | Circuit breaker is open |
| `ERR_EXTERNAL_TIMEOUT` | External operation timed out |

### Business Errors (`ERR_BUSINESS_*`)
| Code | Description |
|------|-------------|
| `ERR_BUSINESS_RULE` | Business rule violation |
| `ERR_BUSINESS_INVALID_STATE` | Invalid state for operation |
| `ERR_BUSINESS_DUPLICATE` | Duplicate resource conflict |
| `ERR_BUSINESS_WORKFLOW` | Workflow step cannot proceed |
| `ERR_BUSINESS_PAYMENT_REQUIRED` | Payment required |

---

## ✅ Example Usage

### Validation Error
```javascript
if (!userInput.email) {
  throw new ValidationError('Email is required', { field: 'email' });
}

if (!isValidEmail(userInput.email)) {
  throw new ValidationError('Invalid email format', {
    field: 'email',
    value: userInput.email,
    pattern: 'user@domain.com'
  });
}
```

### Database Error
```javascript
try {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!result.rows.length) {
    throw new NotFoundError('User', userId);
  }
  return result.rows[0];
} catch (err) {
  if (err instanceof NotFoundError) throw err;
  throw new DatabaseError('Failed to fetch user', { cause: err });
}
```

### External Service Error
```javascript
try {
  const response = await fetch('https://api.payment.com/charge', { ... });
  if (!response.ok) {
    throw new ExternalServiceError(
      'PaymentAPI',
      `HTTP ${response.status}: ${response.statusText}`,
      { status: response.status }
    );
  }
  return response.json();
} catch (err) {
  if (err instanceof NexusError) throw err;
  throw new ExternalServiceError('PaymentAPI', err.message, err);
}
```

### Supabase Error
```javascript
const { data, error } = await supabase
  .from('invoices')
  .update({ status: 'paid' })
  .eq('id', invoiceId);

if (error) {
  throw new SupabaseError('Failed to update invoice status', error);
}
```

### Invalid State Error
```javascript
if (invoice.status !== 'pending') {
  throw new InvalidStateError(
    `Cannot approve invoice in ${invoice.status} state`,
    invoice.status,    // currentState
    'pending',         // expectedState
    {
      action: 'approve',
      resource: 'Invoice',
      resourceId: invoice.id,
      allowedTransitions: ['cancel', 'void']
    }
  );
}
```

### Duplicate Error
```javascript
const existing = await findTenantByEmail(email);
if (existing) {
  throw new DuplicateError('Tenant', 'email', email, {
    existingId: existing.id,
    suggestion: 'Login to your existing account or use a different email'
  });
}
```

### Timeout Error
```javascript
try {
  const result = await Promise.race([
    heavyOperation(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
  ]);
  return result;
} catch (err) {
  throw new TimeoutError('Report generation', 30000, {
    retryable: true,
    suggestedRetryMs: 60000,
    service: 'ReportService'
  });
}
```

---

## 🔍 Debugging with Correlation IDs

Every request gets a unique correlation ID:

```json
{
  "timestamp": "2025-12-25T12:43:33.346Z",
  "level": "ERROR",
  "service": "nexus-portal",
  "message": "Invoice not found: INV-001234",
  "correlationId": "80c6a10a-0869-48db-b39d-e66c408f2dad",
  "code": "ERR_CLIENT_NOT_FOUND",
  "category": "client",
  "method": "GET",
  "path": "/api/invoices/INV-001234"
}
```

Use this to trace errors:
```bash
# Search logs by correlation ID
grep "80c6a10a-0869-48db-b39d-e66c408f2dad" logs/*.json
```

---

## 📊 Monitoring Alerts

| Category | Alert Threshold | Action |
|----------|-----------------|--------|
| `SERVER` | Any occurrence | Page on-call immediately |
| `DEPENDENCY` | 5+ in 1 minute | Page on-call, check circuit breaker |
| `BUSINESS` | 100+ in 1 hour | Notify product team |
| `CLIENT` | 1000+ in 1 hour | Review for attack patterns |

---

## 📌 Summary

Use the Nexus Error Classes consistently:

- **Client errors** → User issues (validation, auth, not found)
- **Server errors** → Internal failures (DB, unexpected)
- **Dependency errors** → External services (Supabase, payment, timeout)
- **Business errors** → Domain rules (state, duplicate, workflow)

This ensures **clarity**, **consistency**, and **scalability** in error handling.
