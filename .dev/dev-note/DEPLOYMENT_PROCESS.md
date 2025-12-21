# Deployment Process — Express + Nunjucks vs Next.js

**Date:** 2025-12-22  
**Status:** Production Ready

---

## 🔄 Build Process Comparison

### Next.js (React Framework)
```bash
npm run build    # Compiles React, optimizes bundles, generates static files
npm start        # Runs production server
```

**Why Next.js needs build:**
- Compiles React/TypeScript → JavaScript
- Bundles and minifies code
- Generates static HTML pages (SSG)
- Optimizes images and assets
- Creates production-optimized bundles

---

### Express + Nunjucks (This Project)
```bash
npm install      # Install dependencies only
npm start        # Run directly (no build needed)
```

**Why no build step:**
- ✅ **Plain JavaScript** — No compilation needed
- ✅ **Server-side rendering** — Nunjucks compiles templates at runtime
- ✅ **No bundling** — Express serves files directly
- ✅ **No static generation** — Templates rendered on-demand

---

## 📋 Deployment Checklist

### 1. **Install Dependencies** (Required)
```bash
npm install
```

**What this does:**
- Installs all packages from `package.json`
- Sets up `node_modules/`
- No compilation happens here

---

### 2. **Set Environment Variables** (Required)
```bash
# .env file or environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEMO_VENDOR_ID=your-vendor-id
SESSION_SECRET=your-secret-key
PORT=9000
NODE_ENV=production
```

**Required vars:**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key for admin operations
- `DEMO_VENDOR_ID` — Vendor ID for demo/testing
- `SESSION_SECRET` — Secret for session encryption
- `PORT` — Server port (default: 9000)
- `NODE_ENV` — Environment (development/production/test)

**Optional vars (rollback):**
- `VMP_HOME_PAGE` — Override home page (default: `home5`)
- `VMP_LOGIN_PAGE` — Override login page (default: `login3`)

---

### 3. **Run Database Migrations** (Required)
```bash
# Apply migrations in Supabase SQL Editor or via CLI
# Files in: migrations/
```

**Migrations to apply:**
- `001_vmp_tenants_companies_vendors.sql`
- `002_vmp_vendor_users_sessions.sql`
- `003_vmp_cases_checklist.sql`
- `004_vmp_evidence_messages.sql`
- `005_vmp_invites.sql`
- `012_vmp_internal_users_rbac.sql`
- `013_vmp_notifications.sql`

**Note:** Run migrations **before** starting the server in production.

---

### 4. **Start Server** (Required)
```bash
npm start
# or
node server.js
```

**What happens:**
- Express server starts
- Nunjucks templates compile on first request (cached after)
- Server listens on configured PORT
- No build/compilation step

---

## 🚀 Production Deployment Steps

### **Option 1: Traditional Server (VPS/EC2)**
```bash
# 1. Clone repository
git clone <repo-url>
cd AIBOS-VMP

# 2. Install dependencies
npm install --production

# 3. Set environment variables
cp .env.example .env
# Edit .env with production values

# 4. Run database migrations
# (Apply via Supabase Dashboard or CLI)

# 5. Start server
npm start

# 6. Use process manager (PM2, systemd, etc.)
pm2 start server.js --name vmp
```

---

### **Option 2: Platform-as-a-Service (Vercel, Railway, Render)**
```bash
# These platforms auto-detect Express apps
# They run: npm install && npm start

# Vercel-specific:
# - Uses "vercel-build" script (currently: echo 'No build step required')
# - Automatically runs npm start
```

**Vercel Configuration:**
```json
// vercel.json
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
  ]
}
```

---

## ⚠️ What's NOT Needed (Unlike Next.js)

| Next.js | Express + Nunjucks |
|---------|-------------------|
| `npm run build` | ❌ Not needed |
| TypeScript compilation | ❌ No TypeScript |
| Bundle optimization | ❌ No bundling |
| Static file generation | ❌ Server-side only |
| Image optimization | ❌ Handled by Supabase Storage |
| Code splitting | ❌ Not applicable |

---

## ✅ Pre-Deployment Checklist

### Code
- [x] All routes consolidated (experimental pages archived)
- [x] Production pages locked (`home5.html`, `login3.html`)
- [x] Environment variables documented
- [x] Rollback mechanism in place

### Database
- [ ] All migrations applied
- [ ] Seed data loaded (if needed)
- [ ] Storage bucket configured (`vmp-evidence`)
- [ ] RLS policies enabled

### Environment
- [ ] `.env` file configured (or platform env vars)
- [ ] `SESSION_SECRET` set (strong random value)
- [ ] `SUPABASE_URL` and keys configured
- [ ] `NODE_ENV=production` set

### Server
- [ ] Node.js 20.x installed
- [ ] Dependencies installed (`npm install`)
- [ ] Port configured (default: 9000)
- [ ] Process manager configured (PM2, systemd, etc.)

---

## 🔍 Runtime Behavior

### Template Compilation
- **First request:** Nunjucks compiles template (slower)
- **Subsequent requests:** Uses cached compiled template (fast)
- **No pre-compilation needed** — happens automatically

### Static Assets
- **CSS:** Served from `public/globals.css` (no build)
- **JS:** HTMX/Alpine.js from CDN (no bundling)
- **Images:** Served from Supabase Storage (no optimization step)

### Code Execution
- **Server-side:** Express routes execute directly
- **No transpilation:** JavaScript runs as-is
- **No bundling:** Each file loaded independently

---

## 📊 Comparison Summary

| Aspect | Next.js | Express + Nunjucks |
|--------|---------|-------------------|
| **Build Step** | ✅ Required (`npm run build`) | ❌ Not needed |
| **Compilation** | ✅ TypeScript/JSX → JS | ❌ Plain JS |
| **Bundling** | ✅ Webpack/SWC | ❌ No bundling |
| **Static Generation** | ✅ `next export` | ❌ Server-side only |
| **Deployment** | Build → Start | Install → Start |
| **Startup Time** | Fast (pre-built) | Fast (runtime compile) |

---

## 🎯 Key Takeaway

**Express + Nunjucks = Zero Build Step**

Just:
1. `npm install` (dependencies)
2. Set environment variables
3. Run database migrations
4. `npm start` (run server)

**No compilation, no bundling, no build process needed!**

---

## 🔧 Optional: Pre-compile Templates (Advanced)

If you want to pre-compile Nunjucks templates (not required):

```bash
# Install nunjucks-precompile
npm install -g nunjucks-precompile

# Pre-compile templates
nunjucks-precompile src/views > templates.js

# Use compiled templates in server.js
```

**Note:** This is **optional** — runtime compilation works fine and is cached automatically.

---

**Status:** Ready for deployment without build step ✅

