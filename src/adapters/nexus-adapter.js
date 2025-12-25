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
 * @returns {Promise<object>} Updated user
 */
async function updateUser(userId, updates) {
  const { data, error } = await serviceClient
    .from('nexus_users')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user: ${error.message}`);
  return data;
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
  if (!tenant) throw new Error('Tenant not found');

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
 * Get notifications for a user
 * @param {string} userId - USR-* ID
 * @param {object} options - Query options
 * @returns {Promise<object[]>} Notifications
 */
async function getNotifications(userId, options = {}) {
  let query = serviceClient
    .from('nexus_notifications')
    .select('*')
    .eq('user_id', userId);

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
 * Get unread notification count
 * @param {string} userId - USR-* ID
 * @returns {Promise<{ total: number, payment: number, case: number, critical: number }>}
 */
async function getUnreadCount(userId) {
  const { data, error } = await serviceClient
    .from('nexus_notification_counts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get unread count: ${error.message}`);

  return {
    total: data?.total_unread || 0,
    payment: data?.payment_unread || 0,
    case: data?.case_unread || 0,
    critical: data?.critical_unread || 0
  };
}

/**
 * Mark notifications as read
 * @param {string} userId - USR-* ID
 * @param {string[]} notificationIds - NTF-* IDs (or empty for all)
 * @returns {Promise<number>} Number marked
 */
async function markNotificationsRead(userId, notificationIds = []) {
  let query = serviceClient
    .from('nexus_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
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
  updateSessionContext,
  deleteSession,

  // Supabase Auth
  signInWithPassword,
  createAuthUser,
  verifyAuthToken,
  sendPasswordResetEmail,
  updateAuthPassword,
  getOAuthUrl,
  exchangeOAuthCode,
  signOut,

  // Clients
  serviceClient,
  createContextClient,
  getAuthClient
};

export default nexusAdapter;
