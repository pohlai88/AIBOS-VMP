/// <reference path="./types/express.d.ts" />
import express from 'express';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { cleanEnv, str, url } from 'envalid';
import 'express-async-errors';
import multer from 'multer';
import { vmpAdapter } from './src/adapters/supabase.js';

// Environment validation
dotenv.config();
const env = cleanEnv(process.env, {
  SUPABASE_URL: url({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  DEMO_VENDOR_ID: str({ default: '' }),
  SESSION_SECRET: str({ default: 'dev-secret-change-in-production' }),
  PORT: str({ default: '9000' }),
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
});

const app = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory (we'll upload to Supabase Storage)
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, images, Word, Excel`), false);
    }
  }
});

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", env.SUPABASE_URL],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Request timeout middleware (30 seconds)
// Wraps async route handlers to enforce timeout
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.',
      });
    }
  }, 30000); // 30 second timeout

  // Clear timeout when response is sent
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    clearTimeout(timeout);
    return originalEnd(...args);
  };

  next();
});

// Compression
app.use(compression());

// --- CONFIG ---
const nunjucksEnv = nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  watch: env.NODE_ENV === 'development',
});

// Add custom filters
nunjucksEnv.addFilter('upper', (str) => {
  return str ? String(str).toUpperCase() : '';
});

nunjucksEnv.addFilter('tojson', (obj) => {
  return JSON.stringify(obj);
});

// Date formatting filter (replaces Python's strftime)
nunjucksEnv.addFilter('date', (date, format) => {
  if (!date) return '';
  
  try {
    // Handle different date input types
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    if (isNaN(d.getTime())) return '';
    
    // Format patterns
    const patterns = {
      '%b %d': () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
      },
      '%H:%M': () => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      },
      '%Y-%m-%d': () => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    };
    
    if (format && patterns[format]) {
      return patterns[format]();
    }
    
    // Default format
    return d.toLocaleDateString();
  } catch (error) {
    console.error('Date filter error:', error, 'Input:', date);
    return '';
  }
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieSession({
    name: 'vmp_session',
    keys: [env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  })
);

// --- MIDDLEWARE: Real Auth (Session Lookup) ---
app.use(async (req, res, next) => {
  // Skip auth for public routes
  const publicRoutes = ['/login', '/login2', '/login3', '/login4', '/', '/health'];
  if (publicRoutes.includes(req.path) || req.path.startsWith('/partials/login-')) {
    return next();
  }

  // Test mode: Allow bypass with test header (for automated testing)
  if (env.NODE_ENV === 'test' && req.headers['x-test-auth'] === 'bypass') {
    const testUserId = req.headers['x-test-user-id'] || 'test-user-id';
    const testVendorId = req.headers['x-test-vendor-id'] || env.DEMO_VENDOR_ID;
    
    req.user = {
      id: testUserId,
      email: 'test@example.com',
      displayName: 'Test User',
      vendorId: testVendorId,
      vendor: { id: testVendorId, name: 'Test Vendor' }
    };
    return next();
  }

  const sessionId = req.session.sessionId;

  if (!sessionId) {
    return res.redirect('/login');
  }

  try {
    // Lookup session in database
    const session = await vmpAdapter.getSession(sessionId);

    if (!session) {
      // Session not found or expired
      req.session = null;
      return res.redirect('/login');
    }

    // Load user context
    const userContext = await vmpAdapter.getVendorContext(session.user_id);

    if (!userContext || !userContext.is_active) {
      // User not found or inactive
      await vmpAdapter.deleteSession(sessionId);
      req.session = null;
      return res.redirect('/login');
    }

    // Set user on request
    req.user = {
      id: userContext.id,
      email: userContext.email,
      displayName: userContext.display_name || userContext.email,
      vendorId: userContext.vendor_id,
      vendor: userContext.vmp_vendors,
      isInternal: userContext.is_internal || false
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.session = null;
    return res.redirect('/login');
  }
});

// --- ROUTES ---

// Health check endpoint (for Vercel monitoring)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// 1. Landing Page (Public)
app.get('/', (req, res) => {
  res.render('pages/landing.html');
});

// 2. Home (Shell)
app.get('/home', async (req, res) => {
  // User is authenticated via middleware
  // Use req.user.vendorId for real data
  const vendorId = req.user?.vendorId || env.DEMO_VENDOR_ID;
  res.render('pages/home.html', {
    user: req.user,
    posture: 'action_required' // Mock
  });
});

// 2b. Home2 (Neural Console)
app.get('/home2', async (req, res) => {
  res.render('pages/home2.html', {
    user: req.user
  });
});

// 2c. Dashboard (Tactical Governance Surface)
app.get('/dashboard', async (req, res) => {
  res.render('pages/dashboard.html', {
    user: req.user
  });
});

// 2d. Home3 (Optimized Console)
app.get('/home3', async (req, res) => {
  try {
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    let cases = [];
    if (VENDOR_ID_HARDCODED) {
      try {
        const rawCases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);
        // Transform adapter data to match home3.html structure
        cases = rawCases.map(c => ({
          id: c.id,
          type: c.case_type || 'invoice',
          vendor: c.vmp_companies?.name || 'Unknown Vendor',
          channel: 'portal', // Default, can be enhanced with actual channel data
          status: c.status || 'open',
          owner: 'AP', // Default, can be enhanced with actual owner data
          sla: c.sla_due_at ? new Date(c.sla_due_at).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '—',
          summary: c.subject || 'No subject',
          detail_url: `/partials/case-detail?case_id=${c.id}`,
          steps: [], // Will be populated from case detail if needed
          thread: [], // Will be populated from case detail if needed
          pay: { outstanding: 'RM 0.00', next_run: '—', eta: '—' } // Default, can be enhanced
        }));
      } catch (error) {
        console.error('Error loading cases for home3:', error);
        // Continue with empty array
      }
    }

    res.render('pages/home3.html', {
      user: req.user,
      cases: cases
    });
  } catch (error) {
    console.error('Error rendering home3:', error);
    res.status(500).render('pages/home3.html', {
      user: req.user,
      cases: [],
      error: error.message
    });
  }
});

// 2e. Home4 (Unified Command Surface)
app.get('/home4', async (req, res) => {
  try {
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    let cases = [];
    let actionCount = 0;
    let openCount = 0;

    if (VENDOR_ID_HARDCODED) {
      try {
        const rawCases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);
        cases = rawCases.map(c => ({
          id: c.id,
          subject: c.subject || 'No subject',
          status: c.status || 'open',
          updated_at: c.updated_at,
          case_type: c.case_type || 'invoice',
          detail_url: `/partials/case-detail?case_id=${c.id}`
        }));

        // Calculate metrics
        actionCount = cases.filter(c => c.status === 'blocked' || c.status === 'waiting_supplier').length;
        openCount = cases.filter(c => c.status === 'open').length;
      } catch (error) {
        console.error('Error loading cases for home4:', error);
      }
    }

    res.render('pages/home4.html', {
      user: req.user,
      cases: cases,
      actionCount: actionCount,
      openCount: openCount
    });
  } catch (error) {
    console.error('Error rendering home4:', error);
    res.status(500).render('pages/home4.html', {
      user: req.user,
      cases: [],
      actionCount: 0,
      openCount: 0,
      error: error.message
    });
  }
});

// 2f. Home5 (Merged Unified Console v7)
app.get('/home5', async (req, res) => {
  try {
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    let actionCount = 0;
    let openCount = 0;
    let soaCount = 0;
    let paidCount = 0;

    if (VENDOR_ID_HARDCODED) {
      try {
        const rawCases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);

        // Calculate metrics
        actionCount = rawCases.filter(c => c.status === 'blocked' || c.status === 'waiting_supplier').length;
        openCount = rawCases.filter(c => c.status === 'open').length;
        soaCount = rawCases.filter(c => c.case_type === 'soa').length;
        paidCount = rawCases.filter(c => c.status === 'resolved' || c.status === 'paid').length;
      } catch (error) {
        console.error('Error loading metrics for home5:', error);
      }
    }

    res.render('pages/home5.html', {
      user: req.user,
      actionCount: actionCount,
      openCount: openCount,
      soaCount: soaCount,
      paidCount: paidCount
    });
  } catch (error) {
    console.error('Error rendering home5:', error);
    res.status(500).render('pages/home5.html', {
      user: req.user,
      actionCount: 0,
      openCount: 0,
      soaCount: 0,
      paidCount: 0,
      error: error.message
    });
  }
});

// 2. Partials (HTMX Cells)
app.get('/partials/case-inbox.html', async (req, res) => {
  try {
    // Fetch REAL data from Supabase
    // Note: For Day 1 without auth, hardcode the vendor_id from your seed data
    // run `select id from vmp_vendors` to get it.
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    if (!VENDOR_ID_HARDCODED) {
      return res.status(500).render('partials/case_inbox.html', {
        cases: [],
        error: 'DEMO_VENDOR_ID not configured. Please set it in your .env file.'
      });
    }

    const cases = await vmpAdapter.getInbox(VENDOR_ID_HARDCODED);
    res.render('partials/case_inbox.html', { cases });
  } catch (error) {
    console.error('Error loading case inbox:', error);
    res.status(500).render('partials/case_inbox.html', {
      cases: [],
      error: error.message
    });
  }
});

app.get('/partials/case-detail.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;

    if (!caseId) {
      return res.render('partials/case_detail.html', { 
        caseId: null, 
        caseDetail: null,
        isInternal: req.user?.isInternal || false
      });
    }

    if (!VENDOR_ID_HARDCODED) {
      return res.status(500).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        isInternal: req.user?.isInternal || false,
        error: 'DEMO_VENDOR_ID not configured'
      });
    }

    // Fetch case detail from adapter
    let caseDetail = null;
    try {
      caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
    } catch (adapterError) {
      console.error('Adapter error:', adapterError);
      // Continue with null caseDetail - template handles it gracefully
    }

    res.render('partials/case_detail.html', { 
      caseId, 
      caseDetail,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error loading case detail:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: null,
      caseDetail: null,
      error: error.message
    });
  }
});

// Case Thread Partial
app.get('/partials/case-thread.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_thread.html', { caseId: null, messages: [] });
    }

    // Fetch messages from adapter
    let messages = [];
    try {
      messages = await vmpAdapter.getMessages(caseId);
    } catch (adapterError) {
      console.error('Adapter error loading messages:', adapterError);
      // Continue with empty messages array
    }

    res.render('partials/case_thread.html', { caseId, messages });
  } catch (error) {
    console.error('Error loading case thread:', error);
    res.status(500).render('partials/case_thread.html', {
      caseId: req.query.case_id || null,
      messages: [],
      error: error.message
    });
  }
});

// Case Checklist Partial
app.get('/partials/case-checklist.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_checklist.html', { 
        caseId: null, 
        checklistSteps: [],
        isInternal: req.user?.isInternal || false
      });
    }

    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
    let checklistSteps = [];

    try {
      // Get case detail to determine case type
      let caseDetail = null;
      if (VENDOR_ID_HARDCODED) {
        try {
          caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
        } catch (adapterError) {
          console.error('Adapter error loading case for checklist:', adapterError);
        }
      }

      // Ensure checklist steps exist (create if missing based on case type)
      if (caseDetail && caseDetail.case_type) {
        try {
          checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
        } catch (ensureError) {
          console.error('Error ensuring checklist steps:', ensureError);
          // Try to get existing steps even if ensure failed
          try {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          } catch (getError) {
            console.error('Error getting checklist steps:', getError);
            // Continue with empty array
          }
        }
      } else {
        // Case type unknown, just get existing steps
        try {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        } catch (getError) {
          console.error('Error getting checklist steps:', getError);
          // Continue with empty array
        }
      }
    } catch (adapterError) {
      console.error('Adapter error loading checklist:', adapterError);
      // Continue with empty checklistSteps array
    }

    res.render('partials/case_checklist.html', { 
      caseId, 
      checklistSteps,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error loading case checklist:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.query.case_id || null,
      checklistSteps: [],
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// Case Evidence Partial
app.get('/partials/case-evidence.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    if (!caseId) {
      return res.render('partials/case_evidence.html', { caseId: null, evidence: [] });
    }

    // Fetch evidence from adapter
    let evidence = [];
    try {
      evidence = await vmpAdapter.getEvidence(caseId);

      // Generate signed URLs for each evidence file (in parallel for better performance)
      const urlPromises = evidence.map(async (ev) => {
        try {
          ev.download_url = await vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600); // 1 hour expiry
        } catch (urlError) {
          console.error(`Error generating signed URL for ${ev.storage_path}:`, urlError);
          ev.download_url = '#'; // Fallback
        }
      });
      await Promise.all(urlPromises);
    } catch (adapterError) {
      console.error('Adapter error loading evidence:', adapterError);
      // Continue with empty evidence array
    }

    res.render('partials/case_evidence.html', { caseId, evidence });
  } catch (error) {
    console.error('Error loading case evidence:', error);
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.query.case_id || null,
      evidence: [],
      error: error.message
    });
  }
});

// Escalation Partial
app.get('/partials/escalation.html', async (req, res) => {
  try {
    const caseId = req.query.case_id;
    let caseDetail = null;

    if (caseId) {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      if (VENDOR_ID_HARDCODED) {
        try {
          caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
        } catch (adapterError) {
          console.error('Adapter error loading case for escalation:', adapterError);
        }
      }
    }

    res.render('partials/escalation.html', { 
      caseId, 
      caseDetail,
      isInternal: req.user?.isInternal || false
    });
  } catch (error) {
    console.error('Error loading escalation:', error);
    res.status(500).render('partials/escalation.html', {
      caseId: req.query.case_id || null,
      caseDetail: null,
      isInternal: req.user?.isInternal || false,
      error: error.message
    });
  }
});

// POST: Create Message
app.post('/cases/:id/messages', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { body } = req.body;

    if (!caseId) {
      return res.status(400).render('partials/case_thread.html', {
        caseId: null,
        messages: [],
        error: 'Case ID is required'
      });
    }

    if (!body || !body.trim()) {
      // Return refreshed thread without error (just ignore empty message)
      try {
        const messages = await vmpAdapter.getMessages(caseId);
        return res.render('partials/case_thread.html', { caseId, messages });
      } catch (error) {
        return res.status(500).render('partials/case_thread.html', {
          caseId,
          messages: [],
          error: 'Failed to refresh thread'
        });
      }
    }

    // Get user context (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_thread.html', {
        caseId,
        messages: [],
        error: 'Authentication required'
      });
    }

    // Create message
    try {
      await vmpAdapter.createMessage(
        caseId,
        body.trim(),
        'vendor', // sender_type
        'portal', // channel_source
        user.id, // sender_user_id
        false // is_internal_note
      );
    } catch (createError) {
      console.error('Error creating message:', createError);
      // Still try to return refreshed thread
    }

    // Return refreshed thread with new message
    try {
      const messages = await vmpAdapter.getMessages(caseId);
      return res.render('partials/case_thread.html', { caseId, messages });
    } catch (error) {
      console.error('Error refreshing thread after message creation:', error);
      return res.status(500).render('partials/case_thread.html', {
        caseId,
        messages: [],
        error: 'Message created but failed to refresh thread'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/messages:', error);
    res.status(500).render('partials/case_thread.html', {
      caseId: req.params.id || null,
      messages: [],
      error: error.message
    });
  }
});

// POST: Upload Evidence
app.post('/cases/:id/evidence', upload.single('file'), async (req, res) => {
  try {
    const caseId = req.params.id;
    const { evidence_type, checklist_step_id } = req.body;
    const file = req.file;

    if (!caseId) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId: null,
        evidence: [],
        error: 'Case ID is required'
      });
    }

    if (!file) {
      // Return refreshed evidence without error (just ignore empty upload)
      try {
        const evidence = await vmpAdapter.getEvidence(caseId);
        // Generate signed URLs in parallel
        const urlPromises = evidence.map(async (ev) => {
          try {
            ev.download_url = await vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600);
          } catch (urlError) {
            ev.download_url = '#';
          }
        });
        await Promise.all(urlPromises);
        return res.render('partials/case_evidence.html', { caseId, evidence });
      } catch (error) {
        return res.status(500).render('partials/case_evidence.html', {
          caseId,
          evidence: [],
          error: 'Failed to refresh evidence'
        });
      }
    }

    if (!evidence_type) {
      return res.status(400).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence type is required'
      });
    }

    // Get user context (set by auth middleware)
    const user = req.user;
    if (!user) {
      return res.status(401).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Authentication required'
      });
    }

    // Verify case belongs to vendor (security check)
    const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
    if (VENDOR_ID_HARDCODED) {
      try {
        const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
        if (!caseDetail) {
          return res.status(404).render('partials/case_evidence.html', {
            caseId,
            evidence: [],
            error: 'Case not found'
          });
        }
      } catch (checkError) {
        return res.status(403).render('partials/case_evidence.html', {
          caseId,
          evidence: [],
          error: 'Access denied to this case'
        });
      }
    }

    // Upload evidence
    try {
      await vmpAdapter.uploadEvidence(
        caseId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        },
        evidence_type,
        checklist_step_id || null,
        'vendor',
        user.id
      );
    } catch (uploadError) {
      console.error('Error uploading evidence:', uploadError);
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: `Failed to upload evidence: ${uploadError.message}`
      });
    }

    // Return refreshed evidence and checklist
    try {
      // Get updated evidence
      const evidence = await vmpAdapter.getEvidence(caseId);
      // Generate signed URLs in parallel
      const urlPromises = evidence.map(async (ev) => {
        try {
          ev.download_url = await vmpAdapter.getEvidenceSignedUrl(ev.storage_path, 3600);
        } catch (urlError) {
          ev.download_url = '#';
        }
      });
      await Promise.all(urlPromises);

      // Return evidence partial (HTMX will refresh checklist separately)
      return res.render('partials/case_evidence.html', { caseId, evidence });
    } catch (error) {
      console.error('Error refreshing evidence after upload:', error);
      return res.status(500).render('partials/case_evidence.html', {
        caseId,
        evidence: [],
        error: 'Evidence uploaded but failed to refresh view'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/evidence:', error);
    res.status(500).render('partials/case_evidence.html', {
      caseId: req.params.id || null,
      evidence: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Verify Evidence
app.post('/cases/:id/verify-evidence', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { checklist_step_id } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can verify evidence
    if (!user.isInternal) {
      return res.status(403).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Only internal staff can verify evidence'
      });
    }

    if (!checklist_step_id) {
      return res.status(400).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'checklist_step_id is required'
      });
    }

    // Verify evidence
    try {
      await vmpAdapter.verifyEvidence(checklist_step_id, user.id);
    } catch (verifyError) {
      console.error('Error verifying evidence:', verifyError);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false,
        error: `Failed to verify evidence: ${verifyError.message}`
      });
    }

    // Day 11: Create notification for vendor (evidence verified)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_verified',
        'Evidence Verified',
        'Your evidence has been verified by internal staff.'
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail verification if notification fails
    }

    // Return refreshed checklist
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (VENDOR_ID_HARDCODED) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
          if (caseDetail && caseDetail.case_type) {
            checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
          } else {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          }
        } catch (error) {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        }
      } else {
        checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
      }

      return res.render('partials/case_checklist.html', { caseId, checklistSteps });
    } catch (error) {
      console.error('Error refreshing checklist after verify:', error);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Evidence verified but failed to refresh checklist'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/verify-evidence:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Reject Evidence
app.post('/cases/:id/reject-evidence', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { checklist_step_id, reason } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can reject evidence
    if (!user.isInternal) {
      return res.status(403).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Only internal staff can reject evidence'
      });
    }

    if (!checklist_step_id || !reason || !reason.trim()) {
      return res.status(400).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'checklist_step_id and reason are required'
      });
    }

    // Reject evidence
    try {
      await vmpAdapter.rejectEvidence(checklist_step_id, user.id, reason.trim());
    } catch (rejectError) {
      console.error('Error rejecting evidence:', rejectError);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        isInternal: req.user?.isInternal || false,
        error: `Failed to reject evidence: ${rejectError.message}`
      });
    }

    // Day 11: Create notification for vendor (evidence rejected)
    try {
      await vmpAdapter.notifyVendorUsersForCase(
        caseId,
        'evidence_rejected',
        'Evidence Rejected',
        `Your evidence was rejected. Reason: ${reason.trim()}`
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail rejection if notification fails
    }

    // Return refreshed checklist
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let checklistSteps = [];

      if (VENDOR_ID_HARDCODED) {
        try {
          const caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
          if (caseDetail && caseDetail.case_type) {
            checklistSteps = await vmpAdapter.ensureChecklistSteps(caseId, caseDetail.case_type);
          } else {
            checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
          }
        } catch (error) {
          checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
        }
      } else {
        checklistSteps = await vmpAdapter.getChecklistSteps(caseId);
      }

      return res.render('partials/case_checklist.html', { caseId, checklistSteps });
    } catch (error) {
      console.error('Error refreshing checklist after reject:', error);
      return res.status(500).render('partials/case_checklist.html', {
        caseId,
        checklistSteps: [],
        error: 'Evidence rejected but failed to refresh checklist'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/reject-evidence:', error);
    res.status(500).render('partials/case_checklist.html', {
      caseId: req.params.id || null,
      checklistSteps: [],
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Reassign Case
app.post('/cases/:id/reassign', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { owner_team } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can reassign cases
    if (!user.isInternal) {
      return res.status(403).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Only internal staff can reassign cases'
      });
    }

    if (!owner_team || !['procurement', 'ap', 'finance'].includes(owner_team)) {
      return res.status(400).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'owner_team must be one of: procurement, ap, finance'
      });
    }

    // Reassign case
    try {
      await vmpAdapter.reassignCase(caseId, owner_team, user.id);
    } catch (reassignError) {
      console.error('Error reassigning case:', reassignError);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: `Failed to reassign case: ${reassignError.message}`
      });
    }

    // Return refreshed case detail
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (VENDOR_ID_HARDCODED) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail });
    } catch (error) {
      console.error('Error refreshing case detail after reassign:', error);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Case reassigned but failed to refresh detail'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/reassign:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      error: error.message
    });
  }
});

// Day 9: Internal Ops - Update Case Status
app.post('/cases/:id/update-status', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { status } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).render('partials/case_detail.html', {
        caseId: null,
        caseDetail: null,
        error: 'Authentication required'
      });
    }

    // RBAC: Only internal users can update case status
    if (!user.isInternal) {
      return res.status(403).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Only internal staff can update case status'
      });
    }

    if (!status || !['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'].includes(status)) {
      return res.status(400).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked'
      });
    }

    // Update case status
    try {
      await vmpAdapter.updateCaseStatus(caseId, status, user.id);
    } catch (updateError) {
      console.error('Error updating case status:', updateError);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: `Failed to update case status: ${updateError.message}`
      });
    }

    // Return refreshed case detail
    try {
      const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
      let caseDetail = null;

      if (VENDOR_ID_HARDCODED) {
        caseDetail = await vmpAdapter.getCaseDetail(caseId, VENDOR_ID_HARDCODED);
      }

      return res.render('partials/case_detail.html', { caseId, caseDetail });
    } catch (error) {
      console.error('Error refreshing case detail after status update:', error);
      return res.status(500).render('partials/case_detail.html', {
        caseId,
        caseDetail: null,
        error: 'Case status updated but failed to refresh detail'
      });
    }
  } catch (error) {
    console.error('Error in POST /cases/:id/update-status:', error);
    res.status(500).render('partials/case_detail.html', {
      caseId: req.params.id || null,
      caseDetail: null,
      error: error.message
    });
  }
});

// 3. Login Pages (GET)
app.get('/login', (req, res) => {
  // If already logged in, redirect to home
  if (req.session?.sessionId) {
    return res.redirect('/home');
  }
  res.render('pages/login.html', { error: null });
});

// 3a. Login POST Handler
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('pages/login.html', {
        error: 'Email and password are required'
      });
    }

    // Get user by email
    const user = await vmpAdapter.getUserByEmail(email);

    if (!user) {
      return res.render('pages/login.html', {
        error: 'Invalid email or password'
      });
    }

    if (!user.is_active) {
      return res.render('pages/login.html', {
        error: 'Account is inactive. Please contact support.'
      });
    }

    // Verify password
    const isValid = await vmpAdapter.verifyPassword(user.id, password);

    if (!isValid) {
      return res.render('pages/login.html', {
        error: 'Invalid email or password'
      });
    }

    // Create session
    const { sessionId } = await vmpAdapter.createSession(user.id, {
      email: user.email,
      loginAt: new Date().toISOString()
    });

    // Set session cookie
    req.session.sessionId = sessionId;
    req.session.userId = user.id;

    // Redirect to home
    res.redirect('/home');
  } catch (error) {
    console.error('Login error:', error);
    res.render('pages/login.html', {
      error: 'An error occurred during login. Please try again.'
    });
  }
});

// 3b. Logout Handler
app.post('/logout', async (req, res) => {
  const sessionId = req.session?.sessionId;

  if (sessionId) {
    try {
      await vmpAdapter.deleteSession(sessionId);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  req.session = null;
  res.redirect('/login');
});

// 3b. Login2 (Unified Command Surface Login)
app.get('/login2', (req, res) => {
  res.render('pages/login2.html');
});

// 3c. Login3 (NOIR + Enterprise + Ops Truth)
app.get('/login3', (req, res) => {
  res.render('pages/login3.html');
});

// 3d. Login4 (Gatekeeper - Role-Aware Entry Ritual)
app.get('/login4', (req, res) => {
  res.render('pages/login4.html');
});

// 4. Login Partials (HTMX)
app.get('/partials/login-help-access.html', (req, res) => {
  res.render('partials/login-help-access.html');
});

app.get('/partials/login-help-sso.html', (req, res) => {
  res.render('partials/login-help-sso.html');
});

app.get('/partials/login-help-security.html', (req, res) => {
  res.render('partials/login-help-security.html');
});

app.post('/partials/login-mock-success.html', (req, res) => {
  res.render('partials/login-mock-success.html');
});

app.post('/partials/login-mock-magic-sent.html', (req, res) => {
  res.render('partials/login-mock-magic-sent.html');
});

app.get('/partials/login-mock-forgot.html', (req, res) => {
  res.render('partials/login-mock-forgot.html');
});

app.get('/partials/login-mock-sso.html', (req, res) => {
  res.render('partials/login-mock-sso.html');
});

app.get('/partials/login-mock-passkey.html', (req, res) => {
  res.render('partials/login-mock-passkey.html');
});

app.get('/partials/login-gate-ritual.html', (req, res) => {
  res.render('partials/login-gate-ritual.html');
});

// 5. Test page (for debugging)
app.get('/test', (req, res) => {
  try {
    res.render('pages/test.html');
  } catch (error) {
    console.error('Error rendering test page:', error);
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});

// 6. Supabase UI Examples (for reference)
app.get('/examples', (req, res) => {
  try {
    res.render('pages/examples.html');
  } catch (error) {
    console.error('Error rendering examples page:', error);
    res.status(500).send(`
            <h1>Error loading examples</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 7. Components Showcase (new Supabase components)
app.get('/components', (req, res) => {
  try {
    res.render('pages/components-showcase.html');
  } catch (error) {
    console.error('Error rendering components showcase:', error);
    res.status(500).send(`
            <h1>Error loading components showcase</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 8. Snippets Test Page (IDE code generation testing)
app.get('/snippets-test', (req, res) => {
  try {
    res.render('pages/snippets-test.html');
  } catch (error) {
    console.error('Error rendering snippets test page:', error);
    res.status(500).send(`
            <h1>Error loading snippets test page</h1>
            <pre>${error.message}</pre>
            <p>Check server console for details.</p>
        `);
  }
});

// 9. Testing routes for partials (Design System isolation testing)
// Per .cursorrules Section 5: All partials should be testable independently via direct URL
app.get('/partials/file-upload-dropzone.html', (req, res) => {
  res.render('partials/file_upload_dropzone.html', {
    maxSize: 10485760,
    acceptedTypes: [],
    multiple: false
  });
});

app.get('/partials/avatar-component.html', (req, res) => {
  res.render('partials/avatar-component.html');
});

app.get('/partials/oauth-github-button.html', (req, res) => {
  res.render('partials/oauth-github-button.html');
});

app.get('/partials/supabase-ui-examples.html', (req, res) => {
  res.render('partials/supabase-ui-examples.html');
});

// --- ERROR HANDLING ---
// 404 handler
app.use((req, res) => {
  res.status(404).render('pages/error.html', {
    error: {
      status: 404,
      message: 'Page not found',
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).render('pages/error.html', {
    error: {
      status: err.status || 500,
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
});

// --- START ---
// Export app for Vercel
export default app;

// Keep listen for local development (skip in test environment)
if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
  const PORT = parseInt(env.PORT, 10);
  app.listen(PORT, () => {
    console.log(`NexusCanon VMP (Phase 0) running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}
