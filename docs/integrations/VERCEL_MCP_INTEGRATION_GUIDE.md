# Vercel MCP Integration Guide: VMP Project

**Date:** 2025-01-XX  
**Status:** Ready for Vercel Deployment  
**Team:** AI-BOS NexusCanon (`team_05yVsWPh4ZJT3Q8u4sM6W2OP`)

---

## Executive Summary

Vercel MCP is **connected and operational**. Your project can be deployed to Vercel with minimal configuration changes.

**Current Status:**
- ✅ Vercel MCP server connected
- ✅ Team "AI-BOS NexusCanon" available
- ✅ Server fully Vercel-compatible (`export default app`)
- ✅ Health check route implemented (`/health`)
- ✅ Function timeout configured (30 seconds)
- ⚠️ No projects exist yet (ready to create)
- ⚠️ Environment variables need to be set in Vercel Dashboard

---

## Vercel MCP Capabilities

### Available Operations

| Operation | Description | Status |
|-----------|-------------|--------|
| **List Projects** | View all Vercel projects | ✅ Working |
| **List Teams** | View available teams | ✅ Working |
| **List Deployments** | View deployment history | ✅ Available |
| **Get Deployment** | Get deployment details | ✅ Available |
| **Get Build Logs** | View build logs | ✅ Available |
| **Deploy to Vercel** | Deploy project directly | ✅ Available |
| **Search Documentation** | Vercel docs search | ✅ Available |
| **List Teams** | View teams | ✅ Available |
| **Check Domain** | Domain availability | ✅ Available |

### Your Vercel Teams

1. **Jack's projects** (`team_Ymg16AtjGxrKyjaZk5Z52IYc`)
2. **AI-BOS NexusCanon** (`team_05yVsWPh4ZJT3Q8u4sM6W2OP`) ⭐ **Recommended**

---

## Project Configuration for Vercel

### Current Server Structure

Your `server.js` uses:
- ✅ ES Modules (`import` statements)
- ✅ Express app
- ✅ `export default app;` (Vercel-compatible)
- ✅ Conditional `app.listen()` (development only)
- ✅ Health check route (`/health`)

### ✅ Configuration Status

**All required changes are complete:**

1. ✅ **`server.js`** - Exports app for Vercel
   ```javascript
   export default app;
   
   // Only listens in development
   if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
     app.listen(PORT, () => { /* ... */ });
   }
   ```

2. ✅ **`vercel.json`** - Configured with function timeout

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server.js": {
      "maxDuration": 30
    }
  }
}
```

3. ✅ **Health Check Route** - Implemented at `/health`
   ```javascript
   app.get('/health', (req, res) => {
     res.json({
       status: 'ok',
       timestamp: new Date().toISOString(),
       uptime: process.uptime(),
       environment: env.NODE_ENV,
     });
   });
   ```

4. ✅ **`package.json`** - Has `vercel-build` script

Add Vercel-specific scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "lint": "eslint . --ext .js,.html",
    "lint:fix": "eslint . --ext .js,.html --fix",
    "vercel-build": "echo 'No build step required'"
  }
}
```

---

## Deployment Options

### Option 1: Deploy via Vercel MCP (Recommended)

Use the MCP tool to deploy directly:

```javascript
mcp_vercel_deploy_to_vercel()
```

**Benefits:**
- Direct deployment from Cursor
- No CLI required
- Instant deployment

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Option 3: Git Integration

Connect your GitHub repository to Vercel for automatic deployments.

---

## Environment Variables Setup

### Required Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ Yes |
| `DEMO_VENDOR_ID` | Vendor ID from seed data | ✅ Yes (Phase 0) |
| `SESSION_SECRET` | Secret key for session encryption | ✅ Yes |
| `NODE_ENV` | Environment (production) | ✅ Yes |

### Setting Environment Variables via Vercel MCP

Currently, environment variables must be set via:
1. Vercel Dashboard (recommended)
2. Vercel CLI: `vercel env add VARIABLE_NAME`

---

## Vercel MCP Usage Examples

### 1. List Projects

```javascript
mcp_vercel_list_projects({
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

### 2. Get Project Details

```javascript
mcp_vercel_get_project({
  projectId: "prj_xxxxxxxxxxxxx",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

### 3. List Deployments

```javascript
mcp_vercel_list_deployments({
  projectId: "prj_xxxxxxxxxxxxx",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP"
})
```

### 4. Get Deployment Build Logs

```javascript
mcp_vercel_get_deployment_build_logs({
  idOrUrl: "deployment-url.vercel.app",
  teamId: "team_05yVsWPh4ZJT3Q8u4sM6W2OP",
  limit: 100
})
```

### 5. Search Vercel Documentation

```javascript
mcp_vercel_search_vercel_documentation({
  topic: "deploying Express applications",
  tokens: 2000
})
```

### 6. Deploy to Vercel

```javascript
mcp_vercel_deploy_to_vercel()
```

---

## Deployment Checklist

### Pre-Deployment

- [x] ✅ Modify `server.js` to export app for Vercel
- [x] ✅ Create `vercel.json` configuration
- [x] ✅ Add function timeout to `vercel.json`
- [x] ✅ Implement health check route
- [x] ✅ Update `package.json` with Vercel build script
- [ ] Test locally with `vercel dev`
- [ ] Set environment variables in Vercel Dashboard

### Deployment

- [ ] Deploy via Vercel MCP or CLI
- [ ] Verify deployment URL
- [ ] Check build logs for errors
- [ ] Test deployed application

### Post-Deployment

- [ ] Verify all routes work
- [ ] Test Supabase connection
- [ ] Check environment variables
- [ ] Monitor deployment status

---

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:** Ensure all dependencies are in `package.json` and `node_modules` is committed or Vercel can install them.

### Issue: Environment variables not working

**Solution:** 
1. Set variables in Vercel Dashboard
2. Redeploy after adding variables
3. Check variable names match exactly

### Issue: Routes not working

**Solution:** 
1. Verify `vercel.json` routes configuration
2. Check that `server.js` exports the app correctly
3. Ensure all routes are defined in Express app

### Issue: Build fails

**Solution:**
1. Check build logs via `mcp_vercel_get_deployment_build_logs`
2. Verify Node.js version compatibility
3. Check for missing dependencies

---

## Next Steps

1. **Modify `server.js`** for Vercel compatibility
2. **Create `vercel.json`** configuration file
3. **Set environment variables** in Vercel Dashboard
4. **Deploy via Vercel MCP** or CLI
5. **Monitor deployment** using Vercel MCP tools

---

## Resources

- [Vercel Express Documentation](https://vercel.com/docs/frameworks/backend/express)
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel MCP Server](https://github.com/modelcontextprotocol/servers)

---

**Ready to deploy your VMP project to Vercel!** 🚀

