/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Service Layer
 * Domain: {{Domain}} (finance | vendor | client | compliance | system)
 * Enforces: CRUD-S, RLS, Validation, State Transitions
 * 
 * DO NOT MODIFY WITHOUT UPDATING:
 * - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
 * - docs/architecture/TEMPLATE_CONSTITUTION.md
 * - Version below
 * 
 * Version: 1.0.0
 * Last Updated: 2025-01-22
 * ============================================================================
 * 
 * Service Template
 * 
 * Business logic layer template extending BaseRepository.
 * 
 * This template provides:
 * - CRUD-S operations (softDelete, restore, findById) via BaseRepository
 * - Audit integration placeholders (Hash Chain)
 * - Tenant isolation
 * - Error handling
 * - State transition validation
 * - Custom business methods structure
 * 
 * Usage:
 * 1. Copy this file: cp src/templates/service.template.js src/services/{{entity-name}}.service.js
 * 2. Replace placeholders:
 *    - {{EntityName}} → Invoice
 *    - {{entity-name}} → invoice
 *    - {{table_name}} → invoices
 *    - {{Domain}} → finance
 * 3. Define state transitions (if entity has status field)
 * 4. Add business logic methods
 * 
 * @module templates/service.template
 */

import { BaseRepository } from '@/services/core/base-repository';
// Optional: Hash Chain integration
// import { logDocumentEvent } from '@/services/audit';

/**
 * {{EntityName}} Service
 * 
 * Extends BaseRepository to inherit:
 * - softDelete(id, userId)
 * - restore(id)
 * - findById(id)
 * - findAllActive(options)
 * - countActive()
 */
export class {{EntityName}}Service extends BaseRepository {
  /**
   * Domain context for governance and policy enforcement
   */
  static DOMAIN = '{{Domain}}'; // finance | vendor | client | compliance | system

  /**
   * State Transition Rules (if entity has status field)
   * 
   * Define allowed transitions to prevent invalid state changes.
   * Example: DRAFT → SUBMITTED → APPROVED → POSTED
   * 
   * If entity has no status field, remove this section.
   */
  static ALLOWED_TRANSITIONS = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['POSTED', 'REJECTED'],
    REJECTED: ['DRAFT'], // Allow resubmission
    POSTED: [], // Terminal state
    CANCELLED: [], // Terminal state
  };

  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
   */
  constructor(supabase) {
    // For Nexus tables: use prefixed ID column (e.g., 'case_id', 'payment_id')
    // For standard tables: use 'id' (default)
    // hasDeletedBy: true for full CRUD-S, false for partial (until migration)
    // Example: super(supabase, 'nexus_cases', 'case_id', { hasDeletedBy: true });
    super(supabase, '{{table_name}}', '{{id_column}}', { hasDeletedBy: {{has_deleted_by}} }); // hasDeletedBy: true | false
  }

  // ============================================================================
  // STATE TRANSITION VALIDATION
  // ============================================================================

  /**
   * Assert that a state transition is valid
   * 
   * @param {string} currentStatus - Current status
   * @param {string} nextStatus - Desired next status
   * @throws {Error} If transition is not allowed
   */
  assertTransition(currentStatus, nextStatus) {
    const allowed = {{EntityName}}Service.ALLOWED_TRANSITIONS[currentStatus];
    
    if (!allowed) {
      throw new Error(`Unknown current status: ${currentStatus}`);
    }
    
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Invalid transition: ${currentStatus} → ${nextStatus}. ` +
        `Allowed: ${allowed.join(', ')}`
      );
    }
  }

  /**
   * Get allowed next states for current status
   * 
   * @param {string} currentStatus - Current status
   * @returns {string[]} Array of allowed next statuses
   */
  getAllowedTransitions(currentStatus) {
    return {{EntityName}}Service.ALLOWED_TRANSITIONS[currentStatus] || [];
  }

  // ============================================================================
  // CRUD OPERATIONS (Inherited from BaseRepository)
  // ============================================================================
  // These methods are automatically available:
  // - findById(id) - Find active record
  // - findAllActive(options) - List all active records
  // - softDelete(id, userId) - Soft delete with audit
  // - restore(id) - Restore soft-deleted record
  // - countActive() - Count active records

  // ============================================================================
  // CREATE OPERATION
  // ============================================================================

  /**
   * Create with Audit & Integrity Checks
   * 
   * @param {object} payload - Entity data
   * @param {string} payload.tenant_id - Tenant ID
   * @param {string} payload.created_by - User ID
   * @param {string} [payload.case_id] - Optional case ID (Evidence First)
   * @returns {Promise<object>} Created entity
   */
  async create(payload) {
    // 1. Evidence First Guard (if applicable)
    // If entity requires case linkage for certain actions, enforce it:
    // if (payload.status === 'SUBMITTED' && !payload.case_id) {
    //   throw new Error('Case linkage required for submission (Evidence First)');
    // }
    
    // 2. Business Logic / Calculations
    // Add any pre-insert calculations here
    // Example:
    // const total = payload.subtotal * (1 + payload.tax_rate);
    // payload.total = total;

    // 2. Perform Insert
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Handle Supabase errors
      if (error.code === '23505') { // Unique violation
        throw new Error(`{{EntityName}} with this identifier already exists`);
      }
      throw error;
    }

    // 3. "No Evidence No Coin" Integration (Optional)
    // If this entity requires strict auditing (e.g. Invoices, Payments),
    // trigger the hash chain logging
    // 
    // Example:
    // if (this.requiresAuditChain) {
    //   await logDocumentEvent(
    //     this.supabase,
    //     data.id,
    //     payload.created_by,
    //     null, // fileBuffer if applicable
    //     {
    //       action: 'CREATE',
    //       entity_type: '{{entity-name}}',
    //       metadata: payload,
    //     }
    //   );
    // }

    return data;
  }

  // ============================================================================
  // UPDATE OPERATION
  // ============================================================================

  /**
   * Update entity
   * 
   * @param {string} id - Entity ID
   * @param {object} updates - Fields to update
   * @param {string} tenantId - Tenant ID (for authorization)
   * @returns {Promise<object>} Updated entity
   */
  async update(id, updates, tenantId) {
    // 1. Verify entity exists and belongs to tenant
    const existing = await this.findById(id);
    if (!existing) {
      return null; // Not found
    }

    if (tenantId && existing.tenant_id !== tenantId) {
      throw new Error('Unauthorized: Entity does not belong to tenant');
    }

    // 2. Business Logic / Calculations
    // Add any pre-update calculations here

    // 3. Perform Update
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null) // Only update active records
      .select()
      .single();

    if (error) throw error;

    // 4. Optional: Log to audit chain
    // await logDocumentEvent(
    //   this.supabase,
    //   id,
    //   updates.updated_by,
    //   null,
    //   {
    //     action: 'UPDATE',
    //     entity_type: '{{entity-name}}',
    //     changes: updates,
    //   }
    // );

    return data;
  }

  // ============================================================================
  // CUSTOM BUSINESS METHODS
  // ============================================================================
  // Add entity-specific business logic methods here

  /**
   * Custom Business Action Example (with State Transition Validation)
   * 
   * @param {string} id - Entity ID
   * @param {string} approverId - User ID of approver
   * @returns {Promise<object>} Updated entity
   */
  async approve(id, approverId) {
    // 1. Get current entity
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Entity not found');
    }

    // 2. Evidence First Guard (if applicable)
    // If approval requires case linkage, enforce it:
    // if (!current.case_id) {
    //   throw new Error('Case linkage required for approval (Evidence First)');
    // }

    // 3. Validate state transition
    this.assertTransition(current.status, 'APPROVED');

    // 3. Perform update
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        status: 'APPROVED',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find by custom field
   * 
   * @param {string} fieldValue - Field value to search
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object | null>} Entity or null
   */
  async findByCustomField(fieldValue, tenantId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('custom_field', fieldValue)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * List with filters
   * 
   * @param {object} options - Query options
   * @param {string} options.tenantId - Tenant ID
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.sort - Sort field
   * @param {string} options.order - Sort order (asc/desc)
   * @param {object} options.filters - Additional filters
   * @returns {Promise<object[]>} Array of entities
   */
  async findAllActive(options = {}) {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      filters = {},
    } = options;

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .is('deleted_at', null);

    // Tenant isolation
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Sorting
    query = query.order(sort, { ascending: order === 'asc' });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
}

