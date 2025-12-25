# Project Improvements & Dependencies Guide

**Date:** 2025-01-XX  
**Status:** Production-Ready Improvements  
**Purpose:** Enhance VMP project with missing dependencies and tools

---

## Executive Summary

Your project is **functionally complete** for Vercel deployment, but missing several **production-ready** and **development** improvements.

**Current Status:**
- ✅ Core dependencies present (Express, Nunjucks, Supabase)
- ✅ Basic linting (ESLint)
- ⚠️ Missing: Testing, Security, Error Handling, Validation
- ⚠️ Missing: Code Formatting, Type Checking, Logging
- ⚠️ Missing: Vercel-specific optimizations

---

## 1. Vercel Deployment Requirements

### ✅ Already Have
- `vercel.json` configuration
- ES Modules support (`"type": "module"`)
- Express app export for Vercel

### ⚠️ Missing for Vercel

#### 1.1 Node.js Version Specification

**Add to `package.json`:**
```json
{
  "engines": {
    "node": "20.x"
  }
}
```

**Why:** Ensures Vercel uses the correct Node.js version (20.x LTS recommended)

#### 1.2 Vercel Build Script (Optional)

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "vercel-build": "echo 'No build step required for Express'"
  }
}
```

**Why:** Explicitly tells Vercel there's no build step (Express doesn't need one)

---

## 2. Production-Ready Dependencies

### 2.1 Security Middleware

**Install:**
```bash
npm install helmet express-rate-limit
```

**Why:**
- `helmet` - Sets security HTTP headers
- `express-rate-limit` - Prevents brute force attacks

**Usage:**
```javascript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

### 2.2 Error Handling

**Install:**
```bash
npm install express-async-errors
```

**Why:** Better async error handling in Express routes

**Usage:**
```javascript
import 'express-async-errors';

// Now async route errors are automatically caught
app.get('/api/data', async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
  // Errors automatically passed to error handler
});
```

### 2.3 Input Validation

**Install:**
```bash
npm install express-validator
```

**Why:** Validate and sanitize user input

**Usage:**
```javascript
import { body, validationResult } from 'express-validator';

app.post('/cases/:id/messages',
  body('message').trim().isLength({ min: 1, max: 5000 }),
  body('message').escape(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process valid input
  }
);
```

### 2.4 Environment Variable Validation

**Install:**
```bash
npm install envalid
```

**Why:** Validate environment variables at startup

**Usage:**
```javascript
import { cleanEnv, str, url } from 'envalid';

const env = cleanEnv(process.env, {
  SUPABASE_URL: url(),
  SUPABASE_SERVICE_ROLE_KEY: str(),
  DEMO_VENDOR_ID: str(),
  SESSION_SECRET: str({ minLength: 32 }),
  PORT: str({ default: '9000' })
});
```

### 2.5 Compression Middleware

**Install:**
```bash
npm install compression
```

**Why:** Gzip compression for faster responses

**Usage:**
```javascript
import compression from 'compression';

app.use(compression());
```

### 2.6 Logging

**Install:**
```bash
npm install winston
```

**Why:** Structured logging instead of console.log

**Usage:**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

logger.info('Server started');
logger.error('Error occurred', { error });
```

---

## 3. Development Tools

### 3.1 Code Formatting

**Install:**
```bash
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

**Why:** Consistent code formatting

**Create `.prettierrc`:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Update `package.json` scripts:**
```json
{
  "scripts": {
    "format": "prettier --write \"**/*.{js,json,html,css,md}\"",
    "format:check": "prettier --check \"**/*.{js,json,html,css,md}\""
  }
}
```

### 3.2 Type Checking (JSDoc)

**Install:**
```bash
npm install --save-dev @types/node @types/express @types/cookie-session
```

**Why:** TypeScript definitions for better IDE support and type checking

**Create `jsconfig.json`:**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "checkJs": true,
    "strict": true
  },
  "include": ["**/*.js"],
  "exclude": ["node_modules"]
}
```

### 3.3 Pre-commit Hooks

**Install:**
```bash
npm install --save-dev husky lint-staged
```

**Why:** Run linting/formatting before commits

**Setup:**
```bash
npx husky init
```

**Create `.husky/pre-commit`:**
```bash
npx lint-staged
```

**Update `package.json`:**
```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "prettier --write"],
    "*.{json,html,css,md}": ["prettier --write"]
  }
}
```

---

## 4. Testing Framework

### 4.1 Testing Setup

**Install:**
```bash
npm install --save-dev jest supertest @jest/globals
```

**Why:** Unit and integration testing

**Create `jest.config.js`:**
```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
```

**Create `tests/server.test.js`:**
```javascript
import request from 'supertest';
import app from '../server.js';

describe('Server', () => {
  test('GET / should redirect to /home', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/home');
  });

  test('GET /home should return 200', async () => {
    const response = await request(app).get('/home');
    expect(response.statusCode).toBe(200);
  });
});
```

**Update `package.json` scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 5. Monitoring & Error Tracking

### 5.1 Error Tracking (Optional - for production)

**Install:**
```bash
npm install @sentry/node
```

**Why:** Track errors in production

**Usage:**
```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 5.2 Health Check Endpoint

**Add to `server.js`:**
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

**Why:** Vercel and monitoring tools can check app health

---

## 6. Complete Updated `package.json`

```json
{
  "name": "nexus-vmp-canon",
  "version": "0.1.0",
  "type": "module",
  "main": "server.js",
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "lint": "eslint . --ext .js,.html",
    "lint:fix": "eslint . --ext .js,.html --fix",
    "format": "prettier --write \"**/*.{js,json,html,css,md}\"",
    "format:check": "prettier --check \"**/*.{js,json,html,css,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "vercel-build": "echo 'No build step required'",
    "prepare": "husky install"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "compression": "^1.7.4",
    "cookie-session": "^2.0.0",
    "dotenv": "^16.3.1",
    "envalid": "^8.0.0",
    "express": "^4.18.2",
    "express-async-errors": "^3.1.1",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "nunjucks": "^3.2.4",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@types/cookie-session": "^2.0.45",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-html": "^7.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "husky": "^8.0.3",
    "jest": "^29.7.0",
    "lint-staged": "^15.2.0",
    "nodemon": "^3.0.2",
    "prettier": "^3.2.4",
    "supertest": "^6.3.3"
  }
}
```

---

## 7. Installation Commands

### Quick Install (All Dependencies)

```bash
# Production dependencies
npm install helmet express-rate-limit express-async-errors express-validator envalid compression winston

# Development dependencies
npm install --save-dev @types/node @types/express @types/cookie-session prettier eslint-config-prettier eslint-plugin-prettier husky lint-staged jest supertest @jest/globals
```

### Step-by-Step Installation

```bash
# 1. Security
npm install helmet express-rate-limit

# 2. Error Handling & Validation
npm install express-async-errors express-validator envalid

# 3. Performance
npm install compression

# 4. Logging
npm install winston

# 5. Code Quality
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier

# 6. Type Definitions
npm install --save-dev @types/node @types/express @types/cookie-session

# 7. Testing
npm install --save-dev jest supertest @jest/globals

# 8. Git Hooks
npm install --save-dev husky lint-staged
```

---

## 8. Configuration Files to Create

### 8.1 `.prettierrc`
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 8.2 `.prettierignore`
```
node_modules
dist
build
*.min.js
package-lock.json
```

### 8.3 `jsconfig.json`
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "checkJs": true,
    "strict": true
  },
  "include": ["**/*.js"],
  "exclude": ["node_modules"]
}
```

### 8.4 `jest.config.js`
```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/tests/**/*.test.js']
};
```

---

## 9. Priority Recommendations

### 🔴 High Priority (Before Production)

1. **Security** - `helmet`, `express-rate-limit`
2. **Error Handling** - `express-async-errors`
3. **Input Validation** - `express-validator`
4. **Environment Validation** - `envalid`
5. **Node.js Version** - Add `engines` to `package.json`

### 🟡 Medium Priority (Development Quality)

6. **Code Formatting** - `prettier`
7. **Type Definitions** - `@types/*` packages
8. **Logging** - `winston`
9. **Compression** - `compression` middleware

### 🟢 Low Priority (Nice to Have)

10. **Testing** - `jest`, `supertest`
11. **Git Hooks** - `husky`, `lint-staged`
12. **Error Tracking** - `@sentry/node` (optional)

---

## 10. Vercel-Specific Improvements

### 10.1 Update `vercel.json`

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

### 10.2 Add Health Check Route

Essential for Vercel monitoring:
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## 11. Next Steps

1. **Install high-priority dependencies**
2. **Update `package.json`** with engines and scripts
3. **Create configuration files** (`.prettierrc`, `jsconfig.json`)
4. **Add security middleware** to `server.js`
5. **Set up environment validation** with `envalid`
6. **Test locally** before deploying to Vercel
7. **Deploy to Vercel** and verify

---

## Resources

- [Vercel Node.js Documentation](https://vercel.com/docs/functions/runtimes/node-js)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)

---

**Your project will be production-ready after implementing these improvements!** 🚀

