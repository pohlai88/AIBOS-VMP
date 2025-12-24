import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import pdfParse from 'pdf-parse';
import ExcelJS from 'exceljs';
import {
  DatabaseError,
  TimeoutError,
  StorageError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  handleSupabaseError,
  logError,
} from '../utils/errors.js';
import { getCachedMetrics, setCachedMetrics, invalidateCache } from '../utils/sla-cache.js';
dotenv.config();

// Validate required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required Supabase configuration. ' +
      'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
  );
}

// Create Supabase client with timeout configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'vmp-adapter',
    },
  },
  // Note: Supabase JS client doesn't directly support timeout,
  // so we'll wrap queries with Promise.race for timeout handling
});

// Timeout wrapper for async operations
// Uses structured error handling per Supabase best practices
const withTimeout = async (promise, timeoutMs = 10000, operationName = 'operation') => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId); // Clear timeout if promise resolves first
    return result;
  } catch (error) {
    clearTimeout(timeoutId); // Clear timeout on error
    logError(error, { operation: operationName, timeoutMs });
    throw error;
  }
};

export const vmpAdapter = {
  // Auth: Get user by email
  async getUserByEmail(email) {
    // Try with all columns first (if migrations have been applied)
    let queryPromise = supabase
      .from('vmp_vendor_users')
      .select(
        'id, email, password_hash, vendor_id, display_name, is_active, phone, notification_preferences'
      )
      .eq('email', email.toLowerCase().trim())
      .single();

    let { data, error } = await withTimeout(queryPromise, 10000, `getUserByEmail(${email})`);

    // If phone or notification_preferences columns don't exist, fall back to basic columns
    const errorMessage = error?.message || error?.details || '';
    const missingColumnError =
      error &&
      (error.code === '42703' ||
        errorMessage.includes('phone') ||
        errorMessage.includes('notification_preferences') ||
        (errorMessage.includes('column') && errorMessage.includes('does not exist')));

    if (missingColumnError) {
      // Fall back to query with only columns that definitely exist
      queryPromise = supabase
        .from('vmp_vendor_users')
        .select('id, email, password_hash, vendor_id, display_name, is_active')
        .eq('email', email.toLowerCase().trim())
        .single();

      const result = await withTimeout(queryPromise, 10000, `getUserByEmail(${email})`);
      data = result.data;
      error = result.error;

      // Set default values for missing columns
      if (data) {
        data.phone = null;
        data.notification_preferences = null;
      }
    }

    if (error) {
      const handledError = handleSupabaseError(error, 'getUserByEmail');
      if (handledError === null) {
        // PGRST116 - No rows returned (not an error)
        return null;
      }
      throw handledError;
    }
    return data;
  },

  // Auth: Verify password
  async verifyPassword(userId, password) {
    const queryPromise = supabase
      .from('vmp_vendor_users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `verifyPassword(${userId})`);

    if (error || !data) {
      return false;
    }

    if (!data.password_hash) {
      // User has no password set (should set one via invite flow)
      return false;
    }

    return await bcrypt.compare(password, data.password_hash);
  },

  // Auth: Create session
  async createSession(userId, sessionData = {}) {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    const queryPromise = supabase
      .from('vmp_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        data: sessionData,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `createSession(${userId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'createSession');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create session', error);
    }
    return { sessionId, expiresAt, data };
  },

  // Auth: Get session
  async getSession(sessionId) {
    if (!sessionId) return null;

    const queryPromise = supabase
      .from('vmp_sessions')
      .select('id, user_id, expires_at, data')
      .eq('id', sessionId)
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `getSession(${sessionId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getSession');
      if (handledError === null) {
        // PGRST116 - Session not found (not an error)
        return null;
      }
      throw handledError;
    }

    // Check if session is expired
    if (new Date(data.expires_at) < new Date()) {
      // Auto-delete expired session
      await this.deleteSession(sessionId);
      return null;
    }

    return data;
  },

  // Auth: Delete session
  async deleteSession(sessionId) {
    if (!sessionId) return;

    const queryPromise = supabase.from('vmp_sessions').delete().eq('id', sessionId);

    const { error } = await withTimeout(queryPromise, 10000, `deleteSession(${sessionId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'deleteSession');
      // Log but don't throw - session might already be deleted
      if (handledError && handledError.code !== 'NOT_FOUND') {
        logError(handledError, { operation: 'deleteSession', sessionId });
      }
    }
  },

  // Auth: Clean expired sessions
  async cleanExpiredSessions() {
    const queryPromise = supabase
      .from('vmp_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    const { error } = await withTimeout(queryPromise, 10000, 'cleanExpiredSessions()');

    if (error) {
      const handledError = handleSupabaseError(error, 'cleanExpiredSessions');
      if (handledError) {
        logError(handledError, { operation: 'cleanExpiredSessions' });
      }
    }
  },

  // Auth: Create password reset token (following Supabase best practices)
  // Token expires after 1 hour (3600 seconds) per Supabase default
  async createPasswordResetToken(email) {
    if (!email) {
      throw new ValidationError('Email is required', 'email');
    }

    // 1. Find user by email
    const user = await this.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists (security best practice)
      return null;
    }

    // 2. Invalidate any existing unused tokens for this user
    await supabase
      .from('vmp_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // 3. Generate secure token (32 bytes = 64 hex characters)
    const token = randomBytes(32).toString('hex');

    // 4. Set expiration to 1 hour from now (following Supabase default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // 5. Create reset token
    const queryPromise = supabase
      .from('vmp_password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `createPasswordResetToken(${email})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'createPasswordResetToken');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create password reset token', error);
    }

    return {
      token: data.token,
      expiresAt: data.expires_at,
      userId: data.user_id,
      email: user.email,
    };
  },

  // Auth: Verify password reset token
  async verifyPasswordResetToken(token) {
    if (!token) {
      throw new ValidationError('Token is required', 'token');
    }

    const queryPromise = supabase
      .from('vmp_password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, 'verifyPasswordResetToken()');

    if (error) {
      const handledError = handleSupabaseError(error, 'verifyPasswordResetToken');
      if (handledError === null) {
        // Token not found
        return null;
      }
      throw handledError;
    }

    // Check if token is expired
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    // Check if token has already been used
    if (data.used_at) {
      return null;
    }

    return {
      tokenId: data.id,
      userId: data.user_id,
      expiresAt: data.expires_at,
    };
  },

  // Auth: Update password using reset token
  async updatePasswordWithToken(token, newPassword) {
    if (!token) {
      throw new ValidationError('Token is required', 'token');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', 'password');
    }

    // 1. Verify token
    const tokenData = await this.verifyPasswordResetToken(token);
    if (!tokenData) {
      throw new ValidationError('Invalid or expired reset token', 'token');
    }

    // 2. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3. Update user password (using transaction-like approach)
    const updateUserPromise = supabase
      .from('vmp_vendor_users')
      .update({ password_hash: passwordHash })
      .eq('id', tokenData.userId)
      .select('id, email')
      .single();

    const { data: userData, error: updateError } = await withTimeout(
      updateUserPromise,
      10000,
      'updatePasswordWithToken()'
    );

    if (updateError) {
      const handledError = handleSupabaseError(updateError, 'updatePasswordWithToken');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to update password', updateError);
    }

    // 4. Mark token as used
    await supabase
      .from('vmp_password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.tokenId);

    // 5. Invalidate all user sessions (security best practice)
    await supabase.from('vmp_sessions').delete().eq('user_id', tokenData.userId);

    return {
      userId: userData.id,
      email: userData.email,
    };
  },

  // Phase 1: Context Loading (Updated to use Supabase Auth)
  async getVendorContext(authUserId) {
    // Validate UUID format before calling Supabase
    if (!authUserId || typeof authUserId !== 'string') {
      throw new ValidationError('authUserId is required and must be a string', 'authUserId');
    }

    // Check UUID format (Supabase Auth user IDs are UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(authUserId)) {
      throw new ValidationError(
        `authUserId must be a valid UUID format, got: ${authUserId}`,
        'authUserId'
      );
    }

    // Development mode: Handle special dev UUID (00000000-0000-0000-0000-000000000000)
    // This allows dev mode to bypass Supabase Auth while still using getVendorContext
    const DEV_AUTH_UUID = '00000000-0000-0000-0000-000000000000';
    if (authUserId === DEV_AUTH_UUID && process.env.NODE_ENV === 'development') {
      // Return mock context for development mode
      // Try to get vendor from DEMO_VENDOR_ID if available
      let vendor = null;
      const devVendorId = process.env.DEMO_VENDOR_ID;
      if (devVendorId) {
        try {
          vendor = await this.getVendorById(devVendorId);
        } catch (error) {
          // If vendor lookup fails, use fallback
          vendor = {
            id: devVendorId,
            name: 'Development Vendor',
            tenant_id: devVendorId,
          };
        }
      }

      return {
        id: 'dev-user-id',
        email: 'dev@example.com',
        display_name: 'Development User',
        vendor_id: vendor?.id || null,
        tenant_id: vendor?.tenant_id || null,
        vmp_vendors: vendor,
        user_tier: 'institutional',
        is_internal: false,
        is_active: true,
      };
    }

    // Get user from Supabase Auth using admin client
    // Note: Requires service role key for admin operations
    const adminClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.admin.getUserById(authUserId);

    if (authError || !user) {
      const handledError = handleSupabaseError(
        authError || new Error('User not found'),
        'getVendorContext'
      );
      if (handledError === null) {
        return null;
      }
      throw handledError;
    }

    // Check user tier from metadata
    const userTier = user.user_metadata?.user_tier || 'institutional';
    const DEFAULT_INDEPENDENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

    // Handle independent users (no vendor required)
    if (userTier === 'independent') {
      // Get vendor_user record (without vendor_id) (with timeout protection)
      const vendorUserQuery = supabase
        .from('vmp_vendor_users')
        .select('*')
        .eq('email', user.email)
        .eq('user_tier', 'independent')
        .is('vendor_id', null)
        .single();

      const { data: vendorUser, error: vendorUserError } = await withTimeout(
        vendorUserQuery,
        10000,
        `getVendorContext-independent(${user.email})`
      );

      if (vendorUserError || !vendorUser) {
        const handledError = handleSupabaseError(
          vendorUserError || new Error('Vendor user not found'),
          'getVendorContext-independent'
        );
        if (handledError === null) {
          return null;
        }
        throw handledError;
      }

      // Return context with default tenant for independent users
      return {
        id: vendorUser.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || vendorUser.display_name || user.email,
        vendor_id: null,
        tenant_id: DEFAULT_INDEPENDENT_TENANT_ID,
        vmp_vendors: null,
        user_tier: 'independent',
        is_internal: false,
        is_active: vendorUser.is_active !== false,
      };
    }

    // Institutional users (existing logic)
    const vendorId = user.user_metadata?.vendor_id;
    if (!vendorId) {
      throw new ValidationError('Institutional user missing vendor_id in metadata');
    }

    // Get vendor details
    const vendor = await this.getVendorById(vendorId);
    if (!vendor) {
      throw new NotFoundError(`Vendor not found: ${vendorId}`);
    }

    // Get vendor_user record to check is_internal from database (fallback to user_metadata)
    // IMPORTANT: Select 'id' to return the vendor_user ID, not the auth user ID (with timeout protection)
    const vendorUserQuery = supabase
      .from('vmp_vendor_users')
      .select('id, is_internal, is_active')
      .eq('email', user.email)
      .eq('vendor_id', vendorId)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid throwing on no match

    const { data: vendorUser, error: vendorUserError } = await withTimeout(
      vendorUserQuery,
      10000,
      `getVendorContext-vendorUser(${user.email}, ${vendorId})`
    );

    if (vendorUserError && vendorUserError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is handled below
      const handledError = handleSupabaseError(vendorUserError, 'getVendorContext-vendorUser');
      if (handledError) {
        throw handledError;
      }
    }

    if (!vendorUser) {
      // Vendor user not found - this is an error for institutional users
      throw new NotFoundError(
        `Vendor user not found for email: ${user.email}, vendor_id: ${vendorId}`
      );
    }

    // Check is_internal from database first, then fallback to user_metadata
    const isInternal =
      vendorUser.is_internal === true || user.user_metadata?.is_internal === true || false;
    const isActive = vendorUser.is_active !== false && user.user_metadata?.is_active !== false;

    // Return context in same format as before for compatibility
    // IMPORTANT: Return vendor_user.id, not auth user.id
    return {
      id: vendorUser.id, // vendor_user ID (for database operations)
      email: user.email,
      display_name: user.user_metadata?.display_name || user.email,
      vendor_id: vendorId,
      tenant_id: vendor.tenant_id,
      is_active: isActive,
      is_internal: isInternal,
      user_tier: 'institutional',
      vmp_vendors: vendor,
    };
  },

  // Phase 2: Inbox Cell Data
  async getInbox(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getInbox requires a vendorId parameter', 'vendorId');
    }

    const queryPromise = supabase
      .from('vmp_cases')
      .select(
        `
                id, subject, status, sla_due_at, updated_at, case_type,
                vmp_companies ( name ),
                evidence_count:vmp_evidence(count)
            `
      )
      .eq('vendor_id', vendorId)
      .order('updated_at', { ascending: false }); // WhatsApp sorting

    const { data, error } = await withTimeout(queryPromise, 10000, `getInbox(${vendorId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getInbox');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch inbox', error, { vendorId });
    }

    // Normalize evidence_count from Supabase nested count format [{count: N}] to number
    const normalizedData = (data || []).map(caseItem => {
      if (
        caseItem.evidence_count &&
        Array.isArray(caseItem.evidence_count) &&
        caseItem.evidence_count.length > 0
      ) {
        return {
          ...caseItem,
          evidence_count: caseItem.evidence_count[0].count || 0,
        };
      }
      return {
        ...caseItem,
        evidence_count: 0,
      };
    });

    return normalizedData;
  },

  // Phase 2: Case Detail Cell Data
  async getCaseDetail(caseId, vendorId) {
    if (!caseId || !vendorId) {
      throw new ValidationError(
        'getCaseDetail requires both caseId and vendorId parameters',
        null,
        { caseId, vendorId }
      );
    }

    // Security check: ensure case belongs to vendor
    // Sprint 8.1: Include assigned user information
    const queryPromise = supabase
      .from('vmp_cases')
      .select(
        `
                *,
                vmp_companies (id, name, group_id),
                assigned_user:assigned_to_user_id (
                    id,
                    email,
                    display_name
                )
            `
      )
      .eq('id', caseId)
      .eq('vendor_id', vendorId)
      .single();

    const { data: caseData, error } = await withTimeout(
      queryPromise,
      10000,
      `getCaseDetail(${caseId}, ${vendorId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getCaseDetail');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch case detail', error, { caseId, vendorId });
    }

    if (!caseData) {
      return null;
    }

    return caseData;
  },

  // Sprint 8.1: Get Case Activity Feed (Combines messages, decisions, evidence, status changes)
  async getCaseActivity(caseId) {
    if (!caseId) {
      throw new ValidationError('getCaseActivity requires a caseId parameter', 'caseId');
    }

    const activities = [];

    // 1. Get messages
    try {
      const messages = await this.getMessages(caseId);
      if (messages && messages.length > 0) {
        messages.forEach(msg => {
          activities.push({
            type: 'message',
            timestamp: msg.created_at,
            actor: msg.sender_party,
            action: 'sent message',
            details: msg.body,
            channel: msg.channel_source,
          });
        });
      }
    } catch (msgError) {
      console.error('Error fetching messages for activity:', msgError);
    }

    // 2. Get decision log entries
    try {
      const decisionQuery = supabase
        .from('vmp_decision_log')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      const { data: decisions, error: decisionError } = await withTimeout(
        decisionQuery,
        10000,
        `getCaseActivity-decisions(${caseId})`
      );

      if (!decisionError && decisions) {
        decisions.forEach(decision => {
          activities.push({
            type: 'decision',
            timestamp: decision.created_at,
            actor: decision.who,
            action: decision.decision_type,
            details: decision.what,
            reason: decision.why,
          });
        });
      }
    } catch (decisionError) {
      console.error('Error fetching decisions for activity:', decisionError);
    }

    // 3. Get evidence events (from evidence table)
    try {
      const evidenceQuery = supabase
        .from('vmp_evidence')
        .select(
          'id, checklist_step_id, status, uploaded_by_user_id, verified_by_user_id, rejected_by_user_id, created_at, updated_at'
        )
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      const { data: evidenceList, error: evidenceError } = await withTimeout(
        evidenceQuery,
        10000,
        `getCaseActivity-evidence(${caseId})`
      );

      if (!evidenceError && evidenceList) {
        evidenceList.forEach(ev => {
          if (ev.status === 'submitted') {
            activities.push({
              type: 'evidence',
              timestamp: ev.created_at,
              actor: 'vendor',
              action: 'uploaded evidence',
              details: `Evidence submitted for checklist step`,
            });
          } else if (ev.status === 'verified' && ev.verified_by_user_id) {
            activities.push({
              type: 'evidence',
              timestamp: ev.updated_at || ev.created_at,
              actor: 'internal',
              action: 'verified evidence',
              details: `Evidence verified`,
            });
          } else if (ev.status === 'rejected' && ev.rejected_by_user_id) {
            activities.push({
              type: 'evidence',
              timestamp: ev.updated_at || ev.created_at,
              actor: 'internal',
              action: 'rejected evidence',
              details: `Evidence rejected`,
            });
          }
        });
      }
    } catch (evidenceError) {
      console.error('Error fetching evidence for activity:', evidenceError);
    }

    // 4. Sort all activities by timestamp
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA - dateB;
    });

    return activities;
  },

  // Phase 3: Thread Cell - Get Messages
  async getMessages(caseId, isInternal = false) {
    if (!caseId) {
      throw new ValidationError('getMessages requires a caseId parameter', 'caseId');
    }

    const queryPromise = supabase
      .from('vmp_messages')
      .select(
        `
                id,
                case_id,
                channel_source,
                sender_type,
                sender_user_id,
                body,
                is_internal_note,
                created_at,
                vmp_vendor_users ( display_name, email )
            `
      )
      .eq('case_id', caseId)
      .order('created_at', { ascending: true }); // Chronological order

    const { data, error } = await withTimeout(queryPromise, 10000, `getMessages(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getMessages');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch messages', error, { caseId });
    }

    // Privacy Shield: Filter out internal notes for non-internal users
    let filteredMessages = data || [];
    if (!isInternal) {
      filteredMessages = filteredMessages.filter(msg => !msg.is_internal_note);
    }

    // Transform data to match template expectations
    // Template expects: sender_party, channel_source, body, created_at
    return filteredMessages.map(msg => ({
      id: msg.id,
      case_id: msg.case_id,
      sender_party:
        msg.sender_type === 'vendor'
          ? msg.vmp_vendor_users?.display_name || msg.vmp_vendor_users?.email || 'Vendor'
          : msg.sender_type === 'internal'
            ? 'Internal'
            : 'AI Assistant',
      channel_source: msg.channel_source,
      body: msg.body,
      created_at: msg.created_at,
      is_internal_note: msg.is_internal_note,
    }));
  },

  // Phase 3: Thread Cell - Create Message
  async createMessage(
    caseId,
    body,
    senderType = 'vendor',
    channelSource = 'portal',
    senderUserId = null,
    isInternalNote = false,
    metadata = null
  ) {
    if (!caseId || !body) {
      throw new ValidationError('createMessage requires caseId and body parameters', null, {
        caseId,
        hasBody: !!body,
      });
    }

    // Validate sender_type
    const validSenderTypes = ['vendor', 'internal', 'ai'];
    if (!validSenderTypes.includes(senderType)) {
      throw new ValidationError(
        `Invalid sender_type. Must be one of: ${validSenderTypes.join(', ')}`,
        'senderType',
        { value: senderType, validValues: validSenderTypes }
      );
    }

    // Validate channel_source
    const validChannels = ['portal', 'whatsapp', 'email', 'slack'];
    if (!validChannels.includes(channelSource)) {
      throw new ValidationError(
        `Invalid channel_source. Must be one of: ${validChannels.join(', ')}`,
        'channelSource',
        { value: channelSource, validValues: validChannels }
      );
    }

    const queryPromise = supabase
      .from('vmp_messages')
      .insert({
        case_id: caseId,
        channel_source: channelSource,
        sender_type: senderType,
        sender_user_id: senderUserId,
        body: body.trim(),
        is_internal_note: isInternalNote,
        metadata: metadata || {},
      })
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `createMessage(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'createMessage');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create message', error);
    }

    return data;
  },

  // Phase 4: Checklist Cell - Get Checklist Steps
  async getChecklistSteps(caseId) {
    if (!caseId) {
      throw new ValidationError('getChecklistSteps requires a caseId parameter', 'caseId');
    }

    const queryPromise = supabase
      .from('vmp_checklist_steps')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    const { data, error } = await withTimeout(queryPromise, 10000, `getChecklistSteps(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getChecklistSteps');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch checklist steps', error);
    }

    return data || [];
  },

  // Phase 4: Checklist Cell - Create Checklist Step
  async createChecklistStep(caseId, label, requiredEvidenceType = null) {
    if (!caseId || !label) {
      throw new ValidationError('createChecklistStep requires caseId and label parameters', null, {
        caseId,
        hasLabel: !!label,
      });
    }

    const queryPromise = supabase
      .from('vmp_checklist_steps')
      .insert({
        case_id: caseId,
        label: label.trim(),
        required_evidence_type: requiredEvidenceType,
        status: 'pending',
      })
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `createChecklistStep(${caseId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'createChecklistStep');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create checklist step', error, { caseId, label });
    }

    return data;
  },

  // Phase 4: Checklist Cell - Ensure Checklist Steps Exist
  async ensureChecklistSteps(caseId, caseType) {
    if (!caseId || !caseType) {
      throw new ValidationError(
        'ensureChecklistSteps requires caseId and caseType parameters',
        null,
        { caseId, caseType }
      );
    }

    // Get vendor information for conditional checklist logic
    let vendorAttributes = {};
    try {
      // Get case to find vendor_id
      const caseQuery = supabase
        .from('vmp_cases')
        .select('vendor_id, company_id')
        .eq('id', caseId)
        .single();

      const { data: caseData } = await withTimeout(
        caseQuery,
        5000,
        `getCaseForChecklist(${caseId})`
      );

      if (caseData && caseData.vendor_id) {
        // Get vendor information
        const vendorQuery = supabase
          .from('vmp_vendors')
          .select('vendor_type, country_code')
          .eq('id', caseData.vendor_id)
          .single();

        const { data: vendorData } = await withTimeout(
          vendorQuery,
          5000,
          `getVendorForChecklist(${caseData.vendor_id})`
        );

        if (vendorData) {
          vendorAttributes = {
            vendorType: vendorData.vendor_type || null,
            countryCode: vendorData.country_code || null,
          };
        }

        // If no vendor_type in vendor, try to infer from company country_code
        if (!vendorAttributes.vendorType && caseData.company_id) {
          const companyQuery = supabase
            .from('vmp_companies')
            .select('country_code')
            .eq('id', caseData.company_id)
            .single();

          const { data: companyData } = await withTimeout(
            companyQuery,
            5000,
            `getCompanyForChecklist(${caseData.company_id})`
          );

          if (companyData && companyData.country_code) {
            // Infer vendor type: if vendor country != company country, it's international
            if (
              vendorAttributes.countryCode &&
              vendorAttributes.countryCode !== companyData.country_code
            ) {
              vendorAttributes.vendorType = 'international';
            } else if (!vendorAttributes.vendorType) {
              vendorAttributes.vendorType = 'domestic';
            }

            // Use company country_code if vendor doesn't have one
            if (!vendorAttributes.countryCode) {
              vendorAttributes.countryCode = companyData.country_code;
            }
          }
        }
      }
    } catch (vendorError) {
      // If vendor lookup fails, continue with empty attributes (non-blocking)
      logError(vendorError, { operation: 'ensureChecklistSteps', caseId, step: 'vendorLookup' });
    }

    // Import rules engine dynamically to avoid circular dependencies
    const { getChecklistStepsForCaseType } = await import('../utils/checklist-rules.js');
    const requiredSteps = getChecklistStepsForCaseType(caseType, null, vendorAttributes);

    // Get existing steps
    const existingSteps = await this.getChecklistSteps(caseId);

    // Create missing steps
    const stepsToCreate = requiredSteps.filter(required => {
      return !existingSteps.some(
        existing =>
          existing.label === required.label ||
          existing.required_evidence_type === required.required_evidence_type
      );
    });

    const createdSteps = [];
    for (const step of stepsToCreate) {
      try {
        const created = await this.createChecklistStep(
          caseId,
          step.label,
          step.required_evidence_type
        );
        createdSteps.push(created);
      } catch (error) {
        const handledError = handleSupabaseError(error, `createChecklistStep(${step.label})`);
        if (handledError) {
          logError(handledError, {
            operation: 'ensureChecklistSteps',
            stepLabel: step.label,
            caseId,
          });
        }
        // Continue with other steps
      }
    }

    // Return all steps (existing + newly created)
    return await this.getChecklistSteps(caseId);
  },

  // Phase 5: Evidence Cell - Get Evidence
  async getEvidence(caseId) {
    if (!caseId) {
      throw new ValidationError('getEvidence requires a caseId parameter', 'caseId');
    }

    const queryPromise = supabase
      .from('vmp_evidence')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false }); // Newest first

    const { data, error } = await withTimeout(queryPromise, 10000, `getEvidence(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getEvidence');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch evidence', error, { caseId });
    }

    return data || [];
  },

  // Phase 5: Evidence Cell - Compute SHA-256 Checksum
  async computeChecksum(fileBuffer) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  },

  // Phase 5: Evidence Cell - Get Next Version for Evidence Type
  async getNextEvidenceVersion(caseId, evidenceType) {
    if (!caseId || !evidenceType) {
      throw new ValidationError(
        'getNextEvidenceVersion requires caseId and evidenceType parameters',
        null,
        { caseId, evidenceType }
      );
    }

    const queryPromise = supabase
      .from('vmp_evidence')
      .select('version')
      .eq('case_id', caseId)
      .eq('evidence_type', evidenceType)
      .order('version', { ascending: false })
      .limit(1);

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `getNextEvidenceVersion(${caseId}, ${evidenceType})`
    );

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows (not an error)
      const handledError = handleSupabaseError(error, 'getNextEvidenceVersion');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get next version', error, { caseId, evidenceType });
    }

    // If no existing evidence, start at version 1
    if (!data || data.length === 0) {
      return 1;
    }

    // Return next version (current max + 1)
    return (data[0].version || 0) + 1;
  },

  // Phase 5: Evidence Cell - Generate Storage Path
  generateEvidenceStoragePath(caseId, evidenceType, version, filename) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${caseId}/${evidenceType}/${today}/v${version}_${sanitizedFilename}`;
  },

  // Phase 5: Evidence Cell - Upload Evidence to Storage
  async uploadEvidenceToStorage(storagePath, fileBuffer, mimeType) {
    const { data, error } = await supabase.storage
      .from('vmp-evidence')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false, // Prevent overwriting
      });

    if (error) {
      throw new StorageError('Failed to upload to storage', error, {
        storagePath,
        mimeType,
      });
    }

    return data;
  },

  // Phase 5: Evidence Cell - Create Signed URL for Evidence
  async getEvidenceSignedUrl(storagePath, expiresIn = 3600) {
    const { data, error } = await supabase.storage
      .from('vmp-evidence')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new StorageError('Failed to create signed URL', error, {
        storagePath,
        expiresIn,
      });
    }

    return data.signedUrl;
  },

  // Phase 5: Evidence Cell - Upload Evidence (Complete Flow)
  async uploadEvidence(
    caseId,
    file,
    evidenceType,
    checklistStepId = null,
    uploaderType = 'vendor',
    uploaderUserId = null
  ) {
    if (!caseId || !file || !evidenceType) {
      throw new ValidationError(
        'uploadEvidence requires caseId, file, and evidenceType parameters',
        null,
        {
          caseId,
          hasFile: !!file,
          evidenceType,
        }
      );
    }

    // Get next version for this evidence type
    const version = await this.getNextEvidenceVersion(caseId, evidenceType);

    // Generate storage path
    const storagePath = this.generateEvidenceStoragePath(
      caseId,
      evidenceType,
      version,
      file.originalname || 'evidence'
    );

    // Compute checksum
    const checksum = await this.computeChecksum(file.buffer);

    // Upload to Supabase Storage
    await this.uploadEvidenceToStorage(storagePath, file.buffer, file.mimetype);

    // Create evidence record in database
    const queryPromise = supabase
      .from('vmp_evidence')
      .insert({
        case_id: caseId,
        checklist_step_id: checklistStepId,
        uploader_type: uploaderType,
        evidence_type: evidenceType,
        version: version,
        original_filename: file.originalname || 'evidence',
        storage_path: storagePath,
        mime_type: file.mimetype || 'application/octet-stream',
        size_bytes: file.size || file.buffer.length,
        checksum_sha256: checksum,
        status: 'submitted',
      })
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `uploadEvidence(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'uploadEvidence');
      // Try to clean up uploaded file
      try {
        await supabase.storage.from('vmp-evidence').remove([storagePath]);
      } catch (cleanupError) {
        logError(cleanupError, {
          operation: 'uploadEvidence.cleanup',
          storagePath,
          originalError: handledError?.message,
        });
      }
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create evidence record', error, {
        caseId,
        evidenceType,
        storagePath,
      });
    }

    // Update checklist step status to 'submitted' if linked
    if (checklistStepId) {
      try {
        await supabase
          .from('vmp_checklist_steps')
          .update({ status: 'submitted' })
          .eq('id', checklistStepId)
          .eq('case_id', caseId);
      } catch (updateError) {
        const handledError = handleSupabaseError(updateError, 'uploadEvidence.updateStepStatus');
        if (handledError) {
          logError(handledError, {
            operation: 'uploadEvidence.updateStepStatus',
            checklistStepId,
            caseId,
          });
        }
        // Don't fail the upload if step update fails
      }
    }

    // Day 11: Update case status based on evidence (waiting_internal when evidence submitted)
    try {
      await this.updateCaseStatusFromEvidence(caseId);
    } catch (statusError) {
      const handledError = handleSupabaseError(statusError, 'uploadEvidence.updateCaseStatus');
      if (handledError) {
        logError(handledError, { operation: 'uploadEvidence.updateCaseStatus', caseId });
      }
      // Don't fail the upload if status update fails
    }

    return data;
  },

  // Day 9: Internal Ops - Verify Evidence
  async verifyEvidence(checklistStepId, verifiedByUserId, reason = null) {
    if (!checklistStepId || !verifiedByUserId) {
      throw new ValidationError(
        'verifyEvidence requires checklistStepId and verifiedByUserId',
        null,
        {
          checklistStepId,
          verifiedByUserId,
        }
      );
    }

    // Get checklist step to find case_id
    const stepQuery = await supabase
      .from('vmp_checklist_steps')
      .select('case_id')
      .eq('id', checklistStepId)
      .single();

    if (stepQuery.error) {
      const handledError = handleSupabaseError(stepQuery.error, 'verifyEvidence.getStep');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch checklist step', stepQuery.error, {
        checklistStepId,
      });
    }
    const caseId = stepQuery.data.case_id;

    const queryPromise = supabase
      .from('vmp_checklist_steps')
      .update({
        status: 'verified',
      })
      .eq('id', checklistStepId)
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `verifyEvidence(${checklistStepId})`
    );

    if (error) throw error;

    // Day 11: Update case status based on evidence (may resolve if all verified)
    try {
      await this.updateCaseStatusFromEvidence(caseId);
    } catch (statusError) {
      const handledError = handleSupabaseError(statusError, 'verifyEvidence.updateCaseStatus');
      if (handledError) {
        logError(handledError, { operation: 'verifyEvidence.updateCaseStatus', caseId });
      }
      // Don't fail verification if status update fails
    }

    // Sprint 7.2: Log decision
    try {
      const stepLabel = data?.label || 'Evidence';
      await this.logDecision(
        caseId,
        'verify',
        `User ${verifiedByUserId}`,
        `Verified evidence: ${stepLabel}`,
        reason || 'Evidence meets requirements'
      );
    } catch (logError) {
      console.error('Failed to log decision:', logError);
      // Don't fail verification if decision logging fails
    }

    return data;
  },

  // Day 9: Internal Ops - Reject Evidence
  async rejectEvidence(checklistStepId, rejectedByUserId, reason) {
    if (!checklistStepId || !rejectedByUserId || !reason) {
      throw new ValidationError(
        'rejectEvidence requires checklistStepId, rejectedByUserId, and reason',
        null,
        {
          checklistStepId,
          rejectedByUserId,
          hasReason: !!reason,
        }
      );
    }

    const queryPromise = supabase
      .from('vmp_checklist_steps')
      .update({
        status: 'rejected',
        waived_reason: reason, // Store rejection reason
      })
      .eq('id', checklistStepId)
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `rejectEvidence(${checklistStepId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'rejectEvidence');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to reject evidence', error, {
        checklistStepId,
        rejectedByUserId,
      });
    }

    // Get case_id for decision log
    const stepQuery = await supabase
      .from('vmp_checklist_steps')
      .select('case_id, label')
      .eq('id', checklistStepId)
      .single();

    const caseId = stepQuery.data?.case_id;
    const stepLabel = stepQuery.data?.label || 'Evidence';

    // Sprint 7.2: Log decision
    if (caseId) {
      try {
        await this.logDecision(
          caseId,
          'reject',
          `User ${rejectedByUserId}`,
          `Rejected evidence: ${stepLabel}`,
          reason
        );
      } catch (logError) {
        console.error('Failed to log decision:', logError);
        // Don't fail rejection if decision logging fails
      }
    }

    return data;
  },

  // Day 9: Internal Ops - Reassign Case
  async reassignCase(caseId, ownerTeam, assignedToUserId = null) {
    if (!caseId || !ownerTeam) {
      throw new ValidationError('reassignCase requires caseId and ownerTeam', null, {
        caseId,
        ownerTeam,
      });
    }

    if (!['procurement', 'ap', 'finance'].includes(ownerTeam)) {
      throw new ValidationError('ownerTeam must be one of: procurement, ap, finance', 'ownerTeam', {
        value: ownerTeam,
        validValues: ['procurement', 'ap', 'finance'],
      });
    }

    const updateData = {
      owner_team: ownerTeam,
      updated_at: new Date().toISOString(),
    };

    // Sprint 8.2: If assigned to specific user, update assigned_to_user_id
    if (assignedToUserId) {
      updateData.assigned_to_user_id = assignedToUserId;
    }

    const queryPromise = supabase
      .from('vmp_cases')
      .update(updateData)
      .eq('id', caseId)
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `reassignCase(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'reassignCase');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to reassign case', error, { caseId, ownerTeam });
    }
    return data;
  },

  // Day 9: Internal Ops - Update Case Status
  async updateCaseStatus(caseId, status, updatedByUserId) {
    if (!caseId || !status) {
      throw new ValidationError('updateCaseStatus requires caseId and status', null, {
        caseId,
        status,
      });
    }
    // updatedByUserId can be null for system updates (e.g., from evidence status changes)

    const validStatuses = ['open', 'waiting_supplier', 'waiting_internal', 'resolved', 'blocked'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        'status must be one of: open, waiting_supplier, waiting_internal, resolved, blocked',
        'status',
        { value: status, validValues: validStatuses }
      );
    }

    const queryPromise = supabase
      .from('vmp_cases')
      .update({
        status: status,
      })
      .eq('id', caseId)
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `updateCaseStatus(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'updateCaseStatus');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to update case status', error, { caseId, status });
    }

    // Sprint 7.2: Log decision (only if updatedByUserId is provided, not for system updates)
    if (updatedByUserId) {
      try {
        await this.logDecision(
          caseId,
          'status_update',
          `User ${updatedByUserId}`,
          `Updated case status to ${status}`,
          null
        );
      } catch (logError) {
        console.error('Failed to log decision:', logError);
        // Don't fail status update if decision logging fails
      }
    }

    // VERIFY-04 Fix: Handle bank details change case resolution
    // When a bank details change case is resolved, update vendor profile with new bank details
    if (
      status === 'resolved' &&
      data &&
      data.metadata &&
      data.metadata.bank_details_change &&
      data.metadata.new_bank_details
    ) {
      try {
        const newBankDetails = data.metadata.new_bank_details;
        const vendorId = data.vendor_id;

        if (vendorId && newBankDetails) {
          // Update vendor bank details
          const bankUpdateQuery = supabase
            .from('vmp_vendors')
            .update({
              bank_name: newBankDetails.bank_name || null,
              account_number: newBankDetails.account_number || null,
              swift_code: newBankDetails.swift_code || null,
              bank_address: newBankDetails.branch_address || null,
              account_holder_name: newBankDetails.account_name || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorId)
            .select()
            .single();

          const { data: updatedVendor, error: bankUpdateError } = await withTimeout(
            bankUpdateQuery,
            10000,
            `updateVendorBankDetails(${vendorId})`
          );

          if (bankUpdateError) {
            logError(bankUpdateError, {
              operation: 'updateCaseStatus.bankDetailsUpdate',
              caseId,
              vendorId,
            });
            // Don't fail case status update if bank details update fails
          } else {
            // Log bank details update decision
            try {
              await this.logDecision(
                caseId,
                'bank_details_updated',
                updatedByUserId ? `User ${updatedByUserId}` : 'System',
                `Bank details updated for vendor ${vendorId} via case resolution`,
                `New bank: ${newBankDetails.bank_name}, Account: ${newBankDetails.account_number}`
              );
            } catch (logError) {
              logError(logError, { operation: 'logDecision-bankDetailsUpdate', caseId });
            }
          }
        }
      } catch (bankDetailsError) {
        logError(bankDetailsError, {
          operation: 'updateCaseStatus.bankDetailsChange',
          caseId,
        });
        // Don't fail case status update if bank details update fails
      }
    }

    return data;
  },

  // Day 10: Escalation - Escalate Case
  async escalateCase(caseId, escalationLevel, escalatedByUserId, reason = null) {
    if (!caseId || !escalationLevel || !escalatedByUserId) {
      throw new ValidationError(
        'escalateCase requires caseId, escalationLevel, and escalatedByUserId',
        null,
        {
          caseId,
          escalationLevel,
          escalatedByUserId,
        }
      );
    }

    if (escalationLevel < 1 || escalationLevel > 3) {
      throw new ValidationError('escalationLevel must be between 1 and 3', 'escalationLevel', {
        value: escalationLevel,
        min: 1,
        max: 3,
      });
    }

    // Update case: set escalation_level, assign to AP team, update status
    const updateData = {
      escalation_level: escalationLevel,
      owner_team: 'ap', // Escalated cases go to AP
      status: escalationLevel >= 3 ? 'blocked' : 'waiting_internal', // Level 3 = blocked
    };

    const queryPromise = supabase
      .from('vmp_cases')
      .update(updateData)
      .eq('id', caseId)
      .select()
      .single();

    const { data, error } = await withTimeout(queryPromise, 10000, `escalateCase(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'escalateCase');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to escalate case', error, { caseId, escalationLevel });
    }

    // Create escalation message/audit log (store in messages table as internal note)
    if (reason) {
      try {
        await supabase.from('vmp_messages').insert({
          case_id: caseId,
          sender_type: 'internal',
          channel_source: 'portal',
          body: `Escalated to Level ${escalationLevel}: ${reason}`,
          is_internal_note: true,
          sender_user_id: escalatedByUserId,
        });
      } catch (messageError) {
        console.error('Failed to create escalation message:', messageError);
        // Don't fail escalation if message creation fails
      }
    }

    return data;
  },

  // Day 11: Notifications - Create Notification
  async createNotification(caseId, userId, notificationType, title, body = null, paymentId = null) {
    if (!userId || !notificationType || !title) {
      throw new ValidationError(
        'createNotification requires userId, notificationType, and title',
        null,
        {
          caseId,
          userId,
          notificationType,
          hasTitle: !!title,
        }
      );
    }

    const queryPromise = supabase
      .from('vmp_notifications')
      .insert({
        case_id: caseId || null,
        user_id: userId,
        notification_type: notificationType,
        title: title,
        body: body,
        payment_id: paymentId || null,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `createNotification(${caseId || 'no-case'}, ${userId})`
    );

    if (error) {
      console.error('Error creating notification:', error);
      // Don't throw - notifications are non-critical
      return null;
    }

    return data;
  },

  // Sprint 12.3: Send Push Notification with In-App Notification
  async createNotificationWithPush(
    caseId,
    userId,
    notificationType,
    title,
    body = null,
    paymentId = null
  ) {
    // Create in-app notification first
    const notification = await this.createNotification(
      caseId,
      userId,
      notificationType,
      title,
      body,
      paymentId
    );

    // Send push notification if available
    if (notification) {
      try {
        const { sendCaseNotification } = await import('../utils/push-sender.js');
        await sendCaseNotification(caseId, userId, body || title, {
          title,
          data: {
            notificationId: notification.id,
            caseId,
            type: notificationType,
          },
        });
      } catch (pushError) {
        // Don't fail if push fails - in-app notification is primary
        console.error('[Push] Failed to send push notification:', pushError);
      }
    }

    return notification;
  },

  // Sprint 7.4: Create Payment Notification for All Vendor Users
  async notifyVendorUsersForPayment(
    paymentId,
    vendorId,
    paymentRef,
    amount,
    currencyCode,
    invoiceNum = null
  ) {
    if (!paymentId || !vendorId || !paymentRef || !amount) {
      throw new ValidationError(
        'notifyVendorUsersForPayment requires paymentId, vendorId, paymentRef, and amount',
        null,
        {
          paymentId,
          vendorId,
          paymentRef,
          hasAmount: !!amount,
        }
      );
    }

    try {
      // Use the new notification service (Sprint 7.4)
      const { sendPaymentNotification } = await import('../utils/notifications.js');
      const results = await sendPaymentNotification(paymentId, vendorId, {
        paymentRef,
        amount,
        currencyCode: currencyCode || 'USD',
        invoiceNum,
      });

      // Return notification results for logging
      return {
        success: true,
        results,
        message: `Notifications sent: ${results.inApp.sent} in-app, ${results.email.sent} email, ${results.sms.sent} SMS, ${results.push.sent} push`,
      };
    } catch (error) {
      logError(error, { operation: 'notifyVendorUsersForPayment', paymentId, vendorId });
      // Don't throw - notifications are non-critical
      return { success: false, error: error.message };
    }
  },

  // Sprint 7.4: Get Vendor Users with Notification Preferences
  async getVendorUsersWithPreferences(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getVendorUsersWithPreferences requires vendorId', null, {
        vendorId,
      });
    }

    try {
      const usersQuery = supabase
        .from('vmp_vendor_users')
        .select('id, email, display_name, phone, notification_preferences')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      const { data, error } = await withTimeout(
        usersQuery,
        10000,
        `getVendorUsersWithPreferences(${vendorId})`
      );

      if (error) {
        const handledError = handleSupabaseError(error, 'getVendorUsersWithPreferences');
        if (handledError === null) {
          return [];
        }
        throw handledError;
      }

      return data || [];
    } catch (error) {
      logError(error, { operation: 'getVendorUsersWithPreferences', vendorId });
      throw new DatabaseError('Failed to fetch vendor users with preferences', error, { vendorId });
    }
  },

  // Sprint 7.4: Update User Notification Preferences
  async updateNotificationPreferences(userId, preferences) {
    if (!userId) {
      throw new ValidationError('updateNotificationPreferences requires userId', null, { userId });
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('updateNotificationPreferences requires preferences object', null, {
        hasPreferences: !!preferences,
      });
    }

    try {
      const updateQuery = supabase
        .from('vmp_vendor_users')
        .update({ notification_preferences: preferences })
        .eq('id', userId)
        .select('id, notification_preferences')
        .single();

      const { data, error } = await withTimeout(
        updateQuery,
        10000,
        `updateNotificationPreferences(${userId})`
      );

      if (error) {
        const handledError = handleSupabaseError(error, 'updateNotificationPreferences');
        if (handledError === null) {
          return null;
        }
        throw handledError;
      }

      return data;
    } catch (error) {
      logError(error, { operation: 'updateNotificationPreferences', userId });
      throw new DatabaseError('Failed to update notification preferences', error, { userId });
    }
  },

  // Sprint 7.4: Send Payment Email Notification (Deprecated - use notifications.js service)
  async sendPaymentEmailNotification(userEmail, userName, paymentData) {
    // This method is kept for backward compatibility
    // New code should use the notification service in src/utils/notifications.js
    const { sendPaymentNotification } = await import('../utils/notifications.js');
    // This is a simplified call - full implementation should use sendPaymentNotification
    console.warn('[Deprecated] sendPaymentEmailNotification - use notification service instead');
    return { success: true, emailContent: { to: userEmail } };
  },

  // Day 11: Notifications - Notify All Vendor Users for Case
  async notifyVendorUsersForCase(caseId, notificationType, title, body = null) {
    if (!caseId || !notificationType || !title) {
      throw new ValidationError(
        'notifyVendorUsersForCase requires caseId, notificationType, and title',
        null,
        {
          caseId,
          notificationType,
          hasTitle: !!title,
        }
      );
    }

    try {
      // Get case to find vendor_id
      const caseQuery = await supabase
        .from('vmp_cases')
        .select('vendor_id')
        .eq('id', caseId)
        .single();

      if (caseQuery.error || !caseQuery.data) {
        console.error('Case not found for notification:', caseQuery.error);
        return [];
      }

      const vendorId = caseQuery.data.vendor_id;

      // Get all active vendor users for this vendor
      const usersQuery = await supabase
        .from('vmp_vendor_users')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      if (usersQuery.error || !usersQuery.data) {
        console.error('Error fetching vendor users:', usersQuery.error);
        return [];
      }

      // Create notifications for all vendor users
      const notifications = [];
      for (const user of usersQuery.data) {
        try {
          const notif = await this.createNotification(
            caseId,
            user.id,
            notificationType,
            title,
            body
          );
          if (notif) notifications.push(notif);
        } catch (notifError) {
          console.error(`Failed to create notification for user ${user.id}:`, notifError);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Error in notifyVendorUsersForCase:', error);
      return [];
    }
  },

  // Day 11: Notifications - Get User Notifications
  async getUserNotifications(userId, limit = 50, unreadOnly = false) {
    if (!userId) {
      throw new ValidationError('getUserNotifications requires userId', 'userId');
    }

    let query = supabase
      .from('vmp_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await withTimeout(query, 10000, `getUserNotifications(${userId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getUserNotifications');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch user notifications', error, { userId });
    }
    return data || [];
  },

  // Day 11: Status Transition Logic - Update Case Status Based on Evidence
  async updateCaseStatusFromEvidence(caseId) {
    if (!caseId) {
      throw new ValidationError('updateCaseStatusFromEvidence requires caseId', 'caseId');
    }

    // Get all checklist steps for this case
    const steps = await this.getChecklistSteps(caseId);

    if (!steps || steps.length === 0) {
      // No checklist steps, keep current status
      return null;
    }

    // Check status of all steps
    const allVerified = steps.every(s => s.status === 'verified' || s.status === 'waived');
    const hasSubmitted = steps.some(s => s.status === 'submitted');
    const hasRejected = steps.some(s => s.status === 'rejected');

    // Get current case status
    // For internal ops, we need to get the case without vendor filter
    // Use a direct query instead of getCaseDetail which requires vendorId
    const caseQuery = await supabase.from('vmp_cases').select('*').eq('id', caseId).single();

    if (caseQuery.error || !caseQuery.data) {
      return null;
    }

    const caseDetail = caseQuery.data;

    if (!caseDetail) {
      return null;
    }

    let newStatus = caseDetail.status;

    // Status transition rules:
    // - If all verified/waived → resolved
    // - If any submitted → waiting_internal (waiting for internal to verify)
    // - If any rejected → waiting_supplier (supplier needs to resubmit)
    // - Otherwise keep current status

    if (allVerified && steps.length > 0) {
      newStatus = 'resolved';
    } else if (hasRejected) {
      newStatus = 'waiting_supplier';
    } else if (hasSubmitted) {
      newStatus = 'waiting_internal';
    }

    // Only update if status changed
    if (newStatus !== caseDetail.status) {
      return await this.updateCaseStatus(caseId, newStatus, null); // System update
    }

    return caseDetail;
  },

  // Sprint 2: Break Glass Protocol - Get Group Director Info
  async getGroupDirectorInfo(groupId) {
    if (!groupId) {
      return null;
    }

    const queryPromise = supabase
      .from('vmp_groups')
      .select('id, name, director_name, director_title, director_phone, director_email')
      .eq('id', groupId)
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      5000,
      `getGroupDirectorInfo(${groupId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getGroupDirectorInfo');
      if (handledError === null) {
        // Group not found
        return null;
      }
      throw handledError;
    }

    if (!data) {
      return null;
    }

    return {
      group_id: data.id,
      group_name: data.name,
      director_name: data.director_name,
      director_title: data.director_title,
      director_phone: data.director_phone,
      director_email: data.director_email,
    };
  },

  // Sprint 1.2: Break Glass Protocol - Log Break Glass Event
  async logBreakGlass(caseId, userId, groupId, directorInfo) {
    if (!caseId || !userId) {
      throw new ValidationError('logBreakGlass requires caseId and userId', null, {
        caseId,
        userId,
      });
    }

    // Sprint 1: Log to console and messages table (audit trail)
    // Sprint 2: Will insert into vmp_break_glass_events table
    const breakGlassMessage = `BREAK GLASS PROTOCOL ACTIVATED: Case escalated to Level 3. Director Contact: ${directorInfo?.director_name || 'N/A'} (${directorInfo?.director_email || 'N/A'})`;

    try {
      await supabase.from('vmp_messages').insert({
        case_id: caseId,
        sender_type: 'system',
        channel_source: 'portal',
        body: breakGlassMessage,
        is_internal_note: true,
        sender_user_id: userId,
      });
    } catch (messageError) {
      console.error('Failed to log break glass message:', messageError);
      // Don't fail if message logging fails
    }

    // Sprint 2: Will also insert into vmp_break_glass_events table
    console.log('Break Glass Event:', {
      caseId,
      userId,
      groupId,
      directorInfo,
      timestamp: new Date().toISOString(),
    });

    // Sprint 7.2: Log decision (if escalateCase was called, it will log separately)
    // This is just for break glass logging, decision log is handled in escalateCase

    return { logged: true };
  },

  // Sprint 2.3: CSV Ingest - Parse and Upsert Invoices
  async ingestInvoicesFromCSV(csvBuffer, vendorId, companyId) {
    if (!csvBuffer || !vendorId || !companyId) {
      throw new ValidationError(
        'ingestInvoicesFromCSV requires csvBuffer, vendorId, and companyId',
        null,
        {
          hasBuffer: !!csvBuffer,
          vendorId,
          companyId,
        }
      );
    }

    // Parse CSV using csv-parse (handles quoted fields, commas in values, etc.)
    let records;
    try {
      records = parse(csvBuffer, {
        columns: true, // Use first row as column names
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow inconsistent column counts
        cast: false, // Keep values as strings for manual parsing
      });
    } catch (parseError) {
      throw new ValidationError(`Failed to parse CSV: ${parseError.message}`, parseError, {
        operation: 'ingestInvoicesFromCSV',
      });
    }

    if (!records || records.length === 0) {
      throw new ValidationError('CSV must have at least a header row and one data row', null, {
        recordCount: records?.length || 0,
      });
    }

    // Normalize headers (case-insensitive, handle whitespace and variations)
    const normalizeHeader = header => {
      if (!header) return '';
      return header
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[#]/g, ''); // Remove # symbols
    };

    // Find column indices with flexible matching
    const findColumn = (headers, patterns) => {
      const normalizedHeaders = headers.map(normalizeHeader);
      for (const pattern of patterns) {
        const normalizedPattern = normalizeHeader(pattern);
        const idx = normalizedHeaders.findIndex(
          h => h.includes(normalizedPattern) || normalizedPattern.includes(h)
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const headers = Object.keys(records[0] || {});

    // Map columns with flexible matching (handle common variations)
    const invoiceNumIdx = findColumn(headers, [
      'Invoice #',
      'Invoice',
      'Invoice Number',
      'Inv #',
      'Inv Num',
      'Invoice Num',
    ]);
    const dateIdx = findColumn(headers, [
      'Date',
      'Invoice Date',
      'Doc Date',
      'Document Date',
      'Invoice Date',
    ]);
    const amountIdx = findColumn(headers, [
      'Amount',
      'Invoice Amount',
      'Total',
      'Total Amount',
      'Invoice Total',
    ]);
    const poRefIdx = findColumn(headers, ['PO #', 'PO', 'PO Number', 'Purchase Order', 'PO Ref']);
    const companyCodeIdx = findColumn(headers, [
      'Company Code',
      'Company',
      'Company ID',
      'Company Name',
    ]);
    const descriptionIdx = findColumn(headers, ['Description', 'Desc', 'Notes', 'Remarks']);

    // Validate required columns
    const requiredColumns = [
      { name: 'Invoice #', idx: invoiceNumIdx },
      { name: 'Date', idx: dateIdx },
      { name: 'Amount', idx: amountIdx },
    ];

    const missingColumns = requiredColumns.filter(col => col.idx < 0);
    if (missingColumns.length > 0) {
      throw new ValidationError(
        `CSV missing required columns: ${missingColumns.map(c => c.name).join(', ')}. Found columns: ${headers.join(', ')}`,
        null,
        {
          foundColumns: headers,
          missingColumns: missingColumns.map(c => c.name),
        }
      );
    }

    // Parse data rows
    const invoices = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const row = records[i];
        const values = headers.map(h => row[h] || '');

        const invoiceNum = values[invoiceNumIdx]?.trim();
        const dateStr = values[dateIdx]?.trim();
        const amountStr = values[amountIdx]?.trim();

        if (!invoiceNum || !dateStr || !amountStr) {
          errors.push(`Row ${i + 2}: Missing required fields (Invoice #, Date, or Amount)`);
          continue;
        }

        // Parse date (support multiple formats)
        const invoiceDate = this._parseDate(dateStr);
        if (!invoiceDate) {
          errors.push(`Row ${i + 2}: Invalid date format: ${dateStr}`);
          continue;
        }

        // Parse amount (remove currency symbols, commas)
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${i + 2}: Invalid amount: ${amountStr}`);
          continue;
        }

        // Get company_id (use provided companyId, or lookup by company code)
        let finalCompanyId = companyId;
        if (companyCodeIdx >= 0 && values[companyCodeIdx]) {
          const companyCode = values[companyCodeIdx].trim();
          // Try to find company by code (name or code field)
          const companyQuery = supabase
            .from('vmp_companies')
            .select('id')
            .or(`name.ilike.%${companyCode}%,code.ilike.%${companyCode}%`)
            .limit(1)
            .single();

          const { data: companyData } = await withTimeout(companyQuery, 5000, 'findCompanyByCode');
          if (companyData) {
            finalCompanyId = companyData.id;
          }
        }

        invoices.push({
          vendor_id: vendorId,
          company_id: finalCompanyId,
          invoice_num: invoiceNum,
          invoice_date: invoiceDate.toISOString().split('T')[0],
          amount: amount,
          po_ref: poRefIdx >= 0 ? values[poRefIdx]?.trim() || null : null,
          description: descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null,
          source_system: 'manual',
        });
      } catch (rowError) {
        errors.push(`Row ${i + 2}: ${rowError.message}`);
      }
    }

    if (invoices.length === 0) {
      throw new ValidationError('No valid invoices found in CSV', null, { errors });
    }

    // Upsert invoices (handle duplicates by invoice_num + vendor_id + company_id)
    const upserted = [];
    const failed = [];

    for (const invoice of invoices) {
      try {
        // Check if invoice exists
        const existingQuery = supabase
          .from('vmp_invoices')
          .select('id')
          .eq('vendor_id', invoice.vendor_id)
          .eq('company_id', invoice.company_id)
          .eq('invoice_num', invoice.invoice_num)
          .single();

        const { data: existing } = await withTimeout(existingQuery, 5000, 'checkExistingInvoice');

        if (existing) {
          // Update existing
          const updateQuery = supabase
            .from('vmp_invoices')
            .update({
              invoice_date: invoice.invoice_date,
              amount: invoice.amount,
              po_ref: invoice.po_ref,
              description: invoice.description,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          const { data: updated, error: updateError } = await withTimeout(
            updateQuery,
            5000,
            'updateInvoice'
          );

          if (updateError) throw updateError;
          upserted.push(updated);
        } else {
          // Insert new
          const insertQuery = supabase.from('vmp_invoices').insert(invoice).select().single();

          const { data: inserted, error: insertError } = await withTimeout(
            insertQuery,
            5000,
            'insertInvoice'
          );

          if (insertError) throw insertError;
          upserted.push(inserted);
        }
      } catch (upsertError) {
        failed.push({
          invoice_num: invoice.invoice_num,
          error: upsertError.message,
        });
      }
    }

    return {
      total: invoices.length,
      upserted: upserted.length,
      failed: failed.length,
      invoices: upserted,
      errors: errors.length > 0 ? errors : null,
      failures: failed.length > 0 ? failed : null,
    };
  },

  // Sprint 4.2: CSV Ingest - Parse and Upsert Payments
  async ingestPaymentsFromCSV(csvBuffer, vendorId, companyId) {
    if (!csvBuffer || !vendorId || !companyId) {
      throw new ValidationError(
        'ingestPaymentsFromCSV requires csvBuffer, vendorId, and companyId',
        null,
        {
          hasBuffer: !!csvBuffer,
          vendorId,
          companyId,
        }
      );
    }

    // Parse CSV using csv-parse (handles quoted fields, commas in values, etc.)
    let records;
    try {
      records = parse(csvBuffer, {
        columns: true, // Use first row as column names
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow inconsistent column counts
        cast: false, // Keep values as strings for manual parsing
      });
    } catch (parseError) {
      throw new ValidationError(`Failed to parse CSV: ${parseError.message}`, parseError, {
        operation: 'ingestPaymentsFromCSV',
      });
    }

    if (!records || records.length === 0) {
      throw new ValidationError('CSV must have at least a header row and one data row', null, {
        recordCount: records?.length || 0,
      });
    }

    // Normalize headers (case-insensitive, handle whitespace and variations)
    const normalizeHeader = header => {
      if (!header) return '';
      return header
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[#]/g, ''); // Remove # symbols
    };

    // Find column indices with flexible matching
    const findColumn = (headers, patterns) => {
      const normalizedHeaders = headers.map(normalizeHeader);
      for (const pattern of patterns) {
        const normalizedPattern = normalizeHeader(pattern);
        const idx = normalizedHeaders.findIndex(
          h => h.includes(normalizedPattern) || normalizedPattern.includes(h)
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const headers = Object.keys(records[0] || {});

    // Map columns with flexible matching (handle common variations)
    const paymentRefIdx = findColumn(headers, [
      'Payment Ref',
      'Payment Reference',
      'Payment Ref #',
      'Pay Ref',
      'Payment Number',
    ]);
    const dateIdx = findColumn(headers, ['Date', 'Payment Date', 'Pay Date', 'Transaction Date']);
    const amountIdx = findColumn(headers, [
      'Amount',
      'Payment Amount',
      'Total',
      'Total Amount',
      'Pay Amount',
    ]);
    const invoiceNumIdx = findColumn(headers, [
      'Invoice #',
      'Invoice',
      'Invoice Number',
      'Inv #',
      'Inv Num',
      'Invoice Num',
    ]);
    const descriptionIdx = findColumn(headers, ['Description', 'Desc', 'Notes', 'Remarks', 'Memo']);

    // Validate required columns
    const requiredColumns = [
      { name: 'Payment Ref', idx: paymentRefIdx },
      { name: 'Date', idx: dateIdx },
      { name: 'Amount', idx: amountIdx },
    ];

    const missingColumns = requiredColumns.filter(col => col.idx < 0);
    if (missingColumns.length > 0) {
      throw new ValidationError(
        `CSV missing required columns: ${missingColumns.map(c => c.name).join(', ')}. Found columns: ${headers.join(', ')}`,
        null,
        {
          foundColumns: headers,
          missingColumns: missingColumns.map(c => c.name),
        }
      );
    }

    // Parse data rows
    const payments = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const row = records[i];
        const values = headers.map(h => row[h] || '');

        const paymentRef = values[paymentRefIdx]?.trim();
        const dateStr = values[dateIdx]?.trim();
        const amountStr = values[amountIdx]?.trim();

        if (!paymentRef || !dateStr || !amountStr) {
          errors.push(`Row ${i + 2}: Missing required fields (Payment Ref, Date, or Amount)`);
          continue;
        }

        // Parse date (support multiple formats)
        const paymentDate = this._parseDate(dateStr);
        if (!paymentDate) {
          errors.push(`Row ${i + 2}: Invalid date format: ${dateStr}`);
          continue;
        }

        // Parse amount (remove currency symbols, commas)
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${i + 2}: Invalid amount: ${amountStr}`);
          continue;
        }

        const invoiceNum = invoiceNumIdx >= 0 ? values[invoiceNumIdx]?.trim() || null : null;

        payments.push({
          vendor_id: vendorId,
          company_id: companyId,
          payment_ref: paymentRef,
          payment_date: paymentDate.toISOString().split('T')[0],
          amount: amount,
          invoice_num: invoiceNum,
          description: descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null,
          source_system: 'manual',
        });
      } catch (rowError) {
        errors.push(`Row ${i + 2}: ${rowError.message}`);
      }
    }

    if (payments.length === 0) {
      throw new ValidationError('No valid payments found in CSV', null, { errors });
    }

    // Upsert payments and update invoice status
    const upserted = [];
    const failed = [];
    const invoicesUpdated = [];

    for (const payment of payments) {
      try {
        // Check if payment exists
        const existingQuery = supabase
          .from('vmp_payments')
          .select('id')
          .eq('vendor_id', payment.vendor_id)
          .eq('company_id', payment.company_id)
          .eq('payment_ref', payment.payment_ref)
          .single();

        const { data: existing } = await withTimeout(existingQuery, 5000, 'checkExistingPayment');

        // Try to find linked invoice if invoice_num provided
        let invoiceId = null;
        if (payment.invoice_num) {
          const invoiceQuery = supabase
            .from('vmp_invoices')
            .select('id')
            .eq('vendor_id', payment.vendor_id)
            .eq('company_id', payment.company_id)
            .eq('invoice_num', payment.invoice_num)
            .single();

          const { data: invoiceData } = await withTimeout(
            invoiceQuery,
            5000,
            'findInvoiceByNumber'
          );
          if (invoiceData) {
            invoiceId = invoiceData.id;
          }
        }

        if (existing) {
          // Update existing payment
          const updateQuery = supabase
            .from('vmp_payments')
            .update({
              payment_date: payment.payment_date,
              amount: payment.amount,
              invoice_num: payment.invoice_num,
              invoice_id: invoiceId,
              description: payment.description,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          const { data: updated, error: updateError } = await withTimeout(
            updateQuery,
            5000,
            'updatePayment'
          );

          if (updateError) throw updateError;
          upserted.push(updated);
        } else {
          // Insert new payment
          const insertQuery = supabase
            .from('vmp_payments')
            .insert({
              ...payment,
              invoice_id: invoiceId,
            })
            .select()
            .single();

          const { data: inserted, error: insertError } = await withTimeout(
            insertQuery,
            5000,
            'insertPayment'
          );

          if (insertError) throw insertError;
          upserted.push(inserted);

          // Sprint 7.4: Create payment notification for new payments
          try {
            await this.notifyVendorUsersForPayment(
              inserted.id,
              payment.vendor_id,
              payment.payment_ref,
              payment.amount,
              payment.currency_code || 'USD',
              payment.invoice_num
            );
          } catch (notifError) {
            // Don't fail payment creation if notification fails
            console.error('Failed to create payment notification:', notifError);
          }
        }

        // Update invoice status to 'paid' if invoice linked
        if (invoiceId) {
          const updateInvoiceQuery = supabase
            .from('vmp_invoices')
            .update({
              status: 'paid',
              paid_date: payment.payment_date,
              paid_amount: payment.amount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);

          const { error: invoiceUpdateError } = await withTimeout(
            updateInvoiceQuery,
            5000,
            'updateInvoiceStatus'
          );
          if (!invoiceUpdateError) {
            invoicesUpdated.push(invoiceId);
          }
        }
      } catch (upsertError) {
        failed.push({
          payment_ref: payment.payment_ref,
          error: upsertError.message,
        });
      }
    }

    return {
      total: payments.length,
      upserted: upserted.length,
      failed: failed.length,
      payments: upserted,
      invoicesUpdated: invoicesUpdated.length,
      errors: errors.length > 0 ? errors : null,
      failures: failed.length > 0 ? failed : null,
    };
  },

  // Sprint 4.3: Ingest Remittances (Bulk PDF Upload)
  async ingestRemittances(files, vendorId, companyId) {
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new ValidationError('ingestRemittances requires files array', null, {
        hasFiles: !!files,
        fileCount: files?.length || 0,
      });
    }

    if (!vendorId || !companyId) {
      throw new ValidationError('ingestRemittances requires vendorId and companyId', null, {
        vendorId,
        companyId,
      });
    }

    // Helper: Extract potential invoice/payment references from filename using fuzzy matching
    const extractReferences = filename => {
      const filenameWithoutExt = filename.replace(/\.(pdf|PDF)$/i, '').trim();
      const references = {
        invoiceNums: [],
        paymentRefs: [],
        exactMatch: filenameWithoutExt,
      };

      // Pattern 1: Invoice numbers (INV-XXX, INV-XXXX-XXX, INV_XXX, etc.)
      // Matches: INV-123, INV-2024-001, INV_456, Invoice-789, etc.
      const invoicePatterns = [
        /(?:INV|Invoice|INVOICE)[\s_-]?([A-Z0-9-]+)/gi,
        /([A-Z]{2,4}[\s_-]?\d{3,}(?:[\s_-]?\d{3,})?)/gi, // Generic alphanumeric patterns
      ];

      invoicePatterns.forEach(pattern => {
        const matches = filenameWithoutExt.matchAll(pattern);
        for (const match of matches) {
          const ref = match[1] || match[0];
          if (ref && ref.length >= 3) {
            references.invoiceNums.push(ref.trim().toUpperCase());
          }
        }
      });

      // Pattern 2: Payment references (PAY-XXX, CHQ-XXX, PAYMENT-XXX, etc.)
      const paymentPatterns = [
        /(?:PAY|Payment|PAYMENT|CHQ|Cheque|CHECK)[\s_-]?([A-Z0-9-]+)/gi,
        /(?:REF|Reference|REFERENCE)[\s_-]?([A-Z0-9-]+)/gi,
      ];

      paymentPatterns.forEach(pattern => {
        const matches = filenameWithoutExt.matchAll(pattern);
        for (const match of matches) {
          const ref = match[1] || match[0];
          if (ref && ref.length >= 3) {
            references.paymentRefs.push(ref.trim().toUpperCase());
          }
        }
      });

      // Remove duplicates
      references.invoiceNums = [...new Set(references.invoiceNums)];
      references.paymentRefs = [...new Set(references.paymentRefs)];

      return references;
    };

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const filename = file.originalname || file.name || '';
        if (!filename) {
          errors.push({
            filename: 'unknown',
            error: 'Filename is missing',
          });
          continue;
        }

        // Extract potential references from filename
        const refs = extractReferences(filename);
        let matchedPayment = null;
        let matchedInvoice = null;

        // Strategy 1: Try exact match first (for simple filenames like "INV-123.pdf")
        const filenameWithoutExt = filename.replace(/\.(pdf|PDF)$/i, '').trim();

        // Try invoice exact match
        const exactInvoiceQuery = supabase
          .from('vmp_invoices')
          .select('id, invoice_num')
          .eq('vendor_id', vendorId)
          .eq('company_id', companyId)
          .ilike('invoice_num', filenameWithoutExt)
          .limit(1)
          .single();

        const { data: exactInvoiceData } = await withTimeout(
          exactInvoiceQuery,
          5000,
          'findInvoiceExact'
        );

        if (exactInvoiceData) {
          matchedInvoice = exactInvoiceData;
        } else {
          // Strategy 2: Try fuzzy match with extracted invoice numbers
          for (const invoiceNum of refs.invoiceNums) {
            const fuzzyInvoiceQuery = supabase
              .from('vmp_invoices')
              .select('id, invoice_num')
              .eq('vendor_id', vendorId)
              .eq('company_id', companyId)
              .ilike('invoice_num', `%${invoiceNum}%`)
              .limit(1)
              .single();

            const { data: fuzzyInvoiceData } = await withTimeout(
              fuzzyInvoiceQuery,
              5000,
              'findInvoiceFuzzy'
            );
            if (fuzzyInvoiceData) {
              matchedInvoice = fuzzyInvoiceData;
              break;
            }
          }
        }

        // If invoice found, find linked payment
        if (matchedInvoice) {
          const paymentQuery = supabase
            .from('vmp_payments')
            .select('id, payment_ref, invoice_id')
            .eq('vendor_id', vendorId)
            .eq('company_id', companyId)
            .eq('invoice_id', matchedInvoice.id)
            .limit(1)
            .single();

          const { data: paymentData } = await withTimeout(
            paymentQuery,
            5000,
            'findPaymentByInvoice'
          );
          if (paymentData) {
            matchedPayment = paymentData;
          }
        }

        // Strategy 3: If no payment found yet, try payment reference matching
        if (!matchedPayment) {
          // Try exact payment ref match
          const exactPaymentQuery = supabase
            .from('vmp_payments')
            .select('id, payment_ref')
            .eq('vendor_id', vendorId)
            .eq('company_id', companyId)
            .ilike('payment_ref', filenameWithoutExt)
            .limit(1)
            .single();

          const { data: exactPaymentData } = await withTimeout(
            exactPaymentQuery,
            5000,
            'findPaymentExact'
          );
          if (exactPaymentData) {
            matchedPayment = exactPaymentData;
          } else {
            // Try fuzzy match with extracted payment refs
            for (const paymentRef of refs.paymentRefs) {
              const fuzzyPaymentQuery = supabase
                .from('vmp_payments')
                .select('id, payment_ref')
                .eq('vendor_id', vendorId)
                .eq('company_id', companyId)
                .ilike('payment_ref', `%${paymentRef}%`)
                .limit(1)
                .single();

              const { data: fuzzyPaymentData } = await withTimeout(
                fuzzyPaymentQuery,
                5000,
                'findPaymentFuzzy'
              );
              if (fuzzyPaymentData) {
                matchedPayment = fuzzyPaymentData;
                break;
              }
            }
          }
        }

        if (!matchedPayment) {
          errors.push({
            filename: filename,
            error: `No matching payment or invoice found. Tried: ${refs.exactMatch}, invoice patterns: ${refs.invoiceNums.join(', ') || 'none'}, payment patterns: ${refs.paymentRefs.join(', ') || 'none'}`,
          });
          continue;
        }

        // Generate storage path for remittance (sanitize filename for storage)
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `remittances/${vendorId}/${companyId}/${matchedPayment.id}/${sanitizedFilename}`;

        // Upload to Supabase Storage (using vmp-evidence bucket - can create vmp-remittances bucket later)
        const uploadPromise = supabase.storage
          .from('vmp-evidence')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'application/pdf',
            upsert: true,
            cacheControl: '3600', // Cache for 1 hour
          });

        const { data: uploadData, error: uploadError } = await withTimeout(
          uploadPromise,
          30000, // 30 second timeout for file uploads
          `uploadRemittance(${filename})`
        );

        if (uploadError) {
          const handledError = handleSupabaseError(uploadError, 'uploadRemittance');
          errors.push({
            filename: filename,
            error: `Storage upload failed: ${handledError?.message || uploadError.message}`,
          });
          logError(handledError || uploadError, {
            operation: 'uploadRemittance',
            filename,
            storagePath,
            fileSize: file.buffer?.length || 0,
          });
          continue;
        }

        // Generate public URL (getPublicUrl is synchronous)
        const { data: urlData } = supabase.storage.from('vmp-evidence').getPublicUrl(storagePath);

        const remittanceUrl =
          urlData?.publicUrl ||
          `${supabaseUrl}/storage/v1/object/public/vmp-evidence/${storagePath}`;

        // Update payment record with remittance URL
        const updateQuery = supabase
          .from('vmp_payments')
          .update({
            remittance_url: remittanceUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedPayment.id)
          .select()
          .single();

        const { data: updatedPayment, error: updateError } = await withTimeout(
          updateQuery,
          5000,
          'updatePaymentRemittance'
        );

        if (updateError) {
          errors.push({
            filename: filename,
            error: `Failed to update payment record: ${updateError.message}`,
          });
          continue;
        }

        results.push({
          filename: filename,
          paymentId: matchedPayment.id,
          remittanceUrl: remittanceUrl,
          matchedInvoice: matchedInvoice?.invoice_num || null,
        });
      } catch (fileError) {
        errors.push({
          filename: file.originalname || file.name || 'unknown',
          error: fileError.message,
        });
      }
    }

    return {
      total: files.length,
      processed: results.length,
      failed: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : null,
    };
  },

  // Helper: Parse CSV line (handles quoted fields with commas)
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());
    return result;
  },

  // Helper: Parse date (supports multiple formats)
  _parseDate(dateStr) {
    // Try ISO format first (YYYY-MM-DD)
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats: MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // YYYY-MM-DD
          date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
        } else {
          // MM/DD/YYYY or DD/MM/YYYY (assume MM/DD/YYYY)
          date = new Date(`${match[3]}-${match[1]}-${match[2]}`);
        }
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  },

  // Sprint 2.4: Get Invoices for Vendor
  async getInvoices(vendorId, companyId = null, filters = {}) {
    if (!vendorId) {
      throw new ValidationError('getInvoices requires vendorId', null, { vendorId });
    }

    // Mapper: Convert DB row to canonical domain shape expected by matching engine/tests
    function mapInvoiceRowToDomain(row) {
      return {
        ...row,
        // Canonical names
        invoice_number:
          row.invoice_number ?? row.invoice_num ?? row.invoiceNo ?? row.invoice_no ?? null,
        total_amount: row.total_amount ?? row.amount ?? row.totalAmount ?? null,
        currency: row.currency ?? row.currency_code ?? row.currencyCode ?? null,
        // Dates / docs
        invoice_date: row.invoice_date ?? row.date ?? row.invoiceDate ?? null,
        doc_number:
          row.doc_number ??
          row.document_no ??
          row.docNo ??
          row.invoice_number ??
          row.invoice_num ??
          null,
      };
    }

    let query = supabase
      .from('vmp_invoices')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name, currency_code)
            `
      )
      .eq('vendor_id', vendorId)
      .order('invoice_date', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.search) {
      query = query.ilike('invoice_num', `%${filters.search}%`);
    }

    const { data, error } = await withTimeout(query, 10000, `getInvoices(${vendorId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getInvoices');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch invoices', error, { vendorId, companyId });
    }

    return (data || []).map(mapInvoiceRowToDomain);
  },

  // Sprint 4.4: Get Payments for Vendor
  async getPayments(vendorId, companyId = null, filters = {}) {
    if (!vendorId) {
      throw new ValidationError('getPayments requires vendorId', null, { vendorId });
    }

    let query = supabase
      .from('vmp_payments')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name, currency_code),
                vmp_invoices (id, invoice_num, invoice_date, amount)
            `
      )
      .eq('vendor_id', vendorId)
      .order('payment_date', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Apply filters
    if (filters.payment_ref) {
      query = query.ilike('payment_ref', `%${filters.payment_ref}%`);
    }

    if (filters.invoice_num) {
      query = query.ilike('invoice_num', `%${filters.invoice_num}%`);
    }

    if (filters.date_from) {
      query = query.gte('payment_date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('payment_date', filters.date_to);
    }

    // Sprint 7.3: Amount range filters
    if (filters.amount_min) {
      query = query.gte('amount', parseFloat(filters.amount_min));
    }

    if (filters.amount_max) {
      query = query.lte('amount', parseFloat(filters.amount_max));
    }

    // Sprint 7.3: Status filter (based on remittance availability)
    if (filters.status) {
      if (filters.status === 'with_remittance') {
        query = query.not('remittance_url', 'is', null);
      } else if (filters.status === 'without_remittance') {
        query = query.is('remittance_url', null);
      }
    }

    const { data, error } = await withTimeout(query, 10000, `getPayments(${vendorId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getPayments');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch payments', error, { vendorId });
    }

    return data || [];
  },

  // Sprint 8.3: Get Payment Status Explanation and Blocking Cases
  async getPaymentStatusInfo(paymentId, vendorId) {
    if (!paymentId || !vendorId) {
      throw new ValidationError('getPaymentStatusInfo requires both paymentId and vendorId', null, {
        paymentId,
        vendorId,
      });
    }

    try {
      // Get payment with linked invoice
      const paymentQuery = supabase
        .from('vmp_payments')
        .select(
          `
                    *,
                    vmp_invoices (
                        id,
                        invoice_num,
                        status,
                        amount,
                        invoice_date
                    )
                `
        )
        .eq('id', paymentId)
        .eq('vendor_id', vendorId)
        .single();

      const { data: payment, error: paymentError } = await withTimeout(
        paymentQuery,
        10000,
        `getPaymentStatusInfo(${paymentId})`
      );

      if (paymentError || !payment) {
        return null;
      }

      // Get blocking cases (cases linked to the invoice that are not resolved)
      const blockingCases = [];
      if (payment.vmp_invoices && payment.vmp_invoices.length > 0) {
        const invoice = Array.isArray(payment.vmp_invoices)
          ? payment.vmp_invoices[0]
          : payment.vmp_invoices;

        // Get cases linked to this invoice
        const invoiceCasesQuery = supabase
          .from('vmp_cases')
          .select('id, subject, status, case_type')
          .eq('linked_invoice_id', invoice.id)
          .eq('vendor_id', vendorId)
          .neq('status', 'resolved')
          .neq('status', 'cancelled');

        const { data: invoiceCases } = await withTimeout(
          invoiceCasesQuery,
          10000,
          `getPaymentStatusInfo-invoiceCases(${invoice.id})`
        );

        if (invoiceCases) {
          blockingCases.push(...invoiceCases);
        }
      }

      // Get cases directly linked to payment
      const paymentCasesQuery = supabase
        .from('vmp_cases')
        .select('id, subject, status, case_type')
        .eq('linked_payment_id', paymentId)
        .eq('vendor_id', vendorId)
        .neq('status', 'resolved');

      const { data: paymentCases } = await withTimeout(
        paymentCasesQuery,
        10000,
        `getPaymentStatusInfo-cases(${paymentId})`
      );

      if (paymentCases) {
        blockingCases.push(...paymentCases);
      }

      // Determine payment status explanation
      let statusExplanation = '';
      let forecastDate = null;

      const invoice =
        payment.vmp_invoices &&
        (Array.isArray(payment.vmp_invoices) ? payment.vmp_invoices[0] : payment.vmp_invoices);

      if (invoice) {
        if (invoice.status === 'disputed') {
          statusExplanation =
            'Payment is blocked due to invoice dispute. Please resolve the linked case to proceed.';
        } else if (invoice.status === 'pending' || invoice.status === 'matched') {
          if (blockingCases.length > 0) {
            statusExplanation = `Payment pending: ${blockingCases.length} open case(s) must be resolved first.`;
            // Forecast: 3-5 business days after case resolution
            forecastDate = new Date();
            forecastDate.setDate(forecastDate.getDate() + 5);
          } else {
            statusExplanation = 'Payment is pending approval. Expected within 3-5 business days.';
            forecastDate = new Date();
            forecastDate.setDate(forecastDate.getDate() + 5);
          }
        } else if (invoice.status === 'paid') {
          statusExplanation = 'Payment has been processed and completed.';
        }
      } else {
        statusExplanation = 'Payment is recorded. No linked invoice found.';
      }

      return {
        payment,
        blockingCases: blockingCases || [],
        statusExplanation,
        forecastDate: forecastDate ? forecastDate.toISOString() : null,
      };
    } catch (error) {
      console.error('Error in getPaymentStatusInfo:', error);
      return null;
    }
  },

  // Sprint 4.4: Get Payment Detail
  async getPaymentDetail(paymentId, vendorId) {
    if (!paymentId || !vendorId) {
      throw new ValidationError('getPaymentDetail requires both paymentId and vendorId', null, {
        paymentId,
        vendorId,
      });
    }

    const queryPromise = supabase
      .from('vmp_payments')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name, currency_code),
                vmp_invoices (id, invoice_num, invoice_date, amount, status)
            `
      )
      .eq('id', paymentId)
      .eq('vendor_id', vendorId)
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `getPaymentDetail(${paymentId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getPaymentDetail');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }

    return data;
  },

  // Sprint 2.5: Get Invoice Detail
  async getInvoiceDetail(invoiceId, vendorId) {
    if (!invoiceId || !vendorId) {
      throw new ValidationError('getInvoiceDetail requires both invoiceId and vendorId', null, {
        invoiceId,
        vendorId,
      });
    }

    const queryPromise = supabase
      .from('vmp_invoices')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name, currency_code, country_code),
                vmp_vendors (id, name)
            `
      )
      .eq('id', invoiceId)
      .eq('vendor_id', vendorId)
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `getInvoiceDetail(${invoiceId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getInvoiceDetail');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }
    // Map to canonical domain shape
    return {
      ...data,
      invoice_number: data?.invoice_number ?? data?.invoice_num ?? null,
      total_amount: data?.total_amount ?? data?.amount ?? null,
      currency: data?.currency ?? data?.currency_code ?? null,
      invoice_date: data?.invoice_date ?? null,
    };
  },

  // Sprint 2.6: Get Matching Status (Enhanced for Sprint 7.1)
  async getMatchingStatus(invoiceId) {
    if (!invoiceId) {
      throw new ValidationError('getMatchingStatus requires invoiceId', null, { invoiceId });
    }

    // Get invoice with amount and date for comparison
    const invoiceQuery = supabase
      .from('vmp_invoices')
      .select('po_ref, grn_ref, status, company_id, amount, invoice_date, currency_code')
      .eq('id', invoiceId)
      .single();

    const { data: invoice, error: invoiceError } = await withTimeout(
      invoiceQuery,
      5000,
      'getInvoiceForMatching'
    );

    if (invoiceError || !invoice) {
      throw new NotFoundError('Invoice not found', { invoiceId });
    }

    // Check PO match
    let poMatch = null;
    if (invoice.po_ref) {
      const poQuery = supabase
        .from('vmp_po_refs')
        .select('*')
        .eq('company_id', invoice.company_id)
        .eq('po_number', invoice.po_ref)
        .single();

      const { data: poData } = await withTimeout(poQuery, 5000, 'getPO');
      poMatch = poData;
    }

    // Check GRN match
    let grnMatch = null;
    if (invoice.grn_ref) {
      const grnQuery = supabase
        .from('vmp_grn_refs')
        .select('*')
        .eq('company_id', invoice.company_id)
        .eq('grn_number', invoice.grn_ref)
        .single();

      const { data: grnData } = await withTimeout(grnQuery, 5000, 'getGRN');
      grnMatch = grnData;
    }

    // Determine matching state and detect mismatches
    let matchState = 'READY';
    const exceptions = [];
    const mismatches = {
      amount: [],
      date: [],
    };

    // PO validation
    if (!invoice.po_ref) {
      matchState = 'WARN';
      exceptions.push('No PO reference');
    } else if (!poMatch) {
      matchState = 'BLOCK';
      exceptions.push(`PO ${invoice.po_ref} not found`);
    } else {
      // Check PO status
      if (poMatch.status !== 'open') {
        matchState = 'WARN';
        exceptions.push(`PO ${invoice.po_ref} is ${poMatch.status}`);
      }

      // Amount mismatch: Invoice vs PO
      if (poMatch.total_amount && invoice.amount) {
        const amountDiff = Math.abs(Number(poMatch.total_amount) - Number(invoice.amount));
        if (amountDiff > 0.01) {
          // Allow for rounding differences
          mismatches.amount.push({
            type: 'po_invoice',
            po_amount: Number(poMatch.total_amount),
            invoice_amount: Number(invoice.amount),
            difference: amountDiff,
            currency: invoice.currency_code || 'USD',
          });
          if (matchState === 'READY') matchState = 'WARN';
        }
      }

      // Date comparison: Invoice date vs PO created date
      if (invoice.invoice_date && poMatch.created_at) {
        const invoiceDate = new Date(invoice.invoice_date);
        const poDate = new Date(poMatch.created_at);
        const daysDiff = Math.abs((invoiceDate - poDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          // Flag if more than 30 days difference
          mismatches.date.push({
            type: 'po_invoice',
            po_date: poMatch.created_at,
            invoice_date: invoice.invoice_date,
            days_difference: Math.round(daysDiff),
          });
        }
      }
    }

    // GRN validation
    if (!invoice.grn_ref) {
      if (matchState === 'READY') matchState = 'WARN';
      exceptions.push('No GRN reference');
    } else if (!grnMatch) {
      matchState = 'BLOCK';
      exceptions.push(`GRN ${invoice.grn_ref} not found`);
    } else {
      // Check GRN status
      if (grnMatch.status !== 'verified') {
        matchState = 'BLOCK';
        exceptions.push(`GRN ${invoice.grn_ref} is ${grnMatch.status}`);
      }

      // Amount mismatch: Invoice vs GRN
      if (grnMatch.total_amount && invoice.amount) {
        const amountDiff = Math.abs(Number(grnMatch.total_amount) - Number(invoice.amount));
        if (amountDiff > 0.01) {
          mismatches.amount.push({
            type: 'grn_invoice',
            grn_amount: Number(grnMatch.total_amount),
            invoice_amount: Number(invoice.amount),
            difference: amountDiff,
            currency: invoice.currency_code || 'USD',
          });
          if (matchState === 'READY') matchState = 'WARN';
        }
      }

      // Date comparison: Invoice date vs GRN created date
      if (invoice.invoice_date && grnMatch.created_at) {
        const invoiceDate = new Date(invoice.invoice_date);
        const grnDate = new Date(grnMatch.created_at);
        const daysDiff = Math.abs((invoiceDate - grnDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          mismatches.date.push({
            type: 'grn_invoice',
            grn_date: grnMatch.created_at,
            invoice_date: invoice.invoice_date,
            days_difference: Math.round(daysDiff),
          });
        }
      }
    }

    // PO vs GRN amount comparison (if both exist)
    if (poMatch && grnMatch && poMatch.total_amount && grnMatch.total_amount) {
      const poGrnDiff = Math.abs(Number(poMatch.total_amount) - Number(grnMatch.total_amount));
      if (poGrnDiff > 0.01) {
        mismatches.amount.push({
          type: 'po_grn',
          po_amount: Number(poMatch.total_amount),
          grn_amount: Number(grnMatch.total_amount),
          difference: poGrnDiff,
          currency: invoice.currency_code || 'USD',
        });
      }
    }

    return {
      invoice_id: invoiceId,
      match_state: matchState,
      exceptions,
      mismatches,
      po_match: poMatch,
      grn_match: grnMatch,
      invoice_po_ref: invoice.po_ref,
      invoice_grn_ref: invoice.grn_ref,
      invoice_amount: invoice.amount ? Number(invoice.amount) : null,
      invoice_date: invoice.invoice_date,
      invoice_currency: invoice.currency_code || 'USD',
    };
  },

  // Sprint 2.7: Create Case from Invoice (Enhanced for Sprint 7.2 - Exception Workflow)
  async createCaseFromInvoice(invoiceId, vendorId, userId, subject = null, exceptionType = null) {
    if (!invoiceId || !vendorId || !userId) {
      throw new ValidationError(
        'createCaseFromInvoice requires invoiceId, vendorId, and userId',
        null,
        {
          invoiceId,
          vendorId,
          userId,
        }
      );
    }

    // Get invoice detail
    const invoice = await this.getInvoiceDetail(invoiceId, vendorId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found', { invoiceId });
    }

    // Build subject with exception details if provided
    let caseSubject = subject || `Invoice ${invoice.invoice_num} Exception`;
    if (exceptionType) {
      const exceptionLabels = {
        missing_grn: 'Missing GRN',
        amount_mismatch: 'Amount Mismatch',
        date_mismatch: 'Date Mismatch',
        missing_po: 'Missing PO',
        po_status: 'PO Status Issue',
        grn_status: 'GRN Status Issue',
      };
      caseSubject = `${exceptionLabels[exceptionType] || 'Exception'}: ${invoice.invoice_num}`;
    }

    // Create case
    const caseData = {
      tenant_id: invoice.vmp_companies?.tenant_id || null, // Will need to get from company
      company_id: invoice.company_id,
      vendor_id: vendorId,
      case_type: 'invoice',
      status: 'open',
      subject: caseSubject,
      owner_team: 'ap',
      linked_invoice_id: invoiceId,
      group_id: null, // Will be set from company relationship
    };

    // Get company to set group_id
    const companyQuery = supabase
      .from('vmp_companies')
      .select('group_id, tenant_id')
      .eq('id', invoice.company_id)
      .single();

    const { data: company } = await withTimeout(companyQuery, 5000, 'getCompanyForCase');
    if (company) {
      caseData.tenant_id = company.tenant_id;
      caseData.group_id = company.group_id;
    }

    const insertQuery = supabase.from('vmp_cases').insert(caseData).select().single();

    const { data: newCase, error } = await withTimeout(insertQuery, 10000, 'createCaseFromInvoice');

    if (error) {
      const handledError = handleSupabaseError(error, 'createCaseFromInvoice');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create case from invoice', error, { invoiceId });
    }

    // Create checklist steps with exception-specific steps if provided
    try {
      if (exceptionType) {
        // Use exception-specific checklist steps
        const { getChecklistStepsForException } = await import('../utils/checklist-rules.js');
        const exceptionSteps = getChecklistStepsForException(exceptionType);

        // Also get base invoice steps and merge
        const { getChecklistStepsForCaseType } = await import('../utils/checklist-rules.js');
        const baseSteps = getChecklistStepsForCaseType('invoice');

        // Create all steps (exception steps first, then base steps)
        for (const step of [...exceptionSteps, ...baseSteps]) {
          try {
            await this.createChecklistStep(newCase.id, step.label, step.required_evidence_type);
          } catch (stepError) {
            logError(stepError, {
              operation: 'createChecklistStep',
              caseId: newCase.id,
              stepLabel: step.label,
            });
            // Continue with other steps
          }
        }
      } else {
        // Use standard ensureChecklistSteps
        await this.ensureChecklistSteps(newCase.id, 'invoice');
      }
    } catch (checklistError) {
      logError(checklistError, {
        operation: 'ensureChecklistSteps',
        caseId: newCase.id,
        caseType: 'invoice',
        exceptionType,
      });
      // Don't fail case creation if checklist creation fails
    }

    return newCase;
  },

  // Sprint 3.1: Create Invite
  async createInvite(vendorId, email, companyIds = [], createdByUserId = null) {
    if (!vendorId || !email) {
      throw new ValidationError('createInvite requires vendorId and email', null, {
        vendorId,
        email,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', 'email', { email });
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');

    // Set expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite record
    const inviteQuery = supabase
      .from('vmp_invites')
      .insert({
        token,
        vendor_id: vendorId,
        email: email.toLowerCase().trim(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    const { data: invite, error: inviteError } = await withTimeout(
      inviteQuery,
      10000,
      'createInvite'
    );

    if (inviteError) {
      const handledError = handleSupabaseError(inviteError, 'createInvite');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create invite', inviteError, { vendorId, email });
    }

    // Create vendor-company links if companyIds provided
    if (companyIds && companyIds.length > 0) {
      const linksToCreate = companyIds.map(companyId => ({
        vendor_id: vendorId,
        company_id: companyId,
      }));

      // Use upsert to avoid duplicates
      const linksQuery = supabase.from('vmp_vendor_company_links').upsert(linksToCreate, {
        onConflict: 'vendor_id,company_id',
        ignoreDuplicates: false,
      });

      const { error: linksError } = await withTimeout(
        linksQuery,
        10000,
        'createVendorCompanyLinks'
      );

      if (linksError) {
        logError(
          new DatabaseError('Failed to create vendor-company links', linksError, {
            vendorId,
            companyIds,
          }),
          {
            operation: 'createVendorCompanyLinks',
            vendorId,
            companyIds,
          }
        );
        // Don't fail invite creation if links fail (can be created later)
      }
    }

    return {
      ...invite,
      invite_url: `/accept?token=${token}`, // Full URL will be constructed in route
    };
  },

  // Sprint 3.2: Get Invite by Token (with tenant info)
  async getInviteByToken(token) {
    if (!token) {
      throw new ValidationError('getInviteByToken requires token', null, { token });
    }

    // First get invite with vendor info
    const inviteQuery = supabase
      .from('vmp_invites')
      .select(
        `
                *,
                vmp_vendors (id, name, tenant_id)
            `
      )
      .eq('token', token)
      .single();

    const { data: inviteData, error: inviteError } = await withTimeout(
      inviteQuery,
      10000,
      `getInviteByToken(${token.substring(0, 8)}...)`
    );

    if (inviteError) {
      const handledError = handleSupabaseError(inviteError, 'getInviteByToken');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }

    // Get tenant info separately (more reliable than nested query)
    let tenantData = null;
    if (inviteData.vmp_vendors?.tenant_id) {
      const tenantQuery = supabase
        .from('vmp_tenants')
        .select('id, name')
        .eq('id', inviteData.vmp_vendors.tenant_id)
        .single();

      const { data: tenant, error: tenantError } = await withTimeout(
        tenantQuery,
        5000,
        'getTenantForInvite'
      );

      if (!tenantError && tenant) {
        tenantData = tenant;
      }
    }

    // Get vendor-company links separately
    const linksQuery = supabase
      .from('vmp_vendor_company_links')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name)
            `
      )
      .eq('vendor_id', inviteData.vendor_id);

    const { data: linksData, error: linksError } = await withTimeout(
      linksQuery,
      10000,
      'getVendorCompanyLinks'
    );

    // Combine data with tenant info
    const data = {
      ...inviteData,
      vmp_vendor_company_links: linksData || [],
    };

    // Attach tenant to vendor object
    if (data.vmp_vendors && tenantData) {
      data.vmp_vendors.vmp_tenants = tenantData;
    }

    // Check if invite is expired
    if (new Date(data.expires_at) < new Date()) {
      return { ...data, expired: true };
    }

    // Check if invite is already used
    if (data.used_at) {
      return { ...data, used: true };
    }

    return data;
  },

  // Get Invite by Email (for Supabase Auth invites)
  async getInviteByEmail(email) {
    if (!email) {
      throw new ValidationError('getInviteByEmail requires email', null, { email });
    }

    // Get the most recent non-expired, non-used invite for this email
    const inviteQuery = supabase
      .from('vmp_invites')
      .select(
        `
                *,
                vmp_vendors (id, name, tenant_id)
            `
      )
      .eq('email', email.toLowerCase().trim())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: inviteData, error: inviteError } = await withTimeout(
      inviteQuery,
      10000,
      `getInviteByEmail(${email})`
    );

    if (inviteError) {
      const handledError = handleSupabaseError(inviteError, 'getInviteByEmail');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }

    // Get tenant info
    let tenantData = null;
    if (inviteData.vmp_vendors?.tenant_id) {
      const tenantQuery = supabase
        .from('vmp_tenants')
        .select('id, name')
        .eq('id', inviteData.vmp_vendors.tenant_id)
        .single();

      const { data: tenant, error: tenantError } = await withTimeout(
        tenantQuery,
        5000,
        'getTenantForInvite'
      );

      if (!tenantError && tenant) {
        tenantData = tenant;
      }
    }

    // Get vendor-company links
    const linksQuery = supabase
      .from('vmp_vendor_company_links')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name)
            `
      )
      .eq('vendor_id', inviteData.vendor_id);

    const { data: linksData, error: linksError } = await withTimeout(
      linksQuery,
      10000,
      'getVendorCompanyLinks'
    );

    const data = {
      ...inviteData,
      vmp_vendor_company_links: linksData || [],
    };

    if (data.vmp_vendors && tenantData) {
      data.vmp_vendors.vmp_tenants = tenantData;
    }

    return data;
  },

  // Create Vendor User from Supabase Auth (for Supabase invite flow)
  async createVendorUserFromSupabase(vendorId, supabaseUserId, email, displayName = null) {
    if (!vendorId || !supabaseUserId || !email) {
      throw new ValidationError(
        'createVendorUserFromSupabase requires vendorId, supabaseUserId, and email',
        null,
        {
          vendorId,
          supabaseUserId,
          email,
        }
      );
    }

    // Check if user already exists
    const existingUserQuery = supabase
      .from('vmp_vendor_users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    const { data: existingUser, error: existingError } = await withTimeout(
      existingUserQuery,
      5000,
      'checkExistingUserForSupabase'
    );

    if (existingUser) {
      throw new ConflictError('User already exists', { email });
    }

    // Create vendor user linked to Supabase Auth user
    const insertQuery = supabase
      .from('vmp_vendor_users')
      .insert({
        vendor_id: vendorId,
        email: email.toLowerCase().trim(),
        display_name: displayName || email.split('@')[0],
        supabase_user_id: supabaseUserId, // Link to Supabase Auth user
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { data: userData, error: insertError } = await withTimeout(
      insertQuery,
      10000,
      'createVendorUserFromSupabase'
    );

    if (insertError) {
      const handledError = handleSupabaseError(insertError, 'createVendorUserFromSupabase');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create vendor user', insertError, { vendorId, email });
    }

    return userData;
  },

  // Sprint 3.2: Create Vendor User
  async createVendorUser(vendorId, email, passwordHash, displayName = null) {
    if (!vendorId || !email || !passwordHash) {
      throw new ValidationError(
        'createVendorUser requires vendorId, email, and passwordHash',
        null,
        {
          vendorId,
          email,
          hasPasswordHash: !!passwordHash,
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', 'email', { email });
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new ValidationError('User with this email already exists', 'email', { email });
    }

    const insertQuery = supabase
      .from('vmp_vendor_users')
      .insert({
        vendor_id: vendorId,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        display_name: displayName || email.split('@')[0],
        is_active: true,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(insertQuery, 10000, 'createVendorUser');

    if (error) {
      const handledError = handleSupabaseError(error, 'createVendorUser');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create vendor user', error, { vendorId, email });
    }

    return data;
  },

  // Independent Investigator: Create Independent User (no vendor required)
  async createIndependentUser(supabaseUserId, email, displayName = null) {
    if (!supabaseUserId || !email) {
      throw new ValidationError('createIndependentUser requires supabaseUserId and email', null, {
        supabaseUserId,
        email,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', 'email', { email });
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new ValidationError('User with this email already exists', 'email', { email });
    }

    // Create independent vendor_user (vendor_id is null)
    const insertQuery = supabase
      .from('vmp_vendor_users')
      .insert({
        vendor_id: null,
        email: email.toLowerCase().trim(),
        display_name: displayName || email.split('@')[0],
        user_tier: 'independent',
        is_active: true,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(insertQuery, 10000, 'createIndependentUser');

    if (error) {
      const handledError = handleSupabaseError(error, 'createIndependentUser');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create independent user', error, { email });
    }

    return data;
  },

  // Sprint 3.3: Accept Invite and Create User (Atomic Operation)
  async acceptInviteAndCreateUser(token, password, displayName = null) {
    if (!token || !password) {
      throw new ValidationError('acceptInviteAndCreateUser requires token and password', null, {
        hasToken: !!token,
        hasPassword: !!password,
      });
    }

    // 1. Verify token (re-validate for safety)
    const invite = await this.getInviteByToken(token);
    if (!invite) {
      throw new NotFoundError('Invite not found', { token });
    }

    if (invite.expired) {
      throw new ValidationError('Invite has expired', 'token', {
        token,
        expiresAt: invite.expires_at,
      });
    }

    if (invite.used) {
      throw new ValidationError('Invite has already been used', 'token', {
        token,
        usedAt: invite.used_at,
      });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Create vendor user
    const user = await this.createVendorUser(
      invite.vendor_id,
      invite.email,
      passwordHash,
      displayName || null
    );

    // 4. Mark invite as used
    await this.markInviteAsUsed(invite.id, user.id);

    return {
      user,
      invite,
    };
  },

  // Sprint 3.2: Mark Invite as Used
  async markInviteAsUsed(inviteId, userId = null) {
    if (!inviteId) {
      throw new ValidationError('markInviteAsUsed requires inviteId', null, { inviteId });
    }

    const updateQuery = supabase
      .from('vmp_invites')
      .update({
        used_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .select()
      .single();

    const { data, error } = await withTimeout(updateQuery, 10000, 'markInviteAsUsed');

    if (error) {
      const handledError = handleSupabaseError(error, 'markInviteAsUsed');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to mark invite as used', error, { inviteId });
    }

    return data;
  },

  // Sprint 3.3: Create Onboarding Case
  async createOnboardingCase(vendorId, companyId = null) {
    if (!vendorId) {
      throw new ValidationError('createOnboardingCase requires vendorId', null, { vendorId });
    }

    // Get vendor to determine tenant_id
    const vendorQuery = supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorId)
      .single();

    const { data: vendor, error: vendorError } = await withTimeout(
      vendorQuery,
      5000,
      'getVendorForOnboarding'
    );

    if (vendorError || !vendor) {
      throw new NotFoundError('Vendor not found', { vendorId });
    }

    // If companyId not provided, get first company linked to vendor
    let finalCompanyId = companyId;
    let groupId = null;

    if (!finalCompanyId) {
      const linksQuery = supabase
        .from('vmp_vendor_company_links')
        .select('company_id')
        .eq('vendor_id', vendorId)
        .limit(1)
        .single();

      const { data: link } = await withTimeout(linksQuery, 5000, 'getVendorCompanyLink');
      if (link) {
        finalCompanyId = link.company_id;
      }
    }

    // Get company to determine group_id (whether provided or fetched)
    if (finalCompanyId) {
      // Get company to determine group_id
      const companyQuery = supabase
        .from('vmp_companies')
        .select('group_id')
        .eq('id', finalCompanyId)
        .single();

      const { data: company } = await withTimeout(companyQuery, 5000, 'getCompanyForOnboarding');
      if (company) {
        groupId = company.group_id;
      }
    }

    if (!finalCompanyId) {
      throw new ValidationError('No company linked to vendor. Please link a company first.', null, {
        vendorId,
      });
    }

    // Create onboarding case
    const caseData = {
      tenant_id: vendor.tenant_id,
      company_id: finalCompanyId,
      vendor_id: vendorId,
      case_type: 'onboarding',
      status: 'open',
      subject: 'Supplier Onboarding',
      owner_team: 'procurement',
      group_id: groupId,
    };

    const insertQuery = supabase.from('vmp_cases').insert(caseData).select().single();

    const { data: newCase, error } = await withTimeout(insertQuery, 10000, 'createOnboardingCase');

    if (error) {
      const handledError = handleSupabaseError(error, 'createOnboardingCase');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create onboarding case', error, { vendorId });
    }

    // Ensure checklist steps exist (will use checklist-rules.js)
    try {
      await this.ensureChecklistSteps(newCase.id, 'onboarding');
    } catch (checklistError) {
      logError(checklistError, {
        operation: 'ensureChecklistSteps',
        caseId: newCase.id,
        caseType: 'onboarding',
      });
      // Don't fail case creation if checklist creation fails
    }

    return newCase;
  },

  // Sprint 3.4: Approve Onboarding
  async approveOnboarding(caseId, userId) {
    if (!caseId || !userId) {
      throw new ValidationError('approveOnboarding requires caseId and userId', null, {
        caseId,
        userId,
      });
    }

    // Get case to verify it's an onboarding case
    const caseQuery = supabase
      .from('vmp_cases')
      .select('vendor_id, case_type, status')
      .eq('id', caseId)
      .single();

    const { data: caseData, error: caseError } = await withTimeout(
      caseQuery,
      5000,
      'getCaseForApproval'
    );

    if (caseError || !caseData) {
      throw new NotFoundError('Case not found', { caseId });
    }

    if (caseData.case_type !== 'onboarding') {
      throw new ValidationError('Case is not an onboarding case', null, {
        caseId,
        caseType: caseData.case_type,
      });
    }

    // Update case status to resolved
    const updateCaseQuery = supabase
      .from('vmp_cases')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .select()
      .single();

    const { data: updatedCase, error: updateError } = await withTimeout(
      updateCaseQuery,
      10000,
      'updateOnboardingCase'
    );

    if (updateError) {
      const handledError = handleSupabaseError(updateError, 'approveOnboarding');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to update onboarding case', updateError, { caseId });
    }

    // Activate vendor account (set status='active' in vmp_vendors)
    // Note: Assuming vmp_vendors has a status field. If not, we'll need to add it.
    // For now, we'll just ensure vendor is active via vmp_vendor_users.is_active
    const activateVendorQuery = supabase
      .from('vmp_vendor_users')
      .update({
        is_active: true,
      })
      .eq('vendor_id', caseData.vendor_id);

    const { error: activateError } = await withTimeout(
      activateVendorQuery,
      10000,
      'activateVendorUsers'
    );

    if (activateError) {
      console.error('Error activating vendor users:', activateError);
      // Don't fail approval if activation fails (users might already be active)
    }

    // Create notification message
    try {
      await supabase.from('vmp_messages').insert({
        case_id: caseId,
        sender_type: 'internal',
        channel_source: 'portal',
        body: 'Onboarding approved. Vendor account activated.',
        is_internal_note: false,
        sender_user_id: userId,
      });
    } catch (messageError) {
      console.error('Error creating approval notification:', messageError);
      // Don't fail approval if notification creation fails
    }

    // Sprint 7.2: Log decision
    try {
      await this.logDecision(
        caseId,
        'approve',
        `User ${userId}`,
        'Approved onboarding case and activated vendor account',
        'All onboarding requirements met'
      );
    } catch (logError) {
      console.error('Failed to log decision:', logError);
      // Don't fail approval if decision logging fails
    }

    return updatedCase;
  },

  // Sprint 5.1: Get Vendor Profile
  async getVendorProfile(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getVendorProfile requires vendorId', null, { vendorId });
    }

    // Fetch vendor master data
    const vendorQuery = supabase
      .from('vmp_vendors')
      .select(
        `
                *,
                vmp_tenants (id, name)
            `
      )
      .eq('id', vendorId)
      .single();

    const { data: vendor, error: vendorError } = await withTimeout(
      vendorQuery,
      10000,
      `getVendorProfile(${vendorId})`
    );

    if (vendorError) {
      const handledError = handleSupabaseError(vendorError, 'getVendorProfile');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }

    // Fetch vendor-company links
    const linksQuery = supabase
      .from('vmp_vendor_company_links')
      .select(
        `
                *,
                vmp_companies (id, name, legal_name, country_code, currency_code)
            `
      )
      .eq('vendor_id', vendorId)
      .eq('status', 'active');

    const { data: companyLinks, error: linksError } = await withTimeout(
      linksQuery,
      10000,
      `getVendorCompanyLinks(${vendorId})`
    );

    if (linksError) {
      logError(linksError, { operation: 'getVendorCompanyLinks', vendorId });
      // Don't fail if links query fails, just return vendor without links
    }

    // Fetch vendor users (for display)
    const usersQuery = supabase
      .from('vmp_vendor_users')
      .select('id, email, display_name, is_active, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    const { data: users, error: usersError } = await withTimeout(
      usersQuery,
      10000,
      `getVendorUsers(${vendorId})`
    );

    if (usersError) {
      logError(usersError, { operation: 'getVendorUsers', vendorId });
      // Don't fail if users query fails
    }

    return {
      vendor,
      companyLinks: companyLinks || [],
      users: users || [],
    };
  },

  // Sprint 5.2: Update Vendor Contact Information (Allow-list: address, phone, website only)
  async updateVendorContact(vendorId, contactData) {
    if (!vendorId) {
      throw new ValidationError('updateVendorContact requires vendorId', null, { vendorId });
    }

    if (!contactData || typeof contactData !== 'object') {
      throw new ValidationError('updateVendorContact requires contactData object', null, {
        hasContactData: !!contactData,
      });
    }

    // Allow-list: Only these fields can be updated directly
    const allowedFields = ['address', 'phone', 'website'];
    const updateData = {};

    // Extract only allowed fields
    for (const field of allowedFields) {
      if (contactData.hasOwnProperty(field)) {
        // Allow empty strings (user clearing field) or non-empty values
        updateData[field] = contactData[field]?.trim() || null;
      }
    }

    // Security: Silently ignore any attempts to update restricted fields
    // (bank_name, tax_id, reg_number, account_number, swift_code, etc.)
    const restrictedFields = [
      'bank_name',
      'tax_id',
      'reg_number',
      'account_number',
      'swift_code',
      'bank_address',
      'account_holder_name',
    ];
    const attemptedRestricted = Object.keys(contactData).filter(key =>
      restrictedFields.includes(key)
    );
    if (attemptedRestricted.length > 0) {
      logError(new Error('Attempted to update restricted fields'), {
        operation: 'updateVendorContact',
        vendorId,
        attemptedFields: attemptedRestricted,
      });
      // Continue with allowed fields only (don't throw error, just log)
    }

    // If no allowed fields to update, return early
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError(
        'No valid contact fields to update. Allowed fields: address, phone, website',
        null,
        {
          providedFields: Object.keys(contactData),
        }
      );
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Update vendor record
    const updateQuery = supabase
      .from('vmp_vendors')
      .update(updateData)
      .eq('id', vendorId)
      .select()
      .single();

    const { data: updatedVendor, error: updateError } = await withTimeout(
      updateQuery,
      10000,
      `updateVendorContact(${vendorId})`
    );

    if (updateError) {
      const handledError = handleSupabaseError(updateError, 'updateVendorContact');
      if (handledError === null) {
        throw new NotFoundError('Vendor not found', { vendorId });
      }
      throw handledError;
    }

    return updatedVendor;
  },

  // Sprint 5.3: Request Bank Details Change (Creates Payment Case)
  async requestBankDetailsChange(vendorId, newBankDetails, userId) {
    if (!vendorId || !newBankDetails || !userId) {
      throw new ValidationError(
        'requestBankDetailsChange requires vendorId, newBankDetails, and userId',
        null,
        {
          vendorId,
          hasBankDetails: !!newBankDetails,
          userId,
        }
      );
    }

    // Validate required bank details fields
    const requiredFields = ['account_name', 'account_number', 'bank_name', 'swift_code'];
    const missingFields = requiredFields.filter(field => !newBankDetails[field]);

    if (missingFields.length > 0) {
      throw new ValidationError(
        `Missing required bank details fields: ${missingFields.join(', ')}`,
        null,
        {
          missingFields,
        }
      );
    }

    // Get vendor context
    const vendorContext = await this.getVendorContext(userId);
    if (vendorContext.vendor_id !== vendorId) {
      throw new UnauthorizedError('Access denied to this vendor', { vendorId, userId });
    }

    // Get first active company link for the case
    const companyLinksQuery = supabase
      .from('vmp_vendor_company_links')
      .select('company_id')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .limit(1)
      .single();

    const { data: companyLink, error: linkError } = await withTimeout(
      companyLinksQuery,
      5000,
      'getCompanyLinkForBankChange'
    );

    if (linkError || !companyLink) {
      throw new ValidationError('Vendor must be linked to at least one company', null, {
        vendorId,
      });
    }

    // Create payment case for bank details change
    const caseTitle = `Bank Details Change Request - ${newBankDetails.bank_name}`;
    const caseDescription =
      `Request to update bank details:\n\n` +
      `Account Name: ${newBankDetails.account_name}\n` +
      `Account Number: ${newBankDetails.account_number}\n` +
      `Bank Name: ${newBankDetails.bank_name}\n` +
      `SWIFT Code: ${newBankDetails.swift_code}\n` +
      (newBankDetails.branch_address ? `Branch Address: ${newBankDetails.branch_address}\n` : '') +
      (newBankDetails.currency ? `Currency: ${newBankDetails.currency}\n` : '');

    // Get tenant_id and group_id from vendor
    const vendorQuery = supabase
      .from('vmp_vendors')
      .select('tenant_id')
      .eq('id', vendorId)
      .single();

    const { data: vendorData, error: vendorError } = await withTimeout(
      vendorQuery,
      5000,
      'getVendorForBankChange'
    );

    if (vendorError || !vendorData) {
      throw new NotFoundError('Vendor not found', { vendorId });
    }

    // Get group_id from company (if available)
    const companyQuery = supabase
      .from('vmp_companies')
      .select('group_id')
      .eq('id', companyLink.company_id)
      .single();

    const { data: companyData } = await withTimeout(companyQuery, 5000, 'getCompanyGroupId');
    const groupId = companyData?.group_id || null;

    // Create case
    const caseInsertQuery = supabase
      .from('vmp_cases')
      .insert({
        tenant_id: vendorData.tenant_id,
        group_id: groupId,
        company_id: companyLink.company_id,
        vendor_id: vendorId,
        case_type: 'payment',
        status: 'open',
        subject: caseTitle,
        description: caseDescription,
        owner_team: 'finance',
        metadata: {
          bank_details_change: true,
          new_bank_details: newBankDetails,
          requested_by: userId,
          requested_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    const { data: newCase, error: caseError } = await withTimeout(
      caseInsertQuery,
      10000,
      'createBankDetailsChangeCase'
    );

    if (caseError) {
      const handledError = handleSupabaseError(caseError, 'requestBankDetailsChange');
      throw (
        handledError || new DatabaseError('Failed to create bank details change case', caseError)
      );
    }

    // Ensure standard payment checklist steps exist
    try {
      await this.ensureChecklistSteps(newCase.id, 'payment');
    } catch (checklistError) {
      logError(checklistError, {
        operation: 'ensureChecklistSteps',
        caseId: newCase.id,
        caseType: 'payment',
      });
      // Don't fail if checklist creation fails
    }

    // Add specific checklist step for Bank Letter (required for bank details change)
    try {
      await this.createChecklistStep(
        newCase.id,
        'Upload Bank Letter / Voided Check',
        'bank_letter'
      );
    } catch (checklistStepError) {
      logError(checklistStepError, {
        operation: 'createChecklistStep',
        caseId: newCase.id,
        stepLabel: 'Upload Bank Letter / Voided Check',
      });
      // Don't fail if checklist step creation fails
    }

    // Create initial message requiring bank letter evidence
    try {
      await supabase.from('vmp_messages').insert({
        case_id: newCase.id,
        sender_type: 'system',
        channel_source: 'portal',
        body: 'Bank details change requested. Please upload a Bank Letter or Voided Check as evidence. The change will require internal approval before activation.',
        is_internal_note: false,
        sender_user_id: userId,
      });
    } catch (messageError) {
      logError(messageError, {
        operation: 'createBankChangeMessage',
        caseId: newCase.id,
      });
      // Don't fail if message creation fails
    }

    return newCase;
  },

  // Sprint 5.4: Get Compliance Documents
  async getComplianceDocuments(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getComplianceDocuments requires vendorId', null, { vendorId });
    }

    const casesQuery = supabase
      .from('vmp_cases')
      .select(
        `
                id,
                case_type,
                subject,
                created_at,
                vmp_evidence (
                    id,
                    evidence_type,
                    original_filename,
                    created_at,
                    status
                )
            `
      )
      .eq('vendor_id', vendorId)
      .in('case_type', ['onboarding', 'compliance'])
      .order('created_at', { ascending: false });

    const { data: cases, error: casesError } = await withTimeout(
      casesQuery,
      10000,
      `getComplianceDocuments(${vendorId})`
    );

    if (casesError) {
      const handledError = handleSupabaseError(casesError, 'getComplianceDocuments');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch compliance documents', casesError, { vendorId });
    }

    // Extract compliance documents from cases and evidence
    const complianceDocs = [];
    if (cases) {
      for (const caseItem of cases) {
        if (caseItem.vmp_evidence && caseItem.vmp_evidence.length > 0) {
          for (const evidence of caseItem.vmp_evidence) {
            complianceDocs.push({
              case_id: caseItem.id,
              case_type: caseItem.case_type,
              evidence_type: evidence.evidence_type,
              filename: evidence.original_filename,
              uploaded_at: evidence.created_at,
              status: evidence.status,
              case_subject: caseItem.subject,
            });
          }
        }
      }
    }

    return complianceDocs;
  },

  // Sprint 5.5: Get Contract Library
  async getContractLibrary(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getContractLibrary requires vendorId', null, { vendorId });
    }

    const casesQuery = supabase
      .from('vmp_cases')
      .select(
        `
                id,
                subject,
                created_at,
                vmp_evidence (
                    id,
                    evidence_type,
                    original_filename,
                    storage_path,
                    created_at,
                    status
                )
            `
      )
      .eq('vendor_id', vendorId)
      .eq('case_type', 'contract')
      .order('created_at', { ascending: false });

    const { data: cases, error: casesError } = await withTimeout(
      casesQuery,
      10000,
      `getContractLibrary(${vendorId})`
    );

    if (casesError) {
      const handledError = handleSupabaseError(casesError, 'getContractLibrary');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch contracts', casesError, { vendorId });
    }

    // Extract contracts from cases and evidence
    const contracts = [];
    if (cases) {
      for (const caseItem of cases) {
        if (caseItem.vmp_evidence && caseItem.vmp_evidence.length > 0) {
          for (const evidence of caseItem.vmp_evidence) {
            // Determine contract type from evidence_type or case subject
            let contractType = evidence.evidence_type || 'contract';
            if (caseItem.subject) {
              const subjectLower = caseItem.subject.toLowerCase();
              if (subjectLower.includes('nda')) contractType = 'NDA';
              else if (subjectLower.includes('msa') || subjectLower.includes('master service'))
                contractType = 'MSA';
              else if (subjectLower.includes('indemnity')) contractType = 'Indemnity';
            }

            contracts.push({
              id: evidence.id,
              case_id: caseItem.id,
              contract_type: contractType,
              filename: evidence.original_filename,
              uploaded_at: evidence.created_at,
              status: evidence.status,
              storage_path: evidence.storage_path,
            });
          }
        }
      }
    }

    return contracts;
  },

  // Sprint 6.1: Get Organization Tree
  async getOrgTree(userId) {
    if (!userId) {
      throw new ValidationError('getOrgTree requires userId', null, { userId });
    }

    // Get user context to determine scope
    const userContext = await this.getVendorContext(userId);

    if (!userContext.is_internal) {
      throw new UnauthorizedError('Access denied. Internal users only.', { userId });
    }

    // Get tenant_id from user's vendor (internal users still have vendor_id pointing to a tenant)
    const tenantId = userContext.vmp_vendors?.tenant_id;
    if (!tenantId) {
      throw new ValidationError('User must be associated with a tenant', null, { userId });
    }

    // Fetch tenant
    const tenantQuery = supabase.from('vmp_tenants').select('id, name').eq('id', tenantId).single();

    const { data: tenant, error: tenantError } = await withTimeout(tenantQuery, 5000, 'getTenant');

    if (tenantError || !tenant) {
      throw new NotFoundError('Tenant not found', { tenantId });
    }

    // Fetch groups
    const groupsQuery = supabase
      .from('vmp_groups')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    const { data: groups, error: groupsError } = await withTimeout(groupsQuery, 5000, 'getGroups');

    if (groupsError) {
      logError(groupsError, { operation: 'getGroups', tenantId });
      // Continue with empty groups array
    }

    // Fetch companies (with group links)
    const companiesQuery = supabase
      .from('vmp_companies')
      .select('id, name, legal_name, group_id, country_code, currency_code')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    const { data: companies, error: companiesError } = await withTimeout(
      companiesQuery,
      5000,
      'getCompanies'
    );

    if (companiesError) {
      logError(companiesError, { operation: 'getCompanies', tenantId });
      // Continue with empty companies array
    }

    // Build hierarchical structure
    const orgTree = {
      tenant: tenant,
      groups: (groups || []).map(group => ({
        ...group,
        companies: (companies || []).filter(company => company.group_id === group.id),
      })),
      ungroupedCompanies: (companies || []).filter(company => !company.group_id),
    };

    // Apply RBAC filtering based on user scope
    const userScopeGroupId = userContext.scope_group_id;
    const userScopeCompanyId = userContext.scope_company_id;

    // If user has group scope, filter to that group only
    if (userScopeGroupId) {
      orgTree.groups = orgTree.groups.filter(g => g.id === userScopeGroupId);
      orgTree.ungroupedCompanies = [];
    }

    // If user has company scope, filter to that company only
    if (userScopeCompanyId) {
      orgTree.groups = orgTree.groups
        .map(group => ({
          ...group,
          companies: group.companies.filter(c => c.id === userScopeCompanyId),
        }))
        .filter(group => group.companies.length > 0);
      orgTree.ungroupedCompanies = orgTree.ungroupedCompanies.filter(
        c => c.id === userScopeCompanyId
      );
    }

    return orgTree;
  },

  // Sprint 6.2: Get Scoped Dashboard
  async getScopedDashboard(scopeType, scopeId, userId) {
    if (!scopeType || !scopeId || !userId) {
      throw new ValidationError(
        'getScopedDashboard requires scopeType, scopeId, and userId',
        null,
        {
          scopeType,
          scopeId,
          userId,
        }
      );
    }

    // Verify user has access to this scope
    const userContext = await this.getVendorContext(userId);

    if (!userContext.is_internal) {
      throw new UnauthorizedError('Access denied. Internal users only.', { userId });
    }

    // Verify scope access
    if (scopeType === 'group') {
      if (userContext.scope_company_id) {
        // Manager can't access group scope
        throw new UnauthorizedError('Access denied. Manager cannot access group scope.', {
          userId,
          scopeType,
        });
      }
      if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
      }
    } else if (scopeType === 'company') {
      if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
      }
      if (userContext.scope_group_id) {
        // Director: verify company belongs to their group
        const companyQuery = supabase
          .from('vmp_companies')
          .select('group_id')
          .eq('id', scopeId)
          .single();

        const { data: company, error: companyError } = await withTimeout(
          companyQuery,
          5000,
          'getCompanyForScopeCheck'
        );

        if (companyError || !company || company.group_id !== userContext.scope_group_id) {
          throw new UnauthorizedError('Access denied. Company not in your group.', {
            userId,
            scopeId,
          });
        }
      }
    }

    // Build query based on scope type
    let casesQuery;
    if (scopeType === 'group') {
      // Director View: All cases in group
      casesQuery = supabase
        .from('vmp_cases')
        .select(
          `
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    created_at,
                    vmp_companies (id, name)
                `
        )
        .eq('group_id', scopeId)
        .order('created_at', { ascending: false })
        .limit(100);
    } else {
      // Manager View: Cases for single company
      casesQuery = supabase
        .from('vmp_cases')
        .select(
          `
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    created_at,
                    vmp_companies (id, name)
                `
        )
        .eq('company_id', scopeId)
        .order('created_at', { ascending: false })
        .limit(100);
    }

    const { data: cases, error: casesError } = await withTimeout(
      casesQuery,
      10000,
      `getScopedDashboard(${scopeType}, ${scopeId})`
    );

    if (casesError) {
      const handledError = handleSupabaseError(casesError, 'getScopedDashboard');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch dashboard data', casesError, { scopeType, scopeId });
    }

    // Calculate metrics
    const totalCases = cases?.length || 0;
    const criticalCases = cases?.filter(c => c.escalation_level >= 2).length || 0;
    const openCases = cases?.filter(c => c.status === 'open').length || 0;
    const resolvedCases = cases?.filter(c => c.status === 'resolved').length || 0;

    // Calculate AP Exposure (sum of invoice amounts for pending invoices)
    let apExposure = 0;
    if (scopeType === 'group') {
      // Sum across all companies in group
      const invoicesQuery = supabase
        .from('vmp_invoices')
        .select('amount, company_id, vmp_companies!inner(group_id)')
        .eq('status', 'pending')
        .eq('vmp_companies.group_id', scopeId);

      const { data: invoices } = await withTimeout(invoicesQuery, 5000, 'getGroupAPExposure');
      if (invoices) {
        apExposure = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      }
    } else {
      // Sum for single company
      const invoicesQuery = supabase
        .from('vmp_invoices')
        .select('amount')
        .eq('company_id', scopeId)
        .eq('status', 'pending');

      const { data: invoices } = await withTimeout(invoicesQuery, 5000, 'getCompanyAPExposure');
      if (invoices) {
        apExposure = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      }
    }

    return {
      scopeType,
      scopeId,
      metrics: {
        totalCases,
        criticalCases,
        openCases,
        resolvedCases,
        apExposure,
      },
      recentCases: cases || [],
    };
  },

  // Sprint 6.1: Get Ops Dashboard Metrics (Pulse of Organization)
  async getOpsDashboardMetrics(tenantId, userScope) {
    if (!tenantId) {
      throw new ValidationError('getOpsDashboardMetrics requires tenantId', null, { tenantId });
    }

    // userScope can be: group_id (UUID), company_id (UUID), or null (Super Admin - all)
    // Determine scope type and build queries accordingly
    let scopeType = null;
    let scopeId = null;

    if (userScope) {
      // Determine if userScope is a group_id or company_id
      // Try group first
      const groupQuery = supabase
        .from('vmp_groups')
        .select('id')
        .eq('id', userScope)
        .eq('tenant_id', tenantId)
        .single();

      const { data: groupData } = await withTimeout(groupQuery, 5000, 'checkGroupScope');
      if (groupData) {
        scopeType = 'group';
        scopeId = userScope;
      } else {
        // Try company
        const companyQuery = supabase
          .from('vmp_companies')
          .select('id')
          .eq('id', userScope)
          .eq('tenant_id', tenantId)
          .single();

        const { data: companyData } = await withTimeout(companyQuery, 5000, 'checkCompanyScope');
        if (companyData) {
          scopeType = 'company';
          scopeId = userScope;
        } else {
          throw new ValidationError('userScope must be a valid group_id or company_id', null, {
            userScope,
            tenantId,
          });
        }
      }
    }
    // If userScope is null, scopeType remains null (Super Admin - all)

    // ============================================================================
    // METRIC 1: Action Items (Open Cases - High Priority)
    // ============================================================================
    let actionItemsQuery;
    if (scopeType === 'group') {
      // Director View: Aggregate all companies in group
      actionItemsQuery = supabase
        .from('vmp_cases')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('group_id', scopeId)
        .eq('status', 'open')
        .in('escalation_level', [2, 3]); // High priority (escalation level 2 or 3)
    } else if (scopeType === 'company') {
      // Manager View: Filter only that company
      actionItemsQuery = supabase
        .from('vmp_cases')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('company_id', scopeId)
        .eq('status', 'open')
        .in('escalation_level', [2, 3]);
    } else {
      // Super Admin: All open high-priority cases in tenant
      actionItemsQuery = supabase
        .from('vmp_cases')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .in('escalation_level', [2, 3]);
    }

    const { count: actionItems, error: actionItemsError } = await withTimeout(
      actionItemsQuery,
      10000,
      'getActionItems'
    );

    if (actionItemsError) {
      logError(actionItemsError, { operation: 'getActionItems', tenantId, userScope });
    }

    // ============================================================================
    // METRIC 2: Financials (Total "Pending" Invoice Volume)
    // ============================================================================
    let financialsQuery;
    if (scopeType === 'group') {
      // Director View: Sum across all companies in group
      financialsQuery = supabase
        .from('vmp_invoices')
        .select('amount, vmp_companies!inner(group_id)')
        .eq('status', 'pending')
        .eq('vmp_companies.group_id', scopeId)
        .eq('vmp_companies.tenant_id', tenantId);
    } else if (scopeType === 'company') {
      // Manager View: Sum for single company
      financialsQuery = supabase
        .from('vmp_invoices')
        .select('amount')
        .eq('company_id', scopeId)
        .eq('status', 'pending');
    } else {
      // Super Admin: All pending invoices in tenant
      financialsQuery = supabase
        .from('vmp_invoices')
        .select('amount, vmp_companies!inner(tenant_id)')
        .eq('status', 'pending')
        .eq('vmp_companies.tenant_id', tenantId);
    }

    const { data: pendingInvoices, error: financialsError } = await withTimeout(
      financialsQuery,
      10000,
      'getPendingInvoiceVolume'
    );

    if (financialsError) {
      logError(financialsError, { operation: 'getPendingInvoiceVolume', tenantId, userScope });
    }

    // Calculate total pending invoice volume
    const pendingInvoiceVolume =
      pendingInvoices?.reduce((sum, inv) => {
        return sum + (parseFloat(inv.amount) || 0);
      }, 0) || 0;

    // ============================================================================
    // METRIC 3: Onboarding (Pending Invites vs. Active Vendors)
    // ============================================================================
    // Count pending invites (not used, not expired)
    // Note: We need to filter by tenant/scope via vendor relationship, so we'll use a different approach
    let pendingInvites = 0;
    try {
      if (scopeType === 'group') {
        // Director View: Get vendor IDs for companies in group, then count invites
        const vendorsInGroupQuery = supabase
          .from('vmp_vendor_company_links')
          .select('vendor_id, vmp_companies!inner(group_id)')
          .eq('vmp_companies.group_id', scopeId)
          .eq('vmp_companies.tenant_id', tenantId);

        const { data: vendorLinks } = await withTimeout(
          vendorsInGroupQuery,
          5000,
          'getVendorsInGroup'
        );
        const vendorIds = vendorLinks ? [...new Set(vendorLinks.map(link => link.vendor_id))] : [];

        if (vendorIds.length > 0) {
          const invitesQuery = supabase
            .from('vmp_invites')
            .select('id', { count: 'exact', head: true })
            .in('vendor_id', vendorIds)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString());

          const { count } = await withTimeout(invitesQuery, 5000, 'getPendingInvitesForGroup');
          pendingInvites = count || 0;
        }
      } else if (scopeType === 'company') {
        // Manager View: Get vendor IDs for this company, then count invites
        const vendorsInCompanyQuery = supabase
          .from('vmp_vendor_company_links')
          .select('vendor_id')
          .eq('company_id', scopeId);

        const { data: vendorLinks } = await withTimeout(
          vendorsInCompanyQuery,
          5000,
          'getVendorsInCompany'
        );
        const vendorIds = vendorLinks ? [...new Set(vendorLinks.map(link => link.vendor_id))] : [];

        if (vendorIds.length > 0) {
          const invitesQuery = supabase
            .from('vmp_invites')
            .select('id', { count: 'exact', head: true })
            .in('vendor_id', vendorIds)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString());

          const { count } = await withTimeout(invitesQuery, 5000, 'getPendingInvitesForCompany');
          pendingInvites = count || 0;
        }
      } else {
        // Super Admin: All pending invites in tenant
        const vendorsInTenantQuery = supabase
          .from('vmp_vendors')
          .select('id')
          .eq('tenant_id', tenantId);

        const { data: vendors } = await withTimeout(
          vendorsInTenantQuery,
          5000,
          'getVendorsInTenant'
        );
        const vendorIds = vendors ? vendors.map(v => v.id) : [];

        if (vendorIds.length > 0) {
          const invitesQuery = supabase
            .from('vmp_invites')
            .select('id', { count: 'exact', head: true })
            .in('vendor_id', vendorIds)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString());

          const { count } = await withTimeout(invitesQuery, 5000, 'getPendingInvitesForTenant');
          pendingInvites = count || 0;
        }
      }
    } catch (invitesError) {
      logError(invitesError, { operation: 'getPendingInvites', tenantId, userScope });
    }

    // Count active vendors
    let activeVendors = 0;
    try {
      if (scopeType === 'group') {
        // Director View: Vendors linked to companies in group
        const vendorsQuery = supabase
          .from('vmp_vendor_company_links')
          .select('vendor_id, vmp_companies!inner(group_id)')
          .eq('vmp_companies.group_id', scopeId)
          .eq('vmp_companies.tenant_id', tenantId);

        const { data: vendorLinks } = await withTimeout(
          vendorsQuery,
          5000,
          'getVendorsInGroupForCount'
        );
        const vendorIds = vendorLinks ? [...new Set(vendorLinks.map(link => link.vendor_id))] : [];

        if (vendorIds.length > 0) {
          const activeVendorsQuery = supabase
            .from('vmp_vendors')
            .select('id', { count: 'exact', head: true })
            .in('id', vendorIds)
            .eq('status', 'active');

          const { count } = await withTimeout(activeVendorsQuery, 5000, 'getActiveVendorsInGroup');
          activeVendors = count || 0;
        }
      } else if (scopeType === 'company') {
        // Manager View: Vendors linked to this company
        const vendorsQuery = supabase
          .from('vmp_vendor_company_links')
          .select('vendor_id')
          .eq('company_id', scopeId);

        const { data: vendorLinks } = await withTimeout(
          vendorsQuery,
          5000,
          'getVendorsInCompanyForCount'
        );
        const vendorIds = vendorLinks ? [...new Set(vendorLinks.map(link => link.vendor_id))] : [];

        if (vendorIds.length > 0) {
          const activeVendorsQuery = supabase
            .from('vmp_vendors')
            .select('id', { count: 'exact', head: true })
            .in('id', vendorIds)
            .eq('status', 'active');

          const { count } = await withTimeout(
            activeVendorsQuery,
            5000,
            'getActiveVendorsInCompany'
          );
          activeVendors = count || 0;
        }
      } else {
        // Super Admin: All active vendors in tenant
        const activeVendorsQuery = supabase
          .from('vmp_vendors')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

        const { count } = await withTimeout(activeVendorsQuery, 5000, 'getActiveVendorsInTenant');
        activeVendors = count || 0;
      }
    } catch (vendorsError) {
      logError(vendorsError, { operation: 'getActiveVendors', tenantId, userScope });
    }

    return {
      tenantId,
      userScope: {
        type: scopeType,
        id: scopeId,
      },
      metrics: {
        actionItems: actionItems || 0, // Open Cases (High Priority)
        pendingInvoiceVolume: pendingInvoiceVolume, // Total "Pending" Invoice Volume
        pendingInvites: pendingInvites || 0, // Count of "Pending" Invites
        activeVendors: activeVendors || 0, // Count of Active Vendors
      },
    };
  },

  // Sprint 6.3: Get Ops Case Queue (Scoped)
  async getOpsCaseQueue(scopeType, scopeId, userId, filters = {}) {
    if (!scopeType || !scopeId || !userId) {
      throw new ValidationError('getOpsCaseQueue requires scopeType, scopeId, and userId', null, {
        scopeType,
        scopeId,
        userId,
      });
    }

    // Verify user has access to this scope
    const userContext = await this.getVendorContext(userId);

    if (!userContext.is_internal) {
      throw new UnauthorizedError('Access denied. Internal users only.', { userId });
    }

    // Verify scope access (same logic as getScopedDashboard)
    if (scopeType === 'group') {
      if (userContext.scope_company_id) {
        throw new UnauthorizedError('Access denied. Manager cannot access group scope.', {
          userId,
          scopeType,
        });
      }
      if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
      }
    } else if (scopeType === 'company') {
      if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
      }
      if (userContext.scope_group_id) {
        const companyQuery = supabase
          .from('vmp_companies')
          .select('group_id')
          .eq('id', scopeId)
          .single();

        const { data: company, error: companyError } = await withTimeout(
          companyQuery,
          5000,
          'getCompanyForScopeCheck'
        );

        if (companyError || !company || company.group_id !== userContext.scope_group_id) {
          throw new UnauthorizedError('Access denied. Company not in your group.', {
            userId,
            scopeId,
          });
        }
      }
    }

    // Build query based on scope type
    let casesQuery;
    if (scopeType === 'group') {
      casesQuery = supabase
        .from('vmp_cases')
        .select(
          `
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    owner_team,
                    created_at,
                    updated_at,
                    vmp_companies (id, name),
                    vmp_vendors (id, name)
                `
        )
        .eq('group_id', scopeId);
    } else {
      casesQuery = supabase
        .from('vmp_cases')
        .select(
          `
                    id,
                    case_type,
                    status,
                    escalation_level,
                    subject,
                    owner_team,
                    created_at,
                    updated_at,
                    vmp_companies (id, name),
                    vmp_vendors (id, name)
                `
        )
        .eq('company_id', scopeId);
    }

    // Apply filters
    if (filters.status) {
      casesQuery = casesQuery.eq('status', filters.status);
    }

    if (filters.owner_team) {
      casesQuery = casesQuery.eq('owner_team', filters.owner_team);
    }

    if (filters.case_type) {
      casesQuery = casesQuery.eq('case_type', filters.case_type);
    }

    casesQuery = casesQuery.order('updated_at', { ascending: false });

    const { data: cases, error: casesError } = await withTimeout(
      casesQuery,
      10000,
      `getOpsCaseQueue(${scopeType}, ${scopeId})`
    );

    if (casesError) {
      const handledError = handleSupabaseError(casesError, 'getOpsCaseQueue');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch case queue', casesError, { scopeType, scopeId });
    }

    return cases || [];
  },

  // Sprint 6.4: Get Case Detail for Internal Users (No Vendor Restriction)
  async getCaseDetailForOps(caseId, userId) {
    if (!caseId || !userId) {
      throw new ValidationError('getCaseDetailForOps requires both caseId and userId', null, {
        caseId,
        userId,
      });
    }

    // Verify user is internal
    const userContext = await this.getVendorContext(userId);
    if (!userContext.is_internal) {
      throw new UnauthorizedError('Access denied. Internal users only.', { userId });
    }

    // Fetch case without vendor restriction
    const queryPromise = supabase
      .from('vmp_cases')
      .select(
        `
                *,
                vmp_companies (id, name, group_id),
                vmp_vendors (id, name)
            `
      )
      .eq('id', caseId)
      .single();

    const { data: caseData, error } = await withTimeout(
      queryPromise,
      10000,
      `getCaseDetailForOps(${caseId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getCaseDetailForOps');
      if (handledError === null) {
        return null; // Not found
      }
      throw handledError;
    }

    if (!caseData) {
      return null;
    }

    // Verify scope access
    if (userContext.scope_company_id) {
      // Manager: verify company match
      if (caseData.company_id !== userContext.scope_company_id) {
        throw new UnauthorizedError('Access denied to this case', { userId, caseId });
      }
    } else if (userContext.scope_group_id) {
      // Director: verify group match
      if (caseData.group_id !== userContext.scope_group_id) {
        throw new UnauthorizedError('Access denied to this case', { userId, caseId });
      }
    }
    // Super admin (no scope): allow access to all cases

    return caseData;
  },

  // Sprint 6.5: Get Vendor Directory (Scoped)
  async getVendorDirectory(scopeType, scopeId, userId, filters = {}) {
    if (!scopeType || !scopeId || !userId) {
      throw new ValidationError(
        'getVendorDirectory requires scopeType, scopeId, and userId',
        null,
        {
          scopeType,
          scopeId,
          userId,
        }
      );
    }

    // Verify user is internal
    const userContext = await this.getVendorContext(userId);
    if (!userContext.is_internal) {
      throw new UnauthorizedError('Access denied. Internal users only.', { userId });
    }

    // Verify scope access (same logic as getScopedDashboard)
    if (scopeType === 'group') {
      if (userContext.scope_company_id) {
        throw new UnauthorizedError('Access denied. Manager cannot access group scope.', {
          userId,
          scopeType,
        });
      }
      if (userContext.scope_group_id && userContext.scope_group_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this group', { userId, scopeId });
      }
    } else if (scopeType === 'company') {
      if (userContext.scope_company_id && userContext.scope_company_id !== scopeId) {
        throw new UnauthorizedError('Access denied to this company', { userId, scopeId });
      }
      if (userContext.scope_group_id) {
        const companyQuery = supabase
          .from('vmp_companies')
          .select('group_id')
          .eq('id', scopeId)
          .single();

        const { data: company, error: companyError } = await withTimeout(
          companyQuery,
          5000,
          'getCompanyForScopeCheck'
        );

        if (companyError || !company || company.group_id !== userContext.scope_group_id) {
          throw new UnauthorizedError('Access denied. Company not in your group.', {
            userId,
            scopeId,
          });
        }
      }
    }

    // Get tenant_id from scope
    let tenantId;
    if (scopeType === 'group') {
      const groupQuery = supabase.from('vmp_groups').select('tenant_id').eq('id', scopeId).single();

      const { data: group, error: groupError } = await withTimeout(
        groupQuery,
        5000,
        'getGroupTenant'
      );
      if (groupError || !group) {
        throw new NotFoundError('Group not found', { scopeId });
      }
      tenantId = group.tenant_id;
    } else {
      const companyQuery = supabase
        .from('vmp_companies')
        .select('tenant_id')
        .eq('id', scopeId)
        .single();

      const { data: company, error: companyError } = await withTimeout(
        companyQuery,
        5000,
        'getCompanyTenant'
      );
      if (companyError || !company) {
        throw new NotFoundError('Company not found', { scopeId });
      }
      tenantId = company.tenant_id;
    }

    // Fetch vendors linked to companies in scope
    let vendorsQuery;
    if (scopeType === 'group') {
      // Get all companies in group
      const companiesInGroupQuery = supabase
        .from('vmp_companies')
        .select('id')
        .eq('group_id', scopeId);

      const { data: companiesInGroup, error: companiesError } = await withTimeout(
        companiesInGroupQuery,
        5000,
        'getCompaniesInGroup'
      );

      if (companiesError || !companiesInGroup || companiesInGroup.length === 0) {
        return [];
      }

      const companyIds = companiesInGroup.map(c => c.id);

      // Get vendors linked to these companies
      vendorsQuery = supabase
        .from('vmp_vendor_company_links')
        .select(
          `
                    *,
                    vmp_vendors (
                        id,
                        name,
                        status,
                        created_at
                    ),
                    vmp_companies (
                        id,
                        name,
                        legal_name
                    )
                `
        )
        .in('company_id', companyIds)
        .eq('status', 'active');
    } else {
      // Get vendors linked to single company
      vendorsQuery = supabase
        .from('vmp_vendor_company_links')
        .select(
          `
                    *,
                    vmp_vendors (
                        id,
                        name,
                        status,
                        created_at
                    ),
                    vmp_companies (
                        id,
                        name,
                        legal_name
                    )
                `
        )
        .eq('company_id', scopeId)
        .eq('status', 'active');
    }

    // Apply filters
    if (filters.status) {
      vendorsQuery = vendorsQuery.eq('vmp_vendors.status', filters.status);
    }

    vendorsQuery = vendorsQuery.order('vmp_vendors.created_at', { ascending: false });

    const { data: links, error: linksError } = await withTimeout(
      vendorsQuery,
      10000,
      `getVendorDirectory(${scopeType}, ${scopeId})`
    );

    if (linksError) {
      const handledError = handleSupabaseError(linksError, 'getVendorDirectory');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch vendor directory', linksError, {
        scopeType,
        scopeId,
      });
    }

    // Group vendors by vendor_id (since one vendor can be linked to multiple companies)
    const vendorMap = new Map();
    if (links) {
      for (const link of links) {
        if (!link.vmp_vendors) continue;

        const vendorId = link.vmp_vendors.id;
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendor: link.vmp_vendors,
            companies: [],
            erpCodes: {},
          });
        }

        const vendorEntry = vendorMap.get(vendorId);
        if (link.vmp_companies) {
          vendorEntry.companies.push(link.vmp_companies);
        }
        if (link.erp_vendor_code && link.vmp_companies) {
          vendorEntry.erpCodes[link.vmp_companies.id] = link.erp_vendor_code;
        }
      }
    }

    // Get case counts for each vendor
    const vendors = Array.from(vendorMap.values());
    for (const vendorEntry of vendors) {
      // Count cases for this vendor
      let caseCountQuery;
      if (scopeType === 'group') {
        const companiesInGroupQuery = supabase
          .from('vmp_companies')
          .select('id')
          .eq('group_id', scopeId);

        const { data: companiesInGroup } = await withTimeout(
          companiesInGroupQuery,
          5000,
          'getCompaniesForCaseCount'
        );
        const companyIds = companiesInGroup?.map(c => c.id) || [];

        if (companyIds.length > 0) {
          caseCountQuery = supabase
            .from('vmp_cases')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', vendorEntry.vendor.id)
            .in('company_id', companyIds);
        }
      } else {
        caseCountQuery = supabase
          .from('vmp_cases')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorEntry.vendor.id)
          .eq('company_id', scopeId);
      }

      if (caseCountQuery) {
        const { count } = await withTimeout(caseCountQuery, 5000, 'getVendorCaseCount');
        vendorEntry.caseCount = count || 0;
      } else {
        vendorEntry.caseCount = 0;
      }
    }

    return vendors;
  },

  // Sprint 6.8: Log Ingest Operation
  async logIngest(type, filename, recordsCount, scopeType, scopeId, userId, metadata = {}) {
    if (!type || !filename || recordsCount === undefined || !userId) {
      throw new ValidationError(
        'logIngest requires type, filename, recordsCount, and userId',
        null,
        {
          type,
          filename,
          recordsCount,
          userId,
        }
      );
    }

    const validTypes = ['invoice', 'payment', 'remittance'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(
        `Invalid ingest type. Must be one of: ${validTypes.join(', ')}`,
        null,
        { type }
      );
    }

    const insertQuery = supabase
      .from('vmp_ingest_log')
      .insert({
        ingest_type: type,
        filename: filename,
        records_count: recordsCount,
        scope_type: scopeType || null,
        scope_id: scopeId || null,
        uploaded_by: userId,
        metadata: metadata,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(insertQuery, 5000, 'logIngest');

    if (error) {
      const handledError = handleSupabaseError(error, 'logIngest');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to log ingest operation', error, { type, filename });
    }

    return data;
  },

  // Sprint 6.8: Get Ingest History
  async getIngestHistory(scopeType = null, scopeId = null, userId = null, limit = 100) {
    let query = supabase
      .from('vmp_ingest_log')
      .select(
        `
                *,
                vmp_vendor_users (id, email, display_name)
            `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scopeType && scopeId) {
      query = query.eq('scope_type', scopeType).eq('scope_id', scopeId);
    }

    if (userId) {
      query = query.eq('uploaded_by', userId);
    }

    const { data, error } = await withTimeout(query, 10000, 'getIngestHistory');

    if (error) {
      const handledError = handleSupabaseError(error, 'getIngestHistory');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch ingest history', error);
    }

    return data || [];
  },

  // Sprint 7.1: Get Cases with SLA Approaching
  async getCasesWithSLAApproaching(thresholdHours = 24) {
    if (thresholdHours < 0) {
      throw new ValidationError('thresholdHours must be non-negative', null, { thresholdHours });
    }

    // Calculate threshold time
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + thresholdHours * 60 * 60 * 1000);

    const queryPromise = supabase
      .from('vmp_cases')
      .select(
        `
                id,
                subject,
                status,
                sla_due_at,
                case_type,
                escalation_level,
                vmp_companies (id, name),
                vmp_vendors (id, name)
            `
      )
      .not('sla_due_at', 'is', null)
      .lte('sla_due_at', thresholdTime.toISOString())
      .in('status', ['open', 'waiting_supplier', 'waiting_internal'])
      .order('sla_due_at', { ascending: true });

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `getCasesWithSLAApproaching(${thresholdHours}h)`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getCasesWithSLAApproaching');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch cases with approaching SLA', error);
    }

    // Calculate hours until due for each case
    const casesWithTimeRemaining = (data || []).map(caseItem => {
      const dueAt = new Date(caseItem.sla_due_at);
      const hoursRemaining = Math.round((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      return {
        ...caseItem,
        hours_remaining: hoursRemaining,
        is_overdue: hoursRemaining < 0,
      };
    });

    return casesWithTimeRemaining;
  },

  // Sprint 7.2: Log Decision
  async logDecision(caseId, decisionType, who, what, why) {
    if (!caseId || !decisionType || !who || !what) {
      throw new ValidationError('logDecision requires caseId, decisionType, who, and what', null, {
        caseId,
        decisionType,
        who,
        what,
      });
    }

    const validDecisionTypes = [
      'verify',
      'reject',
      'reassign',
      'status_update',
      'escalate',
      'approve',
      'close',
    ];
    if (!validDecisionTypes.includes(decisionType)) {
      throw new ValidationError(
        `Invalid decisionType. Must be one of: ${validDecisionTypes.join(', ')}`,
        null,
        { decisionType }
      );
    }

    const insertQuery = supabase
      .from('vmp_decision_log')
      .insert({
        case_id: caseId,
        decision_type: decisionType,
        who: who,
        what: what,
        why: why || null,
      })
      .select()
      .single();

    const { data, error } = await withTimeout(insertQuery, 5000, 'logDecision');

    if (error) {
      const handledError = handleSupabaseError(error, 'logDecision');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to log decision', error, { caseId, decisionType });
    }

    return data;
  },

  // Sprint 7.2: Get Decision Log
  async getDecisionLog(caseId) {
    if (!caseId) {
      throw new ValidationError('getDecisionLog requires caseId', null, { caseId });
    }

    const queryPromise = supabase
      .from('vmp_decision_log')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const { data, error } = await withTimeout(queryPromise, 10000, `getDecisionLog(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getDecisionLog');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch decision log', error, { caseId });
    }

    return data || [];
  },

  // Sprint 9.1: Find or Get Vendor by Email
  async findVendorByEmail(email) {
    if (!email) {
      throw new ValidationError('findVendorByEmail requires an email parameter', 'email');
    }

    // First, try to find user by email
    const user = await this.getUserByEmail(email);
    if (user && user.vendor_id) {
      // Get vendor details
      const vendorQuery = supabase
        .from('vmp_vendors')
        .select('id, name, tenant_id')
        .eq('id', user.vendor_id)
        .single();

      const { data: vendor, error: vendorError } = await withTimeout(
        vendorQuery,
        10000,
        `findVendorByEmail-vendor(${user.vendor_id})`
      );

      if (!vendorError && vendor) {
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          tenantId: vendor.tenant_id,
          userId: user.id,
          userEmail: user.email,
        };
      }
    }

    // If no user found, return null (will need to create case manually or link to existing)
    return null;
  },

  // Sprint 9.2: Find Vendor by Phone Number
  async findVendorByPhone(phoneNumber) {
    if (!phoneNumber) {
      throw new ValidationError(
        'findVendorByPhone requires a phoneNumber parameter',
        'phoneNumber'
      );
    }

    // Clean phone number (remove non-digits, country codes, etc.)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

    // Try to find vendor by phone number (exact match or partial match)
    const vendorQuery = supabase
      .from('vmp_vendors')
      .select('id, name, tenant_id, phone')
      .or(`phone.eq.${phoneNumber},phone.ilike.%${cleanPhone}%,phone.ilike.%${phoneNumber}%`)
      .limit(1);

    const { data: vendors, error: vendorError } = await withTimeout(
      vendorQuery,
      10000,
      `findVendorByPhone(${phoneNumber})`
    );

    if (vendorError || !vendors || vendors.length === 0) {
      return null;
    }

    const vendor = vendors[0];

    // Get first user for this vendor (for sender_user_id)
    const userQuery = supabase
      .from('vmp_vendor_users')
      .select('id, email, display_name')
      .eq('vendor_id', vendor.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    const { data: user, error: userError } = await withTimeout(
      userQuery,
      10000,
      `findVendorByPhone-user(${vendor.id})`
    );

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      tenantId: vendor.tenant_id,
      userId: user?.id || null,
      userEmail: user?.email || null,
      phoneNumber: vendor.phone,
    };
  },

  // Sprint 9.1: Find or Create Case from Email
  async findOrCreateCaseFromEmail(emailData, vendorInfo, caseReference = null) {
    if (!emailData || !vendorInfo) {
      throw new ValidationError(
        'findOrCreateCaseFromEmail requires emailData and vendorInfo',
        null,
        {
          hasEmailData: !!emailData,
          hasVendorInfo: !!vendorInfo,
        }
      );
    }

    const { vendorId, tenantId } = vendorInfo;

    // Try to find existing case by reference
    if (caseReference) {
      try {
        // Try to parse as UUID
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidPattern.test(caseReference)) {
          const caseQuery = supabase
            .from('vmp_cases')
            .select('id, vendor_id, tenant_id, company_id')
            .eq('id', caseReference)
            .eq('vendor_id', vendorId)
            .single();

          const { data: existingCase, error: caseError } = await withTimeout(
            caseQuery,
            10000,
            `findOrCreateCaseFromEmail-find(${caseReference})`
          );

          if (!caseError && existingCase) {
            return existingCase.id;
          }
        }
      } catch (error) {
        // Continue to create new case
        console.warn('Error finding case by reference:', error);
      }
    }

    // Create new case from email
    const subject = emailData.subject || 'Email Inquiry';
    const body = emailData.text || emailData.html || '';

    // Extract first company (for now - could be enhanced to match by domain)
    const companyQuery = supabase
      .from('vmp_companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    const { data: company, error: companyError } = await withTimeout(
      companyQuery,
      10000,
      `findOrCreateCaseFromEmail-company(${tenantId})`
    );

    if (companyError || !company) {
      throw new DatabaseError('No company found for tenant', companyError, { tenantId });
    }

    // Create case
    const caseQuery = supabase
      .from('vmp_cases')
      .insert({
        tenant_id: tenantId,
        company_id: company.id,
        vendor_id: vendorId,
        case_type: 'general',
        status: 'open',
        subject: subject.substring(0, 255), // Ensure subject fits in TEXT field
        owner_team: 'ap',
        sla_due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      })
      .select('id')
      .single();

    const { data: newCase, error: createError } = await withTimeout(
      caseQuery,
      10000,
      `findOrCreateCaseFromEmail-create`
    );

    if (createError) {
      const handledError = handleSupabaseError(createError, 'findOrCreateCaseFromEmail');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create case from email', createError);
    }

    // Create initial checklist steps
    await this.ensureChecklistSteps(newCase.id, 'general');

    return newCase.id;
  },

  // Sprint 9.3: Get Port Configuration
  async getPortConfiguration(portType = null) {
    let query = supabase
      .from('vmp_port_configuration')
      .select('*')
      .order('port_type', { ascending: true });

    if (portType) {
      query = query.eq('port_type', portType).single();
    }

    const { data, error } = await withTimeout(
      query,
      10000,
      `getPortConfiguration(${portType || 'all'})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getPortConfiguration');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch port configuration', error);
    }

    return portType ? data : data || [];
  },

  // Sprint 9.3: Update Port Configuration
  async updatePortConfiguration(portType, updates) {
    if (!portType) {
      throw new ValidationError('updatePortConfiguration requires portType parameter', 'portType');
    }

    const validPortTypes = ['email', 'whatsapp', 'slack'];
    if (!validPortTypes.includes(portType)) {
      throw new ValidationError(
        `Invalid portType. Must be one of: ${validPortTypes.join(', ')}`,
        'portType'
      );
    }

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const queryPromise = supabase
      .from('vmp_port_configuration')
      .update(updateData)
      .eq('port_type', portType)
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `updatePortConfiguration(${portType})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'updatePortConfiguration');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to update port configuration', error);
    }

    return data;
  },

  // Sprint 9.3: Log Port Activity
  async logPortActivity(portType, activityType, status = 'success', metadata = {}) {
    if (!portType || !activityType) {
      throw new ValidationError('logPortActivity requires portType and activityType', null, {
        portType,
        activityType,
      });
    }

    const validPortTypes = ['email', 'whatsapp', 'slack'];
    const validActivityTypes = [
      'webhook_received',
      'message_processed',
      'case_created',
      'error',
      'status_update',
    ];
    const validStatuses = ['success', 'error', 'skipped'];

    if (!validPortTypes.includes(portType)) {
      throw new ValidationError(
        `Invalid portType. Must be one of: ${validPortTypes.join(', ')}`,
        'portType'
      );
    }
    if (!validActivityTypes.includes(activityType)) {
      throw new ValidationError(
        `Invalid activityType. Must be one of: ${validActivityTypes.join(', ')}`,
        'activityType'
      );
    }
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        'status'
      );
    }

    const insertData = {
      port_type: portType,
      activity_type: activityType,
      status: status,
      metadata: metadata || {},
      message_id: metadata.messageId || null,
      case_id: metadata.caseId || null,
      vendor_id: metadata.vendorId || null,
      error_message:
        status === 'error' ? metadata.errorMessage || metadata.error?.message || null : null,
    };

    const queryPromise = supabase
      .from('vmp_port_activity_log')
      .insert(insertData)
      .select()
      .single();

    const { data, error } = await withTimeout(
      queryPromise,
      10000,
      `logPortActivity(${portType}, ${activityType})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'logPortActivity');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to log port activity', error);
    }

    return data;
  },

  // Sprint 9.3: Get Port Activity Log
  async getPortActivityLog(portType = null, limit = 100) {
    let query = supabase
      .from('vmp_port_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (portType) {
      query = query.eq('port_type', portType);
    }

    const { data, error } = await withTimeout(
      query,
      10000,
      `getPortActivityLog(${portType || 'all'}, ${limit})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getPortActivityLog');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch port activity log', error);
    }

    return data || [];
  },

  // Emergency Pay Override: Request Override
  async requestEmergencyPayOverride(
    paymentId,
    caseId,
    userId,
    reason,
    urgencyLevel = 'high',
    metadata = null
  ) {
    if (!paymentId || !userId || !reason) {
      throw new ValidationError(
        'requestEmergencyPayOverride requires paymentId, userId, and reason',
        null,
        {
          paymentId,
          userId,
          hasReason: !!reason,
        }
      );
    }

    // Validate urgency level
    const validUrgencyLevels = ['high', 'critical', 'emergency'];
    if (!validUrgencyLevels.includes(urgencyLevel)) {
      throw new ValidationError(
        'urgencyLevel must be one of: high, critical, emergency',
        'urgencyLevel',
        { value: urgencyLevel, validValues: validUrgencyLevels }
      );
    }

    // Verify payment exists and user has access
    const payment = await this.getPaymentDetail(paymentId, null); // Get without vendor check for internal users
    if (!payment) {
      throw new NotFoundError('Payment not found', { paymentId });
    }

    // Create override request
    const insertQuery = supabase
      .from('vmp_emergency_pay_overrides')
      .insert({
        payment_id: paymentId,
        case_id: caseId || null,
        requested_by_user_id: userId,
        reason: reason.trim(),
        urgency_level: urgencyLevel,
        status: 'pending',
        metadata: metadata || {},
      })
      .select()
      .single();

    const { data, error } = await withTimeout(
      insertQuery,
      10000,
      `requestEmergencyPayOverride(${paymentId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'requestEmergencyPayOverride');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create emergency pay override request', error, {
        paymentId,
      });
    }

    // Log decision
    try {
      await this.logDecision(
        caseId || paymentId, // Use case_id if available, otherwise payment_id
        'emergency_pay_override_requested',
        `User ${userId}`,
        `Emergency pay override requested for payment ${payment.payment_ref}`,
        reason
      );
    } catch (logError) {
      // Don't fail if decision logging fails
      logError(logError, { operation: 'logDecision-emergencyOverrideRequest', paymentId });
    }

    return data;
  },

  // Emergency Pay Override: Approve Override
  async approveEmergencyPayOverride(overrideId, approvedByUserId, metadata = null) {
    if (!overrideId || !approvedByUserId) {
      throw new ValidationError(
        'approveEmergencyPayOverride requires overrideId and approvedByUserId',
        null,
        {
          overrideId,
          approvedByUserId,
        }
      );
    }

    // Get override request
    const overrideQuery = supabase
      .from('vmp_emergency_pay_overrides')
      .select('*, vmp_payments(*), vmp_cases(*)')
      .eq('id', overrideId)
      .single();

    const { data: overrideData, error: overrideError } = await withTimeout(
      overrideQuery,
      10000,
      `getEmergencyPayOverride(${overrideId})`
    );

    if (overrideError || !overrideData) {
      throw new NotFoundError('Emergency pay override request not found', { overrideId });
    }

    if (overrideData.status !== 'pending') {
      throw new ValidationError('Override request is not pending', null, {
        overrideId,
        currentStatus: overrideData.status,
      });
    }

    // Update override status to approved
    const updateQuery = supabase
      .from('vmp_emergency_pay_overrides')
      .update({
        status: 'approved',
        approved_by_user_id: approvedByUserId,
        approved_at: new Date().toISOString(),
        metadata: metadata || overrideData.metadata || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .select()
      .single();

    const { data: updatedOverride, error: updateError } = await withTimeout(
      updateQuery,
      10000,
      `approveEmergencyPayOverride(${overrideId})`
    );

    if (updateError) {
      const handledError = handleSupabaseError(updateError, 'approveEmergencyPayOverride');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to approve emergency pay override', updateError, {
        overrideId,
      });
    }

    // Log decision
    try {
      await this.logDecision(
        overrideData.case_id || overrideData.payment_id,
        'emergency_pay_override_approved',
        `User ${approvedByUserId}`,
        `Emergency pay override approved for payment ${overrideData.vmp_payments?.payment_ref || overrideId}`,
        `Approved by: ${approvedByUserId}. Reason: ${overrideData.reason}`
      );
    } catch (logError) {
      // Don't fail if decision logging fails
      logError(logError, { operation: 'logDecision-emergencyOverrideApproval', overrideId });
    }

    return updatedOverride;
  },

  // Emergency Pay Override: Reject Override
  async rejectEmergencyPayOverride(overrideId, rejectedByUserId, rejectionReason) {
    if (!overrideId || !rejectedByUserId || !rejectionReason) {
      throw new ValidationError(
        'rejectEmergencyPayOverride requires overrideId, rejectedByUserId, and rejectionReason',
        null,
        {
          overrideId,
          rejectedByUserId,
          hasRejectionReason: !!rejectionReason,
        }
      );
    }

    // Get override request
    const overrideQuery = supabase
      .from('vmp_emergency_pay_overrides')
      .select('*, vmp_payments(*)')
      .eq('id', overrideId)
      .single();

    const { data: overrideData, error: overrideError } = await withTimeout(
      overrideQuery,
      10000,
      `getEmergencyPayOverride(${overrideId})`
    );

    if (overrideError || !overrideData) {
      throw new NotFoundError('Emergency pay override request not found', { overrideId });
    }

    if (overrideData.status !== 'pending') {
      throw new ValidationError('Override request is not pending', null, {
        overrideId,
        currentStatus: overrideData.status,
      });
    }

    // Update override status to rejected
    const updateQuery = supabase
      .from('vmp_emergency_pay_overrides')
      .update({
        status: 'rejected',
        approved_by_user_id: rejectedByUserId, // Store who rejected it
        approved_at: new Date().toISOString(), // Store rejection time
        rejection_reason: rejectionReason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .select()
      .single();

    const { data: updatedOverride, error: updateError } = await withTimeout(
      updateQuery,
      10000,
      `rejectEmergencyPayOverride(${overrideId})`
    );

    if (updateError) {
      const handledError = handleSupabaseError(updateError, 'rejectEmergencyPayOverride');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to reject emergency pay override', updateError, {
        overrideId,
      });
    }

    // Log decision
    try {
      await this.logDecision(
        overrideData.case_id || overrideData.payment_id,
        'emergency_pay_override_rejected',
        `User ${rejectedByUserId}`,
        `Emergency pay override rejected for payment ${overrideData.vmp_payments?.payment_ref || overrideId}`,
        `Rejection reason: ${rejectionReason}`
      );
    } catch (logError) {
      // Don't fail if decision logging fails
      logError(logError, { operation: 'logDecision-emergencyOverrideRejection', overrideId });
    }

    return updatedOverride;
  },

  // Emergency Pay Override: Get Override Requests
  async getEmergencyPayOverrides(paymentId = null, status = null, limit = 50) {
    let query = supabase
      .from('vmp_emergency_pay_overrides')
      .select(
        `
                *,
                vmp_payments (id, payment_ref, amount, payment_date),
                vmp_cases (id, subject, case_type),
                requested_by:requested_by_user_id (id, display_name, email),
                approved_by:approved_by_user_id (id, display_name, email)
            `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (paymentId) {
      query = query.eq('payment_id', paymentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(
      query,
      10000,
      `getEmergencyPayOverrides(${paymentId || 'all'}, ${status || 'all'})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getEmergencyPayOverrides');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch emergency pay override requests', error);
    }

    return data || [];
  },

  // Sprint: Recommendations - SLA Analytics Dashboard
  async getSLAMetrics(
    tenantId,
    userScope,
    dateRange = { startDate: null, endDate: null },
    options = {}
  ) {
    if (!tenantId) {
      throw new ValidationError('getSLAMetrics requires tenantId', null, { tenantId });
    }

    // Check cache first (skip cache if forceRefresh is true)
    if (!options.forceRefresh) {
      const cached = getCachedMetrics(tenantId, userScope, dateRange, null);
      if (cached) {
        // Apply pagination to cached results if needed
        if (options.limit || options.offset) {
          const paginated = {
            ...cached,
            trends: cached.trends.slice(
              options.offset || 0,
              (options.offset || 0) + (options.limit || cached.trends.length)
            ),
          };
          return paginated;
        }
        return cached;
      }
    }

    // Determine scope type (same pattern as getOpsDashboardMetrics)
    let scopeType = null;
    let scopeId = null;

    if (userScope) {
      const groupQuery = supabase
        .from('vmp_groups')
        .select('id')
        .eq('id', userScope)
        .eq('tenant_id', tenantId)
        .single();

      const { data: groupData } = await withTimeout(groupQuery, 5000, 'checkGroupScope');
      if (groupData) {
        scopeType = 'group';
        scopeId = userScope;
      } else {
        const companyQuery = supabase
          .from('vmp_companies')
          .select('id')
          .eq('id', userScope)
          .eq('tenant_id', tenantId)
          .single();

        const { data: companyData } = await withTimeout(companyQuery, 5000, 'checkCompanyScope');
        if (companyData) {
          scopeType = 'company';
          scopeId = userScope;
        } else {
          throw new ValidationError('userScope must be a valid group_id or company_id', null, {
            userScope,
            tenantId,
          });
        }
      }
    }

    // Set date range defaults (last 30 days if not provided)
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
    const startDate = dateRange.startDate
      ? new Date(dateRange.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build base query for cases
    let casesQuery = supabase
      .from('vmp_cases')
      .select(
        `
                id,
                case_type,
                status,
                created_at,
                owner_team,
                company_id,
                vmp_companies (id, name, group_id)
            `
      )
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Apply scope filtering
    if (scopeType === 'group') {
      casesQuery = casesQuery.eq('vmp_companies.group_id', scopeId);
    } else if (scopeType === 'company') {
      casesQuery = casesQuery.eq('company_id', scopeId);
    }

    const { data: cases, error: casesError } = await withTimeout(
      casesQuery,
      15000,
      'getSLAMetrics-cases'
    );

    if (casesError) {
      const handledError = handleSupabaseError(casesError, 'getSLAMetrics');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to fetch cases for SLA metrics', casesError);
    }

    if (!cases || cases.length === 0) {
      return {
        complianceRate: 0,
        averageResponseTime: 0,
        totalCases: 0,
        casesWithinSLA: 0,
        casesBreached: 0,
        trends: [],
        byTeam: {},
        byCompany: {},
        byCaseType: {},
      };
    }

    // Get first message for each case to calculate response time
    const caseIds = cases.map(c => c.id);
    const messagesQuery = supabase
      .from('vmp_messages')
      .select('case_id, created_at')
      .in('case_id', caseIds)
      .order('created_at', { ascending: true });

    const { data: allMessages, error: messagesError } = await withTimeout(
      messagesQuery,
      15000,
      'getSLAMetrics-messages'
    );

    if (messagesError) {
      logError(messagesError, { operation: 'getSLAMetrics-messages' });
    }

    // Group messages by case_id and get first message
    const firstMessagesByCase = {};
    if (allMessages) {
      for (const msg of allMessages) {
        if (!firstMessagesByCase[msg.case_id]) {
          firstMessagesByCase[msg.case_id] = msg;
        }
      }
    }

    // Calculate SLA metrics for each case
    const SLA_TARGET_HOURS = 2;
    const caseMetrics = [];
    let totalResponseTime = 0;
    let casesWithResponse = 0;
    let casesWithinSLA = 0;
    let casesBreached = 0;

    const byTeam = {};
    const byCompany = {};
    const byCaseType = {};

    for (const caseItem of cases) {
      const caseCreated = new Date(caseItem.created_at);
      const firstMessage = firstMessagesByCase[caseItem.id];

      let responseHours = null;
      let withinSLA = false;

      if (firstMessage) {
        const firstMessageTime = new Date(firstMessage.created_at);
        responseHours = (firstMessageTime.getTime() - caseCreated.getTime()) / (1000 * 60 * 60);
        withinSLA = responseHours <= SLA_TARGET_HOURS;
        totalResponseTime += responseHours;
        casesWithResponse++;
      } else {
        // No response yet - check if overdue
        const now = new Date();
        const hoursSinceCreated = (now.getTime() - caseCreated.getTime()) / (1000 * 60 * 60);
        withinSLA = hoursSinceCreated <= SLA_TARGET_HOURS;
        if (hoursSinceCreated > SLA_TARGET_HOURS) {
          casesBreached++;
        }
      }

      if (withinSLA) {
        casesWithinSLA++;
      } else if (responseHours !== null && responseHours > SLA_TARGET_HOURS) {
        casesBreached++;
      }

      caseMetrics.push({
        caseId: caseItem.id,
        caseType: caseItem.case_type,
        ownerTeam: caseItem.owner_team,
        companyId: caseItem.company_id,
        companyName: caseItem.vmp_companies?.name || 'Unknown',
        responseHours,
        withinSLA,
        created_at: caseItem.created_at,
      });

      // Aggregate by team
      const team = caseItem.owner_team || 'unknown';
      if (!byTeam[team]) {
        byTeam[team] = {
          total: 0,
          withinSLA: 0,
          breached: 0,
          totalResponseTime: 0,
          casesWithResponse: 0,
        };
      }
      byTeam[team].total++;
      if (withinSLA) byTeam[team].withinSLA++;
      if (!withinSLA && responseHours !== null) byTeam[team].breached++;
      if (responseHours !== null) {
        byTeam[team].totalResponseTime += responseHours;
        byTeam[team].casesWithResponse++;
      }

      // Aggregate by company
      const companyName = caseItem.vmp_companies?.name || 'Unknown';
      if (!byCompany[companyName]) {
        byCompany[companyName] = {
          total: 0,
          withinSLA: 0,
          breached: 0,
          totalResponseTime: 0,
          casesWithResponse: 0,
        };
      }
      byCompany[companyName].total++;
      if (withinSLA) byCompany[companyName].withinSLA++;
      if (!withinSLA && responseHours !== null) byCompany[companyName].breached++;
      if (responseHours !== null) {
        byCompany[companyName].totalResponseTime += responseHours;
        byCompany[companyName].casesWithResponse++;
      }

      // Aggregate by case type
      const caseType = caseItem.case_type || 'unknown';
      if (!byCaseType[caseType]) {
        byCaseType[caseType] = {
          total: 0,
          withinSLA: 0,
          breached: 0,
          totalResponseTime: 0,
          casesWithResponse: 0,
        };
      }
      byCaseType[caseType].total++;
      if (withinSLA) byCaseType[caseType].withinSLA++;
      if (!withinSLA && responseHours !== null) byCaseType[caseType].breached++;
      if (responseHours !== null) {
        byCaseType[caseType].totalResponseTime += responseHours;
        byCaseType[caseType].casesWithResponse++;
      }
    }

    // Calculate compliance rate
    const totalCases = cases.length;
    const complianceRate = totalCases > 0 ? (casesWithinSLA / totalCases) * 100 : 0;

    // Calculate average response time
    const averageResponseTime = casesWithResponse > 0 ? totalResponseTime / casesWithResponse : 0;

    // Calculate compliance rates for breakdowns
    const calculateCompliance = item => {
      return item.total > 0 ? (item.withinSLA / item.total) * 100 : 0;
    };

    const calculateAvgResponseTime = item => {
      return item.casesWithResponse > 0 ? item.totalResponseTime / item.casesWithResponse : 0;
    };

    // Format breakdowns with compliance rates and averages
    const formatBreakdown = breakdown => {
      const formatted = {};
      for (const [key, value] of Object.entries(breakdown)) {
        formatted[key] = {
          ...value,
          complianceRate: calculateCompliance(value),
          averageResponseTime: calculateAvgResponseTime(value),
        };
      }
      return formatted;
    };

    // Generate daily trends (last 30 days or date range)
    const trends = [];
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysToShow = Math.min(daysDiff, 30);

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayCases = caseMetrics.filter(c => {
        const caseDate = new Date(c.created_at);
        return caseDate >= date && caseDate < nextDate;
      });

      const dayTotal = dayCases.length;
      const dayWithinSLA = dayCases.filter(c => c.withinSLA).length;
      const dayResponseTimes = dayCases
        .filter(c => c.responseHours !== null)
        .map(c => c.responseHours);
      const dayAvgResponseTime =
        dayResponseTimes.length > 0
          ? dayResponseTimes.reduce((a, b) => a + b, 0) / dayResponseTimes.length
          : 0;

      trends.push({
        date: date.toISOString().split('T')[0],
        totalCases: dayTotal,
        casesWithinSLA: dayWithinSLA,
        complianceRate: dayTotal > 0 ? (dayWithinSLA / dayTotal) * 100 : 0,
        averageResponseTime: dayAvgResponseTime,
      });
    }

    const limit = options.limit || 10000;
    const result = {
      complianceRate: Math.round(complianceRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      totalCases,
      casesWithinSLA,
      casesBreached,
      trends,
      byTeam: formatBreakdown(byTeam),
      byCompany: formatBreakdown(byCompany),
      byCaseType: formatBreakdown(byCaseType),
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      scope: {
        type: scopeType || 'tenant',
        id: scopeId || null,
      },
      pagination: {
        limit,
        total: totalCases,
        hasMore: totalCases >= limit,
      },
    };

    // Cache the result
    setCachedMetrics(tenantId, userScope, dateRange, scopeType, result);

    return result;
  },

  // Get Access Requests (for admin review)
  async getAccessRequests(status = null, limit = 100) {
    let query = supabase
      .from('vmp_access_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(query, 10000, 'getAccessRequests');

    if (error) {
      const handledError = handleSupabaseError(error, 'getAccessRequests');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get access requests', error);
    }

    return data || [];
  },

  // Update Access Request Status
  async updateAccessRequestStatus(requestId, status, reviewedByUserId, reviewNotes = null) {
    if (!requestId || !status) {
      throw new ValidationError('updateAccessRequestStatus requires requestId and status', null, {
        requestId,
        status,
      });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'invited'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        'status',
        { status }
      );
    }

    const updateData = {
      status,
      reviewed_by_user_id: reviewedByUserId || null,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await withTimeout(
      supabase.from('vmp_access_requests').update(updateData).eq('id', requestId).select().single(),
      10000,
      'updateAccessRequestStatus'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'updateAccessRequestStatus');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to update access request status', error, {
        requestId,
        status,
      });
    }

    return data;
  },

  // ============================================================================
  // SOA RECONCILIATION METHODS
  // ============================================================================

  // Get companies linked to a vendor (for SOA upload company selection)
  async getVendorCompanies(vendorId) {
    if (!vendorId) {
      throw new ValidationError('getVendorCompanies requires vendorId', null, { vendorId });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_vendor_company_links')
        .select(
          `
                    company_id,
                    vmp_companies (
                        id,
                        name,
                        legal_name,
                        country_code,
                        currency_code
                    )
                `
        )
        .eq('vendor_id', vendorId)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
      10000,
      `getVendorCompanies(${vendorId})`
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'getVendorCompanies');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get vendor companies', error);
    }

    return (data || []).map(link => ({
      id: link.company_id,
      ...link.vmp_companies,
    }));
  },

  // Ingest SOA from CSV (VMP-07: SOA Reconciliation)
  async ingestSOAFromCSV(csvBuffer, vendorId, companyId, periodStart, periodEnd, tenantId = null) {
    if (!csvBuffer || !vendorId || !companyId || !periodStart || !periodEnd) {
      throw new ValidationError(
        'ingestSOAFromCSV requires csvBuffer, vendorId, companyId, periodStart, and periodEnd',
        null,
        {
          hasBuffer: !!csvBuffer,
          vendorId,
          companyId,
          periodStart,
          periodEnd,
        }
      );
    }

    // Parse CSV using csv-parse
    let records;
    try {
      records = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        cast: false,
      });
    } catch (parseError) {
      throw new ValidationError(`Failed to parse CSV: ${parseError.message}`, parseError, {
        operation: 'ingestSOAFromCSV',
      });
    }

    if (!records || records.length === 0) {
      throw new ValidationError('CSV must have at least a header row and one data row', null, {
        recordCount: records?.length || 0,
      });
    }

    // Normalize headers
    const normalizeHeader = header => {
      if (!header) return '';
      return header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[#]/g, '');
    };

    const findColumn = (headers, patterns) => {
      const normalizedHeaders = headers.map(normalizeHeader);
      for (const pattern of patterns) {
        const normalizedPattern = normalizeHeader(pattern);
        const idx = normalizedHeaders.findIndex(
          h => h.includes(normalizedPattern) || normalizedPattern.includes(h)
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const headers = Object.keys(records[0] || {});

    // Map columns with flexible matching
    const docNoIdx = findColumn(headers, [
      'Invoice #',
      'Invoice',
      'Invoice Number',
      'Doc #',
      'Doc No',
      'Document Number',
      'Reference',
    ]);
    const dateIdx = findColumn(headers, [
      'Date',
      'Invoice Date',
      'Doc Date',
      'Document Date',
      'Transaction Date',
    ]);
    const amountIdx = findColumn(headers, [
      'Amount',
      'Invoice Amount',
      'Total',
      'Total Amount',
      'Transaction Amount',
    ]);
    const docTypeIdx = findColumn(headers, [
      'Type',
      'Doc Type',
      'Document Type',
      'Transaction Type',
    ]);
    const descriptionIdx = findColumn(headers, ['Description', 'Desc', 'Notes', 'Remarks', 'Memo']);
    const currencyIdx = findColumn(headers, ['Currency', 'Currency Code', 'CCY']);

    // Validate required columns
    const requiredColumns = [
      { name: 'Document Number', idx: docNoIdx },
      { name: 'Date', idx: dateIdx },
      { name: 'Amount', idx: amountIdx },
    ];

    const missingColumns = requiredColumns.filter(col => col.idx < 0);
    if (missingColumns.length > 0) {
      throw new ValidationError(
        `CSV missing required columns: ${missingColumns.map(c => c.name).join(', ')}. Found columns: ${headers.join(', ')}`,
        null,
        {
          foundColumns: headers,
          missingColumns: missingColumns.map(c => c.name),
        }
      );
    }

    // Create SOA Case first
    const caseSubject = `SOA Reconciliation - ${periodStart} to ${periodEnd}`;
    const caseInsertQuery = supabase
      .from('vmp_cases')
      .insert({
        tenant_id: tenantId,
        company_id: companyId,
        vendor_id: vendorId,
        case_type: 'soa',
        status: 'open', // Will be updated to ACTION_REQUIRED after parsing
        subject: caseSubject,
        owner_team: 'finance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { data: soaCase, error: caseError } = await withTimeout(
      caseInsertQuery,
      10000,
      'createSOACase'
    );

    if (caseError || !soaCase) {
      throw new DatabaseError('Failed to create SOA case', caseError);
    }

    // Parse SOA lines
    const soaLines = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const row = records[i];
        const values = headers.map(h => row[h] || '');

        const docNo = values[docNoIdx]?.trim();
        const dateStr = values[dateIdx]?.trim();
        const amountStr = values[amountIdx]?.trim();

        if (!docNo || !dateStr || !amountStr) {
          errors.push({
            row: i + 2,
            field: 'required_fields',
            value: null,
            message: `Line ${i + 2}: Missing required information. Please ensure Document Number, Date, and Amount are filled in.`,
            technical: `Row ${i + 2}: Missing required fields (Document Number, Date, or Amount)`,
          });
          continue;
        }

        // Parse date
        const docDate = this._parseDate(dateStr);
        if (!docDate) {
          errors.push({
            row: i + 2,
            field: 'date',
            value: dateStr,
            expectedFormat: 'DD/MM/YYYY or YYYY-MM-DD',
            message: `Line ${i + 2}: Date looks wrong. Found "${dateStr}", but expected format: DD/MM/YYYY or YYYY-MM-DD (e.g., 15/01/2024 or 2024-01-15). Please check and correct the date.`,
            technical: `Row ${i + 2}: Invalid date format: ${dateStr}`,
          });
          continue;
        }

        // Parse amount
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          errors.push({
            row: i + 2,
            field: 'amount',
            value: amountStr,
            message: `Line ${i + 2}: Amount looks wrong. Found "${amountStr}", but expected a number (e.g., 1000.00). Please check and correct the amount.`,
            technical: `Row ${i + 2}: Invalid amount: ${amountStr}`,
          });
          continue;
        }

        // Determine doc type (default to INV if not specified)
        let docType = 'INV';
        if (docTypeIdx >= 0 && values[docTypeIdx]) {
          const typeStr = values[docTypeIdx].trim().toUpperCase();
          if (['INV', 'CN', 'DN', 'PAY', 'WHT', 'ADJ'].includes(typeStr)) {
            docType = typeStr;
          }
        }

        // Get currency (default to USD)
        const currency =
          currencyIdx >= 0 && values[currencyIdx]
            ? values[currencyIdx].trim().toUpperCase()
            : 'USD';

        soaLines.push({
          case_id: soaCase.id,
          vendor_id: vendorId,
          company_id: companyId,
          line_number: i + 1,
          invoice_number: docNo,
          invoice_date: docDate.toISOString().split('T')[0],
          amount: amount,
          currency_code: currency,
          doc_type: docType,
          description: descriptionIdx >= 0 ? values[descriptionIdx]?.trim() || null : null,
          extraction_method: 'csv_import',
          extraction_confidence: 1.0,
          status: 'extracted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (rowError) {
        errors.push({
          row: i + 2,
          field: 'unknown',
          value: null,
          message: `Line ${i + 2}: Error processing this line. ${rowError.message}. Please check the data and try again.`,
          technical: `Row ${i + 2}: ${rowError.message}`,
        });
      }
    }

    if (soaLines.length === 0) {
      // Delete the case if no valid lines
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      const userFriendlyErrors = errors.map(e => (typeof e === 'object' ? e.message : e));
      throw new ValidationError(
        'No valid SOA lines found in CSV. Please check the file format and ensure all required columns are present. You can download a template to see the expected format.',
        null,
        {
          errors: userFriendlyErrors,
          technicalErrors: errors.map(e => (typeof e === 'object' ? e.technical : e)),
          userFriendly: true,
        }
      );
    }

    // Insert SOA lines in batch
    const { data: insertedLines, error: insertError } = await withTimeout(
      supabase.from('vmp_soa_items').insert(soaLines).select(),
      30000,
      'insertSOALines'
    );

    if (insertError) {
      // Delete the case if insert fails
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new DatabaseError('Failed to insert SOA lines', insertError);
    }

    // Update case status to ACTION_REQUIRED (per PRD status model)
    await supabase
      .from('vmp_cases')
      .update({
        status: 'open', // Will be updated by matching engine
        updated_at: new Date().toISOString(),
      })
      .eq('id', soaCase.id);

    // Format errors for user-friendly display
    const formattedErrors =
      errors.length > 0 ? errors.map(e => (typeof e === 'object' ? e.message : e)) : null;

    return {
      caseId: soaCase.id,
      total: records.length,
      inserted: insertedLines?.length || 0,
      failed: errors.length,
      errors: formattedErrors,
      soaLines: insertedLines || [],
    };
  },

  // Ingest SOA from PDF (VMP-07: SOA Reconciliation - PDF Support)
  async ingestSOAFromPDF(pdfBuffer, vendorId, companyId, periodStart, periodEnd, tenantId = null) {
    if (!pdfBuffer || !vendorId || !companyId || !periodStart || !periodEnd) {
      throw new ValidationError(
        'ingestSOAFromPDF requires pdfBuffer, vendorId, companyId, periodStart, and periodEnd',
        null,
        {
          hasBuffer: !!pdfBuffer,
          vendorId,
          companyId,
          periodStart,
          periodEnd,
        }
      );
    }

    // Extract text from PDF
    let pdfData;
    try {
      pdfData = await pdfParse(pdfBuffer);
    } catch (parseError) {
      throw new ValidationError(`Failed to parse PDF: ${parseError.message}`, parseError, {
        operation: 'ingestSOAFromPDF',
      });
    }

    if (!pdfData || !pdfData.text || pdfData.text.trim().length === 0) {
      throw new ValidationError(
        'PDF appears to be empty or scanned. Please use a text-based PDF or convert to CSV.',
        null,
        {
          pageCount: pdfData?.numpages || 0,
          textLength: pdfData?.text?.length || 0,
        }
      );
    }

    const pdfText = pdfData.text;

    // Create SOA Case first
    const caseSubject = `SOA Reconciliation - ${periodStart} to ${periodEnd}`;
    const caseInsertQuery = supabase
      .from('vmp_cases')
      .insert({
        tenant_id: tenantId,
        company_id: companyId,
        vendor_id: vendorId,
        case_type: 'soa',
        status: 'open',
        subject: caseSubject,
        owner_team: 'finance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { data: soaCase, error: caseError } = await withTimeout(
      caseInsertQuery,
      10000,
      'createSOACase'
    );

    if (caseError || !soaCase) {
      throw new DatabaseError('Failed to create SOA case', caseError);
    }

    // Parse SOA lines from PDF text
    const soaLines = [];
    const errors = [];

    // Common SOA line patterns (handles various formats)
    // Pattern 1: Table format with columns (most common)
    // Example: "INV-001    2024-01-15    1000.00    USD"
    const tablePattern =
      /(\S+)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+([\d,]+\.?\d*)\s*([A-Z]{3})?/gi;

    // Pattern 2: Invoice number, date, amount on separate lines or with labels
    // Example: "Invoice: INV-001 Date: 2024-01-15 Amount: 1000.00"
    const labeledPattern =
      /(?:invoice|inv|doc|document)[\s#:]*([A-Z0-9\-_]+)[\s,;]*(?:date|dated)[\s:]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})[\s,;]*(?:amount|amt|total)[\s:]*([\d,]+\.?\d*)/gi;

    // Pattern 3: Simple line format (doc number, date, amount)
    // Example: "INV-001 15/01/2024 1000.00"
    const simplePattern =
      /([A-Z]{2,4}[-_]?\d+)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+([\d,]+\.?\d*)/gi;

    // Try to extract lines using multiple patterns
    const allMatches = [];

    // Try table pattern first (most common)
    let match;
    while ((match = tablePattern.exec(pdfText)) !== null) {
      allMatches.push({
        docNo: match[1]?.trim(),
        dateStr: match[2]?.trim(),
        amountStr: match[3]?.trim(),
        currency: match[4]?.trim() || 'USD',
        pattern: 'table',
      });
    }

    // Try labeled pattern if table pattern didn't find much
    if (allMatches.length < 3) {
      tablePattern.lastIndex = 0; // Reset regex
      while ((match = labeledPattern.exec(pdfText)) !== null) {
        allMatches.push({
          docNo: match[1]?.trim(),
          dateStr: match[2]?.trim(),
          amountStr: match[3]?.trim(),
          currency: 'USD', // Default, can be extracted separately
          pattern: 'labeled',
        });
      }
    }

    // Try simple pattern as fallback
    if (allMatches.length < 3) {
      labeledPattern.lastIndex = 0; // Reset regex
      while ((match = simplePattern.exec(pdfText)) !== null) {
        allMatches.push({
          docNo: match[1]?.trim(),
          dateStr: match[2]?.trim(),
          amountStr: match[3]?.trim(),
          currency: 'USD',
          pattern: 'simple',
        });
      }
    }

    // Remove duplicates (same doc number)
    const uniqueMatches = [];
    const seenDocNos = new Set();
    for (const m of allMatches) {
      if (m.docNo && !seenDocNos.has(m.docNo.toUpperCase())) {
        seenDocNos.add(m.docNo.toUpperCase());
        uniqueMatches.push(m);
      }
    }

    if (uniqueMatches.length === 0) {
      // Delete the case if no lines found
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new ValidationError(
        'Could not extract SOA lines from PDF. The PDF may be scanned (image-based) or in an unsupported format. Please try: 1) Export the PDF to CSV or Excel, 2) Use a text-based PDF (not scanned), or 3) Contact support for assistance.',
        null,
        {
          pdfTextLength: pdfText.length,
          pdfPages: pdfData.numpages,
          suggestion: 'Try exporting the PDF to CSV or ensure the PDF is text-based (not scanned)',
          userFriendly: true,
        }
      );
    }

    // Process extracted matches
    for (let i = 0; i < uniqueMatches.length; i++) {
      try {
        const match = uniqueMatches[i];

        if (!match.docNo || !match.dateStr || !match.amountStr) {
          errors.push({
            row: i + 1,
            field: 'required_fields',
            value: null,
            message: `Line ${i + 1}: Missing required information. Please ensure Document Number, Date, and Amount are present in the PDF.`,
            technical: `Line ${i + 1}: Missing required fields (Document Number, Date, or Amount)`,
          });
          continue;
        }

        // Parse date
        const docDate = this._parseDate(match.dateStr);
        if (!docDate) {
          errors.push({
            row: i + 1,
            field: 'date',
            value: match.dateStr,
            expectedFormat: 'DD/MM/YYYY or YYYY-MM-DD',
            message: `Line ${i + 1}: Date looks wrong. Found "${match.dateStr}", but expected format: DD/MM/YYYY or YYYY-MM-DD. Please check the PDF and correct if needed.`,
            technical: `Line ${i + 1}: Invalid date format: ${match.dateStr}`,
          });
          continue;
        }

        // Parse amount (remove commas, currency symbols)
        const amount = parseFloat(match.amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          errors.push({
            row: i + 1,
            field: 'amount',
            value: match.amountStr,
            message: `Line ${i + 1}: Amount looks wrong. Found "${match.amountStr}", but expected a number (e.g., 1000.00). Please check the PDF and correct if needed.`,
            technical: `Line ${i + 1}: Invalid amount: ${match.amountStr}`,
          });
          continue;
        }

        // Determine doc type from document number prefix
        let docType = 'INV';
        const docNoUpper = match.docNo.toUpperCase();
        if (docNoUpper.startsWith('CN') || docNoUpper.includes('CREDIT')) {
          docType = 'CN';
        } else if (docNoUpper.startsWith('DN') || docNoUpper.includes('DEBIT')) {
          docType = 'DN';
        } else if (docNoUpper.startsWith('PAY') || docNoUpper.includes('PAYMENT')) {
          docType = 'PAY';
        } else if (docNoUpper.startsWith('WHT')) {
          docType = 'WHT';
        } else if (docNoUpper.startsWith('ADJ')) {
          docType = 'ADJ';
        }

        // Get currency (default to USD)
        const currency = match.currency || 'USD';

        soaLines.push({
          case_id: soaCase.id,
          vendor_id: vendorId,
          company_id: companyId,
          line_number: i + 1,
          invoice_number: match.docNo,
          invoice_date: docDate.toISOString().split('T')[0],
          amount: amount,
          currency_code: currency,
          doc_type: docType,
          description: null,
          extraction_method: 'pdf_parse',
          extraction_confidence: 0.85, // PDF parsing is less reliable than CSV
          raw_text: `${match.docNo} ${match.dateStr} ${match.amountStr}`, // Store raw for audit
          status: 'extracted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (rowError) {
        errors.push({
          row: i + 1,
          field: 'unknown',
          value: null,
          message: `Line ${i + 1}: Error processing this line. ${rowError.message}. Please check the PDF and try again.`,
          technical: `Line ${i + 1}: ${rowError.message}`,
        });
      }
    }

    if (soaLines.length === 0) {
      // Delete the case if no valid lines
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      const userFriendlyErrors = errors.map(e => (typeof e === 'object' ? e.message : e));
      throw new ValidationError(
        'No valid SOA lines could be extracted from PDF. Please check the file format or try using CSV/Excel instead.',
        null,
        {
          errors: userFriendlyErrors,
          technicalErrors: errors.map(e => (typeof e === 'object' ? e.technical : e)),
          userFriendly: true,
        }
      );
    }

    // Insert SOA lines in batch
    const { data: insertedLines, error: insertError } = await withTimeout(
      supabase.from('vmp_soa_items').insert(soaLines).select(),
      30000,
      'insertSOALines'
    );

    if (insertError) {
      // Delete the case if insert fails
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new DatabaseError('Failed to insert SOA lines', insertError);
    }

    // Update case status
    await supabase
      .from('vmp_cases')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', soaCase.id);

    return {
      caseId: soaCase.id,
      total: uniqueMatches.length,
      inserted: insertedLines?.length || 0,
      failed: errors.length,
      errors: errors.length > 0 ? errors.map(e => (typeof e === 'object' ? e.message : e)) : null,
      soaLines: insertedLines || [],
      extractionMethod: 'pdf_parse',
      confidence: soaLines.length > 0 ? soaLines.length / uniqueMatches.length : 0,
    };
  },

  // Ingest SOA from Excel (VMP-07: SOA Reconciliation - Excel Support)
  async ingestSOAFromExcel(
    excelBuffer,
    vendorId,
    companyId,
    periodStart,
    periodEnd,
    tenantId = null
  ) {
    if (!excelBuffer || !vendorId || !companyId || !periodStart || !periodEnd) {
      throw new ValidationError(
        'ingestSOAFromExcel requires excelBuffer, vendorId, companyId, periodStart, and periodEnd',
        null,
        {
          hasBuffer: !!excelBuffer,
          vendorId,
          companyId,
          periodStart,
          periodEnd,
        }
      );
    }

    // Parse Excel file
    const workbook = new ExcelJS.Workbook();
    let worksheet;
    try {
      await workbook.xlsx.load(excelBuffer);
      worksheet = workbook.worksheets[0]; // Use first sheet
      if (!worksheet) {
        throw new ValidationError('Excel file appears to be empty or has no worksheets', null, {
          sheetCount: workbook.worksheets.length,
        });
      }
    } catch (parseError) {
      throw new ValidationError(`Failed to parse Excel file: ${parseError.message}`, parseError, {
        operation: 'ingestSOAFromExcel',
      });
    }

    // Create SOA Case first
    const caseSubject = `SOA Reconciliation - ${periodStart} to ${periodEnd}`;
    const caseInsertQuery = supabase
      .from('vmp_cases')
      .insert({
        tenant_id: tenantId,
        company_id: companyId,
        vendor_id: vendorId,
        case_type: 'soa',
        status: 'open',
        subject: caseSubject,
        owner_team: 'finance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { data: soaCase, error: caseError } = await withTimeout(
      caseInsertQuery,
      10000,
      'createSOACase'
    );

    if (caseError || !soaCase) {
      throw new DatabaseError('Failed to create SOA case', caseError);
    }

    // Find header row (look for common column names)
    let headerRowIndex = -1;
    const headerPatterns = ['invoice', 'doc', 'document', 'date', 'amount', 'total'];

    for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const rowText = row.values.map(v => String(v || '').toLowerCase()).join(' ');
      if (headerPatterns.some(pattern => rowText.includes(pattern))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex < 0) {
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new ValidationError(
        'Could not find header row in Excel file. Please ensure the file has column headers like "Invoice #", "Date", "Amount"',
        null,
        {
          suggestion: 'Download the template to see the expected format',
        }
      );
    }

    // Extract headers
    const headerRow = worksheet.getRow(headerRowIndex);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    // Normalize headers (same as CSV)
    const normalizeHeader = header => {
      if (!header) return '';
      return header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[#]/g, '');
    };

    const findColumn = (headers, patterns) => {
      const normalizedHeaders = headers.map(normalizeHeader);
      for (const pattern of patterns) {
        const normalizedPattern = normalizeHeader(pattern);
        const idx = normalizedHeaders.findIndex(
          h => h.includes(normalizedPattern) || normalizedPattern.includes(h)
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    // Map columns
    const docNoIdx = findColumn(headers, [
      'Invoice #',
      'Invoice',
      'Invoice Number',
      'Doc #',
      'Doc No',
      'Document Number',
      'Reference',
    ]);
    const dateIdx = findColumn(headers, [
      'Date',
      'Invoice Date',
      'Doc Date',
      'Document Date',
      'Transaction Date',
    ]);
    const amountIdx = findColumn(headers, [
      'Amount',
      'Invoice Amount',
      'Total',
      'Total Amount',
      'Transaction Amount',
    ]);
    const docTypeIdx = findColumn(headers, [
      'Type',
      'Doc Type',
      'Document Type',
      'Transaction Type',
    ]);
    const descriptionIdx = findColumn(headers, ['Description', 'Desc', 'Notes', 'Remarks', 'Memo']);
    const currencyIdx = findColumn(headers, ['Currency', 'Currency Code', 'CCY']);

    // Validate required columns
    const requiredColumns = [
      { name: 'Document Number', idx: docNoIdx },
      { name: 'Date', idx: dateIdx },
      { name: 'Amount', idx: amountIdx },
    ];

    const missingColumns = requiredColumns.filter(col => col.idx < 0);
    if (missingColumns.length > 0) {
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new ValidationError(
        `Excel file missing required columns: ${missingColumns.map(c => c.name).join(', ')}. Found columns: ${headers.filter(h => h).join(', ')}`,
        null,
        {
          foundColumns: headers.filter(h => h),
          missingColumns: missingColumns.map(c => c.name),
          suggestion: 'Download the template to see the expected format',
        }
      );
    }

    // Parse SOA lines
    const soaLines = [];
    const errors = [];

    for (let i = headerRowIndex + 1; i <= worksheet.rowCount; i++) {
      try {
        const row = worksheet.getRow(i);
        if (!row || row.cellCount === 0) continue;

        const docNo = docNoIdx > 0 ? String(row.getCell(docNoIdx).value || '').trim() : '';
        const dateStr = dateIdx > 0 ? String(row.getCell(dateIdx).value || '').trim() : '';
        const amountStr = amountIdx > 0 ? String(row.getCell(amountIdx).value || '').trim() : '';

        // Skip empty rows
        if (!docNo && !dateStr && !amountStr) continue;

        if (!docNo || !dateStr || !amountStr) {
          errors.push({
            row: i,
            field: 'required_fields',
            value: null,
            message: `Line ${i}: Missing required information. Please ensure Document Number, Date, and Amount are filled in.`,
            technical: `Row ${i}: Missing required fields (Document Number, Date, or Amount)`,
          });
          continue;
        }

        // Parse date (Excel dates are numbers, but can also be strings)
        let docDate;
        if (typeof row.getCell(dateIdx).value === 'number') {
          // Excel date serial number
          docDate = new Date((row.getCell(dateIdx).value - 25569) * 86400 * 1000);
        } else {
          docDate = this._parseDate(dateStr);
        }

        if (!docDate || isNaN(docDate.getTime())) {
          errors.push({
            row: i,
            field: 'date',
            value: dateStr,
            expectedFormat: 'DD/MM/YYYY or YYYY-MM-DD',
            message: `Line ${i}: Date looks wrong. Found "${dateStr}", but expected format: DD/MM/YYYY or YYYY-MM-DD. Please check and correct the date.`,
            technical: `Row ${i}: Invalid date format: ${dateStr}`,
          });
          continue;
        }

        // Parse amount
        let amount;
        if (typeof row.getCell(amountIdx).value === 'number') {
          amount = row.getCell(amountIdx).value;
        } else {
          amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        }

        if (isNaN(amount) || amount <= 0) {
          errors.push({
            row: i,
            field: 'amount',
            value: amountStr,
            message: `Line ${i}: Amount looks wrong. Found "${amountStr}", but expected a number (e.g., 1000.00). Please check and correct the amount.`,
            technical: `Row ${i}: Invalid amount: ${amountStr}`,
          });
          continue;
        }

        // Determine doc type
        let docType = 'INV';
        if (docTypeIdx > 0 && row.getCell(docTypeIdx).value) {
          const typeStr = String(row.getCell(docTypeIdx).value).trim().toUpperCase();
          if (['INV', 'CN', 'DN', 'PAY', 'WHT', 'ADJ'].includes(typeStr)) {
            docType = typeStr;
          }
        }

        // Get currency
        const currency =
          currencyIdx > 0 && row.getCell(currencyIdx).value
            ? String(row.getCell(currencyIdx).value).trim().toUpperCase()
            : 'USD';

        soaLines.push({
          case_id: soaCase.id,
          vendor_id: vendorId,
          company_id: companyId,
          line_number: i - headerRowIndex,
          invoice_number: docNo,
          invoice_date: docDate.toISOString().split('T')[0],
          amount: amount,
          currency_code: currency,
          doc_type: docType,
          description:
            descriptionIdx > 0 && row.getCell(descriptionIdx).value
              ? String(row.getCell(descriptionIdx).value).trim()
              : null,
          extraction_method: 'excel_import',
          extraction_confidence: 0.95,
          status: 'extracted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (rowError) {
        errors.push({
          row: i,
          field: 'unknown',
          value: null,
          message: `Line ${i}: Error processing this line. ${rowError.message}. Please check the Excel file and try again.`,
          technical: `Row ${i}: ${rowError.message}`,
        });
      }
    }

    if (soaLines.length === 0) {
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      const userFriendlyErrors = errors.map(e => (typeof e === 'object' ? e.message : e));
      throw new ValidationError(
        'No valid SOA lines found in Excel file. Please check the file format and ensure all required columns are present.',
        null,
        {
          errors: userFriendlyErrors,
          technicalErrors: errors.map(e => (typeof e === 'object' ? e.technical : e)),
          userFriendly: true,
        }
      );
    }

    // Insert SOA lines in batch
    const { data: insertedLines, error: insertError } = await withTimeout(
      supabase.from('vmp_soa_items').insert(soaLines).select(),
      30000,
      'insertSOALines'
    );

    if (insertError) {
      await supabase.from('vmp_cases').delete().eq('id', soaCase.id);
      throw new DatabaseError('Failed to insert SOA lines', insertError);
    }

    // Update case status
    await supabase
      .from('vmp_cases')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', soaCase.id);

    return {
      caseId: soaCase.id,
      total: worksheet.rowCount - headerRowIndex,
      inserted: insertedLines?.length || 0,
      failed: errors.length,
      errors: errors.length > 0 ? errors.map(e => (typeof e === 'object' ? e.message : e)) : null,
      soaLines: insertedLines || [],
      extractionMethod: 'excel_import',
      confidence: soaLines.length > 0 ? soaLines.length / (worksheet.rowCount - headerRowIndex) : 0,
    };
  },

  // Get SOA Cases (Statements) for a vendor
  async getSOAStatements(vendorId, companyId = null, status = null) {
    if (!vendorId) {
      throw new ValidationError('getSOAStatements requires vendorId', null, { vendorId });
    }

    let query = supabase
      .from('vmp_cases')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('case_type', 'soa')
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(query, 10000, `getSOAStatements(${vendorId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getSOAStatements');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get SOA statements', error);
    }

    return data || [];
  },

  // Get SOA Items (Lines) for a case
  async getSOALines(caseId, vendorId, status = null) {
    if (!caseId || !vendorId) {
      throw new ValidationError('getSOALines requires both caseId and vendorId', null, {
        caseId,
        vendorId,
      });
    }

    // Verify case belongs to vendor and is SOA type
    const caseQuery = supabase
      .from('vmp_cases')
      .select('id, case_type, vendor_id')
      .eq('id', caseId)
      .eq('vendor_id', vendorId)
      .eq('case_type', 'soa')
      .single();

    const { data: caseData, error: caseError } = await withTimeout(
      caseQuery,
      5000,
      'verifySOACase'
    );

    if (caseError || !caseData) {
      throw new NotFoundError('SOA case not found or access denied', { caseId, vendorId });
    }

    let query = supabase
      .from('vmp_soa_items')
      .select(
        `
                *,
                vmp_soa_matches (
                    id,
                    invoice_id,
                    match_type,
                    is_exact_match,
                    match_confidence,
                    status,
                    amount_difference,
                    date_difference_days
                )
            `
      )
      .eq('case_id', caseId)
      .order('line_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(query, 10000, `getSOALines(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getSOALines');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get SOA lines', error);
    }

    return data || [];
  },

  // Get SOA Reconciliation Summary
  async getSOASummary(caseId, vendorId) {
    if (!caseId || !vendorId) {
      throw new ValidationError('getSOASummary requires both caseId and vendorId', null, {
        caseId,
        vendorId,
      });
    }

    // Get all lines for the case
    const lines = await this.getSOALines(caseId, vendorId);

    // Calculate summary
    const summary = {
      total_lines: lines.length,
      total_amount: 0,
      matched_lines: 0,
      matched_amount: 0,
      unmatched_lines: 0,
      unmatched_amount: 0,
      discrepancy_lines: 0,
      discrepancy_amount: 0,
      statement_only_lines: 0,
      statement_only_amount: 0,
      ledger_only_lines: 0,
      ledger_only_amount: 0,
    };

    lines.forEach(line => {
      summary.total_amount += parseFloat(line.amount || 0);

      if (line.status === 'matched') {
        summary.matched_lines++;
        summary.matched_amount += parseFloat(line.amount || 0);
      } else if (line.status === 'discrepancy') {
        summary.discrepancy_lines++;
        summary.discrepancy_amount += parseFloat(line.amount || 0);
      } else if (line.status === 'extracted') {
        summary.unmatched_lines++;
        summary.unmatched_amount += parseFloat(line.amount || 0);
      }
    });

    // Calculate net variance
    summary.net_variance = summary.total_amount - summary.matched_amount;

    return summary;
  },

  // Create SOA Match
  async createSOAMatch(soaItemId, invoiceId, matchData) {
    if (!soaItemId || !invoiceId) {
      throw new ValidationError('createSOAMatch requires both soaItemId and invoiceId', null, {
        soaItemId,
        invoiceId,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_matches')
        .insert({
          soa_item_id: soaItemId,
          invoice_id: invoiceId,
          match_type: matchData.matchType || 'probabilistic',
          is_exact_match: matchData.isExactMatch || false,
          match_confidence: matchData.confidence || 0.5,
          match_score: matchData.matchScore || null,
          match_criteria: matchData.matchCriteria || {},
          soa_amount: matchData.soaAmount,
          invoice_amount: matchData.invoiceAmount,
          soa_date: matchData.soaDate,
          invoice_date: matchData.invoiceDate,
          status: 'pending',
          matched_by: matchData.matchedBy || 'system',
          metadata: matchData.metadata || {},
        })
        .select()
        .single(),
      10000,
      'createSOAMatch'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'createSOAMatch');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create SOA match', error);
    }

    // Update SOA item status
    await supabase.from('vmp_soa_items').update({ status: 'matched' }).eq('id', soaItemId);

    return data;
  },

  // Confirm SOA Match
  async confirmSOAMatch(matchId, userId) {
    if (!matchId || !userId) {
      throw new ValidationError('confirmSOAMatch requires both matchId and userId', null, {
        matchId,
        userId,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_matches')
        .update({
          status: 'confirmed',
          confirmed_by_user_id: userId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', matchId)
        .select()
        .single(),
      10000,
      'confirmSOAMatch'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'confirmSOAMatch');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to confirm SOA match', error);
    }

    return data;
  },

  // Reject SOA Match
  async rejectSOAMatch(matchId, userId, reason) {
    if (!matchId || !userId) {
      throw new ValidationError('rejectSOAMatch requires both matchId and userId', null, {
        matchId,
        userId,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_matches')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
        })
        .eq('id', matchId)
        .select()
        .single(),
      10000,
      'rejectSOAMatch'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'rejectSOAMatch');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to reject SOA match', error);
    }

    // Update SOA item status back to extracted
    await supabase.from('vmp_soa_items').update({ status: 'extracted' }).eq('id', data.soa_item_id);

    return data;
  },

  // Create SOA Issue (Variance/Exception)
  async createSOAIssue(caseId, issueData) {
    if (!caseId) {
      throw new ValidationError('createSOAIssue requires caseId', null, { caseId });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_discrepancies')
        .insert({
          case_id: caseId,
          soa_item_id: issueData.soaItemId || null,
          match_id: issueData.matchId || null,
          invoice_id: issueData.invoiceId || null,
          discrepancy_type: issueData.issueType,
          severity: issueData.severity || 'medium',
          description: issueData.description,
          expected_value: issueData.expectedValue || null,
          actual_value: issueData.actualValue || null,
          difference_amount: issueData.amountDelta || null,
          status: 'open',
          detected_by: issueData.detectedBy || 'system',
          metadata: issueData.metadata || {},
        })
        .select()
        .single(),
      10000,
      'createSOAIssue'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'createSOAIssue');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to create SOA issue', error);
    }

    return data;
  },

  // Get SOA Issues for a case
  async getSOAIssues(caseId, status = null) {
    if (!caseId) {
      throw new ValidationError('getSOAIssues requires caseId', null, { caseId });
    }

    let query = supabase
      .from('vmp_soa_discrepancies')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(query, 10000, `getSOAIssues(${caseId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getSOAIssues');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get SOA issues', error);
    }

    return data || [];
  },

  // Resolve SOA Issue
  async resolveSOAIssue(issueId, userId, resolutionData) {
    if (!issueId || !userId) {
      throw new ValidationError('resolveSOAIssue requires both issueId and userId', null, {
        issueId,
        userId,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_discrepancies')
        .update({
          status: 'resolved',
          resolution_notes: resolutionData.notes || null,
          resolved_by_user_id: userId,
          resolved_at: new Date().toISOString(),
          resolution_action: resolutionData.action || 'corrected',
        })
        .eq('id', issueId)
        .select()
        .single(),
      10000,
      'resolveSOAIssue'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'resolveSOAIssue');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to resolve SOA issue', error);
    }

    return data;
  },

  // Sign off SOA Reconciliation
  async signOffSOA(caseId, vendorId, userId, acknowledgementData) {
    if (!caseId || !vendorId || !userId) {
      throw new ValidationError('signOffSOA requires caseId, vendorId, and userId', null, {
        caseId,
        vendorId,
        userId,
      });
    }

    // Get summary for acknowledgement
    const summary = await this.getSOASummary(caseId, vendorId);

    // Create or update acknowledgement
    const { data, error } = await withTimeout(
      supabase
        .from('vmp_soa_acknowledgements')
        .upsert(
          {
            case_id: caseId,
            vendor_id: vendorId,
            company_id: acknowledgementData.companyId || null,
            acknowledgement_type: acknowledgementData.type || 'full',
            total_items: summary.total_lines,
            matched_items: summary.matched_lines,
            discrepancy_items: summary.discrepancy_lines,
            unmatched_items: summary.unmatched_lines,
            total_amount: summary.total_amount,
            matched_amount: summary.matched_amount,
            discrepancy_amount: summary.discrepancy_amount,
            unmatched_amount: summary.unmatched_amount,
            status: 'acknowledged',
            acknowledged_by_user_id: userId,
            acknowledged_at: new Date().toISOString(),
            acknowledgement_notes: acknowledgementData.notes || null,
          },
          {
            onConflict: 'case_id',
          }
        )
        .select()
        .single(),
      10000,
      'signOffSOA'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'signOffSOA');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to sign off SOA', error);
    }

    // Update case status to closed
    await supabase.from('vmp_cases').update({ status: 'closed' }).eq('id', caseId);

    return data;
  },

  // ============================================================================
  // DEBIT NOTE (DN) METHODS
  // ============================================================================

  // Propose Debit Note
  async proposeDebitNote(dnData) {
    if (!dnData.soaStatementId || !dnData.vendorId || !dnData.amount) {
      throw new ValidationError(
        'proposeDebitNote requires soaStatementId, vendorId, and amount',
        null,
        dnData
      );
    }

    // Generate DN number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('vmp_debit_notes')
      .select('*', { count: 'exact', head: true })
      .like('dn_no', `DN-${year}-%`);

    const dnNo = `DN-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_debit_notes')
        .insert({
          tenant_id: dnData.tenantId || null,
          vendor_id: dnData.vendorId,
          company_id: dnData.companyId || null,
          soa_statement_id: dnData.soaStatementId,
          soa_issue_id: dnData.soaIssueId || null,
          dn_no: dnNo,
          dn_date: dnData.dnDate || new Date().toISOString().split('T')[0],
          currency_code: dnData.currencyCode || 'USD',
          amount: dnData.amount,
          reason_code: dnData.reasonCode,
          status: 'DRAFT',
          notes: dnData.notes || null,
          created_by_user_id: dnData.userId || null,
        })
        .select()
        .single(),
      10000,
      'proposeDebitNote'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'proposeDebitNote');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to propose debit note', error);
    }

    return data;
  },

  // Get Debit Notes
  async getDebitNotes(vendorId, status = null, soaStatementId = null) {
    if (!vendorId) {
      throw new ValidationError('getDebitNotes requires vendorId', null, { vendorId });
    }

    let query = supabase
      .from('vmp_debit_notes')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (soaStatementId) {
      query = query.eq('soa_statement_id', soaStatementId);
    }

    const { data, error } = await withTimeout(query, 10000, `getDebitNotes(${vendorId})`);

    if (error) {
      const handledError = handleSupabaseError(error, 'getDebitNotes');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to get debit notes', error);
    }

    return data || [];
  },

  // Approve Debit Note
  async approveDebitNote(dnId, userId) {
    if (!dnId || !userId) {
      throw new ValidationError('approveDebitNote requires both dnId and userId', null, {
        dnId,
        userId,
      });
    }

    // Verify current status is DRAFT
    const { data: current } = await supabase
      .from('vmp_debit_notes')
      .select('status')
      .eq('id', dnId)
      .single();

    if (!current || current.status !== 'DRAFT') {
      throw new ValidationError('Debit note must be in DRAFT status to approve', 'status', {
        currentStatus: current?.status,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_debit_notes')
        .update({
          status: 'APPROVED',
          approved_by_user_id: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', dnId)
        .select()
        .single(),
      10000,
      'approveDebitNote'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'approveDebitNote');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to approve debit note', error);
    }

    return data;
  },

  // Post Debit Note (to AP Ledger)
  async postDebitNote(dnId, userId, ledgerEntryId = null) {
    if (!dnId || !userId) {
      throw new ValidationError('postDebitNote requires both dnId and userId', null, {
        dnId,
        userId,
      });
    }

    // Verify current status is APPROVED
    const { data: current } = await supabase
      .from('vmp_debit_notes')
      .select('status')
      .eq('id', dnId)
      .single();

    if (!current || current.status !== 'APPROVED') {
      throw new ValidationError('Debit note must be in APPROVED status to post', 'status', {
        currentStatus: current?.status,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_debit_notes')
        .update({
          status: 'POSTED',
          posted_by_user_id: userId,
          posted_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntryId || null,
          ledger_posted_at: new Date().toISOString(),
        })
        .eq('id', dnId)
        .select()
        .single(),
      10000,
      'postDebitNote'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'postDebitNote');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to post debit note', error);
    }

    // Update linked SOA issue to RESOLVED if exists
    if (data.soa_issue_id) {
      await supabase
        .from('vmp_soa_discrepancies')
        .update({
          status: 'resolved',
          resolution_action: 'corrected',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', data.soa_issue_id);
    }

    return data;
  },

  // Void Debit Note
  async voidDebitNote(dnId, userId, voidReason) {
    if (!dnId || !userId) {
      throw new ValidationError('voidDebitNote requires both dnId and userId', null, {
        dnId,
        userId,
      });
    }

    // Verify current status is DRAFT or APPROVED (cannot void POSTED)
    const { data: current } = await supabase
      .from('vmp_debit_notes')
      .select('status')
      .eq('id', dnId)
      .single();

    if (!current || current.status === 'POSTED') {
      throw new ValidationError('Cannot void a POSTED debit note', 'status', {
        currentStatus: current?.status,
      });
    }

    const { data, error } = await withTimeout(
      supabase
        .from('vmp_debit_notes')
        .update({
          status: 'VOID',
          void_reason: voidReason || null,
        })
        .eq('id', dnId)
        .select()
        .single(),
      10000,
      'voidDebitNote'
    );

    if (error) {
      const handledError = handleSupabaseError(error, 'voidDebitNote');
      if (handledError) throw handledError;
      throw new DatabaseError('Failed to void debit note', error);
    }

    return data;
  },
};
