/// <reference path="./types/express.d.ts" />
/**
 * ============================================================================
 * TEMPORARY MINIMAL SERVER
 * ============================================================================
 * Purpose: View specific Nexus pages only
 * Pages Supported:
 * - /nexus/complete-profile (GET, POST)
 * - /nexus/client (GET) - client-dashboard.html
 * - /nexus/client/payments/:payment_id (GET) - client-payment-detail.html
 * - /nexus/client/approvals (GET) - client-approval-dashboard.html
 * 
 * Legacy server archived as: server.js.legacy
 * ============================================================================
 */

import express from 'express';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Import Nexus routers
import nexusPortalRouter from './src/routes/nexus-portal.js';
import nexusClientRouter from './src/routes/nexus-client.js';

// Environment setup
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 9000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// NUNJUCKS TEMPLATE ENGINE
// ============================================================================

// Nunjucks configuration
// In dev: watch templates for changes (nodemon handles server restart)
// In production: no watch, use cache
const isDev = process.env.NODE_ENV !== 'production';
nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  watch: isDev, // Template watching (nodemon handles server restart)
  noCache: isDev, // Disable template cache in dev
});

// ============================================================================
// ROUTES
// ============================================================================

// Mount Nexus Portal Router (for complete-profile)
app.use('/nexus', nexusPortalRouter);

// Mount Nexus Client Router (for client pages)
app.use('/nexus/client', nexusClientRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('nexus/pages/error.html', {
    error: { status: 500, message: err.message || 'Internal server error' }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('nexus/pages/error.html', {
    error: { status: 404, message: 'Page not found' }
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Temporary Nexus Server running on http://localhost:${PORT}`);
  console.log(`📄 Supported pages:`);
  console.log(`   - /nexus/complete-profile`);
  console.log(`   - /nexus/client (dashboard)`);
  console.log(`   - /nexus/client/payments/:payment_id`);
  console.log(`   - /nexus/client/approvals`);
  console.log(`\n⚠️  Legacy server archived as: server.js.legacy`);
  if (isDev) {
    console.log(`\n🔄 Dev Mode: Nunjucks watching templates, nodemon watching code`);
  }
});

