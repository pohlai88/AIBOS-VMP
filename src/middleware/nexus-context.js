/**
 * Nexus Context Middleware
 *
 * Handles tenant context loading, validation, and role switching.
 * Philosophy: Everyone is a Tenant. Context determines whether viewing as client or vendor.
 */

import { nexusAdapter } from '../adapters/nexus-adapter.js';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Load Nexus session from cookie
 * Populates req.nexus with session, user, tenant, and context data
 */
export async function loadNexusSession(req, res, next) {
  try {
    const sessionId = req.cookies?.nexus_session;

    if (!sessionId) {
      req.nexus = null;
      return next();
    }

    const session = await nexusAdapter.getSession(sessionId);

    if (!session) {
      // Clear invalid cookie
      res.clearCookie('nexus_session');
      req.nexus = null;
      return next();
    }

    // Load tenant contexts
    const contexts = await nexusAdapter.getTenantContexts(session.tenant_id);

    // Load unread counts (graceful - returns defaults if view missing)
    let unreadCounts = { total: 0, payment: 0, case: 0, critical: 0 };
    try {
      unreadCounts = await nexusAdapter.getUnreadCount(session.user_id);
    } catch (countError) {
      console.warn('Could not load unread counts:', countError.message);
    }

    // Populate req.nexus
    req.nexus = {
      session,
      user: session.user,
      tenant: session.tenant,

      // IDs for easy access
      userId: session.user_id,
      tenantId: session.tenant_id,
      tenantClientId: session.tenant.tenant_client_id,
      tenantVendorId: session.tenant.tenant_vendor_id,

      // Active context
      activeContext: session.active_context,           // 'client' | 'vendor'
      activeContextId: session.active_context_id,      // TC-* or TV-*
      activeCounterparty: session.active_counterparty, // Counterparty TNT-*

      // All contexts
      contexts,
      hasDualContext: contexts.hasDualContext,

      // For determining what to show
      facing: session.active_context === 'vendor' ? 'up' : 'down',

      // Unread counts (for badges)
      unread: unreadCounts
    };

    // Update session last_active_at
    await nexusAdapter.serviceClient
      .from('nexus_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', sessionId);

    next();
  } catch (error) {
    console.error('Error loading Nexus session:', error);
    req.nexus = null;
    next();
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Require authenticated Nexus session
 * Redirects to /nexus/login if not authenticated
 */
export function requireNexusAuth(req, res, next) {
  if (!req.nexus?.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/nexus/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

/**
 * Require specific tenant role
 * @param {string[]} roles - Allowed roles ('owner', 'admin', 'member', 'viewer')
 */
export function requireNexusRole(...roles) {
  return (req, res, next) => {
    if (!req.nexus?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.nexus.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Require tenant context (simplified for template routes)
 * Sets req.tenantId and req.userId from session
 * Use this in template-generated routes for consistent tenant isolation
 */
export function requireTenant(req, res, next) {
  if (!req.nexus?.tenant) {
    return res.status(401).json({ error: 'Tenant context required' });
  }
  
  // Set for easy access in route handlers
  req.tenantId = req.nexus.tenantId;
  req.userId = req.nexus.userId;
  
  next();
}

/**
 * Require active context to be set
 *
 * Usage patterns:
 *   - requireNexusContext - auto-selects context (legacy/portal)
 *   - requireNexusContext('client') - requires client context (TC-*)
 *   - requireNexusContext('vendor') - requires vendor context (TV-*)
 *
 * Redirects to Role Dashboard if dual-context tenant hasn't selected
 */
export function requireNexusContext(requiredContext) {
  // Support both factory and direct middleware patterns
  // If called with req/res/next directly (legacy), treat as no required context
  if (requiredContext && typeof requiredContext === 'object' && requiredContext.nexus !== undefined) {
    // Called as direct middleware: requireNexusContext(req, res, next)
    return requireNexusContextMiddleware(null)(requiredContext, arguments[1], arguments[2]);
  }

  // Called as factory: requireNexusContext('client') or requireNexusContext()
  return requireNexusContextMiddleware(requiredContext);
}

/**
 * Internal middleware factory for context requirement
 */
function requireNexusContextMiddleware(requiredContext) {
  return (req, res, next) => {
    if (!req.nexus?.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/nexus/login');
    }

    // If dual-context and no active context, redirect to role dashboard
    if (req.nexus.hasDualContext && !req.nexus.activeContext) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Context selection required', redirect: '/nexus/portal' });
      }
      return res.redirect('/nexus/portal');
    }

    // Single context tenants auto-select
    if (!req.nexus.activeContext) {
      if (req.nexus.contexts.hasVendorContext) {
        req.nexus.activeContext = 'vendor';
        req.nexus.activeContextId = req.nexus.tenantVendorId;
        req.nexus.facing = 'up';
      } else {
        req.nexus.activeContext = 'client';
        req.nexus.activeContextId = req.nexus.tenantClientId;
        req.nexus.facing = 'down';
      }
    }

    // Enforce required context if specified
    if (requiredContext) {
      const hasRequiredContext = requiredContext === 'client'
        ? req.nexus.contexts?.hasClientContext
        : req.nexus.contexts?.hasVendorContext;

      if (!hasRequiredContext) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: `${requiredContext} context required`,
            message: `You do not have ${requiredContext} access`
          });
        }
        return res.status(403).render('nexus/pages/error.html', {
          error: {
            status: 403,
            message: `Access denied. You do not have ${requiredContext} privileges.`
          }
        });
      }

      // Force the required context as active
      if (requiredContext === 'client') {
        req.nexus.activeContext = 'client';
        req.nexus.activeContextId = req.nexus.tenantClientId;
        req.nexus.facing = 'down';
      } else if (requiredContext === 'vendor') {
        req.nexus.activeContext = 'vendor';
        req.nexus.activeContextId = req.nexus.tenantVendorId;
        req.nexus.facing = 'up';
      }
    }

    next();
  };
}

// ============================================================================
// CASE ACCESS MIDDLEWARE
// ============================================================================

/**
 * Require access to a specific case
 * Validates that current tenant is client or vendor of the case
 * Sets req.nexus.caseContext with role info
 */
export async function requireCaseAccess(req, res, next) {
  const caseId = req.params.caseId || req.params.id;

  if (!caseId) {
    return res.status(400).json({ error: 'Case ID required' });
  }

  if (!req.nexus?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const caseData = await nexusAdapter.getCaseById(caseId);

    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Check if tenant is client or vendor of this case
    const isClient = caseData.client_id === req.nexus.tenantClientId;
    const isVendor = caseData.vendor_id === req.nexus.tenantVendorId;

    if (!isClient && !isVendor) {
      // Return 404 (anti-enumeration)
      return res.status(404).json({ error: 'Case not found' });
    }

    // Set case context
    req.nexus.caseContext = {
      case: caseData,
      isClient,
      isVendor,
      myRole: isClient ? 'client' : 'vendor',
      myContextId: isClient ? req.nexus.tenantClientId : req.nexus.tenantVendorId
    };

    next();
  } catch (error) {
    console.error('Error checking case access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Require access to a specific payment
 * Validates that current tenant is payer (client) or payee (vendor)
 */
export async function requirePaymentAccess(req, res, next) {
  const paymentId = req.params.paymentId || req.params.id;

  if (!paymentId) {
    return res.status(400).json({ error: 'Payment ID required' });
  }

  if (!req.nexus?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { data: payment } = await nexusAdapter.serviceClient
      .from('nexus_payments')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check if tenant is payer or payee
    const isPayer = payment.from_id === req.nexus.tenantClientId;
    const isPayee = payment.to_id === req.nexus.tenantVendorId;

    if (!isPayer && !isPayee) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    req.nexus.paymentContext = {
      payment,
      isPayer,
      isPayee,
      myRole: isPayer ? 'payer' : 'payee'
    };

    next();
  } catch (error) {
    console.error('Error checking payment access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTEXT SWITCHING
// ============================================================================

/**
 * Switch active context
 * @param {object} req - Express request with nexus session
 * @param {string} context - 'client' or 'vendor'
 * @param {string} counterpartyId - Optional specific counterparty TNT-*
 */
export async function switchContext(req, context, counterpartyId = null) {
  if (!req.nexus?.session) {
    throw new Error('No active session');
  }

  const tenant = req.nexus.tenant;

  let contextId;
  if (context === 'client') {
    contextId = tenant.tenant_client_id;
  } else if (context === 'vendor') {
    contextId = tenant.tenant_vendor_id;
  } else {
    throw new Error('Invalid context');
  }

  // Update session
  await nexusAdapter.updateSessionContext(req.nexus.session.id, {
    activeContext: context,
    activeContextId: contextId,
    activeCounterparty: counterpartyId
  });

  // Update req.nexus
  req.nexus.activeContext = context;
  req.nexus.activeContextId = contextId;
  req.nexus.activeCounterparty = counterpartyId;
  req.nexus.facing = context === 'vendor' ? 'up' : 'down';
}

// ============================================================================
// VIEW HELPERS
// ============================================================================

/**
 * Get view locals for Nexus templates
 * @param {object} req - Express request
 * @returns {object} Template locals
 */
export function getNexusLocals(req) {
  if (!req.nexus) {
    return {
      nexus: null,
      user: null,
      tenant: null,
      context: null
    };
  }

  return {
    nexus: req.nexus,
    user: req.nexus.user,
    tenant: req.nexus.tenant,
    context: {
      active: req.nexus.activeContext,
      activeId: req.nexus.activeContextId,
      facing: req.nexus.facing,
      counterparty: req.nexus.activeCounterparty,
      hasDual: req.nexus.hasDualContext
    },
    contexts: req.nexus.contexts,
    unread: req.nexus.unread,

    // Helper for context badge text
    contextBadge: req.nexus.activeContext === 'vendor'
      ? `▲ SERVING${req.nexus.activeCounterparty ? ': ' + req.nexus.activeCounterparty : ''}`
      : `▼ MANAGING${req.nexus.contexts?.vendorCount ? ': ' + req.nexus.contexts.vendorCount + ' vendors' : ''}`,

    // Helper for determining which nav to show
    isVendorContext: req.nexus.activeContext === 'vendor',
    isClientContext: req.nexus.activeContext === 'client'
  };
}

/**
 * Inject Nexus locals into all responses
 * Use after loadNexusSession
 */
export function injectNexusLocals(req, res, next) {
  res.locals = {
    ...res.locals,
    ...getNexusLocals(req)
  };
  next();
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} Match result
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// LOGIN / LOGOUT HELPERS
// ============================================================================

/**
 * Create session and set cookie
 * @param {object} res - Express response
 * @param {object} user - User object
 * @param {object} tenant - Tenant object
 * @param {object} [authSession] - Optional Supabase Auth session with tokens
 * @returns {Promise<object>} Created session
 */
export async function createNexusSession(res, user, tenant, authSession = null) {
  // Determine initial context
  const contexts = await nexusAdapter.getTenantContexts(tenant.tenant_id);

  let activeContext = null;
  let activeContextId = null;

  // If single context, auto-select
  if (!contexts.hasDualContext) {
    if (contexts.hasVendorContext) {
      activeContext = 'vendor';
      activeContextId = tenant.tenant_vendor_id;
    } else if (contexts.hasClientContext) {
      activeContext = 'client';
      activeContextId = tenant.tenant_client_id;
    }
  }
  // If dual context, leave null to show Role Dashboard

  // Build session data with optional auth tokens
  const sessionData = {};
  if (authSession) {
    sessionData.authToken = authSession.access_token;
    sessionData.refreshToken = authSession.refresh_token;
    sessionData.authExpiresAt = authSession.expires_at;
  }

  const session = await nexusAdapter.createSession({
    userId: user.user_id,
    tenantId: tenant.tenant_id,
    activeContext,
    activeContextId,
    data: sessionData
  });

  // Set cookie
  res.cookie('nexus_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  return session;
}

/**
 * Destroy session and clear cookie
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export async function destroyNexusSession(req, res) {
  if (req.nexus?.session?.id) {
    await nexusAdapter.deleteSession(req.nexus.session.id);
  }
  res.clearCookie('nexus_session');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  loadNexusSession,
  requireNexusAuth,
  requireNexusRole,
  requireNexusContext,
  requireCaseAccess,
  requirePaymentAccess,
  switchContext,
  getNexusLocals,
  injectNexusLocals,
  hashPassword,
  verifyPassword,
  createNexusSession,
  destroyNexusSession
};
