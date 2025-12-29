/**
 * Legacy VMP Adapter Compatibility Layer
 * 
 * This file provides backward compatibility for tests and server.js that still use vmpAdapter.
 * 
 * TODO: Migrate all code to use nexusAdapter directly
 * 
 * @deprecated Use nexusAdapter from './nexus-adapter.js' instead
 */

import { createClient } from '@supabase/supabase-js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================

let _serviceClient = null;

function getServiceClient() {
  if (_serviceClient) return _serviceClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  _serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serviceClient;
}

// ============================================================================
// SOA METHODS (Legacy vmp_* tables)
// ============================================================================

/**
 * Get SOA statements for a vendor
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<Array>} Array of SOA cases (statements)
 */
async function getSOAStatements(vendorId) {
  if (!vendorId) {
    throw new ValidationError('getSOAStatements requires vendorId');
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('vmp_cases')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('case_type', 'soa')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get SOA statements: ${error.message}`);
  }

  return data || [];
}

/**
 * Get SOA lines for a case
 * @param {string} caseId - Case ID
 * @param {string} vendorId - Vendor ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} Array of SOA line items
 */
async function getSOALines(caseId, vendorId, status = null) {
  if (!caseId || !vendorId) {
    throw new ValidationError('getSOALines requires both caseId and vendorId');
  }

  const supabase = getServiceClient();

  // First verify it's an SOA case
  const { data: caseData, error: caseError } = await supabase
    .from('vmp_cases')
    .select('case_type')
    .eq('id', caseId)
    .eq('vendor_id', vendorId)
    .single();

  if (caseError || !caseData) {
    throw new NotFoundError('SOA case not found');
  }

  if (caseData.case_type !== 'soa') {
    throw new NotFoundError('SOA case not found');
  }

  // Get SOA lines
  let query = supabase
    .from('vmp_soa_items')
    .select('*')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId)
    .order('line_number', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get SOA lines: ${error.message}`);
  }

  return data || [];
}

/**
 * Get SOA summary for a case
 * @param {string} caseId - Case ID
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<object>} SOA summary with totals and counts
 */
async function getSOASummary(caseId, vendorId) {
  if (!caseId || !vendorId) {
    throw new ValidationError('getSOASummary requires both caseId and vendorId');
  }

  const supabase = getServiceClient();

  // Get all SOA lines for the case
  const { data: lines, error: linesError } = await supabase
    .from('vmp_soa_items')
    .select('amount, status')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId);

  if (linesError) {
    throw new Error(`Failed to get SOA summary: ${linesError.message}`);
  }

  // Get matched lines - matches are linked through soa_items
  const { data: soaItems, error: itemsError } = await supabase
    .from('vmp_soa_items')
    .select('id')
    .eq('case_id', caseId)
    .eq('vendor_id', vendorId);

  if (itemsError) {
    throw new Error(`Failed to get SOA summary: ${itemsError.message}`);
  }

  const soaItemIds = (soaItems || []).map(item => item.id);
  
  const { data: matches, error: matchesError } = await supabase
    .from('vmp_soa_matches')
    .select('soa_item_id, status')
    .in('soa_item_id', soaItemIds.length > 0 ? soaItemIds : ['00000000-0000-0000-0000-000000000000']);

  if (matchesError) {
    throw new Error(`Failed to get SOA summary: ${matchesError.message}`);
  }

  // Calculate summary
  const totalLines = lines?.length || 0;
  const totalAmount = lines?.reduce((sum, line) => sum + parseFloat(line.amount || 0), 0) || 0;

  const matchedLineIds = new Set((matches || []).map(m => m.soa_item_id));
  const matchedLines = lines?.filter(l => matchedLineIds.has(l.id)).length || 0;
  const matchedAmount = lines?.filter(l => matchedLineIds.has(l.id))
    .reduce((sum, line) => sum + parseFloat(line.amount || 0), 0) || 0;

  const unmatchedLines = totalLines - matchedLines;
  const unmatchedAmount = totalAmount - matchedAmount;

  // Get discrepancy lines
  const { data: issues, error: issuesError } = await supabase
    .from('vmp_soa_discrepancies')
    .select('soa_item_id')
    .eq('case_id', caseId)
    .eq('status', 'open');

  if (issuesError) {
    throw new Error(`Failed to get SOA summary: ${issuesError.message}`);
  }

  const discrepancyLineIds = new Set((issues || []).map(i => i.soa_item_id));
  const discrepancyLines = lines?.filter(l => discrepancyLineIds.has(l.id)).length || 0;
  const discrepancyAmount = lines?.filter(l => discrepancyLineIds.has(l.id))
    .reduce((sum, line) => sum + parseFloat(line.amount || 0), 0) || 0;

  const netVariance = totalAmount - matchedAmount;

  return {
    total_lines: totalLines,
    total_amount: totalAmount,
    matched_lines: matchedLines,
    matched_amount: matchedAmount,
    unmatched_lines: unmatchedLines,
    unmatched_amount: unmatchedAmount,
    discrepancy_lines: discrepancyLines,
    discrepancy_amount: discrepancyAmount,
    net_variance: netVariance,
  };
}

/**
 * Create SOA match
 * @param {string} soaItemId - SOA item ID
 * @param {string} invoiceId - Invoice ID
 * @param {object} matchData - Match data
 * @returns {Promise<object>} Created match
 */
async function createSOAMatch(soaItemId, invoiceId, matchData) {
  if (!soaItemId || !invoiceId) {
    throw new ValidationError('createSOAMatch requires both soaItemId and invoiceId');
  }

  const supabase = getServiceClient();

  // Get invoice to get required invoice_amount and invoice_date
  const { data: invoice, error: invoiceError } = await supabase
    .from('vmp_invoices')
    .select('total_amount, invoice_date')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new NotFoundError('Invoice not found');
  }

  // Get SOA item to get required soa_amount and soa_date
  const { data: soaItemFull, error: soaItemError } = await supabase
    .from('vmp_soa_items')
    .select('amount, invoice_date')
    .eq('id', soaItemId)
    .single();

  if (soaItemError || !soaItemFull) {
    throw new NotFoundError('SOA item not found');
  }

  // Create match (soa_amount and invoice_amount are NOT NULL in schema)
  const match = {
    soa_item_id: soaItemId,
    invoice_id: invoiceId,
    match_type: matchData.matchType || 'deterministic',
    is_exact_match: matchData.isExactMatch || false,
    match_confidence: matchData.confidence !== undefined ? matchData.confidence : 1.0,
    match_score: matchData.matchScore || 0,
    match_criteria: matchData.matchCriteria || {},
    soa_amount: matchData.soaAmount !== undefined ? matchData.soaAmount : parseFloat(soaItemFull.amount || 0),
    invoice_amount: matchData.invoiceAmount !== undefined ? matchData.invoiceAmount : parseFloat(invoice.total_amount || 0),
    soa_date: matchData.soaDate || soaItemFull.invoice_date || null,
    invoice_date: matchData.invoiceDate || invoice.invoice_date || new Date().toISOString().split('T')[0],
    matched_by: matchData.matchedBy || 'system',
    status: 'pending',
    metadata: matchData.metadata || {},
  };

  const { data, error } = await supabase
    .from('vmp_soa_matches')
    .insert(match)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create SOA match: ${error.message}`);
  }

  // Update SOA item status to 'matched'
  await supabase
    .from('vmp_soa_items')
    .update({ status: 'matched', updated_at: new Date().toISOString() })
    .eq('id', soaItemId);

  return data;
}

/**
 * Confirm SOA match
 * @param {string} matchId - Match ID
 * @param {string} userId - User ID
 * @returns {Promise<object>} Updated match
 */
async function confirmSOAMatch(matchId, userId) {
  if (!matchId || !userId) {
    throw new ValidationError('confirmSOAMatch requires both matchId and userId');
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('vmp_soa_matches')
    .update({
      status: 'confirmed',
      confirmed_by_user_id: userId,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to confirm SOA match: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('SOA match not found');
  }

  return data;
}

/**
 * Reject SOA match
 * @param {string} matchId - Match ID
 * @param {string} userId - User ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<object>} Updated match
 */
async function rejectSOAMatch(matchId, userId, reason) {
  if (!matchId || !userId) {
    throw new ValidationError('rejectSOAMatch requires both matchId and userId');
  }

  const supabase = getServiceClient();

  // Get match to get soa_item_id
  const { data: match, error: matchError } = await supabase
    .from('vmp_soa_matches')
    .select('soa_item_id')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    throw new NotFoundError('SOA match not found');
  }

  // Update match
  const { data, error } = await supabase
    .from('vmp_soa_matches')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      rejected_by_user_id: userId,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reject SOA match: ${error.message}`);
  }

  // Update SOA item status back to 'extracted'
  await supabase
    .from('vmp_soa_items')
    .update({ status: 'extracted', updated_at: new Date().toISOString() })
    .eq('id', match.soa_item_id);

  return data;
}

/**
 * Create SOA issue (discrepancy)
 * @param {string} caseId - Case ID
 * @param {object} issueData - Issue data
 * @returns {Promise<object>} Created issue
 */
async function createSOAIssue(caseId, issueData) {
  if (!caseId) {
    throw new ValidationError('createSOAIssue requires caseId');
  }

  const supabase = getServiceClient();

  const issue = {
    case_id: caseId,
    soa_item_id: issueData.soaItemId || null,
    discrepancy_type: issueData.issueType || issueData.discrepancy_type || 'amount_mismatch',
    severity: issueData.severity || 'medium',
    description: issueData.description || 'Test discrepancy',
    difference_amount: issueData.amountDelta || issueData.difference_amount || null,
    detected_by: issueData.detectedBy || 'system',
    status: 'open',
  };

  const { data, error } = await supabase
    .from('vmp_soa_discrepancies')
    .insert(issue)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create SOA issue: ${error.message}`);
  }

  return data;
}

/**
 * Get SOA issues for a case
 * @param {string} caseId - Case ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} Array of issues
 */
async function getSOAIssues(caseId, status = null) {
  if (!caseId) {
    throw new ValidationError('getSOAIssues requires caseId');
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('vmp_soa_discrepancies')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get SOA issues: ${error.message}`);
  }

  return data || [];
}

/**
 * Resolve SOA issue
 * @param {string} issueId - Issue ID
 * @param {string} userId - User ID
 * @param {object} resolutionData - Resolution data
 * @returns {Promise<object>} Updated issue
 */
async function resolveSOAIssue(issueId, userId, resolutionData) {
  if (!issueId || !userId) {
    throw new ValidationError('resolveSOAIssue requires both issueId and userId');
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('vmp_soa_discrepancies')
    .update({
      status: 'resolved',
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: resolutionData.notes || null,
      resolution_action: resolutionData.action || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to resolve SOA issue: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('SOA issue not found');
  }

  return data;
}

/**
 * Sign off SOA reconciliation
 * @param {string} caseId - Case ID
 * @param {string} vendorId - Vendor ID
 * @param {string} userId - User ID
 * @param {object} acknowledgementData - Acknowledgement data
 * @returns {Promise<object>} Created acknowledgement
 */
async function signOffSOA(caseId, vendorId, userId, acknowledgementData) {
  if (!caseId || !vendorId || !userId) {
    throw new ValidationError('signOffSOA requires caseId, vendorId, and userId');
  }

  const supabase = getServiceClient();

  // Create acknowledgement record (if table exists)
  // For now, we'll update the case status to 'closed'
  const { data: caseData, error: caseError } = await supabase
    .from('vmp_cases')
    .update({
      status: 'closed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId)
    .eq('vendor_id', vendorId)
    .select()
    .single();

  if (caseError) {
    throw new Error(`Failed to sign off SOA: ${caseError.message}`);
  }

  if (!caseData) {
    throw new NotFoundError('SOA case not found');
  }

  // Return acknowledgement-like structure
  return {
    case_id: caseId,
    vendor_id: vendorId,
    status: 'acknowledged',
    acknowledged_by_user_id: userId,
    acknowledged_at: new Date().toISOString(),
    acknowledgement_type: acknowledgementData.type || 'full',
    acknowledgement_notes: acknowledgementData.notes || null,
  };
}

// ============================================================================
// LEGACY VMP ADAPTER EXPORT
// ============================================================================

/**
 * Legacy vmpAdapter export (for backward compatibility)
 * 
 * Maps legacy vmpAdapter methods to direct vmp_* table queries.
 * 
 * @deprecated Use nexusAdapter directly
 */
export const vmpAdapter = {
  // User methods (proxy to nexusAdapter)
  getUserByEmail: (email) => {
    // This would need nexusAdapter implementation
    throw new Error('getUserByEmail: Method needs implementation');
  },
  
  createUser: (userData) => {
    throw new Error('createUser: Method needs implementation');
  },
  
  // Session methods (proxy to nexusAdapter)
  createSession: (userId, sessionData) => {
    throw new Error('createSession: Method needs implementation');
  },
  
  deleteSession: (sessionId) => {
    throw new Error('deleteSession: Method needs implementation');
  },
  
  getSession: (sessionId) => {
    throw new Error('getSession: Method needs implementation');
  },
  
  // Vendor methods (may need custom implementation)
  getVendorById: async (vendorId) => {
    throw new Error('getVendorById: Method needs migration to nexusAdapter');
  },
  
  getInbox: async (vendorId) => {
    throw new Error('getInbox: Method needs migration to nexusAdapter');
  },
  
  getAllVendors: async () => {
    throw new Error('getAllVendors: Method needs migration to nexusAdapter');
  },
  
  getInvoiceDetail: async (invoiceId, vendorId) => {
    throw new Error('getInvoiceDetail: Method needs migration to nexusAdapter');
  },
  
  // SOA methods (implemented above)
  getSOAStatements,
  getSOALines,
  getSOASummary,
  createSOAMatch,
  confirmSOAMatch,
  rejectSOAMatch,
  createSOAIssue,
  getSOAIssues,
  resolveSOAIssue,
  signOffSOA,
  
  // Payments
  getPayments: async (vendorId, options) => {
    throw new Error('getPayments: Method needs migration to nexusAdapter');
  },
  
  // Vendor context
  getVendorContext: async (userId) => {
    throw new Error('getVendorContext: Method needs migration to nexusAdapter');
  },
  
  createIndependentUser: async (userData) => {
    throw new Error('createIndependentUser: Method needs migration to nexusAdapter');
  },
};

export default vmpAdapter;
