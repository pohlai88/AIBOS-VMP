/**
 * Nexus Adapter
 *
 * Data access layer for the new nexus_* schema.
 * All methods use explicit prefixed IDs (TNT-, TC-, TV-, USR-, CASE-, PAY-, etc.)
 *
 * Philosophy: Everyone is a Tenant. Role is contextual based on relationship.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// CLIENT INITIALIZATION (Lazy - created on first use)
// ============================================================================

let _serviceClient = null;

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  return { supabaseUrl, supabaseServiceKey, supabaseAnonKey };
}

// Service client for admin operations (lazy initialization)
function getServiceClient() {
  if (!_serviceClient) {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    _serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return _serviceClient;
}

// Backward compatible getter
const serviceClient = {
  get from() { return getServiceClient().from.bind(getServiceClient()); },
  get rpc() { return getServiceClient().rpc.bind(getServiceClient()); },
  get auth() { return getServiceClient().auth; },
  get storage() { return getServiceClient().storage; }
};

/**
 * Create a client with RLS context for a specific user
 */
function createContextClient(tenantId, userId, tenantClientId, tenantVendorId) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        'x-tenant-id': tenantId,
        'x-user-id': userId,
        'x-tenant-client-id': tenantClientId,
        'x-tenant-vendor-id': tenantVendorId
      }
    }
  });
}

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a unique prefixed ID
 * @param {string} prefix - ID prefix (TNT, TC, TV, USR, CASE, PAY, etc.)
 * @param {string} [name] - Optional name to derive readable portion
 * @returns {string} Generated ID
 */
function generateId(prefix, name = null) {
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();

  if (name && name.trim().length > 0) {
    // Create readable code from name (first 4 chars, alphanumeric only)
    let baseCode = name.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (baseCode.length < 4) {
      baseCode += randomSuffix.substring(0, 4 - baseCode.length);
    }
    return `${prefix}-${baseCode}${randomSuffix.substring(0, 4)}`;
  }

  return `${prefix}-${randomSuffix}`;
}

/**
 * Generate all tenant IDs at once (for onboarding)
 * @param {string} name - Tenant name
 * @returns {{ tenantId: string, tenantClientId: string, tenantVendorId: string }}
 */
function generateTenantIds(name) {
  const baseCode = name.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const code = baseCode.padEnd(4, randomSuffix.substring(0, 4 - baseCode.length)) + randomSuffix.substring(0, 4);

  return {
    tenantId: `TNT-${code}`,
    tenantClientId: `TC-${code}`,
    tenantVendorId: `TV-${code}`
  };
}

// ============================================================================
// TENANT OPERATIONS
// ============================================================================

/**
 * Create a new tenant with all IDs generated
 * @param {object} data - Tenant data
 * @returns {Promise<object>} Created tenant
 */
async function createTenant(data) {
  const { tenantId, tenantClientId, tenantVendorId } = generateTenantIds(data.name);

  const tenant = {
    tenant_id: tenantId,
    tenant_client_id: tenantClientId,
    tenant_vendor_id: tenantVendorId,
    name: data.name,
    display_name: data.displayName || data.name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    status: 'active',
    onboarding_status: 'pending',
    settings: data.settings || {},
    metadata: data.metadata || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_tenants')
    .insert(tenant)
    .select()
    .single();

  if (error) throw new Error(`Failed to create tenant: ${error.message}`);
  return result;
}

/**
 * Get tenant by any ID type (TNT-, TC-, or TV-)
 * @param {string} id - Any tenant ID
 * @returns {Promise<object|null>} Tenant or null
 */
async function getTenantById(id) {
  let column = 'tenant_id';
  if (id.startsWith('TC-')) column = 'tenant_client_id';
  else if (id.startsWith('TV-')) column = 'tenant_vendor_id';

  const { data, error } = await serviceClient
    .from('nexus_tenants')
    .select('*')
    .eq(column, id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get tenant: ${error.message}`);
  return data;
}

/**
 * Update tenant
 * @param {string} tenantId - TNT-* ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated tenant
 */
async function updateTenant(tenantId, updates) {
  const { data, error } = await serviceClient
    .from('nexus_tenants')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update tenant: ${error.message}`);
  return data;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Create a new user
 * @param {object} data - User data
 * @returns {Promise<object>} Created user
 */
async function createUser(data) {
  const userId = generateId('USR', data.email);

  const user = {
    user_id: userId,
    tenant_id: data.tenantId,
    email: data.email,
    password_hash: data.passwordHash,
    auth_user_id: data.authUserId || null,  // Link to Supabase Auth
    display_name: data.displayName || data.email.split('@')[0],
    first_name: data.firstName,
    last_name: data.lastName,
    phone: data.phone,
    role: data.role || 'member',
    status: 'active',
    email_verified: data.emailVerified || false,
    preferences: data.preferences || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_users')
    .insert(user)
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return result;
}

/**
 * Get user by ID or email
 * @param {string} identifier - USR-* ID or email
 * @returns {Promise<object|null>} User or null
 */
async function getUser(identifier) {
  const column = identifier.startsWith('USR-') ? 'user_id' : 'email';

  // First get the user
  const { data: user, error: userError } = await serviceClient
    .from('nexus_users')
    .select('*')
    .eq(column, identifier)
    .single();

  if (userError && userError.code !== 'PGRST116') throw new Error(`Failed to get user: ${userError.message}`);
  if (!user) return null;

  // Then get the tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from('nexus_tenants')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .single();

  if (tenantError && tenantError.code !== 'PGRST116') throw new Error(`Failed to get tenant: ${tenantError.message}`);

  return { ...user, tenant };
}

/**
 * Get user by email with tenant data
 * @param {string} email - User email
 * @returns {Promise<object|null>} User with tenant or null
 */
async function getUserByEmail(email) {
  // First get the user
  const { data: user, error: userError } = await serviceClient
    .from('nexus_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (userError && userError.code !== 'PGRST116') throw new Error(`Failed to get user: ${userError.message}`);
  if (!user) return null;

  // Then get the tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from('nexus_tenants')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .single();

  if (tenantError && tenantError.code !== 'PGRST116') throw new Error(`Failed to get tenant: ${tenantError.message}`);

  return { ...user, tenant };
}

/**
 * Update user
 * @param {string} userId - USR-* ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object|null>} Updated user or null if no-op
 */
async function updateUser(userId, updates) {
  const { data, error } = await serviceClient
    .from('nexus_users')
    .update(updates)
    .eq('user_id', userId)
    .select(); // no .single() - tolerate 0 rows

  if (error) throw new Error(`Failed to update user: ${error.message}`);

  // If nothing returned, verify existence so we don't hide real issues
  if (!data || data.length === 0) {
    const { data: exists, error: existsErr } = await serviceClient
      .from('nexus_users')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);

    if (existsErr) throw new Error(`Failed to verify user after update: ${existsErr.message}`);
    if (!exists || exists.length === 0) {
      throw new Error(`updateUser: user not found for user_id=${userId}`);
    }

    // User exists but update returned no rows: treat as "no-op"
    return null;
  }

  return data[0];
}

/**
 * Get users for a tenant
 * @param {string} tenantId - TNT-* ID
 * @returns {Promise<object[]>} Users
 */
async function getUsersByTenant(tenantId) {
  const { data, error } = await serviceClient
    .from('nexus_users')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get users: ${error.message}`);
  return data || [];
}

// ============================================================================
// RELATIONSHIP OPERATIONS
// ============================================================================

/**
 * Create a relationship between tenants
 * @param {string} clientId - TC-* (the client)
 * @param {string} vendorId - TV-* (the vendor)
 * @param {object} options - Additional options
 * @returns {Promise<object>} Created relationship
 */
async function createRelationship(clientId, vendorId, options = {}) {
  const relationship = {
    client_id: clientId,
    vendor_id: vendorId,
    relationship_type: options.type || 'client_vendor',
    status: options.status || 'active',
    invited_by: options.invitedBy,
    invite_token: options.inviteToken,
    invite_accepted_at: options.acceptedAt,
    contract_ref: options.contractRef,
    effective_from: options.effectiveFrom,
    effective_to: options.effectiveTo,
    metadata: options.metadata || {}
  };

  const { data, error } = await serviceClient
    .from('nexus_tenant_relationships')
    .insert(relationship)
    .select()
    .single();

  if (error) throw new Error(`Failed to create relationship: ${error.message}`);
  return data;
}

/**
 * Get relationships for a tenant
 * @param {string} tenantId - TNT-* ID
 * @returns {Promise<{ asClient: object[], asVendor: object[] }>} Relationships grouped by context
 */
async function getTenantRelationships(tenantId) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  // Get relationships where tenant is client
  const { data: asClientRels, error: clientError } = await serviceClient
    .from('nexus_tenant_relationships')
    .select('*')
    .eq('client_id', tenant.tenant_client_id)
    .eq('status', 'active');

  if (clientError) throw new Error(`Failed to get client relationships: ${clientError.message}`);

  // Enrich client relationships with vendor tenant info
  const asClientData = await Promise.all((asClientRels || []).map(async rel => {
    // Look up the vendor tenant by vendor_id (TV-*)
    const { data: vendorTenant } = await serviceClient
      .from('nexus_tenants')
      .select('*')
      .eq('tenant_vendor_id', rel.vendor_id)
      .single();
    return { ...rel, vendor_tenant: vendorTenant };
  }));

  // Get relationships where tenant is vendor
  const { data: asVendorRels, error: vendorError } = await serviceClient
    .from('nexus_tenant_relationships')
    .select('*')
    .eq('vendor_id', tenant.tenant_vendor_id)
    .eq('status', 'active');

  if (vendorError) throw new Error(`Failed to get vendor relationships: ${vendorError.message}`);

  // Enrich vendor relationships with client tenant info
  const asVendorData = await Promise.all((asVendorRels || []).map(async rel => {
    // Look up the client tenant by client_id (TC-*)
    const { data: clientTenant } = await serviceClient
      .from('nexus_tenants')
      .select('*')
      .eq('tenant_client_id', rel.client_id)
      .single();
    return { ...rel, client_tenant: clientTenant };
  }));

  return {
    asClient: asClientData || [],   // I am client, these are my vendors
    asVendor: asVendorData || []    // I am vendor, these are my clients
  };
}

/**
 * Get contexts for a tenant (for Role Dashboard)
 * @param {string} tenantId - TNT-* ID
 * @returns {Promise<object>} Contexts summary
 */
async function getTenantContexts(tenantId) {
  const relationships = await getTenantRelationships(tenantId);

  return {
    hasClientContext: relationships.asClient.length > 0,
    hasVendorContext: relationships.asVendor.length > 0,
    hasDualContext: relationships.asClient.length > 0 && relationships.asVendor.length > 0,
    vendorCount: relationships.asClient.length,    // Number of vendors I have
    clientCount: relationships.asVendor.length,    // Number of clients I serve
    asClient: relationships.asClient,
    asVendor: relationships.asVendor
  };
}

// ============================================================================
// INVITE OPERATIONS
// ============================================================================

/**
 * Create an invitation for a vendor
 * @param {string} invitingTenantId - TNT-* of the inviter (client)
 * @param {string} inviteeEmail - Email of the vendor to invite
 * @param {object} options - Additional options
 * @returns {Promise<object>} Created invite
 */
async function createRelationshipInvite(invitingTenantId, inviteeEmail, options = {}) {
  const tenant = await getTenantById(invitingTenantId);
  if (!tenant) throw new Error('Inviting tenant not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invite = {
    token,
    inviting_tenant_id: tenant.tenant_id,
    inviting_client_id: tenant.tenant_client_id,
    invitee_email: inviteeEmail.toLowerCase(),
    invitee_name: options.inviteeName,
    status: 'pending',
    expires_at: expiresAt.toISOString()
  };

  const { data, error } = await serviceClient
    .from('nexus_relationship_invites')
    .insert(invite)
    .select()
    .single();

  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  return data;
}

/**
 * Get invite by token
 * @param {string} token - Invite token
 * @returns {Promise<object|null>} Invite or null
 */
async function getInviteByToken(token) {
  const { data, error } = await serviceClient
    .from('nexus_relationship_invites')
    .select(`
      *,
      inviting_tenant:nexus_tenants!nexus_relationship_invites_inviting_tenant_id_fkey(*)
    `)
    .eq('token', token)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get invite: ${error.message}`);
  return data;
}

/**
 * Accept an invitation (auto-onboarding)
 * Creates tenant, user, and relationship in one transaction
 * @param {string} token - Invite token
 * @param {object} vendorData - New vendor tenant data
 * @param {object} userData - New user data
 * @returns {Promise<{ tenant: object, user: object, relationship: object }>}
 */
async function acceptInvite(token, vendorData, userData) {
  const invite = await getInviteByToken(token);

  if (!invite) throw new Error('Invite not found');
  if (invite.status !== 'pending') throw new Error('Invite already used or expired');
  if (new Date(invite.expires_at) < new Date()) throw new Error('Invite expired');

  // Create the vendor tenant
  const tenant = await createTenant({
    name: vendorData.name,
    email: userData.email,
    phone: userData.phone,
    address: vendorData.address,
    settings: vendorData.settings,
    metadata: { onboardedVia: 'invite', inviteToken: token }
  });

  // Create the user
  const user = await createUser({
    tenantId: tenant.tenant_id,
    email: userData.email,
    passwordHash: userData.passwordHash,
    displayName: userData.displayName,
    firstName: userData.firstName,
    lastName: userData.lastName,
    phone: userData.phone,
    role: 'owner',
    emailVerified: true // Email verified via invite
  });

  // Create the relationship (auto-approved)
  const relationship = await createRelationship(
    invite.inviting_client_id,  // Client (the inviter)
    tenant.tenant_vendor_id,    // Vendor (the new tenant)
    {
      status: 'active',
      invitedBy: invite.id,
      inviteToken: token,
      acceptedAt: new Date().toISOString()
    }
  );

  // Mark invite as accepted
  await serviceClient
    .from('nexus_relationship_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_tenant_id: tenant.tenant_id,
      accepted_by_vendor_id: tenant.tenant_vendor_id
    })
    .eq('token', token);

  // Send notification to the client
  await createNotification({
    userId: null, // Will need to find client admin
    tenantId: invite.inviting_tenant_id,
    type: 'vendor_invite_accepted',
    title: `${tenant.name} has joined as your vendor`,
    body: `${tenant.name} accepted your invitation and is now connected.`,
    referenceType: 'relationship',
    referenceId: relationship.id,
    actionUrl: '/nexus/relationships'
  });

  return { tenant, user, relationship };
}

// ============================================================================
// CASE OPERATIONS
// ============================================================================

/**
 * Create a new case
 * @param {object} data - Case data
 * @returns {Promise<object>} Created case
 */
async function createCase(data) {
  const caseId = generateId('CASE');

  const caseData = {
    case_id: caseId,
    client_id: data.clientId,           // TC-*
    vendor_id: data.vendorId,           // TV-*
    relationship_id: data.relationshipId,
    subject: data.subject,
    description: data.description,
    case_type: data.caseType || 'general',
    status: 'open',
    priority: data.priority || 'normal',
    assigned_to: data.assignedTo,
    sla_due_at: data.slaDueAt,
    invoice_ref: data.invoiceRef,
    payment_ref: data.paymentRef,
    amount_disputed: data.amountDisputed,
    currency: data.currency || 'USD',
    tags: data.tags || [],
    category: data.category,
    metadata: data.metadata || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_cases')
    .insert(caseData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create case: ${error.message}`);
  return result;
}

/**
 * Get cases by context (client or vendor perspective)
 * @param {string} contextId - TC-* or TV-*
 * @param {string} facing - 'down' (as client) or 'up' (as vendor)
 * @param {object} filters - Query filters
 * @returns {Promise<{ cases: object[], pagination: { page: number, limit: number, total: number, pages: number } }>}
 */
async function getCasesByContext(contextId, facing, filters = {}) {
  const column = facing === 'down' ? 'client_id' : 'vendor_id';

  let query = serviceClient
    .from('nexus_cases')
    .select(`
      *,
      unread_count:nexus_case_messages(count),
      client_tenant:nexus_tenants!fk_cases_client_tenant(tenant_id, name, display_name),
      vendor_tenant:nexus_tenants!fk_cases_vendor_tenant(tenant_id, name, display_name)
    `, { count: 'exact' })
    .eq(column, contextId);

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.search) {
    query = query.or(`subject.ilike.%${filters.search}%,case_id.ilike.%${filters.search}%`);
  }

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to get cases: ${error.message}`);

  return {
    cases: data || [],
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil((count || 0) / limit)
    }
  };
}

/**
 * Get case by ID with full details
 * @param {string} caseId - CASE-* ID
 * @returns {Promise<object|null>} Case with details
 */
async function getCaseById(caseId) {
  const { data, error } = await serviceClient
    .from('nexus_cases')
    .select(`
      *,
      client_tenant:nexus_tenants!fk_cases_client_tenant(tenant_id, name, display_name),
      vendor_tenant:nexus_tenants!fk_cases_vendor_tenant(tenant_id, name, display_name),
      messages:nexus_case_messages(*, sender:nexus_users(display_name, email)),
      evidence:nexus_case_evidence(*),
      checklist:nexus_case_checklist(*),
      activity:nexus_case_activity(*)
    `)
    .eq('case_id', caseId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get case: ${error.message}`);
  return data;
}

/**
 * Update case
 * @param {string} caseId - CASE-* ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated case
 */
async function updateCase(caseId, updates) {
  const { data, error } = await serviceClient
    .from('nexus_cases')
    .update(updates)
    .eq('case_id', caseId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update case: ${error.message}`);
  return data;
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Create a case message
 * @param {object} data - Message data
 * @returns {Promise<object>} Created message
 */
async function createMessage(data) {
  const messageId = generateId('MSG');

  const message = {
    message_id: messageId,
    case_id: data.caseId,
    sender_user_id: data.senderUserId,
    sender_tenant_id: data.senderTenantId,
    sender_context: data.senderContext,       // 'client' or 'vendor'
    sender_context_id: data.senderContextId,  // TC-* or TV-*
    body: data.body,
    body_html: data.bodyHtml,
    message_type: data.messageType || 'message',
    attachments: data.attachments || [],
    metadata: data.metadata || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_case_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw new Error(`Failed to create message: ${error.message}`);
  return result;
}

/**
 * Get messages for a case
 * @param {string} caseId - CASE-* ID
 * @param {object} options - Query options
 * @returns {Promise<object[]>} Messages
 */
async function getCaseMessages(caseId, options = {}) {
  let query = serviceClient
    .from('nexus_case_messages')
    .select('*, sender:nexus_users(display_name, email, avatar_url)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get messages: ${error.message}`);
  return data || [];
}

/**
 * Mark messages as read
 * @param {string} caseId - CASE-* ID
 * @param {string} userId - USR-* ID of reader
 * @returns {Promise<number>} Number of messages marked
 */
async function markMessagesRead(caseId, userId) {
  const { data, error } = await serviceClient
    .from('nexus_case_messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .neq('sender_user_id', userId)
    .eq('is_read', false)
    .select();

  if (error) throw new Error(`Failed to mark messages read: ${error.message}`);
  return data?.length || 0;
}

// ============================================================================
// PAYMENT OPERATIONS
// ============================================================================

/**
 * Create a payment
 * @param {object} data - Payment data
 * @returns {Promise<object>} Created payment
 */
async function createPayment(data) {
  const paymentId = generateId('PAY');

  const payment = {
    payment_id: paymentId,
    from_id: data.fromId,           // TC-* (payer = client)
    to_id: data.toId,               // TV-* (payee = vendor)
    relationship_id: data.relationshipId,
    invoice_id: data.invoiceId,
    amount: data.amount,
    currency: data.currency || 'USD',
    status: 'pending',
    payment_method: data.paymentMethod,
    payment_reference: data.paymentReference,
    payment_date: data.paymentDate,
    scheduled_date: data.scheduledDate,
    description: data.description,
    notes: data.notes,
    metadata: data.metadata || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_payments')
    .insert(payment)
    .select()
    .single();

  if (error) throw new Error(`Failed to create payment: ${error.message}`);
  return result;
}

/**
 * Get payments by context
 * @param {string} contextId - TC-* or TV-*
 * @param {string} facing - 'down' (as payer/client) or 'up' (as payee/vendor)
 * @param {object} filters - Query filters
 * @returns {Promise<object[]>} Payments
 */
async function getPaymentsByContext(contextId, facing, filters = {}) {
  const column = facing === 'down' ? 'from_id' : 'to_id';

  let query = serviceClient
    .from('nexus_payments')
    .select(`
      *,
      from_tenant:nexus_tenants!fk_payments_from_tenant(tenant_id, name, display_name),
      to_tenant:nexus_tenants!fk_payments_to_tenant(tenant_id, name, display_name)
    `)
    .eq(column, contextId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get payments: ${error.message}`);
  return data || [];
}

/**
 * Update payment status
 * @param {string} paymentId - PAY-* ID
 * @param {string} status - New status
 * @param {object} updates - Additional updates
 * @returns {Promise<object>} Updated payment
 */
async function updatePaymentStatus(paymentId, status, updates = {}) {
  const updateData = {
    status,
    ...updates,
    ...(status === 'completed' && { completed_at: new Date().toISOString() })
  };

  const { data, error } = await serviceClient
    .from('nexus_payments')
    .update(updateData)
    .eq('payment_id', paymentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
  return data;
}

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

/**
 * Create a notification
 * @param {object} data - Notification data
 * @returns {Promise<object>} Created notification
 */
async function createNotification(data) {
  const notificationId = generateId('NTF');

  // Determine priority (payment always critical)
  let priority = data.priority || 'normal';
  if (data.type?.startsWith('payment_') || data.type?.startsWith('invoice_')) {
    priority = 'critical';
  }

  const notification = {
    notification_id: notificationId,
    user_id: data.userId,
    tenant_id: data.tenantId,
    context: data.context,
    context_id: data.contextId,
    notification_type: data.type,
    priority,
    title: data.title,
    body: data.body,
    reference_type: data.referenceType,
    reference_id: data.referenceId,
    action_url: data.actionUrl,
    action_label: data.actionLabel,
    metadata: data.metadata || {}
  };

  const { data: result, error } = await serviceClient
    .from('nexus_notifications')
    .insert(notification)
    .select()
    .single();

  if (error) throw new Error(`Failed to create notification: ${error.message}`);
  return result;
}

/**
 * Get notifications for a user (includes tenant broadcasts where user_id IS NULL)
 * @param {string} userId - USR-* ID
 * @param {string} tenantId - TNT-* ID (for broadcasts)
 * @param {object} options - Query options
 * @returns {Promise<object[]>} Notifications
 */
async function getNotifications(userId, tenantId, options = {}) {
  let query = serviceClient
    .from('nexus_notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (options.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options.type) {
    query = query.eq('notification_type', options.type);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(options.limit || 50);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get notifications: ${error.message}`);
  return data || [];
}

/**
 * Get unread notification count (includes tenant broadcasts)
 * @param {string} userId - USR-* ID
 * @param {string} tenantId - TNT-* ID (for broadcasts)
 * @returns {Promise<{ total: number, payment: number, case: number, critical: number }>}
 */
async function getUnreadCount(userId, tenantId) {
  // Get user-specific counts
  const { data: userData, error: userError } = await serviceClient
    .from('nexus_notification_counts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (userError && userError.code !== 'PGRST116') {
    throw new Error(`Failed to get unread count: ${userError.message}`);
  }

  // Get broadcast counts (user_id IS NULL for this tenant)
  const { data: broadcastData, error: broadcastError } = await serviceClient
    .from('nexus_notifications')
    .select('notification_id, notification_type, priority')
    .eq('tenant_id', tenantId)
    .is('user_id', null)
    .eq('is_read', false);

  if (broadcastError) {
    throw new Error(`Failed to get broadcast count: ${broadcastError.message}`);
  }

  // Combine counts
  const broadcasts = broadcastData || [];
  const broadcastCounts = {
    total: broadcasts.length,
    payment: broadcasts.filter(n => n.notification_type?.startsWith('payment_')).length,
    case: broadcasts.filter(n => n.notification_type?.startsWith('case_') || n.notification_type === 'message_received').length,
    critical: broadcasts.filter(n => n.priority === 'critical').length
  };

  return {
    total: (userData?.total_unread || 0) + broadcastCounts.total,
    payment: (userData?.payment_unread || 0) + broadcastCounts.payment,
    case: (userData?.case_unread || 0) + broadcastCounts.case,
    critical: (userData?.critical_unread || 0) + broadcastCounts.critical
  };
}

/**
 * Mark notifications as read
 * @param {string} userId - USR-* ID
 * @param {string} tenantId - TNT-* ID (for broadcasts)
 * @param {string[]} notificationIds - NTF-* IDs (or empty for all)
 * @returns {Promise<number>} Number marked
 */
async function markNotificationsRead(userId, tenantId, notificationIds = []) {
  // Build filter: user's own notifications OR tenant broadcasts
  let query = serviceClient
    .from('nexus_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_read', false);

  if (notificationIds.length > 0) {
    query = query.in('notification_id', notificationIds);
  }

  const { data, error } = await query.select();

  if (error) throw new Error(`Failed to mark notifications read: ${error.message}`);
  return data?.length || 0;
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Create a session
 * @param {object} data - Session data
 * @returns {Promise<object>} Created session
 */
async function createSession(data) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  const session = {
    id: sessionId,
    user_id: data.userId,
    tenant_id: data.tenantId,
    active_context: data.activeContext,
    active_context_id: data.activeContextId,
    active_counterparty: data.activeCounterparty,
    data: data.data || {},
    expires_at: expiresAt.toISOString()
  };

  const { data: result, error } = await serviceClient
    .from('nexus_sessions')
    .insert(session)
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return result;
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<object|null>} Session or null
 */
async function getSession(sessionId) {
  // First get the session
  const { data: session, error: sessionError } = await serviceClient
    .from('nexus_sessions')
    .select('*')
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (sessionError) {
    if (sessionError.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get session: ${sessionError.message}`);
  }
  if (!session) return null;

  // Manually fetch the user and tenant (no FK relationship in schema)
  const { data: user } = await serviceClient
    .from('nexus_users')
    .select('*')
    .eq('user_id', session.user_id)
    .single();

  const { data: tenant } = await serviceClient
    .from('nexus_tenants')
    .select('*')
    .eq('tenant_id', session.tenant_id)
    .single();

  return { ...session, user, tenant };
}

/**
 * Update session data (for token refresh, etc.)
 * @param {string} sessionId - Session ID
 * @param {object} updates - Fields to update (data, active_context, etc.)
 * @returns {Promise<object>} Updated session
 */
async function updateSession(sessionId, updates) {
  const updatePayload = {
    last_active_at: new Date().toISOString()
  };

  // Map allowed fields
  if (updates.data !== undefined) updatePayload.data = updates.data;
  if (updates.activeContext !== undefined) updatePayload.active_context = updates.activeContext;
  if (updates.activeContextId !== undefined) updatePayload.active_context_id = updates.activeContextId;
  if (updates.activeCounterparty !== undefined) updatePayload.active_counterparty = updates.activeCounterparty;

  const { data, error } = await serviceClient
    .from('nexus_sessions')
    .update(updatePayload)
    .eq('id', sessionId)
    .select();

  if (error) throw new Error(`Failed to update session: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return data[0];
}

/**
 * Update session context
 * @param {string} sessionId - Session ID
 * @param {object} context - New context
 * @returns {Promise<object>} Updated session
 */
async function updateSessionContext(sessionId, context) {
  const { data, error } = await serviceClient
    .from('nexus_sessions')
    .update({
      active_context: context.activeContext,
      active_context_id: context.activeContextId,
      active_counterparty: context.activeCounterparty,
      last_active_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update session: ${error.message}`);
  return data;
}

/**
 * Delete session
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
async function deleteSession(sessionId) {
  const { error } = await serviceClient
    .from('nexus_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw new Error(`Failed to delete session: ${error.message}`);
}

// ============================================================================
// SUPABASE AUTH OPERATIONS
// ============================================================================

let _authClient = null;

/**
 * Get Supabase Auth client (uses anon key for client-side auth operations)
 */
function getAuthClient() {
  if (!_authClient) {
    const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getSupabaseConfig();
    const key = supabaseAnonKey || supabaseServiceKey;
    _authClient = createClient(supabaseUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return _authClient;
}

/**
 * Sign in with email and password via Supabase Auth
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{ user: object, session: object }>} Auth data
 */
async function signInWithPassword(email, password) {
  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw new Error(`Authentication failed: ${error.message}`);
  return data;
}

/**
 * Create a new auth user via Supabase Admin API
 * @param {object} options - User options
 * @returns {Promise<object>} Created auth user
 */
async function createAuthUser(options) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: options.emailConfirm !== false,
    user_metadata: options.metadata || {}
  });

  if (error) throw new Error(`Failed to create auth user: ${error.message}`);
  return data.user;
}

/**
 * Set Nexus identity claims in auth user's app_metadata and return refreshed session
 * MUST be called server-side (service_role) after successful login
 * This enables RLS policies to use jwt_nexus_user_id() and jwt_nexus_tenant_id()
 *
 * IMPORTANT: After updating app_metadata, the current session JWT is stale.
 * Pass the refresh_token to get a NEW session with updated JWT containing the metadata.
 * If refresh_token is provided, refresh MUST succeed or this throws (no silent failures).
 *
 * @param {string} authUserId - Supabase Auth UUID
 * @param {string} nexusUserId - Nexus user ID (USR-*)
 * @param {string} nexusTenantId - Nexus tenant ID (TNT-*)
 * @param {string} [refreshToken] - Current refresh token to exchange for new session
 * @returns {Promise<{user: object, session: object|null}>} Updated user + refreshed session
 * @throws {Error} If refresh_token provided but refresh fails
 */
async function setAuthAppMetadata(authUserId, nexusUserId, nexusTenantId, refreshToken = null) {
  // Step 1: Update app_metadata using admin API
  const { data: userData, error: updateError } = await serviceClient.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      nexus_user_id: nexusUserId,
      nexus_tenant_id: nexusTenantId
    }
  });

  if (updateError) throw new Error(`Failed to set app_metadata: ${updateError.message}`);
  if (!userData?.user) {
    throw new Error('Failed to set app_metadata: updateUserById returned no user. Please retry login.');
  }

  // Step 2: If refresh token provided, refresh MUST succeed (no silent failures)
  let refreshedSession = null;
  if (refreshToken) {
    const { data: refreshData, error: refreshError } = await serviceClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (refreshError) {
      // HARD ERROR: Don't allow half-success where user is "logged in" but RLS claims are missing
      throw new Error(`Session refresh failed after metadata update: ${refreshError.message}. Please retry login.`);
    }
    if (!refreshData?.session?.access_token) {
      // Edge case: no error but also no session (revoked token, race condition)
      throw new Error('Session refresh failed after metadata update: no session returned. Please retry login.');
    }

    refreshedSession = refreshData.session;

    // DEV: Verify JWT contains the claims (catches bugs early)
    if (process.env.NODE_ENV === 'development') {
      try {
        const parts = refreshedSession.access_token.split('.');
        if (parts.length < 2) {
          console.warn('[DEV] Invalid access_token format (expected 3 parts)');
        } else {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          const claims = payload.app_metadata || {};

          if (claims.nexus_user_id !== nexusUserId || claims.nexus_tenant_id !== nexusTenantId) {
            console.warn('[DEV] JWT claims mismatch after refresh!', {
              expected: { nexus_user_id: nexusUserId, nexus_tenant_id: nexusTenantId },
              got: { nexus_user_id: claims.nexus_user_id, nexus_tenant_id: claims.nexus_tenant_id }
            });
          } else {
            console.log('[DEV] ✓ JWT claims verified:', claims.nexus_user_id, claims.nexus_tenant_id);
          }
        }
      } catch (decodeErr) {
        console.warn('[DEV] Could not decode JWT for verification:', decodeErr.message);
      }
    }
  }

  return { user: userData.user, session: refreshedSession };
}

/**
 * Get user by auth_user_id (Supabase Auth UUID)
 * @param {string} authUserId - UUID from auth.users
 * @returns {Promise<object|null>} Nexus user with tenant or null
 */
async function getUserByAuthId(authUserId) {
  // First get the user
  const { data: user, error: userError } = await serviceClient
    .from('nexus_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (userError && userError.code !== 'PGRST116') throw new Error(`Failed to get user by auth ID: ${userError.message}`);
  if (!user) return null;

  // Then get the tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from('nexus_tenants')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .single();

  if (tenantError && tenantError.code !== 'PGRST116') throw new Error(`Failed to get tenant: ${tenantError.message}`);

  return { ...user, tenant };
}

/**
 * Link existing nexus_user to auth.users
 * @param {string} userId - USR-* ID
 * @param {string} authUserId - UUID from auth.users
 * @returns {Promise<object>} Updated user
 */
async function linkAuthUser(userId, authUserId) {
  const { data, error } = await serviceClient
    .from('nexus_users')
    .update({ auth_user_id: authUserId })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to link auth user: ${error.message}`);
  return data;
}

/**
 * Verify Supabase Auth token and get user
 * @param {string} accessToken - JWT access token
 * @returns {Promise<object|null>} Auth user or null
 */
async function verifyAuthToken(accessToken) {
  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error) return null;
  return data.user;
}

/**
 * Send password reset email via Supabase Auth
 * @param {string} email - User email
 * @param {string} redirectTo - URL to redirect after reset
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(email, redirectTo) {
  const authClient = getAuthClient();
  const { error } = await authClient.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  if (error) throw new Error(`Failed to send password reset: ${error.message}`);
}

/**
 * Update user password via Supabase Auth
 * @param {string} accessToken - User's access token
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Updated auth user
 */
async function updateAuthPassword(accessToken, newPassword) {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getSupabaseConfig();
  const key = supabaseAnonKey || supabaseServiceKey;

  // Create client with user's session
  const userClient = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  });

  const { data, error } = await userClient.auth.updateUser({
    password: newPassword
  });

  if (error) throw new Error(`Failed to update password: ${error.message}`);
  return data.user;
}

/**
 * Get OAuth sign-in URL for a provider
 * @param {string} provider - OAuth provider (google, github, etc.)
 * @param {string} redirectTo - URL to redirect after OAuth
 * @returns {Promise<{ url: string }>} OAuth URL
 */
async function getOAuthUrl(provider, redirectTo) {
  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      flowType: 'pkce'  // Use authorization code flow instead of implicit
    }
  });

  if (error) throw new Error(`Failed to get OAuth URL: ${error.message}`);
  return { url: data.url };
}

/**
 * Exchange OAuth code for session
 * @param {string} code - OAuth authorization code
 * @returns {Promise<{ user: object, session: object }>} Auth data
 */
async function exchangeOAuthCode(code) {
  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.exchangeCodeForSession(code);

  if (error) throw new Error(`Failed to exchange OAuth code: ${error.message}`);
  return data;
}

/**
 * Sign out and invalidate session
 * @param {string} accessToken - User's access token
 * @returns {Promise<void>}
 */
async function signOut(accessToken) {
  if (!accessToken) return;

  const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getSupabaseConfig();
  const key = supabaseAnonKey || supabaseServiceKey;

  const userClient = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  });

  await userClient.auth.signOut();
}

/**
 * Debug: Check what role the serviceClient is actually using
 * Calls the debug_auth_context() function to see the real role from PostgREST
 */
async function debugAuthContext() {
  // Also decode the key to verify it's correct
  const { supabaseServiceKey, supabaseAnonKey } = getSupabaseConfig();

  function decodeJwtRole(jwt) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      return payload?.role || null;
    } catch { return null; }
  }

  const serviceKeyRole = decodeJwtRole(supabaseServiceKey);
  const anonKeyRole = decodeJwtRole(supabaseAnonKey);

  // Call the debug function via RPC
  const { data: serviceResult, error: serviceError } = await serviceClient.rpc('debug_auth_context');

  return {
    keyDecoded: {
      serviceKeyRole,
      anonKeyRole
    },
    serviceClientRpc: serviceError ? { error: serviceError.message } : serviceResult
  };
}

// ============================================================================
// CLIENT-PERSPECTIVE OPERATIONS (CMP Phase C2)
// ============================================================================

/**
 * Get vendors for a client (relationships where I am the client)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @returns {Promise<object[]>} Relationships with vendor tenant info
 */
async function getVendorsByClient(clientId) {
  // Get relationships where this tenant is the client
  const { data: relationships, error } = await serviceClient
    .from('nexus_tenant_relationships')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (error) throw new Error(`Failed to get vendors: ${error.message}`);

  // Enrich with vendor tenant info (no FK on relationships table)
  const enriched = await Promise.all((relationships || []).map(async rel => {
    const { data: vendorTenant } = await serviceClient
      .from('nexus_tenants')
      .select('tenant_id, tenant_vendor_id, name, display_name')
      .eq('tenant_vendor_id', rel.vendor_id)
      .single();
    return { ...rel, vendor_tenant: vendorTenant };
  }));

  return enriched;
}

/**
 * Get invoices for a client (invoices I need to pay - Accounts Payable)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {object} filters - Optional filters { status, vendorId }
 * @returns {Promise<object[]>} Invoices with vendor tenant info
 */
async function getInvoicesByClient(clientId, filters = {}) {
  // Invoices table has no FK constraints, so we query and enrich manually
  let query = serviceClient
    .from('nexus_invoices')
    .select('*')
    .eq('client_id', clientId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId);
  }

  query = query.order('due_date', { ascending: true });

  const { data: invoices, error } = await query;

  if (error) throw new Error(`Failed to get invoices: ${error.message}`);

  // Enrich with vendor tenant info
  const enriched = await Promise.all((invoices || []).map(async inv => {
    const { data: vendorTenant } = await serviceClient
      .from('nexus_tenants')
      .select('tenant_id, tenant_vendor_id, name, display_name')
      .eq('tenant_vendor_id', inv.vendor_id)
      .single();
    return { ...inv, vendor_tenant: vendorTenant };
  }));

  return enriched;
}

/**
 * C8.1: Invoice Inbox for Client with tabs, filters, and pagination
 * @param {object} options - Query options
 * @returns {Promise<{rows: object[], total: number, limit: number, offset: number, tab: string}>}
 */
async function getInvoiceInboxByClient({
  clientId,
  tab = 'needs_review',
  vendorId = null,
  q = null,
  dateFrom = null,
  dateTo = null,
  minAmount = null,
  maxAmount = null,
  limit = 20,
  offset = 0,
} = {}) {
  if (!clientId) throw new Error('getInvoiceInboxByClient: clientId required');

  // Normalize tab (support legacy 'pending' → 'needs_review')
  const normalizeTab = (t) => {
    const x = String(t || '').toLowerCase();
    if (x === 'pending') return 'needs_review';
    return x || 'needs_review';
  };

  const normalizedTab = normalizeTab(tab);

  // Map tab to status array
  const tabToStatuses = (t) => {
    switch (t) {
      case 'needs_review': return ['sent', 'viewed', 'overdue'];
      case 'approved': return ['approved'];
      case 'disputed': return ['disputed'];
      case 'paid': return ['paid'];
      case 'overdue': return ['overdue'];
      case 'all': return null; // no status filter
      default: return ['sent', 'viewed', 'overdue'];
    }
  };

  const statuses = tabToStatuses(normalizedTab);

  // Build base query
  let query = serviceClient
    .from('nexus_invoices')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId);

  // Apply status filter
  if (statuses && statuses.length) {
    query = query.in('status', statuses);
  }

  // Apply vendor filter
  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  // Date filters (on invoice_date)
  if (dateFrom) {
    query = query.gte('invoice_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('invoice_date', dateTo);
  }

  // Amount filters (on total_amount)
  if (minAmount != null && !isNaN(Number(minAmount))) {
    query = query.gte('total_amount', Number(minAmount));
  }
  if (maxAmount != null && !isNaN(Number(maxAmount))) {
    query = query.lte('total_amount', Number(maxAmount));
  }

  // Search filter (invoice_id or invoice_number)
  if (q && String(q).trim()) {
    const searchTerm = String(q).trim();
    query = query.or(`invoice_id.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`);
  }

  // Pagination bounds
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safeOffset = Math.max(0, Number(offset) || 0);

  // Order and paginate
  query = query
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to get invoice inbox: ${error.message}`);

  // Enrich with vendor tenant info
  const enriched = await Promise.all((data || []).map(async inv => {
    const { data: vendorTenant } = await serviceClient
      .from('nexus_tenants')
      .select('tenant_id, tenant_vendor_id, name, display_name')
      .eq('tenant_vendor_id', inv.vendor_id)
      .single();
    return { ...inv, vendor_tenant: vendorTenant };
  }));

  return {
    rows: enriched,
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
    tab: normalizedTab,
  };
}

/**
 * Get payments made by a client (payments I sent - outbound)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {object} filters - Optional filters { status }
 * @returns {Promise<object[]>} Payments with from/to tenant info
 */
async function getPaymentsByClient(clientId, filters = {}) {
  // Payments table HAS FK constraints - use PostgREST join syntax
  let query = serviceClient
    .from('nexus_payments')
    .select(`
      *,
      from_tenant:nexus_tenants!fk_payments_from_tenant(tenant_id, name, display_name),
      to_tenant:nexus_tenants!fk_payments_to_tenant(tenant_id, name, display_name)
    `)
    .eq('from_id', clientId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get payments: ${error.message}`);
  return data || [];
}

/**
 * Get cases for a client (cases where I am the client)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {object} filters - Optional filters { status, category, vendorId }
 * @returns {Promise<object[]>} Cases with client/vendor tenant info
 */
async function getCasesByClient(clientId, filters = {}) {
  // Cases table HAS FK constraints - use PostgREST join syntax
  let query = serviceClient
    .from('nexus_cases')
    .select(`
      *,
      client_tenant:nexus_tenants!fk_cases_client_tenant(tenant_id, name, display_name),
      vendor_tenant:nexus_tenants!fk_cases_vendor_tenant(tenant_id, name, display_name)
    `)
    .eq('client_id', clientId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get cases: ${error.message}`);
  return data || [];
}

/**
 * Get invoice detail for a client (single invoice with payments)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {string} invoiceId - INV-* ID
 * @returns {Promise<object|null>} Invoice with vendor info and linked payments
 */
async function getInvoiceDetailByClient(clientId, invoiceId) {
  // Fetch invoice - scoped to client
  const { data: invoice, error } = await serviceClient
    .from('nexus_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('client_id', clientId)
    .single();

  if (error || !invoice) return null;

  // Enrich with vendor tenant info
  const { data: vendorTenant } = await serviceClient
    .from('nexus_tenants')
    .select('tenant_id, tenant_vendor_id, name, display_name')
    .eq('tenant_vendor_id', invoice.vendor_id)
    .single();

  // Fetch linked payments (payments referencing this invoice)
  const { data: payments } = await serviceClient
    .from('nexus_payments')
    .select(`
      payment_id, amount, status, payment_date, payment_method, created_at,
      to_tenant:nexus_tenants!fk_payments_to_tenant(tenant_id, name, display_name)
    `)
    .eq('invoice_id', invoiceId)
    .eq('from_id', clientId)
    .order('created_at', { ascending: false });

  return {
    ...invoice,
    vendor_tenant: vendorTenant,
    payments: payments || [],
  };
}

/**
 * Get payment detail for a client (single payment with invoice info)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {string} paymentId - PAY-* ID
 * @returns {Promise<object|null>} Payment with tenant info and linked invoice
 */
async function getPaymentDetailByClient(clientId, paymentId) {
  // Fetch payment - scoped to client (from_id = payer)
  const { data: payment, error } = await serviceClient
    .from('nexus_payments')
    .select(`
      *,
      from_tenant:nexus_tenants!fk_payments_from_tenant(tenant_id, name, display_name),
      to_tenant:nexus_tenants!fk_payments_to_tenant(tenant_id, name, display_name)
    `)
    .eq('payment_id', paymentId)
    .eq('from_id', clientId)
    .single();

  if (error || !payment) return null;

  // Fetch linked invoice if exists
  let linkedInvoice = null;
  if (payment.invoice_id) {
    const { data: invoice } = await serviceClient
      .from('nexus_invoices')
      .select('invoice_id, invoice_number, total_amount, amount_outstanding, status, due_date')
      .eq('invoice_id', payment.invoice_id)
      .single();
    linkedInvoice = invoice;
  }

  return {
    ...payment,
    linked_invoice: linkedInvoice,
  };
}

/**
 * Get case detail for a client (single case with timeline)
 * @param {string} clientId - TC-* ID (the client's tenant_client_id)
 * @param {string} caseId - CASE-* ID
 * @returns {Promise<object|null>} Case with vendor info, messages, and evidence
 */
async function getCaseDetailByClient(clientId, caseId) {
  // Fetch case - scoped to client
  const { data: caseData, error } = await serviceClient
    .from('nexus_cases')
    .select(`
      *,
      client_tenant:nexus_tenants!fk_cases_client_tenant(tenant_id, name, display_name),
      vendor_tenant:nexus_tenants!fk_cases_vendor_tenant(tenant_id, name, display_name)
    `)
    .eq('case_id', caseId)
    .eq('client_id', clientId)
    .single();

  if (error || !caseData) return null;

  // Fetch messages (timeline items)
  const { data: messages } = await serviceClient
    .from('nexus_case_messages')
    .select('*, sender:nexus_users(user_id, display_name, email)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  // Fetch evidence
  const { data: evidence } = await serviceClient
    .from('nexus_case_evidence')
    .select('*')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Build references object
  const references = {
    invoice_id: caseData.invoice_ref,
    payment_id: caseData.payment_ref,
    vendor_id: caseData.vendor_id,
  };

  return {
    ...caseData,
    messages: messages || [],
    evidence: evidence || [],
    references,
  };
}

/**
 * Create a note on a case (client context)
 * @param {object} data - Note data { caseId, clientId, userId, tenantId, content }
 * @returns {Promise<object>} Created message
 */
async function createCaseNoteByClient(data) {
  const messageId = generateId('MSG');

  const message = {
    message_id: messageId,
    case_id: data.caseId,
    sender_user_id: data.userId,
    sender_tenant_id: data.tenantId,
    sender_context: 'client',
    sender_context_id: data.clientId,
    body: data.content,
    message_type: 'note',
    metadata: {},
  };

  const { data: result, error } = await serviceClient
    .from('nexus_case_messages')
    .insert(message)
    .select('*, sender:nexus_users(user_id, display_name, email)')
    .single();

  if (error) throw new Error(`Failed to create note: ${error.message}`);
  return result;
}

// ============================================================================
// EVIDENCE UPLOAD (CMP Phase C6.2)
// ============================================================================

/**
 * File constraints for evidence uploads
 */
const EVIDENCE_CONSTRAINTS = {
  maxSize: 10 * 1024 * 1024, // 10 MB
  allowedTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  ],
  allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx'],
  bucket: 'nexus-evidence',
};

/**
 * Validate file for evidence upload
 * @param {object} file - Multer file object
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEvidenceFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > EVIDENCE_CONSTRAINTS.maxSize) {
    return { valid: false, error: `File too large. Maximum size is ${EVIDENCE_CONSTRAINTS.maxSize / (1024 * 1024)}MB` };
  }

  if (!EVIDENCE_CONSTRAINTS.allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Allowed: PDF, PNG, JPG, DOCX, XLSX' };
  }

  const ext = '.' + file.originalname.split('.').pop().toLowerCase();
  if (!EVIDENCE_CONSTRAINTS.allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  return { valid: true };
}

/**
 * Upload evidence file to a case (client context)
 * @param {object} data - Upload data { caseId, clientId, userId, tenantId, file }
 * @returns {Promise<object>} Created evidence record
 */
async function createCaseEvidenceByClient(data) {
  const { caseId, clientId, userId, tenantId, file } = data;

  // 1. Verify case ownership by client
  const { data: caseData, error: caseError } = await serviceClient
    .from('nexus_cases')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('client_id', clientId)
    .single();

  if (caseError || !caseData) {
    throw new Error('Case not found or access denied');
  }

  // 2. Validate file
  const validation = validateEvidenceFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 3. Generate evidence ID and storage path
  const evidenceId = generateId('EVD');
  const fileExt = file.originalname.split('.').pop().toLowerCase();
  const uniqueFilename = `${evidenceId}_${Date.now()}.${fileExt}`;
  const storagePath = `cases/${caseId}/${uniqueFilename}`;

  // 4. Upload to storage
  const { error: uploadError } = await serviceClient.storage
    .from(EVIDENCE_CONSTRAINTS.bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false, // Never overwrite
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 5. Insert database record
  const evidenceRecord = {
    evidence_id: evidenceId,
    case_id: caseId,
    uploader_user_id: userId,
    uploader_tenant_id: tenantId,
    uploader_context: 'client',
    filename: uniqueFilename,
    original_filename: file.originalname,
    file_type: file.mimetype,
    file_size: file.size,
    file_extension: fileExt,
    storage_path: storagePath,
    storage_bucket: EVIDENCE_CONSTRAINTS.bucket,
    evidence_type: mapMimeToEvidenceType(file.mimetype),
    metadata: {},
  };

  const { data: result, error: insertError } = await serviceClient
    .from('nexus_case_evidence')
    .insert(evidenceRecord)
    .select('*')
    .single();

  if (insertError) {
    // Attempt to clean up the uploaded file if DB insert fails
    await serviceClient.storage
      .from(EVIDENCE_CONSTRAINTS.bucket)
      .remove([storagePath])
      .catch(() => {}); // Ignore cleanup errors
    throw new Error(`Failed to record evidence: ${insertError.message}`);
  }

  return result;
}

/**
 * Map MIME type to evidence_type enum
 */
function mapMimeToEvidenceType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('spreadsheet')) return 'document';
  if (mimeType.includes('wordprocessing')) return 'document';
  return 'other';
}

/**
 * Get download URL for evidence file
 * @param {string} storagePath - Path in storage bucket
 * @param {number} expiresIn - Seconds until URL expires (default 1 hour)
 * @returns {Promise<string|null>} Signed URL or null
 */
async function getEvidenceDownloadUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await serviceClient.storage
    .from(EVIDENCE_CONSTRAINTS.bucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error) return null;
  return data.signedUrl;
}

/**
 * Get evidence list for a case (with download URLs)
 * @param {string} clientId - Client context ID (TC-*)
 * @param {string} caseId - Case ID (CASE-*)
 * @returns {Promise<Array>} Evidence records with download URLs
 */
async function getCaseEvidenceByClient(clientId, caseId) {
  // Verify case ownership
  const { data: caseData, error: caseError } = await serviceClient
    .from('nexus_cases')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('client_id', clientId)
    .single();

  if (caseError || !caseData) return [];

  // Fetch evidence
  const { data: evidence, error } = await serviceClient
    .from('nexus_case_evidence')
    .select('*, uploader:nexus_users(user_id, display_name)')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !evidence) return [];

  // Generate download URLs for each item
  const withUrls = await Promise.all(
    evidence.map(async (item) => ({
      ...item,
      download_url: await getEvidenceDownloadUrl(item.storage_path),
    }))
  );

  return withUrls;
}

// ============================================================================
// VENDOR-SIDE CASE ACCESS (CMP Phase C6.4)
// ============================================================================

/**
 * Get case detail scoped to vendor (TV-*)
 * Must match BOTH case_id AND vendor_id
 * @param {string} vendorId - Vendor context ID (TV-*)
 * @param {string} caseId - Case ID (CASE-*)
 * @returns {Promise<object|null>} Case detail with messages and evidence
 */
async function getCaseDetailByVendor(vendorId, caseId) {
  const { data: c, error } = await serviceClient
    .from('nexus_cases')
    .select(`
      *,
      client_tenant:nexus_tenants!nexus_cases_client_id_fkey(tenant_id, name, display_name)
    `)
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw error;
  if (!c) return null;

  // Fetch messages (case already vendor-scoped)
  const { data: msgs, error: e2 } = await serviceClient
    .from('nexus_case_messages')
    .select('*, sender:nexus_users(user_id, display_name, email)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (e2) throw e2;

  // Fetch evidence (scoped by case_id; case already vendor-scoped)
  const evidence = await getCaseEvidenceByVendor(vendorId, caseId);

  return { case: c, messages: msgs || [], evidence: evidence || [] };
}

/**
 * Get evidence list for a case (vendor context)
 * @param {string} vendorId - Vendor context ID (TV-*)
 * @param {string} caseId - Case ID (CASE-*)
 * @returns {Promise<Array|null>} Evidence records with download URLs, or null if no access
 */
async function getCaseEvidenceByVendor(vendorId, caseId) {
  // Verify vendor ownership first
  const { data: c, error: e0 } = await serviceClient
    .from('nexus_cases')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (e0) throw e0;
  if (!c) return null;

  const { data: rows, error } = await serviceClient
    .from('nexus_case_evidence')
    .select('*, uploader:nexus_users(user_id, display_name)')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Attach signed URLs (reuse existing function)
  const enriched = await Promise.all(
    (rows || []).map(async (r) => ({
      ...r,
      download_url: await getEvidenceDownloadUrl(r.storage_path),
    }))
  );

  return enriched;
}

/**
 * Create a note on a case (vendor context)
 * Hard locks: sender_context = 'vendor', message_type = 'note'
 * @param {object} data - { caseId, vendorId, userId, tenantId, content }
 * @returns {Promise<object|null>} Created message or null if no access
 */
async function createCaseNoteByVendor({ caseId, vendorId, userId, tenantId, content }) {
  // Verify vendor ownership
  const { data: c, error: e0 } = await serviceClient
    .from('nexus_cases')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (e0) throw e0;
  if (!c) return null;

  const messageId = generateId('MSG');
  const payload = {
    message_id: messageId,
    case_id: caseId,
    message_type: 'note',
    sender_context: 'vendor',
    sender_context_id: vendorId,
    sender_user_id: userId,
    sender_tenant_id: tenantId,
    body: content,
  };

  const { data: msg, error } = await serviceClient
    .from('nexus_case_messages')
    .insert(payload)
    .select('*, sender:nexus_users(user_id, display_name, email)')
    .single();

  if (error) throw error;
  return msg;
}

/**
 * Upload evidence to a case (vendor context)
 * Hard locks: uploader_context = 'vendor', bucket = 'nexus-evidence'
 * @param {object} data - { caseId, vendorId, userId, tenantId, file }
 * @returns {Promise<object|null>} Created evidence record or null if no access
 */
async function createCaseEvidenceByVendor({ caseId, vendorId, userId, tenantId, file }) {
  // Verify vendor ownership
  const { data: c, error: e0 } = await serviceClient
    .from('nexus_cases')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (e0) throw e0;
  if (!c) return null;

  // Validate file using existing validator
  const validation = validateEvidenceFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const bucket = EVIDENCE_CONSTRAINTS.bucket;
  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  const evidenceId = generateId('EVD');
  const ts = Date.now();
  const storagePath = `cases/${caseId}/${evidenceId}_${ts}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const row = {
    evidence_id: evidenceId,
    case_id: caseId,
    uploader_user_id: userId,
    uploader_tenant_id: tenantId,
    uploader_context: 'vendor',
    original_filename: file.originalname,
    file_type: file.mimetype,
    file_size: file.size,
    file_extension: ext,
    storage_bucket: bucket,
    storage_path: storagePath,
    evidence_type: 'file',
  };

  const { data: ins, error } = await serviceClient
    .from('nexus_case_evidence')
    .insert(row)
    .select('*, uploader:nexus_users(user_id, display_name)')
    .single();

  if (error) throw error;

  const downloadUrl = await getEvidenceDownloadUrl(storagePath);
  return { evidence: { ...ins, download_url: downloadUrl }, evidenceId };
}

// ============================================================================
// STATUS TRANSITIONS (CMP Phase C6.3)
// ============================================================================

/**
 * Allowed status transitions (state machine)
 * Key = current status, Value = array of allowed next statuses
 */
const STATUS_TRANSITIONS = {
  open: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  // Terminal states - no transitions allowed
  closed: [],
  cancelled: [],
  // Read-only states (not part of C6.3 workflow)
  draft: [],
  pending_client: [],
  pending_vendor: [],
  escalated: [],
};

/**
 * Human-readable action labels for each transition
 */
const TRANSITION_LABELS = {
  in_progress: 'Mark In Progress',
  resolved: 'Mark Resolved',
  closed: 'Close Case',
};

/**
 * Validate a status transition
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @returns {{ valid: boolean, error?: string }}
 */
function validateStatusTransition(fromStatus, toStatus) {
  const allowed = STATUS_TRANSITIONS[fromStatus];

  if (!allowed) {
    return { valid: false, error: `Current status '${fromStatus}' is not recognized` };
  }

  if (allowed.length === 0) {
    return { valid: false, error: `Cannot transition from '${fromStatus}' - case is in a terminal state` };
  }

  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      error: `Invalid transition: '${fromStatus}' → '${toStatus}'. Allowed: ${allowed.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Transition case status (client context)
 * Creates system timeline event + optional note
 * @param {object} data - { caseId, clientId, userId, tenantId, toStatus, note? }
 * @returns {Promise<{ case: object, systemEvent: object, noteEvent?: object }>}
 */
async function transitionCaseStatusByClient(data) {
  const { caseId, clientId, userId, tenantId, toStatus, note } = data;

  // 1. Fetch case and verify ownership
  const { data: caseData, error: fetchError } = await serviceClient
    .from('nexus_cases')
    .select('case_id, status, client_id')
    .eq('case_id', caseId)
    .eq('client_id', clientId)
    .single();

  if (fetchError || !caseData) {
    throw new Error('Case not found or access denied');
  }

  const fromStatus = caseData.status;

  // 2. Validate transition
  const validation = validateStatusTransition(fromStatus, toStatus);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 3. Update case status
  const updatePayload = {
    status: toStatus,
    updated_at: new Date().toISOString(),
  };

  // If resolving, set resolution timestamp
  if (toStatus === 'resolved') {
    updatePayload.resolved_at = new Date().toISOString();
    updatePayload.resolved_by = userId;
  }

  // If closing, set closed timestamp
  if (toStatus === 'closed') {
    updatePayload.closed_at = new Date().toISOString();
  }

  const { data: updatedCase, error: updateError } = await serviceClient
    .from('nexus_cases')
    .update(updatePayload)
    .eq('case_id', caseId)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(`Failed to update case status: ${updateError.message}`);
  }

  // 4. Create system timeline event
  const systemEventId = generateId('MSG');
  const systemEvent = {
    message_id: systemEventId,
    case_id: caseId,
    sender_user_id: userId,
    sender_tenant_id: tenantId,
    sender_context: 'system',
    sender_context_id: clientId,
    body: `Status changed: ${fromStatus} → ${toStatus}`,
    message_type: 'status_change',
    metadata: {
      from_status: fromStatus,
      to_status: toStatus,
      changed_by_user_id: userId,
      changed_by_tenant_id: tenantId,
      changed_by_context: 'client',
    },
  };

  const { data: systemEventResult, error: systemEventError } = await serviceClient
    .from('nexus_case_messages')
    .insert(systemEvent)
    .select('*, sender:nexus_users(user_id, display_name, email)')
    .single();

  if (systemEventError) {
    // Log but don't fail - status already updated
    console.error('Failed to create system event:', systemEventError);
  }

  // 5. Create optional note if provided
  let noteEventResult = null;
  if (note && note.trim()) {
    const noteEventId = generateId('MSG');
    const noteEvent = {
      message_id: noteEventId,
      case_id: caseId,
      sender_user_id: userId,
      sender_tenant_id: tenantId,
      sender_context: 'client',
      sender_context_id: clientId,
      body: note.trim(),
      message_type: 'note',
      metadata: {
        transition_context: `${fromStatus} → ${toStatus}`,
      },
    };

    const { data: noteResult, error: noteError } = await serviceClient
      .from('nexus_case_messages')
      .insert(noteEvent)
      .select('*, sender:nexus_users(user_id, display_name, email)')
      .single();

    if (!noteError) {
      noteEventResult = noteResult;
    }
  }

  return {
    case: updatedCase,
    systemEvent: systemEventResult,
    noteEvent: noteEventResult,
    fromStatus,
    toStatus,
  };
}

/**
 * Get available status transitions for a case
 * @param {string} currentStatus - Current case status
 * @returns {{ nextStatus: string, label: string }[]}
 */
function getAvailableTransitions(currentStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.map(status => ({
    nextStatus: status,
    label: TRANSITION_LABELS[status] || status,
  }));
}

// ============================================================================
// INVOICE DECISION (Client MVP Patch)
// ============================================================================

/**
 * Approve an invoice by client
 * @param {object} params - { invoiceId, clientId, actorUserId }
 * @returns {Promise<object>} Updated invoice
 */
async function approveInvoiceByClient({ invoiceId, clientId, actorUserId }) {
  if (!invoiceId) throw new Error('approveInvoiceByClient: invoiceId required');
  if (!clientId) throw new Error('approveInvoiceByClient: clientId required');

  // Ensure invoice belongs to client
  const invoice = await getInvoiceDetailByClient(clientId, invoiceId);
  if (!invoice) throw new Error('Invoice not found for client');

  // Idempotent: if already approved, just return
  if (invoice.status === 'approved') return invoice;

  const { data, error } = await serviceClient
    .from('nexus_invoices')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: actorUserId || null,
    })
    .eq('invoice_id', invoiceId)
    .eq('client_id', clientId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to approve invoice: ${error.message}`);

  return data;
}

/**
 * Dispute an invoice and create a linked case
 * @param {object} params - { invoiceId, clientId, actorUserId, subject, description }
 * @returns {Promise<{ invoice: object, caseId: string }>}
 */
async function disputeInvoiceByClient({ invoiceId, clientId, actorUserId, subject, description }) {
  if (!invoiceId) throw new Error('disputeInvoiceByClient: invoiceId required');
  if (!clientId) throw new Error('disputeInvoiceByClient: clientId required');

  const invoice = await getInvoiceDetailByClient(clientId, invoiceId);
  if (!invoice) throw new Error('Invoice not found for client');

  // If already linked to a case, return that relationship (MVP: avoid duplicate cases)
  if (invoice.case_id) {
    // Still mark as disputed if not already
    if (invoice.status !== 'disputed') {
      await serviceClient
        .from('nexus_invoices')
        .update({
          status: 'disputed',
          disputed_at: new Date().toISOString(),
          disputed_by: actorUserId || null,
        })
        .eq('invoice_id', invoiceId)
        .eq('client_id', clientId);
    }
    return { invoice: { ...invoice, status: 'disputed' }, caseId: invoice.case_id };
  }

  // Create a case using existing SSOT createCase()
  const createdCase = await createCase({
    clientId: invoice.client_id,
    vendorId: invoice.vendor_id,
    relationshipId: invoice.relationship_id || null,
    subject: subject || `Invoice dispute: ${invoice.invoice_number || invoice.invoice_id}`,
    description: description || 'Client raised an issue on this invoice.',
    caseType: 'invoice_dispute',
    priority: 'normal',
    invoiceRef: invoice.invoice_id,
    amountDisputed: invoice.total_amount || null,
    currency: invoice.currency || 'USD',
  });

  const caseId = createdCase?.case_id || null;
  if (!caseId) throw new Error('Failed to create dispute case (missing case id)');

  // Link invoice -> case and set disputed status
  const { data, error } = await serviceClient
    .from('nexus_invoices')
    .update({
      status: 'disputed',
      case_id: caseId,
      disputed_at: new Date().toISOString(),
      disputed_by: actorUserId || null,
    })
    .eq('invoice_id', invoiceId)
    .eq('client_id', clientId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to dispute invoice: ${error.message}`);

  return { invoice: data, caseId };
}

// ============================================================================
// MATCH SIGNAL (C8.2 Matching Pilot)
// ============================================================================

/**
 * Compute match signal for an invoice (pilot logic)
 * Does NOT persist - use refreshInvoiceMatchSignal to persist
 * @param {object} invoice - Invoice object with status, case_id, etc.
 * @returns {{ match_status: string, match_score: number|null, match_reason: string }}
 */
function computeInvoiceMatchSignal(invoice) {
  if (!invoice) {
    return { match_status: 'unknown', match_score: null, match_reason: 'No invoice data' };
  }

  // Pilot logic: derive match status from invoice state
  const status = invoice.status;
  const hasLinkedCase = Boolean(invoice.case_id);

  // Disputed → mismatch
  if (status === 'disputed') {
    return {
      match_status: 'mismatch',
      match_score: 0,
      match_reason: 'Invoice is disputed',
    };
  }

  // Has linked case but not disputed → needs_review
  if (hasLinkedCase) {
    return {
      match_status: 'needs_review',
      match_score: 50,
      match_reason: 'Invoice has a linked case requiring review',
    };
  }

  // Approved → matched
  if (status === 'approved') {
    return {
      match_status: 'matched',
      match_score: 100,
      match_reason: 'Invoice approved by client',
    };
  }

  // Paid → matched (implicit approval)
  if (status === 'paid') {
    return {
      match_status: 'matched',
      match_score: 95,
      match_reason: 'Invoice paid',
    };
  }

  // Pending, overdue, or unknown status → unknown
  return {
    match_status: 'unknown',
    match_score: null,
    match_reason: 'Awaiting client review',
  };
}

/**
 * Refresh and persist match signal for an invoice
 * @param {object} params - { invoiceId, clientId }
 * @returns {Promise<object>} Updated invoice with match signal
 */
async function refreshInvoiceMatchSignal({ invoiceId, clientId }) {
  if (!invoiceId) throw new Error('refreshInvoiceMatchSignal: invoiceId required');
  if (!clientId) throw new Error('refreshInvoiceMatchSignal: clientId required');

  // Fetch current invoice
  const invoice = await getInvoiceDetailByClient(clientId, invoiceId);
  if (!invoice) throw new Error('Invoice not found for client');

  // Compute signal
  const signal = computeInvoiceMatchSignal(invoice);

  // Persist signal
  const { data, error } = await serviceClient
    .from('nexus_invoices')
    .update({
      match_status: signal.match_status,
      match_score: signal.match_score,
      match_reason: signal.match_reason,
      match_updated_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .eq('client_id', clientId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to refresh match signal: ${error.message}`);

  return data;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const nexusAdapter = {
  // ID generation
  generateId,
  generateTenantIds,

  // Tenant
  createTenant,
  getTenantById,
  updateTenant,

  // User
  createUser,
  getUser,
  getUserByEmail,
  getUserByAuthId,
  updateUser,
  getUsersByTenant,
  linkAuthUser,

  // Relationship
  createRelationship,
  getTenantRelationships,
  getTenantContexts,

  // Client-Perspective (CMP Phase C2)
  getVendorsByClient,
  getInvoicesByClient,
  getPaymentsByClient,
  getCasesByClient,

  // Client-Perspective Inbox (CMP Phase C8.1)
  getInvoiceInboxByClient,

  // Client-Perspective Detail (CMP Phase C5)
  getInvoiceDetailByClient,
  getPaymentDetailByClient,

  // Client-Perspective Invoice Decision (MVP Patch)
  approveInvoiceByClient,
  disputeInvoiceByClient,

  // Match Signal (C8.2 Matching Pilot)
  computeInvoiceMatchSignal,
  refreshInvoiceMatchSignal,

  // Client-Perspective Case (CMP Phase C6)
  getCaseDetailByClient,
  createCaseNoteByClient,

  // Client-Perspective Evidence (CMP Phase C6.2)
  getCaseEvidenceByClient,
  createCaseEvidenceByClient,
  getEvidenceDownloadUrl,
  EVIDENCE_CONSTRAINTS,

  // Client-Perspective Status Transitions (CMP Phase C6.3)
  transitionCaseStatusByClient,
  getAvailableTransitions,
  validateStatusTransition,
  STATUS_TRANSITIONS,
  TRANSITION_LABELS,

  // Vendor-Perspective Case (CMP Phase C6.4)
  getCaseDetailByVendor,
  getCaseEvidenceByVendor,
  createCaseNoteByVendor,
  createCaseEvidenceByVendor,

  // Invite
  createRelationshipInvite,
  getInviteByToken,
  acceptInvite,

  // Case
  createCase,
  getCasesByContext,
  getCaseById,
  updateCase,

  // Message
  createMessage,
  getCaseMessages,
  markMessagesRead,

  // Payment
  createPayment,
  getPaymentsByContext,
  updatePaymentStatus,

  // Notification
  createNotification,
  getNotifications,
  getUnreadCount,
  markNotificationsRead,

  // Session
  createSession,
  getSession,
  updateSession,
  updateSessionContext,
  deleteSession,

  // Supabase Auth
  signInWithPassword,
  createAuthUser,
  setAuthAppMetadata,
  verifyAuthToken,
  sendPasswordResetEmail,
  updateAuthPassword,
  getOAuthUrl,
  exchangeOAuthCode,
  signOut,

  // Clients
  serviceClient,
  createContextClient,
  getAuthClient,

  // Debug
  debugAuthContext
};

export default nexusAdapter;
