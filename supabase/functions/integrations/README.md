# Integrations Edge Function

Domain-based Edge Function for external API integrations using action-based routing.

## Endpoint

```
POST https://{project}.supabase.co/functions/v1/integrations
```

## Authentication

All actions require authentication via JWT token in the Authorization header:

```
Authorization: Bearer {jwt_token}
```

## Required Secrets

Configure these secrets in Supabase Dashboard or via CLI:

- `OPENAI_API_KEY` - For embedding generation (optional)
- `STRIPE_SECRET_KEY` - For payment processing (optional)
- `EXTERNAL_API_KEY` - For external API calls (optional)

## Actions

### 1. Generate Embedding (OpenAI)

Generate text embeddings using OpenAI API.

**Request:**
```json
{
  "action": "generate-embedding",
  "text": "Hello, world!",
  "model": "text-embedding-ada-002"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "embedding": [0.123, 0.456, ...],
    "model": "text-embedding-ada-002",
    "usage": {
      "prompt_tokens": 2,
      "total_tokens": 2
    }
  },
  "message": "Embedding generated successfully",
  "timestamp": "...",
  "request_id": "..."
}
```

### 2. Create Payment Intent (Stripe)

Create a payment intent using Stripe API.

**Request:**
```json
{
  "action": "create-payment",
  "amount": 1000,
  "currency": "usd",
  "description": "Payment description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_secret": "pi_...",
    "id": "pi_...",
    "amount": 1000,
    "currency": "usd",
    "status": "requires_payment_method"
  },
  "message": "Payment intent created successfully",
  "timestamp": "...",
  "request_id": "..."
}
```

### 3. Call External API

Call an external API with configured API key.

**Request:**
```json
{
  "action": "call-external-api",
  "endpoint": "https://api.example.com/data",
  "method": "GET",
  "headers": {},
  "body": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": { ... }
  },
  "message": "External API call successful",
  "timestamp": "...",
  "request_id": "..."
}
```

### 4. Get Secrets Status

Check which secrets are configured (without exposing values).

**Request:**
```json
{
  "action": "secrets-status"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supabase": {
      "url": true,
      "serviceRoleKey": true
    },
    "custom": {
      "openai": true,
      "stripe": false,
      "externalApi": true
    }
  },
  "message": "Secrets status retrieved...",
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
    "details": { ... }
  }
}
```

## Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `405` - Method Not Allowed
- `500` - Internal Server Error
- `503` - Service Unavailable (secret not configured)

## Testing

```bash
# Generate embedding
curl -X POST https://vrawceruzokxitybkufk.supabase.co/functions/v1/integrations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate-embedding",
    "text": "Hello, world!"
  }'

# Check secrets status
curl -X POST https://vrawceruzokxitybkufk.supabase.co/functions/v1/integrations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "secrets-status"
  }'
```

