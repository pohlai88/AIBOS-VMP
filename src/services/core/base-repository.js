/**
 * Base Repository Pattern for CRUD-S (Soft Delete) Operations
 *
 * This class provides centralized soft delete logic for all repositories.
 * It enforces the "Database is the Source of Truth" principle by using
 * RLS policies and standardized soft delete operations.
 *
 * PRIMARY KEY CONVENTION:
 * - Nexus tables use prefixed IDs: `{entity}_id` (e.g., `case_id`, `payment_id`, `invoice_id`)
 * - Legacy VMP tables use `id` as primary key
 * - Non-domain tables (sessions, queues, audit logs) may use `id` - this is acceptable
 *
 * When using this class:
 * - For Nexus tables: Pass the correct `idColumn` (e.g., `'case_id'`, `'payment_id'`)
 * - For legacy tables: Use default `'id'`
 * - Never hardcode `.eq('id', ...)` in CRUD-S operations - use `this.idColumn` instead
 *
 * @module services/core/base-repository
 */

/**
 * Base Repository class for CRUD-S operations
 *
 * @template T - The entity type
 */
export class BaseRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
   * @param {string} tableName - Table name (e.g., 'vendors', 'invoices', 'nexus_cases')
   * @param {string} [idColumn='id'] - Primary key column name (default: 'id', or 'case_id', 'payment_id', etc. for Nexus tables)
   * @param {object} [opts={}] - Options
   * @param {boolean} [opts.hasDeletedBy=true] - Whether table has `deleted_by` column (default: true)
   */
  constructor(supabase, tableName, idColumn = 'id', opts = {}) {
    this.supabase = supabase;
    this.tableName = tableName;
    this.idColumn = idColumn; // Support custom PK column (Nexus uses prefixed IDs)
    this.hasDeletedBy = opts.hasDeletedBy !== false; // Default: true, can be disabled for partial CRUD-S
  }

  /**
   * STANDARD READ: Respects RLS (which hides deleted_at automatically)
   *
   * @param {string} id - Record ID
   * @returns {Promise<T | null>} Record or null if not found
   */
  async findById(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq(this.idColumn, id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  /**
   * Find all active records (explicit filter for clarity)
   * RLS should handle this automatically, but this is explicit
   *
   * @param {object} options - Query options
   * @param {string} [options.orderBy='created_at'] - Column to order by
   * @param {boolean} [options.ascending=false] - Sort order
   * @returns {Promise<T[]>} Array of active records
   */
  async findAllActive(options = {}) {
    const { orderBy = 'created_at', ascending = false } = options;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .is('deleted_at', null)
      .order(orderBy, { ascending });

    if (error) throw error;
    return data || [];
  }

  /**
   * SOFT DELETE: The centralized implementation
   *
   * @param {string} id - Record ID
   * @param {string} userId - User ID performing the deletion
   * @returns {Promise<T>} Soft-deleted record
   * @throws {Error} If record not found or already deleted
   */
  async softDelete(id, userId) {
    // Build update payload: always set deleted_at, conditionally set deleted_by
    const updatePayload = {
      deleted_at: new Date().toISOString(),
    };

    if (this.hasDeletedBy) {
      updatePayload.deleted_by = userId;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq(this.idColumn, id)
      .is('deleted_at', null) // Only soft-delete if not already deleted
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Record ${id} not found or already deleted`);
      }
      throw error;
    }

    return data;
  }

  /**
   * RESTORE: The "Undo" button
   *
   * @param {string} id - Record ID
   * @returns {Promise<T>} Restored record
   * @throws {Error} If record not found or already active
   */
  async restore(id) {
    // Build update payload: always clear deleted_at, conditionally clear deleted_by
    const updatePayload = {
      deleted_at: null,
    };

    if (this.hasDeletedBy) {
      updatePayload.deleted_by = null;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq(this.idColumn, id)
      .not('deleted_at', 'is', null) // Only restore if deleted
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Record ${id} not found or already active`);
      }
      throw error;
    }

    return data;
  }

  /**
   * HARD DELETE: Admin only (for GDPR/retention policies)
   * WARNING: This bypasses soft delete. Use with extreme caution.
   *
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   */
  async hardDelete(id) {
    const { error } = await this.supabase.from(this.tableName).delete().eq(this.idColumn, id);

    if (error) throw error;
  }

  /**
   * Find including deleted (admin/audit use)
   * Requires service role client or admin RLS policy
   *
   * @param {string} id - Record ID
   * @returns {Promise<T | null>} Record including deleted
   */
  async findByIdIncludingDeleted(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq(this.idColumn, id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  /**
   * Find all including deleted (admin/audit use)
   * Requires service role client or admin RLS policy
   *
   * @param {object} options - Query options
   * @returns {Promise<T[]>} All records including deleted
   */
  async findAllIncludingDeleted(options = {}) {
    const { orderBy = 'created_at', ascending = false } = options;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order(orderBy, { ascending });

    if (error) throw error;
    return data || [];
  }

  /**
   * Count active records
   *
   * @returns {Promise<number>} Count of active records
   */
  async countActive() {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Count all records including deleted
   *
   * @returns {Promise<number>} Total count
   */
  async countAll() {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }
}
