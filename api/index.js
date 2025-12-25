// Vercel serverless function handler for Express app
// This file serves as the entry point for all routes via vercel.json rewrites

import app from '../server.js';

// Export the Express app as the default handler
// Vercel automatically wraps Express apps in a serverless function
// All routes are rewritten to /api via vercel.json, so this handler receives all requests
export default app;
