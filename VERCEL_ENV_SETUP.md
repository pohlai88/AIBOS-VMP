# Vercel Environment Variables Setup Guide

## Required Environment Variables

The following environment variables **MUST** be set in your Vercel project settings for the deployment to work:

### Critical (Required - App will fail without these)

1. **`SESSION_DB_URL`** ⚠️ **REQUIRED**
   - PostgreSQL connection string for session store
   - Format: `postgresql://user:password@host:port/database`
   - This is validated by `envalid` and will cause the app to fail fast if missing
   - **Action**: Set this to your Supabase PostgreSQL connection string

2. **`SUPABASE_URL`**
   - Your Supabase project URL
   - Format: `https://your-project.supabase.co`
   - Default: `''` (empty string, but should be set for production)

3. **`SUPABASE_SERVICE_ROLE_KEY`**
   - Supabase service role key (bypasses RLS)
   - Used for admin operations
   - Default: `''` (empty string, but should be set for production)

4. **`SUPABASE_ANON_KEY`**
   - Supabase anonymous key (for client-side auth)
   - Used for RLS-enforced operations
   - Default: `''` (empty string, but should be set for production)

### Important (Should be set for production)

5. **`SESSION_SECRET`**
   - Secret key for session encryption
   - Default: `'dev-secret-change-in-production'` ⚠️ **CHANGE THIS IN PRODUCTION**
   - **Action**: Generate a strong random secret (32+ characters)

6. **`BASE_URL`**
   - Base URL for your Vercel deployment
   - Used for password reset redirects and OAuth callbacks
   - Default: `'http://localhost:9000'`
   - **Action**: Set to your Vercel deployment URL (e.g., `https://aibos-vmp.vercel.app`)

7. **`NODE_ENV`**
   - Environment mode
   - Choices: `'development'`, `'production'`, `'test'`
   - Default: `'development'`
   - **Action**: Set to `'production'` (already set in vercel.json, but verify)

### Optional (Have defaults but may be needed)

8. **`DEMO_VENDOR_ID`**
   - Demo vendor ID for testing
   - Default: `''` (empty string)

9. **`BASE_PATH`**
   - Base path for sub-directory deployment (e.g., `/VMP`)
   - Default: `''` (empty string)
   - Only needed if deploying to a subdirectory

10. **`VMP_HOME_PAGE`**
    - Rollback switch for home page
    - Default: `'home'`
    - Usually not needed to change

11. **`VAPID_PUBLIC_KEY`**
    - VAPID public key for push notifications
    - Default: `''` (empty string)
    - Only needed if using push notifications

12. **`VAPID_PRIVATE_KEY`**
    - VAPID private key for push notifications
    - Default: `''` (empty string)
    - Only needed if using push notifications

13. **`USE_DECISION_ENGINE`**
    - Feature flag to enable decision engine
    - Default: `false` (when not set or not `'true'`)
    - Set to `'true'` to enable

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with its value
4. Make sure to select the appropriate environments (Production, Preview, Development)
5. Redeploy after adding variables

## Common Issues and Solutions

### Issue: "Internal Server Error" on deployment

**Possible Causes:**
1. Missing `SESSION_DB_URL` - The app will fail during initialization
2. Invalid `SESSION_DB_URL` - Database connection string is incorrect
3. Database not accessible from Vercel - Check firewall/network settings
4. Missing Supabase keys - App can't connect to Supabase

**Solution:**
- Verify all required environment variables are set
- Check that `SESSION_DB_URL` points to a valid PostgreSQL database
- Ensure the database allows connections from Vercel's IP ranges
- Verify Supabase keys are correct

### Issue: Session store connection fails

**Possible Causes:**
1. `SESSION_DB_URL` format is incorrect
2. Database credentials are wrong
3. Database doesn't allow external connections

**Solution:**
- Use the connection string format: `postgresql://user:password@host:port/database`
- Verify credentials in Supabase dashboard
- Check Supabase connection pooling settings

### Issue: Password reset redirects fail

**Possible Causes:**
1. `BASE_URL` is not set or incorrect
2. Supabase redirect URLs not configured

**Solution:**
- Set `BASE_URL` to your Vercel deployment URL
- Add redirect URLs in Supabase dashboard:
  - `https://your-app.vercel.app/reset-password`
  - `https://your-app.vercel.app/accept`

## Verification Checklist

Before deploying, ensure:

- [ ] `SESSION_DB_URL` is set and valid
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `SUPABASE_ANON_KEY` is set
- [ ] `SESSION_SECRET` is changed from default
- [ ] `BASE_URL` is set to your Vercel URL
- [ ] `NODE_ENV` is set to `'production'`
- [ ] All Supabase redirect URLs are configured
- [ ] Database allows connections from Vercel

## Testing the Configuration

After setting environment variables:

1. Redeploy the project
2. Check deployment logs for initialization errors
3. Test a simple endpoint (e.g., `/health` if available)
4. Check Vercel function logs for runtime errors

## Getting Your Supabase Connection String

1. Go to Supabase Dashboard → Project Settings → Database
2. Find "Connection string" section
3. Copy the "URI" connection string
4. It should look like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
5. Replace `[YOUR-PASSWORD]` with your actual database password

## Security Notes

⚠️ **Never commit environment variables to git**
- All secrets should be in Vercel environment variables
- Use different secrets for production vs development
- Rotate `SESSION_SECRET` regularly
- Keep Supabase service role key secure (it bypasses RLS)

