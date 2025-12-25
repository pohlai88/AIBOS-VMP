# Vercel Deployment Checklist & Troubleshooting

## Quick Checklist

### Before Deployment
- [ ] All required environment variables are set in Vercel
- [ ] `SESSION_DB_URL` is valid and accessible
- [ ] `BASE_URL` matches your Vercel deployment URL
- [ ] `SESSION_SECRET` is changed from default
- [ ] Supabase redirect URLs are configured

### After Deployment
- [ ] Check deployment logs for errors
- [ ] Test a simple endpoint (e.g., `/health` or `/`)
- [ ] Verify session store connection works
- [ ] Test authentication flow

## Required Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_DB_URL` | ✅ **YES** | None | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ **YES** | `''` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES** | `''` | Supabase service role key |
| `SUPABASE_ANON_KEY` | ✅ **YES** | `''` | Supabase anonymous key |
| `SESSION_SECRET` | ⚠️ **CHANGE** | `'dev-secret...'` | Session encryption secret |
| `BASE_URL` | ⚠️ **SET** | `'http://localhost:9000'` | Your Vercel deployment URL |
| `NODE_ENV` | ✅ **SET** | `'development'` | Should be `'production'` |

## Common Error Patterns

### Error: "Internal Server Error" (500)

**Most Likely Causes:**
1. **Missing `SESSION_DB_URL`** - App fails during initialization
   - **Fix**: Set `SESSION_DB_URL` in Vercel environment variables
   - **Verify**: Check deployment logs for "SESSION_DB_URL" error

2. **Invalid `SESSION_DB_URL`** - Database connection fails
   - **Fix**: Verify connection string format: `postgresql://user:password@host:port/database`
   - **Verify**: Test connection string locally or in Supabase dashboard

3. **Database not accessible** - Network/firewall issue
   - **Fix**: Check Supabase connection pooling settings
   - **Verify**: Ensure database allows external connections

4. **Missing Supabase keys** - Can't connect to Supabase
   - **Fix**: Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
   - **Verify**: Check Supabase dashboard for correct values

### Error: "Function timeout"

**Cause**: Request takes longer than 60 seconds
- **Fix**: Already configured `maxDuration: 60` in vercel.json
- **Alternative**: Optimize slow database queries or operations

### Error: "Out of memory"

**Cause**: Function exceeds memory limit
- **Fix**: Already configured `memory: 3008` in vercel.json
- **Alternative**: Optimize memory usage in code

## Serverless-Specific Considerations

### ✅ Good Practices (Already Implemented)

1. **No `app.listen()` in production** - Server only starts in development
   ```javascript
   if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
     app.listen(PORT, ...);
   }
   ```

2. **Express app exported correctly** - Works with Vercel serverless functions
   ```javascript
   export default app;
   ```

3. **Function configuration** - Memory and timeout set appropriately
   ```json
   "functions": {
     "api/index.js": {
       "memory": 3008,
       "maxDuration": 60
     }
   }
   ```

### ⚠️ Potential Issues

1. **Session Store Connection** - Synchronous initialization
   - The session store connects during module load
   - If database is unreachable, app will fail to initialize
   - **Mitigation**: Ensure `SESSION_DB_URL` is correct and database is accessible

2. **Cold Starts** - Large Express app may have slow cold starts
   - First request after inactivity may be slow
   - **Mitigation**: Increased memory (3008 MB) helps

3. **Database Connection Pooling** - Multiple serverless instances
   - Each instance creates its own connection pool
   - **Mitigation**: Use Supabase connection pooling (recommended)

## Verification Steps

### Step 1: Check Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify all required variables are set
3. Check that values are correct (especially `SESSION_DB_URL`)

### Step 2: Check Deployment Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Check "Build Logs" for initialization errors
4. Check "Function Logs" for runtime errors

### Step 3: Test the Deployment

1. Visit your deployment URL: `https://aibos-vmp.vercel.app`
2. Check if the app loads (even if just error page)
3. Try accessing `/health` endpoint if available
4. Check browser console for errors

### Step 4: Check Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `api/index.js`
3. Check "Logs" tab for runtime errors
4. Look for database connection errors or missing environment variable errors

## Getting Help

If you're still experiencing issues:

1. **Check Vercel Function Logs** - Most detailed error information
2. **Check Deployment Build Logs** - Initialization errors
3. **Test Locally** - Verify environment variables work locally
4. **Check Supabase Dashboard** - Verify database is accessible

## Quick Fixes

### Fix: Missing SESSION_DB_URL
```bash
# Get connection string from Supabase Dashboard
# Project Settings → Database → Connection string → URI
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### Fix: Wrong BASE_URL
```bash
# Set to your Vercel deployment URL
BASE_URL=https://aibos-vmp.vercel.app
```

### Fix: Weak SESSION_SECRET
```bash
# Generate a strong secret (32+ characters)
# Use: openssl rand -base64 32
# Or: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Next Steps After Fixing

1. **Redeploy** - Push a new commit or redeploy from Vercel dashboard
2. **Monitor** - Watch deployment logs for errors
3. **Test** - Verify the app works end-to-end
4. **Document** - Note any additional environment variables needed

