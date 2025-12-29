/**
 * Example Repository Implementation
 * 
 * This file demonstrates how to extend BaseRepository for a specific entity.
 * Use this as a template for creating other repositories.
 * 
 * @module services/examples/vendor-repository-example
 */

import { BaseRepository } from '../core/base-repository.js';

/**
 * Vendor Repository Example
 * 
 * Extends BaseRepository to add vendor-specific methods while inheriting
 * all CRUD-S operations (soft delete, restore, etc.)
 */
export class VendorRepository extends BaseRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
   */
  constructor(supabase) {
    super(supabase, 'vmp_vendors');
  }

  /**
   * Find vendor by email (only active vendors)
   * 
   * @param {string} email - Vendor email
   * @returns {Promise<object | null>} Vendor or null if not found
   */
  async findByEmail(email) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  /**
   * Find vendors by tenant (only active vendors)
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object[]>} Array of vendors
   */
  async findByTenant(tenantId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Create new vendor
   * 
   * @param {object} vendorData - Vendor data
   * @param {string} userId - User ID creating the vendor
   * @returns {Promise<object>} Created vendor
   */
  async create(vendorData, userId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        ...vendorData,
        created_by: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Update vendor (only active vendors)
   * 
   * @param {string} id - Vendor ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID performing the update
   * @returns {Promise<object>} Updated vendor
   */
  async update(id, updates, userId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        ...updates,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)  // Only update active vendors
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Vendor ${id} not found or already deleted`);
      }
      throw error;
    }
    return data;
  }

  /**
   * Get vendor statistics (active vs deleted)
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object>} Statistics object
   */
  async getStatistics(tenantId) {
    const [activeCount, deletedCount] = await Promise.all([
      this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null),
      this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('deleted_at', 'is', null),
    ]);

    return {
      active: activeCount.count || 0,
      deleted: deletedCount.count || 0,
      total: (activeCount.count || 0) + (deletedCount.count || 0),
    };
  }
}

/**
 * Usage Example in API Route:
 * 
 * ```javascript
 * import { VendorRepository } from '../services/examples/vendor-repository-example.js';
 * 
 * app.delete('/api/vendors/:id', async (req, res) => {
 *   try {
 *     const vendorRepo = new VendorRepository(req.supabase);
 *     const deleted = await vendorRepo.softDelete(req.params.id, req.user.id);
 *     res.json({ success: true, data: deleted });
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * 
 * app.post('/api/vendors/:id/restore', async (req, res) => {
 *   try {
 *     const vendorRepo = new VendorRepository(req.supabase);
 *     const restored = await vendorRepo.restore(req.params.id);
 *     res.json({ success: true, data: restored });
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * ```
 */

