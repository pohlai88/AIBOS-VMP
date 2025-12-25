# Example Edge Function with Secrets

This is an example Edge Function that demonstrates proper secrets management.

## Features

- ✅ Validates required secrets before use
- ✅ Accesses default Supabase secrets
- ✅ Uses custom secrets (OpenAI, Stripe, External API)
- ✅ Proper error handling
- ✅ Never exposes secret values in responses

## Setup

### 1. Set Required Secrets

**Local Development:**
```bash
# Create .env.local file
cp ../env.example ../.env.local
# Edit .env.local with your secrets
```

**Production:**
```bash
# Set secrets via CLI
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set EXTERNAL_API_KEY=your-api-key
```

### 2. Deploy Function

```bash
supabase functions deploy example-with-secrets
```

## Usage

### Check Available Secrets

```bash
curl -X POST https://your-project.supabase.co/functions/v1/example-with-secrets \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Generate Embedding (requires OpenAI API key)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/example-with-secrets \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate-embedding",
    "data": {
      "text": "Hello, world!"
    }
  }'
```

### Create Payment Intent (requires Stripe key)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/example-with-secrets \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-payment",
    "data": {
      "amount": "1000",
      "currency": "usd"
    }
  }'
```

## Code Structure

- `validateSecrets()` - Checks required secrets exist
- `getSecret()` - Safely retrieves secrets with optional validation
- Action handlers - Demonstrate using different secrets

## Security Notes

- Never log secret values
- Always validate secrets before use
- Return error messages without exposing secret names
- Use different secrets for dev/staging/production

