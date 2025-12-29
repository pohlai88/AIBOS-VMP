# Nodemon Development Setup

**Date:** 2025-01-22  
**Status:** ✅ **Configured for Development**

---

## ✅ Nodemon Configuration

### Current Setup

**File:** `nodemon.json`
```json
{
  "watch": ["server.js", "src/", "nexus-server.js"],
  "ext": "js,json,html",
  "ignore": ["public/*", "node_modules/*", "tests/*", ".dev/*"],
  "delay": 500
}
```

**Dev Script:** `npm run dev` → `nodemon server.js`

---

## 🔄 How It Works

### In Development Mode

1. **Nodemon watches:**
   - `server.js` (main server file)
   - `src/` directory (routes, adapters, services, views)
   - File extensions: `.js`, `.json`, `.html`

2. **On file change:**
   - Nodemon detects change
   - Waits 500ms (delay) to batch multiple changes
   - Restarts the server automatically

3. **Nunjucks watch (separate):**
   - Watches template files in `src/views/`
   - Reloads templates without server restart
   - Only active when `NODE_ENV !== 'production'`

---

## 🚀 Usage

### Start Development Server
```bash
npm run dev
```

### What Happens:
- ✅ Server starts on `http://localhost:9000`
- ✅ Nodemon watches for file changes
- ✅ Auto-restarts on code changes
- ✅ Nunjucks watches templates (no restart needed)

---

## 📋 Watched Files

| Path | Watched | Reason |
|------|---------|--------|
| `server.js` | ✅ Yes | Main server file |
| `src/routes/*.js` | ✅ Yes | Route handlers |
| `src/adapters/*.js` | ✅ Yes | Database adapters |
| `src/services/*.js` | ✅ Yes | Business logic |
| `src/views/**/*.html` | ✅ Yes | Templates |
| `src/middleware/*.js` | ✅ Yes | Middleware |

---

## 🚫 Ignored Files

| Path | Ignored | Reason |
|------|---------|--------|
| `public/*` | ✅ Yes | Static assets (no restart needed) |
| `node_modules/*` | ✅ Yes | Dependencies |
| `tests/*` | ✅ Yes | Test files |
| `.dev/*` | ✅ Yes | Dev notes |

---

## ⚙️ Environment Detection

**Server.js checks:**
```javascript
const isDev = process.env.NODE_ENV !== 'production';
```

**If `NODE_ENV` is not set:**
- Defaults to development mode
- Nunjucks watch enabled
- Template cache disabled

**To run in production:**
```bash
NODE_ENV=production npm start
```

---

## 🔍 Troubleshooting

### Nodemon Not Restarting

1. **Check if nodemon is running:**
   ```bash
   npm run dev
   ```
   Should see: `[nodemon] starting...`

2. **Check file is being watched:**
   - File must be in `src/` or root
   - Extension must be `.js`, `.json`, or `.html`

3. **Check nodemon.json:**
   - Verify `watch` array includes your file path
   - Check `ignore` array doesn't exclude your file

### Template Changes Not Reflecting

1. **Nunjucks watch is separate:**
   - Template changes don't restart server
   - Should auto-reload without restart
   - If not working, check `NODE_ENV` is not `production`

2. **Force restart:**
   - Save a `.js` file to trigger nodemon restart
   - Or manually restart: `Ctrl+C` then `npm run dev`

---

## ✅ Verification

**Test nodemon is working:**
1. Start server: `npm run dev`
2. Make a change to `server.js` (add a comment)
3. Save the file
4. Should see: `[nodemon] restarting due to changes...`

**Test Nunjucks watch:**
1. Start server: `npm run dev`
2. Edit a template in `src/views/nexus/pages/`
3. Refresh browser
4. Changes should appear without server restart

---

**Status:** ✅ **Ready for Development**  
**Last Updated:** 2025-01-22

