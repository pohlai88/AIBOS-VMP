/**
 * Nexus Portal Routes
 *
 * All routes for the Nexus tenant portal at /nexus/*
 * Completely separate from legacy vmp_* routes
 */

import express from 'express';
import { nexusAdapter } from '../adapters/nexus-adapter.js';
import {
  loadNexusSession,
  requireNexusAuth,
  requireNexusContext,
  requireCaseAccess,
  requirePaymentAccess,
  injectNexusLocals,
  switchContext,
  hashPassword,
  verifyPassword,
  createNexusSession,
  destroyNexusSession,
} from '../middleware/nexus-context.js';

const router = express.Router();

// ============================================================================
// RATE LIMITING (in-memory, simple)
// ============================================================================

/**
 * Simple in-memory rate limiter for sensitive endpoints
 * Prevents accidental loops from melting auth
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_PER_SESSION = 30;
const RATE_LIMIT_MAX_PER_IP = 60;

function checkRateLimit(key, maxRequests) {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  // Reset if window expired
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  return entry.count <= maxRequests;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ============================================================================

// Apply Nexus middleware to all routes
router.use(loadNexusSession);
router.use(injectNexusLocals);

// ============================================================================
// PUBLIC ROUTES (No Auth Required)
// ============================================================================

/**
 * GET /nexus/login
 * Login page
 */
router.get('/login', (req, res) => {
  if (req.nexus?.user) {
    return res.redirect('/nexus/portal');
  }
  res.render('nexus/pages/login.html', {
    redirect: req.query.redirect || '/nexus/portal'
  });
});

/**
 * POST /nexus/login
 * Process login - supports both Supabase Auth and legacy bcrypt
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await nexusAdapter.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    let authSession = null;

    // Try Supabase Auth first if user is linked
    if (user.auth_user_id) {
      try {
        const authData = await nexusAdapter.signInWithPassword(email, password);

        // CRITICAL: Inject Nexus identity into JWT app_metadata for RLS
        // This enables jwt_nexus_user_id() and jwt_nexus_tenant_id() in RLS policies
        // Refresh MUST succeed - we never return the stale pre-metadata session
        const { session: refreshedSession } = await nexusAdapter.setAuthAppMetadata(
          user.auth_user_id,
          user.user_id,      // USR-* from DB lookup (not client input)
          user.tenant_id,    // TNT-* from DB lookup (not client input)
          authData.session.refresh_token  // Exchange for new JWT with metadata
        );

        // ALWAYS use refreshed session (contains nexus_user_id in JWT)
        // setAuthAppMetadata throws if refresh fails, so this is guaranteed
        authSession = refreshedSession;

        // Production-safe audit log (no secrets, high debug value)
        console.log('[AUTH] Login success:', {
          auth_uid: user.auth_user_id?.slice(0, 8) + '...',
          nexus_user_id: user.user_id,
          nexus_tenant_id: user.tenant_id,
          claims_ok: true
        });
      } catch (authError) {
        // Check if this is a refresh failure vs auth failure
        if (authError.message?.includes('Session refresh failed')) {
          console.error('Login succeeded but session refresh failed:', authError.message);
          return res.status(500).json({ error: 'Login succeeded but session could not be established. Please retry.' });
        }
        console.log('Supabase Auth failed, trying legacy bcrypt:', authError.message);
        // Fall back to bcrypt
      }
    }

    // Fall back to legacy bcrypt if Supabase Auth failed or not linked
    if (!authSession && user.password_hash) {
      const validPassword = await verifyPassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else if (!authSession) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session with auth tokens if available
    await createNexusSession(res, user, user.tenant, authSession);

    // Update last login
    await nexusAdapter.updateUser(user.user_id, {
      last_login_at: new Date().toISOString()
    });

    const redirect = req.body.redirect || '/nexus/portal';

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, redirect });
    }

    res.redirect(redirect);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /nexus/sign-up
 * Sign up page with role selection
 */
router.get('/sign-up', (req, res) => {
  if (req.nexus?.user) {
    return res.redirect('/nexus/portal');
  }
  res.render('nexus/pages/sign-up.html', {
    inviteToken: req.query.token
  });
});

/**
 * POST /nexus/sign-up
 * Process sign up - creates both Supabase Auth and nexus_users entries
 */
router.post('/sign-up', async (req, res) => {
  try {
    const {
      name, email, password, phone,
      role,           // 'client' or 'vendor'
      clientCode      // Required if role === 'vendor'
    } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['client', 'vendor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role selection' });
    }

    // Check if email already exists
    const existingUser = await nexusAdapter.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create tenant
    const tenant = await nexusAdapter.createTenant({
      name,
      email,
      phone,
      metadata: { signUpRole: role }
    });

    // Create Supabase Auth user first
    let authUser = null;
    try {
      authUser = await nexusAdapter.createAuthUser({
        email,
        password,
        metadata: {
          display_name: name,
          tenant_id: tenant.tenant_id,
          role: 'owner',
          data_source: 'production'
        }
      });
      // Note: app_metadata will be set after we have the real user_id below
    } catch (authError) {
      console.error('Failed to create Supabase Auth user:', authError.message);
      // Continue with bcrypt fallback
    }

    // Create nexus user (keep password_hash for backward compatibility)
    const passwordHash = await hashPassword(password);
    const user = await nexusAdapter.createUser({
      tenantId: tenant.tenant_id,
      email,
      passwordHash,
      displayName: name,
      role: 'owner',
      authUserId: authUser?.id  // Link to Supabase Auth if created
    });

    // Set app_metadata with actual user_id for RLS (no refresh needed - user will login next)
    // The JWT refresh happens in the login route when user signs in
    if (authUser?.id && user?.user_id) {
      try {
        await nexusAdapter.setAuthAppMetadata(
          authUser.id,
          user.user_id,      // Real USR-* ID from DB
          tenant.tenant_id   // TNT-* from DB
          // No refresh token - sign-up doesn't create a session
        );
      } catch (metadataError) {
        console.warn('Failed to set app_metadata:', metadataError.message);
      }
    }


    // If signing up as vendor, handle client linkage
    if (role === 'vendor' && clientCode) {
      // Try to find client by code (TC-* or TNT-*)
      const clientTenant = await nexusAdapter.getTenantById(clientCode);

      if (clientTenant) {
        // Create relationship (pending if we want approval, or active for auto-approve)
        await nexusAdapter.createRelationship(
          clientTenant.tenant_client_id,  // Client
          tenant.tenant_vendor_id,         // Vendor (new tenant)
          { status: 'active' }             // Auto-approve for now
        );

        // Notify client
        const clientUsers = await nexusAdapter.getUsersByTenant(clientTenant.tenant_id);
        for (const clientUser of clientUsers) {
          await nexusAdapter.createNotification({
            userId: clientUser.user_id,
            tenantId: clientTenant.tenant_id,
            type: 'vendor_linked',
            title: `${name} has joined as your vendor`,
            body: `${name} registered and linked to your organization.`,
            actionUrl: '/nexus/relationships'
          });
        }
      } else {
        // Client not found - show polite message (privacy preserving)
        // Store the request for later
        await nexusAdapter.serviceClient
          .from('nexus_relationship_invites')
          .insert({
            token: nexusAdapter.generateId('REQ'),
            inviting_tenant_id: tenant.tenant_id,
            inviting_client_id: clientCode,  // Store the code they entered
            invitee_email: email,
            invitee_name: name,
            status: 'pending',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
      }
    }

    // Create session
    await createNexusSession(res, user, tenant);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        redirect: '/nexus/portal',
        message: role === 'vendor' && !clientCode
          ? 'Account created. You can link to a client later.'
          : 'Account created successfully.'
      });
    }

    res.redirect('/nexus/portal');
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /nexus/accept
 * Accept invitation page
 */
router.get('/accept', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.render('nexus/pages/accept.html', { error: 'Invalid invitation link' });
    }

    const invite = await nexusAdapter.getInviteByToken(String(token));

    if (!invite) {
      return res.render('nexus/pages/accept.html', { error: 'Invitation not found' });
    }

    if (invite.status !== 'pending') {
      return res.render('nexus/pages/accept.html', { error: 'Invitation already used' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.render('nexus/pages/accept.html', { error: 'Invitation expired' });
    }

    res.render('nexus/pages/accept.html', {
      invite,
      clientName: invite.inviting_tenant?.name || 'Unknown'
    });
  } catch (error) {
    console.error('Accept page error:', error);
    res.render('nexus/pages/accept.html', { error: 'Something went wrong' });
  }
});

/**
 * POST /nexus/accept
 * Process invitation acceptance
 */
router.post('/accept', async (req, res) => {
  try {
    const { token, name, email, password, phone } = req.body;

    if (!token || !name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordHash = await hashPassword(password);

    const { tenant, user } = await nexusAdapter.acceptInvite(token, {
      name,
      phone
    }, {
      email,
      passwordHash,
      displayName: name,
      phone
    });

    // Create session
    await createNexusSession(res, user, tenant);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, redirect: '/nexus/portal' });
    }

    res.redirect('/nexus/portal');
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept invitation' });
  }
});

/**
 * POST /nexus/logout
 * Logout
 */
router.post('/logout', async (req, res) => {
  await destroyNexusSession(req, res);
  res.redirect('/nexus/login');
});

router.get('/logout', async (req, res) => {
  // Also sign out from Supabase Auth if session has auth token
  if (req.nexus?.session?.data?.authToken) {
    try {
      await nexusAdapter.signOut(req.nexus.session.data.authToken);
    } catch (e) {
      console.log('Supabase signout error (ignored):', e.message);
    }
  }
  await destroyNexusSession(req, res);
  res.redirect('/nexus/login');
});

// ============================================================================
// OAUTH ROUTES
// Note: Specific routes (/callback, /exchange, /token) MUST come before
// the wildcard /:provider route to avoid matching "callback" as a provider
// ============================================================================

/**
 * GET /nexus/oauth/callback
 * Render callback page that handles both code (PKCE) and token (implicit) flows
 * The page will extract tokens from URL fragment and POST to /nexus/oauth/token
 * MUST be defined BEFORE /oauth/:provider
 */
router.get('/oauth/callback', async (req, res) => {
  // If we have a code in query params, process it server-side
  const { code, error: oauthError, error_description } = req.query;

  if (oauthError) {
    console.error('OAuth error:', oauthError, error_description);
    return res.redirect(`/nexus/login?error=${oauthError}`);
  }

  if (code && typeof code === 'string') {
    // PKCE flow - exchange code server-side
    try {
      const result = await handleOAuthSession(res, code, null);
      if (result.redirect) {
        return res.redirect(result.redirect);
      }
    } catch (error) {
      console.error('OAuth code exchange error:', error);
      return res.redirect('/nexus/login?error=oauth_failed');
    }
  }

  // Render the callback page - it will handle fragment tokens client-side
  res.render('nexus/pages/oauth_callback.html');
});

/**
 * GET /nexus/oauth/exchange
 * Handle code exchange redirect from callback page
 * MUST be defined BEFORE /oauth/:provider
 */
router.get('/oauth/exchange', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect('/nexus/login?error=no_code');
    }

    const result = await handleOAuthSession(res, code, null);
    res.redirect(result.redirect || '/nexus/portal');
  } catch (error) {
    console.error('OAuth exchange error:', error);
    res.redirect('/nexus/login?error=oauth_failed');
  }
});

/**
 * POST /nexus/oauth/token
 * Handle token submission from client-side (implicit flow)
 */
router.post('/oauth/token', express.json(), async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'No access token provided' });
    }

    const result = await handleOAuthSession(res, null, access_token);

    if (result.needsProfile) {
      // Store pending OAuth data in cookie
      res.cookie('nexus_oauth_pending', JSON.stringify(result.pendingData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      return res.json({ success: true, redirect: '/nexus/complete-profile' });
    }

    res.json({ success: true, redirect: result.redirect || '/nexus/portal' });
  } catch (error) {
    console.error('OAuth token error:', error);
    res.status(500).json({ error: 'Failed to process OAuth token' });
  }
});

/**
 * GET /nexus/oauth/:provider
 * Initiate OAuth flow for a provider (google, github, etc.)
 * MUST be defined AFTER specific routes like /oauth/callback, /oauth/exchange
 */
router.get('/oauth/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const validProviders = ['google', 'github', 'azure', 'microsoft'];

    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid OAuth provider' });
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const redirectTo = `${baseUrl}/nexus/oauth/callback`;

    const { url } = await nexusAdapter.getOAuthUrl(provider, redirectTo);
    res.redirect(url);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.redirect('/nexus/login?error=oauth_init_failed');
  }
});

/**
 * Shared helper to handle OAuth session creation
 * @param {Response} res - Express response (for setting cookies)
 * @param {string|null} code - Authorization code (PKCE flow)
 * @param {string|null} accessToken - Access token (implicit flow)
 * @returns {Promise<{redirect?: string, needsProfile?: boolean, pendingData?: object}>}
 */
async function handleOAuthSession(res, code, accessToken) {
  let authData;
  let authUser;

  if (code) {
    // PKCE flow - exchange code for tokens
    authData = await nexusAdapter.exchangeOAuthCode(code);
    authUser = authData.user;
  } else if (accessToken) {
    // Implicit flow - verify token and get user
    authUser = await nexusAdapter.verifyAuthToken(accessToken);
    if (!authUser) {
      throw new Error('Invalid access token');
    }
    authData = { session: { access_token: accessToken } };
  } else {
    throw new Error('No code or access token provided');
  }

  // Check if nexus_user exists for this auth user
  let nexusUser = await nexusAdapter.getUserByAuthId(authUser.id);

  if (!nexusUser) {
    // First-time OAuth user - check if email exists in nexus_users
    nexusUser = await nexusAdapter.getUserByEmail(authUser.email);

    if (nexusUser) {
      // Link existing nexus_user to this auth user
      await nexusAdapter.linkAuthUser(nexusUser.user_id, authUser.id);
    } else {
      // Brand new user - needs to complete profile
      return {
        needsProfile: true,
        pendingData: {
          authUserId: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
          accessToken: authData.session.access_token,
          refreshToken: authData.session?.refresh_token
        }
      };
    }
  }

  // Create session
  await createNexusSession(res, nexusUser, nexusUser.tenant, authData.session);

  // Update last login
  await nexusAdapter.updateUser(nexusUser.user_id, {
    last_login_at: new Date().toISOString()
  });

  return { redirect: '/nexus/portal' };
}

/**
 * GET /nexus/complete-profile
 * Complete profile for first-time OAuth users
 */
router.get('/complete-profile', (req, res) => {
  const pendingData = req.cookies.nexus_oauth_pending;
  if (!pendingData) {
    return res.redirect('/nexus/sign-up');
  }

  try {
    const pending = JSON.parse(pendingData);
    res.render('nexus/pages/complete-profile.html', {
      email: pending.email,
      name: pending.name
    });
  } catch (e) {
    res.redirect('/nexus/sign-up');
  }
});

/**
 * POST /nexus/complete-profile
 * Process profile completion for OAuth users
 */
router.post('/complete-profile', async (req, res) => {
  try {
    const pendingData = req.cookies.nexus_oauth_pending;
    if (!pendingData) {
      return res.status(400).json({ error: 'No pending OAuth session' });
    }

    const pending = JSON.parse(pendingData);
    const { name, phone, role, clientCode } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    // Create tenant
    const tenant = await nexusAdapter.createTenant({
      name,
      email: pending.email,
      phone,
      metadata: { signUpRole: role, oauthProvider: true }
    });

    // Create nexus user linked to OAuth auth user
    const user = await nexusAdapter.createUser({
      tenantId: tenant.tenant_id,
      email: pending.email,
      displayName: name,
      phone,
      role: 'owner',
      authUserId: pending.authUserId,
      emailVerified: true  // OAuth emails are verified
    });

    // Handle client linkage for vendors
    if (role === 'vendor' && clientCode) {
      const clientTenant = await nexusAdapter.getTenantById(clientCode);
      if (clientTenant) {
        await nexusAdapter.createRelationship(
          clientTenant.tenant_client_id,
          tenant.tenant_vendor_id,
          { status: 'active' }
        );
      }
    }

    // Clear pending cookie
    res.clearCookie('nexus_oauth_pending');

    // Create session
    await createNexusSession(res, user, tenant, {
      access_token: pending.accessToken,
      refresh_token: pending.refreshToken
    });

    res.json({ success: true, redirect: '/nexus/portal' });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// ============================================================================
// PASSWORD RESET ROUTES
// ============================================================================

/**
 * GET /nexus/forgot-password
 * Forgot password page
 */
router.get('/forgot-password', (req, res) => {
  res.render('nexus/pages/forgot-password.html', {
    success: req.query.success === 'true',
    error: req.query.error
  });
});

/**
 * POST /nexus/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists and is linked to Supabase Auth
    const user = await nexusAdapter.getUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists - always show success
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
    }

    if (!user.auth_user_id) {
      // User exists but not linked to Supabase Auth - can't use password reset
      // For security, still show success message
      console.log(`Password reset requested for non-OAuth user: ${email}`);
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
    }

    // Send password reset via Supabase Auth
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    await nexusAdapter.sendPasswordResetEmail(email, `${baseUrl}/nexus/reset-password`);

    res.json({ success: true, message: 'Password reset email sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Don't reveal errors to prevent email enumeration
    res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
  }
});

/**
 * GET /nexus/reset-password
 * Password reset page (from email link)
 */
router.get('/reset-password', async (req, res) => {
  const { access_token, type, error: resetError } = req.query;

  if (resetError) {
    return res.render('nexus/pages/reset-password.html', {
      error: 'Password reset link is invalid or expired.'
    });
  }

  if (!access_token || typeof access_token !== 'string' || type !== 'recovery') {
    return res.render('nexus/pages/reset-password.html', {
      error: 'Invalid password reset link.'
    });
  }

  // Verify the token
  const authUser = await nexusAdapter.verifyAuthToken(access_token);
  if (!authUser) {
    return res.render('nexus/pages/reset-password.html', {
      error: 'Password reset link has expired.'
    });
  }

  res.render('nexus/pages/reset-password.html', {
    accessToken: access_token,
    email: authUser.email
  });
});

/**
 * POST /nexus/reset-password
 * Process password reset
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { accessToken, password } = req.body;

    if (!accessToken || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Update password via Supabase Auth
    await nexusAdapter.updateAuthPassword(accessToken, password);

    res.json({ success: true, message: 'Password updated successfully.', redirect: '/nexus/login' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. The link may have expired.' });
  }
});

// ============================================================================
// PROTECTED ROUTES (Auth Required)
// ============================================================================

/**
 * GET /nexus/portal
 * Role Dashboard (for dual-context tenants) or redirect to inbox
 */
router.get('/portal', requireNexusAuth, async (req, res) => {
  // If dual context and no active context, show Role Dashboard
  if (req.nexus.hasDualContext && !req.nexus.activeContext) {
    // Get stats for each context
    const clientCases = await nexusAdapter.getCasesByContext(
      req.nexus.tenantClientId, 'down', { limit: 1 }
    );
    const vendorCases = await nexusAdapter.getCasesByContext(
      req.nexus.tenantVendorId, 'up', { limit: 1 }
    );

    const clientPayments = await nexusAdapter.getPaymentsByContext(
      req.nexus.tenantClientId, 'down', { status: 'pending' }
    );
    const vendorPayments = await nexusAdapter.getPaymentsByContext(
      req.nexus.tenantVendorId, 'up', { status: 'pending' }
    );

    return res.render('nexus/pages/role-dashboard.html', {
      clientStats: {
        vendorCount: req.nexus.contexts.vendorCount,
        caseCount: clientCases.pagination.total,
        pendingPayments: clientPayments.length,
        pendingAmount: clientPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
      },
      vendorStats: {
        clientCount: req.nexus.contexts.clientCount,
        caseCount: vendorCases.pagination.total,
        pendingPayments: vendorPayments.length,
        pendingAmount: vendorPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
      }
    });
  }

  // Single context or context already selected - redirect to inbox
  res.redirect('/nexus/inbox');
});

/**
 * POST /nexus/portal/switch
 * Switch context
 */
router.post('/portal/switch', requireNexusAuth, async (req, res) => {
  try {
    const { context, counterpartyId } = req.body;

    if (!['client', 'vendor'].includes(context)) {
      return res.status(400).json({ error: 'Invalid context' });
    }

    await switchContext(req, context, counterpartyId);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true });
    }

    res.redirect('/nexus/inbox');
  } catch (error) {
    console.error('Switch context error:', error);
    res.status(500).json({ error: 'Failed to switch context' });
  }
});

// ============================================================================
// INBOX ROUTES
// ============================================================================

/**
 * GET /nexus/inbox
 * Unified case inbox
 */
router.get('/inbox', requireNexusAuth, requireNexusContext, async (req, res) => {
  try {
    const { status, priority, search, page } = req.query;

    const result = await nexusAdapter.getCasesByContext(
      req.nexus.activeContextId,
      req.nexus.facing,
      {
        status: status ? String(status) : undefined,
        priority: priority ? String(priority) : undefined,
        search: search ? String(search) : undefined,
        page: parseInt(String(page)) || 1
      }
    );

    res.render('nexus/pages/inbox.html', {
      cases: result.cases,
      pagination: result.pagination,
      filters: { status, priority, search }
    });
  } catch (error) {
    console.error('Inbox error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load inbox' });
  }
});

// ============================================================================
// CASE ROUTES
// ============================================================================

/**
 * GET /nexus/cases/:id
 * Case detail page
 */
router.get('/cases/:id', requireNexusAuth, requireCaseAccess, async (req, res) => {
  try {
    const caseData = req.nexus.caseContext.case;

    // Mark messages as read
    await nexusAdapter.markMessagesRead(caseData.case_id, req.nexus.userId);

    res.render('nexus/pages/case-detail.html', {
      case: caseData,
      myRole: req.nexus.caseContext.myRole,
      isClient: req.nexus.caseContext.isClient,
      isVendor: req.nexus.caseContext.isVendor,
      activeTab: req.query.tab || 'overview'
    });
  } catch (error) {
    console.error('Case detail error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load case' });
  }
});

/**
 * GET /nexus/cases/:id/thread
 * Case thread partial (HTMX)
 */
router.get('/cases/:id/thread', requireNexusAuth, requireCaseAccess, async (req, res) => {
  try {
    const messages = await nexusAdapter.getCaseMessages(req.params.id);

    res.render('nexus/partials/case-thread.html', {
      messages,
      caseId: req.params.id,
      myRole: req.nexus.caseContext.myRole
    });
  } catch (error) {
    console.error('Thread error:', error);
    res.status(500).send('Failed to load messages');
  }
});

/**
 * POST /nexus/cases/:id/messages
 * Send message to case
 */
router.post('/cases/:id/messages', requireNexusAuth, requireCaseAccess, async (req, res) => {
  try {
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Message body required' });
    }

    const message = await nexusAdapter.createMessage({
      caseId: req.params.id,
      senderUserId: req.nexus.userId,
      senderTenantId: req.nexus.tenantId,
      senderContext: req.nexus.caseContext.myRole,
      senderContextId: req.nexus.caseContext.myContextId,
      body: body.trim()
    });

    // Create notification for other party
    const caseData = req.nexus.caseContext.case;
    const otherPartyId = req.nexus.caseContext.isClient
      ? caseData.vendor_id
      : caseData.client_id;

    // Get other party's tenant
    const otherTenant = await nexusAdapter.getTenantById(otherPartyId);
    if (otherTenant) {
      const otherUsers = await nexusAdapter.getUsersByTenant(otherTenant.tenant_id);
      for (const user of otherUsers) {
        await nexusAdapter.createNotification({
          userId: user.user_id,
          tenantId: otherTenant.tenant_id,
          type: 'message_received',
          title: `New message in ${caseData.subject}`,
          body: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
          referenceType: 'case',
          referenceId: caseData.case_id,
          actionUrl: `/nexus/cases/${caseData.case_id}?tab=thread`
        });
      }
    }

    // Get sender info for display
    const sender = await nexusAdapter.getUser(req.nexus.userId);

    // Return HTML partial for HTMX, or JSON for API calls
    if (req.headers['hx-request']) {
      // Clear the "No messages yet" empty state and return the message HTML
      res.render('nexus/partials/single-message.html', {
        message,
        senderName: sender?.display_name || sender?.email || 'You',
        nexus: req.nexus
      });
    } else {
      res.json({ success: true, message });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /nexus/cases/new
 * Create new case
 */
router.post('/cases/new', requireNexusAuth, requireNexusContext, async (req, res) => {
  try {
    const { vendorId, subject, description, caseType, priority } = req.body;

    if (!vendorId || !subject) {
      return res.status(400).json({ error: 'Vendor and subject required' });
    }

    // Verify relationship exists
    const relationships = req.nexus.contexts.asClient;
    const relationship = relationships.find(r => r.vendor_id === vendorId);

    if (!relationship) {
      return res.status(400).json({ error: 'No relationship with this vendor' });
    }

    const caseData = await nexusAdapter.createCase({
      clientId: req.nexus.tenantClientId,
      vendorId: vendorId,
      relationshipId: relationship.id,
      subject,
      description,
      caseType: caseType || 'general',
      priority: priority || 'normal'
    });

    // Notify vendor
    const vendorTenant = await nexusAdapter.getTenantById(vendorId);
    if (vendorTenant) {
      const vendorUsers = await nexusAdapter.getUsersByTenant(vendorTenant.tenant_id);
      for (const user of vendorUsers) {
        await nexusAdapter.createNotification({
          userId: user.user_id,
          tenantId: vendorTenant.tenant_id,
          type: 'case_created',
          title: `New case: ${subject}`,
          body: description?.substring(0, 100),
          referenceType: 'case',
          referenceId: caseData.case_id,
          actionUrl: `/nexus/cases/${caseData.case_id}`
        });
      }
    }

    res.json({ success: true, case: caseData, redirect: `/nexus/cases/${caseData.case_id}` });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

/**
 * GET /nexus/payments
 * Payment dashboard
 */
router.get('/payments', requireNexusAuth, requireNexusContext, async (req, res) => {
  try {
    const { status } = req.query;

    const rawPayments = await nexusAdapter.getPaymentsByContext(
      req.nexus.activeContextId,
      req.nexus.facing,
      { status }
    );

    // Convert amount strings to numbers for template math operations
    const payments = rawPayments.map(p => ({
      ...p,
      amount: parseFloat(p.amount) || 0
    }));

    // Calculate pending summary in JavaScript (more reliable than Nunjucks filters)
    const pendingPayments = payments.filter(p => p.status === 'pending');
    const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    res.render('nexus/pages/payments.html', {
      payments,
      filters: { status },
      isPayer: req.nexus.facing === 'down',  // Client pays
      isPayee: req.nexus.facing === 'up',    // Vendor receives
      pendingSummary: {
        count: pendingPayments.length,
        total: pendingTotal
      }
    });
  } catch (error) {
    console.error('Payments error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load payments' });
  }
});

/**
 * GET /nexus/payments/:id
 * Payment detail
 */
router.get('/payments/:id', requireNexusAuth, requirePaymentAccess, async (req, res) => {
  try {
    const payment = req.nexus.paymentContext.payment;

    res.render('nexus/pages/payment-detail.html', {
      payment,
      isPayer: req.nexus.paymentContext.isPayer,
      isPayee: req.nexus.paymentContext.isPayee
    });
  } catch (error) {
    console.error('Payment detail error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load payment' });
  }
});

/**
 * POST /nexus/payments/:id/status
 * Update payment status
 */
router.post('/payments/:id/status', requireNexusAuth, requirePaymentAccess, async (req, res) => {
  try {
    const { status } = req.body;
    const payment = req.nexus.paymentContext.payment;

    // Validate status transition
    const allowedStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await nexusAdapter.updatePaymentStatus(payment.payment_id, status);

    // Notify other party
    const otherPartyId = req.nexus.paymentContext.isPayer ? payment.to_id : payment.from_id;
    const otherTenant = await nexusAdapter.getTenantById(otherPartyId);

    if (otherTenant) {
      const otherUsers = await nexusAdapter.getUsersByTenant(otherTenant.tenant_id);
      for (const user of otherUsers) {
        await nexusAdapter.createNotification({
          userId: user.user_id,
          tenantId: otherTenant.tenant_id,
          type: `payment_${status}`,
          priority: 'critical',
          title: `Payment ${status}: ${payment.payment_id}`,
          body: `Payment of ${payment.currency} ${payment.amount} is now ${status}`,
          referenceType: 'payment',
          referenceId: payment.payment_id,
          actionUrl: `/nexus/payments/${payment.payment_id}`
        });
      }
    }

    res.json({ success: true, payment: updated });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// ============================================================================
// RELATIONSHIP ROUTES
// ============================================================================

/**
 * GET /nexus/relationships
 * Relationship management
 */
router.get('/relationships', requireNexusAuth, async (req, res) => {
  try {
    const relationships = await nexusAdapter.getTenantRelationships(req.nexus.tenantId);

    // Get pending invites sent by this tenant
    const { data: sentInvites } = await nexusAdapter.serviceClient
      .from('nexus_relationship_invites')
      .select('*')
      .eq('inviting_tenant_id', req.nexus.tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    res.render('nexus/pages/relationships.html', {
      asClient: relationships.asClient,    // My vendors
      asVendor: relationships.asVendor,    // My clients
      sentInvites: sentInvites || []
    });
  } catch (error) {
    console.error('Relationships error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load relationships' });
  }
});

/**
 * POST /nexus/relationships/invite
 * Send vendor invitation
 */
router.post('/relationships/invite', requireNexusAuth, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const invite = await nexusAdapter.createRelationshipInvite(
      req.nexus.tenantId,
      email,
      { inviteeName: name }
    );

    // TODO: Send email with invite link
    const inviteLink = `${process.env.BASE_URL || 'http://localhost:3000'}/nexus/accept?token=${invite.token}`;

    res.json({
      success: true,
      invite,
      inviteLink  // For now, return link directly
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

/**
 * GET /nexus/notifications
 * Notifications page
 */
router.get('/notifications', requireNexusAuth, async (req, res) => {
  try {
    const notifications = await nexusAdapter.getNotifications(req.nexus.userId, {
      limit: 100
    });

    res.render('nexus/pages/notifications.html', {
      notifications
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load notifications' });
  }
});

/**
 * GET /nexus/api/notifications/unread
 * Get unread count (for badge updates)
 */
router.get('/api/notifications/unread', requireNexusAuth, async (req, res) => {
  try {
    const counts = await nexusAdapter.getUnreadCount(req.nexus.userId);
    res.json(counts);
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

/**
 * POST /nexus/api/notifications/read
 * Mark notifications as read
 */
router.post('/api/notifications/read', requireNexusAuth, async (req, res) => {
  try {
    const { notificationIds } = req.body;

    const count = await nexusAdapter.markNotificationsRead(
      req.nexus.userId,
      notificationIds || []
    );

    res.json({ success: true, count });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ============================================================================
// REALTIME CONFIG ENDPOINT
// ============================================================================

/**
 * GET /nexus/api/realtime-config
 * Returns Supabase URL and anon key for client-side realtime
 * SECURITY: Never exposes service role key - only public anon key
 */
router.get('/api/realtime-config', (req, res) => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('Realtime Config: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return res.status(503).json({ error: 'Realtime not configured' });
  }

  res.json({
    url,
    anonKey
    // NEVER include SUPABASE_SERVICE_ROLE_KEY here!
  });
});

/**
 * GET /nexus/api/realtime-token
 * Returns short-lived access token for browser Supabase Realtime authentication
 *
 * SECURITY:
 * - Requires valid session cookie (authenticated users only)
 * - Returns access_token only (never refresh_token)
 * - Token contains RLS claims (nexus_user_id, nexus_tenant_id)
 * - Auto-refreshes if token is expired or about to expire
 * - Returns 401 if no valid token (forces re-login, no anon fallback)
 * - Rate limited: 30/min per session, 60/min per IP
 */
router.get('/api/realtime-token', requireNexusAuth, async (req, res) => {
  try {
    // Rate limiting - prevent accidental loops from melting auth
    const sessionId = req.nexus?.session?.id;
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    if (sessionId && !checkRateLimit(`session:${sessionId}`, RATE_LIMIT_MAX_PER_SESSION)) {
      return res.status(429).json({
        error: 'Too many requests',
        hint: 'Please wait before requesting another token.',
        retryAfter: 60
      });
    }

    if (!checkRateLimit(`ip:${clientIp}`, RATE_LIMIT_MAX_PER_IP)) {
      return res.status(429).json({
        error: 'Too many requests from this IP',
        hint: 'Please wait before requesting another token.',
        retryAfter: 60
      });
    }

    const session = req.nexus?.session;
    const sessionData = session?.data || {};

    if (!sessionData.authToken) {
      // User logged in via legacy bcrypt (no Supabase auth) - realtime unavailable
      // Return 401 to force re-login, NOT 400 (don't mask as "bad request")
      return res.status(401).json({
        error: 'No auth token available',
        hint: 'Realtime requires Supabase Auth. Please re-login.',
        code: 'LEGACY_AUTH'
      });
    }

    // Check if token is expired or expiring soon
    // Threshold: 5 minutes + random jitter (0-60s) to prevent thundering herd
    const jitter = Math.floor(Math.random() * 60);
    const expiringThreshold = 5 * 60 + jitter;

    let currentExpiresAt = sessionData.authExpiresAt || 0;
    const now = Math.floor(Date.now() / 1000);

    let accessToken = sessionData.authToken;

    if (currentExpiresAt - now < expiringThreshold) {
      // Token is expired or expiring soon - refresh it
      if (!sessionData.refreshToken) {
        return res.status(401).json({
          error: 'Token expired and no refresh token available',
          hint: 'Please re-login to continue using realtime features.',
          code: 'TOKEN_EXPIRED'
        });
      }

      try {
        const { data: refreshData, error: refreshError } = await nexusAdapter.serviceClient.auth.refreshSession({
          refresh_token: sessionData.refreshToken
        });

        if (refreshError || !refreshData?.session?.access_token) {
          console.warn('[REALTIME-TOKEN] Refresh failed:', refreshError?.message);
          return res.status(401).json({
            error: 'Token refresh failed',
            hint: 'Please re-login to continue using realtime features.',
            code: 'REFRESH_FAILED'
          });
        }

        // Update session with new tokens
        await nexusAdapter.updateSession(session.id, {
          data: {
            ...sessionData,
            authToken: refreshData.session.access_token,
            refreshToken: refreshData.session.refresh_token,
            authExpiresAt: refreshData.session.expires_at
          }
        });

        accessToken = refreshData.session.access_token;
        currentExpiresAt = refreshData.session.expires_at;
        console.log('[REALTIME-TOKEN] Token refreshed for user:', req.nexus.userId);
      } catch (refreshErr) {
        console.error('[REALTIME-TOKEN] Refresh error:', refreshErr);
        return res.status(500).json({ error: 'Token refresh failed' });
      }
    }

    // Return only access_token and expiry (NEVER refresh_token)
    res.json({
      access_token: accessToken,
      expires_at: currentExpiresAt
    });
  } catch (error) {
    console.error('[REALTIME-TOKEN] Error:', error);
    res.status(500).json({ error: 'Failed to get realtime token' });
  }
});

// ============================================================================
// SETTINGS ROUTES
// ============================================================================

/**
 * GET /nexus/settings
 * Settings page
 */
router.get('/settings', requireNexusAuth, async (req, res) => {
  try {
    // Get user notification preferences
    const { data: prefs } = await nexusAdapter.serviceClient
      .from('nexus_user_notification_prefs')
      .select('*')
      .eq('user_id', req.nexus.userId)
      .single();

    // Get tenant config (for admin)
    const { data: tenantConfig } = await nexusAdapter.serviceClient
      .from('nexus_notification_config')
      .select('*')
      .eq('tenant_id', req.nexus.tenantId)
      .single();

    res.render('nexus/pages/settings.html', {
      notificationPrefs: prefs || {},
      tenantConfig: tenantConfig || {},
      isAdmin: ['owner', 'admin'].includes(req.nexus.user.role)
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).render('nexus/pages/error.html', { error: 'Failed to load settings' });
  }
});

/**
 * POST /nexus/settings/notifications
 * Update notification preferences
 */
router.post('/settings/notifications', requireNexusAuth, async (req, res) => {
  try {
    const { realtime_enabled, push_enabled, email_enabled, email_digest_mode } = req.body;

    await nexusAdapter.serviceClient
      .from('nexus_user_notification_prefs')
      .upsert({
        user_id: req.nexus.userId,
        tenant_id: req.nexus.tenantId,
        realtime_enabled,
        push_enabled,
        email_enabled,
        email_digest_mode,
        updated_at: new Date().toISOString()
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Update prefs error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
