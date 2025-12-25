# Documents Edge Function

Domain-based Edge Function for document operations using action-based routing.

## Endpoint

```
POST https://{project}.supabase.co/functions/v1/documents
```

## Authentication

All actions require authentication via JWT token in the Authorization header:

```
Authorization: Bearer {jwt_token}
```

## Actions

### 1. Create Document

Create a new document record.

**Request:**
```json
{
  "action": "create",
  "name": "Invoice_2024.pdf",
  "category": "invoice",
  "tenant_id": "uuid-here",
  "organization_id": "uuid-here",
  "content": "Optional content"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document": {
      "id": "...",
      "name": "Invoice_2024.pdf",
      "category": "invoice",
      "tenant_id": "...",
      "created_at": "..."
    }
  },
  "message": "Document created successfully",
  "timestamp": "2025-01-XX...",
  "request_id": "..."
}
```

### 2. Update Document

Update an existing document.

**Request:**
```json
{
  "action": "update",
  "document_id": "uuid-here",
  "name": "Updated_Name.pdf",
  "category": "updated-category",
  "content": "Updated content"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document": { ... }
  },
  "message": "Document updated successfully",
  "timestamp": "...",
  "request_id": "..."
}
```

### 3. Delete Document

Delete a document.

**Request:**
```json
{
  "action": "delete",
  "document_id": "uuid-here",
  "tenant_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Document deleted successfully",
  "timestamp": "...",
  "request_id": "..."
}
```

### 4. Process Document

Process a document and generate embeddings (migrated from `process-document` function).

**Request:**
```json
{
  "action": "process",
  "document_id": "uuid-here",
  "tenant_id": "uuid-here",
  "name": "Document Name",
  "category": "category",
  "organization_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document_id": "..."
  },
  "message": "Document ... processed successfully",
  "timestamp": "...",
  "request_id": "..."
}
```

## Error Responses

All errors follow the standard format:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "...",
  "request_id": "...",
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

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (document doesn't exist)
- `405` - Method Not Allowed
- `500` - Internal Server Error

## Migration from process-document

The `process` action replaces the standalone `process-document` function:

**Before:**
```bash
POST /functions/v1/process-document
{
  "document_id": "...",
  "tenant_id": "..."
}
```

**After:**
```bash
POST /functions/v1/documents
{
  "action": "process",
  "document_id": "...",
  "tenant_id": "..."
}
```

## Testing

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

