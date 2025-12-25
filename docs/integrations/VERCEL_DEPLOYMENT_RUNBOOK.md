# Vercel Deployment Runbook

**Date:** 2025-01-XX  
**Status:** ✅ Ready for Use  
**Project:** VMP (Vendor Management Platform)

---

## Overview

Step-by-step guide for deploying the VMP project to Vercel, including pre-deployment checks, deployment procedures, and post-deployment verification.

---

## Pre-Deployment Checklist

### 1. Configuration Verification

- [x] ✅ `vercel.json` exists and configured
- [x] ✅ `server.js` exports app for Vercel
- [x] ✅ Health check route implemented (`/health`)
- [x] ✅ Function timeout configured (30 seconds)
- [x] ✅ Node.js version specified (20.x)
- [x] ✅ ES Modules enabled

### 2. Code Quality Checks

- [ ] Run linting: `npm run lint`
- [ ] Fix any linting errors: `npm run lint:fix`
- [ ] Run tests: `npm test`
- [ ] Verify all tests pass
- [ ] Check for console errors locally

### 3. Environment Variables Preparation

**Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | `eyJhbGc...` |
| `DEMO_VENDOR_ID` | Demo vendor UUID | `uuid-here` |
| `SESSION_SECRET` | Session encryption key | `random-secret-key` |
| `NODE_ENV` | Environment | `production` (auto-set) |

**Prepare values:**
- [ ] Copy `SUPABASE_URL` from `.env`
- [ ] Copy `SUPABASE_SERVICE_ROLE_KEY` from `.env`
- [ ] Copy `DEMO_VENDOR_ID` from `.env`
- [ ] Generate new `SESSION_SECRET` for production
- [ ] Document all values (securely)

---

## Deployment Methods

### Method 1: Vercel MCP (Recommended for Testing)

**Use Vercel MCP tools directly from Cursor:**

```javascript
// Deploy to Vercel
mcp_vercel_deploy_to_vercel({
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

**Steps:**
1. Ensure all pre-deployment checks pass
2. Use MCP tool to deploy
3. Monitor deployment status
4. Verify deployment URL

**Benefits:**
- ✅ Direct deployment from Cursor
- ✅ No CLI required
- ✅ Instant feedback

### Method 2: Vercel CLI (Recommended for Production)

**Install and Setup:**

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Link to team (optional)
vercel teams switch team_05yVsWPh4ZJT3Q8u4sM6W2OP
```

**Deploy:**

```bash
# Preview deployment (recommended first)
vercel

# Production deployment
vercel --prod
```

**Steps:**
1. Install Vercel CLI
2. Login to Vercel account
3. Navigate to project directory
4. Run `vercel` for preview
5. Test preview deployment
6. Run `vercel --prod` for production

**Benefits:**
- ✅ More control over deployment
- ✅ Preview before production
- ✅ Better for production workflows

### Method 3: Git Integration (Recommended for Ongoing)

**Setup:**

1. Connect GitHub repository to Vercel
2. Configure build settings
3. Set environment variables
4. Enable automatic deployments

**Workflow:**
- **Preview:** Automatic on every push/PR
- **Production:** Automatic on merge to main

**Benefits:**
- ✅ Automatic deployments
- ✅ Preview deployments for PRs
- ✅ Deployment history
- ✅ Team collaboration

---

## Environment Variables Setup

### Setting Variables in Vercel Dashboard

1. **Navigate to Project**
   - Go to Vercel Dashboard
   - Select project (or create new)
   - Go to Settings → Environment Variables

2. **Add Each Variable**
   - Click "Add New"
   - Enter variable name
   - Enter variable value
   - Select environments (Production, Preview, Development)
   - Click "Save"

3. **Required Variables**
   ```
   SUPABASE_URL=https://vrawceruzokxitybkufk.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   DEMO_VENDOR_ID=uuid-here
   SESSION_SECRET=your-secret-key-here
   ```

4. **Redeploy After Adding**
   - Variables are only available after redeploy
   - Use "Redeploy" button in Vercel Dashboard

### Setting Variables via CLI

```bash
# Add environment variable
vercel env add SUPABASE_URL production
# Paste value when prompted

# Add for all environments
vercel env add SUPABASE_URL

# List all variables
vercel env ls

# Remove variable
vercel env rm SUPABASE_URL production
```

---

## Local Testing with Vercel

### Test Vercel Configuration Locally

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Test locally with Vercel
vercel dev
```

**This will:**
- ✅ Simulate Vercel environment
- ✅ Test `vercel.json` configuration
- ✅ Verify routes work
- ✅ Test environment variables

**Expected Output:**
```
> Ready! Available at http://localhost:3000
```

**Test:**
```bash
# Test health check
curl http://localhost:3000/health

# Test main route
curl http://localhost:3000/
```

---

## Deployment Steps

### Step 1: Pre-Deployment

1. **Verify Configuration**
   ```bash
   # Check vercel.json exists
   cat vercel.json
   
   # Verify server.js exports app
   tail -5 server.js
   ```

2. **Test Locally**
   ```bash
   # Run local server
   npm run dev
   
   # Test health check
   curl http://localhost:9000/health
   ```

3. **Prepare Environment Variables**
   - List all required variables
   - Have values ready
   - Document securely

### Step 2: Deploy

**Option A: Vercel MCP**
```javascript
mcp_vercel_deploy_to_vercel({
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

**Option B: Vercel CLI**
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

**Option C: Git Integration**
- Push to GitHub
- Vercel automatically deploys

### Step 3: Post-Deployment

1. **Get Deployment URL**
   - From Vercel Dashboard
   - From CLI output
   - From MCP response

2. **Verify Deployment**
   ```bash
   # Test health check
   curl https://your-project.vercel.app/health
   
   # Expected response:
   {
     "status": "ok",
     "timestamp": "2025-01-XX...",
     "uptime": 123.456,
     "environment": "production"
   }
   ```

3. **Test Main Routes**
   - Test `/` (landing page)
   - Test `/login` (login page)
   - Test authenticated routes (if applicable)

4. **Check Build Logs**
   ```javascript
   // Using Vercel MCP
   mcp_vercel_get_deployment_build_logs({
     idOrUrl: "deployment-url.vercel.app",
     teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
   })
   ```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-project.vercel.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "uptime": 123.456,
  "environment": "production"
}
```

### 2. Route Testing

**Test Public Routes:**
```bash
# Landing page
curl https://your-project.vercel.app/

# Login page
curl https://your-project.vercel.app/login

# Health check
curl https://your-project.vercel.app/health
```

**Test Authenticated Routes:**
- Login via browser
- Verify session works
- Test protected routes

### 3. Supabase Connection

**Verify:**
- Database queries work
- Authentication works
- Edge Functions accessible

### 4. Environment Variables

**Verify:**
- All variables are set
- Variables have correct values
- No missing variables

**Check via:**
```bash
# In server logs (if logged)
# Or test functionality that uses variables
```

---

## Monitoring & Troubleshooting

### Check Deployment Status

**Via Vercel Dashboard:**
1. Go to project
2. View "Deployments" tab
3. Check latest deployment status

**Via Vercel MCP:**
```javascript
mcp_vercel_list_deployments({
  projectId: "prj_xxxxxxxxxxxxx",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

### View Build Logs

**Via Vercel MCP:**
```javascript
mcp_vercel_get_deployment_build_logs({
  idOrUrl: "deployment-url.vercel.app",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP",
  limit: 100
})
```

**Via Vercel Dashboard:**
1. Go to deployment
2. Click "View Build Logs"
3. Review for errors

### Common Issues & Solutions

#### Issue: Build Fails

**Symptoms:**
- Deployment shows "Error" status
- Build logs show errors

**Solutions:**
1. Check build logs for specific error
2. Verify Node.js version compatibility
3. Check for missing dependencies
4. Verify `package.json` is correct
5. Check `vercel.json` configuration

#### Issue: Routes Return 404

**Symptoms:**
- Routes not found
- 404 errors

**Solutions:**
1. Verify `vercel.json` routes configuration
2. Check that `server.js` exports app correctly
3. Verify routes are defined in Express app
4. Check route paths match exactly

#### Issue: Environment Variables Not Working

**Symptoms:**
- Variables undefined
- Connection errors

**Solutions:**
1. Verify variables are set in Vercel Dashboard
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)
4. Verify environment (Production vs Preview)

#### Issue: Function Timeout

**Symptoms:**
- Requests timeout
- 504 errors

**Solutions:**
1. Check `vercel.json` function timeout (should be 30s)
2. Optimize slow operations
3. Consider breaking into smaller functions
4. Add caching where possible

---

## Rollback Procedure

### Rollback to Previous Deployment

**Via Vercel Dashboard:**
1. Go to project → Deployments
2. Find previous successful deployment
3. Click "..." menu
4. Select "Promote to Production"

**Via Vercel CLI:**
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

**Via Vercel MCP:**
```javascript
// Get previous deployment
mcp_vercel_list_deployments({
  projectId: "prj_xxxxxxxxxxxxx",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP",
  limit: 10
})

// Promote previous deployment
// (Use Vercel Dashboard or CLI)
```

---

## Performance Optimization

### Function Optimization

1. **Minimize Cold Starts**
   - Keep dependencies minimal
   - Use ES Modules efficiently
   - Optimize imports

2. **Response Time Optimization**
   - Add caching headers
   - Optimize database queries
   - Use compression (already enabled)

3. **Bundle Size**
   - Remove unused dependencies
   - Tree-shake imports
   - Optimize assets

### Monitoring Performance

**Via Vercel Analytics:**
1. Enable Vercel Analytics in Dashboard
2. Monitor function execution times
3. Track error rates
4. Monitor bandwidth usage

**Via Vercel MCP:**
```javascript
// Get deployment metrics
mcp_vercel_get_deployment({
  idOrUrl: "deployment-url.vercel.app",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

---

## Security Checklist

### Pre-Deployment Security

- [ ] Environment variables set securely
- [ ] No secrets in code
- [ ] `SESSION_SECRET` is strong and unique
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Security headers configured (Helmet.js)
- [ ] Rate limiting enabled
- [ ] CORS configured correctly

### Post-Deployment Security

- [ ] Verify HTTPS is working
- [ ] Test security headers
- [ ] Verify rate limiting works
- [ ] Check for exposed secrets
- [ ] Review access logs

---

## Deployment Checklist Summary

### Pre-Deployment ✅

- [x] Configuration verified
- [x] Code quality checks passed
- [x] Tests passing
- [ ] Environment variables prepared
- [ ] Local testing completed

### Deployment ✅

- [ ] Environment variables set in Vercel
- [ ] Deployed via chosen method
- [ ] Deployment URL obtained
- [ ] Build logs reviewed

### Post-Deployment ✅

- [ ] Health check passing
- [ ] Routes tested
- [ ] Supabase connection verified
- [ ] Environment variables verified
- [ ] Performance acceptable
- [ ] Monitoring configured

---

## Quick Reference

### Deployment Commands

```bash
# Test locally with Vercel
vercel dev

# Preview deployment
vercel

# Production deployment
vercel --prod

# List deployments
vercel ls

# View logs
vercel logs [deployment-url]

# Rollback
vercel rollback [deployment-url]
```

### Health Check

```bash
curl https://your-project.vercel.app/health
```

### Vercel MCP Tools

```javascript
// List projects
mcp_vercel_list_projects({ teamId: "..." })

// Deploy
mcp_vercel_deploy_to_vercel({ teamId: "..." })

// Get deployment
mcp_vercel_get_deployment({ idOrUrl: "...", teamId: "..." })

// Get build logs
mcp_vercel_get_deployment_build_logs({ idOrUrl: "...", teamId: "..." })
```

---

## Related Documentation

- [Vercel MCP Evaluation](./VERCEL_MCP_EVALUATION.md) - Complete evaluation
- [Vercel MCP Integration Guide](./VERCEL_MCP_INTEGRATION_GUIDE.md) - Integration details
- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md) - Supabase integration

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Ready for Deployment

