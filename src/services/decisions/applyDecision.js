/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Decision Service (Future Feature)
 * Domain: system
 * Enforces: Decision workflow, State transitions
 * 
 * NOTE: This is a stub implementation for the decision engine feature.
 * The decision engine is planned but not yet fully implemented.
 * 
 * DO NOT MODIFY WITHOUT UPDATING:
 * - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
 * - docs/architecture/TEMPLATE_CONSTITUTION.md
 * - Version below
 * 
 * Version: 0.1.0 (Stub)
 * Last Updated: 2025-01-22
 * ============================================================================
 * 
 * Apply Decision Service
 * 
 * Stub implementation for the decision engine feature.
 * Currently defers to legacy adapter methods until full implementation.
 * 
 * @param {object} params - Decision parameters
 * @param {string} params.entity - Entity type ('case', 'invoice', 'payment')
 * @param {string} params.id - Entity ID
 * @param {string} params.action - Action to apply
 * @param {string} params.channel - Channel (e.g., 'resolution', 'approval')
 * @param {string} params.actorId - User ID performing action
 * @param {string} [params.tenantId] - Tenant ID
 * @param {string} [params.vendorId] - Vendor ID
 * @param {string} [params.note] - Optional note
 * @param {string} [params.reason] - Optional reason
 * @returns {Promise<object>} Updated entity
 */

/**
 * Apply a decision to an entity
 * 
 * This is a stub that will be replaced with full decision engine implementation.
 * Currently throws an error to indicate the feature is not yet implemented.
 * 
 * @param {object} params - Decision parameters
 * @returns {Promise<object>} Updated entity
 * @throws {Error} Always throws - feature not yet implemented
 */
export async function applyDecision(params) {
  const { entity, id, action, channel, actorId, tenantId, vendorId, note, reason } = params;

  // Stub implementation - feature not yet implemented
  throw new Error(
    `Decision engine not yet implemented. ` +
    `Entity: ${entity}, ID: ${id}, Action: ${action}, Channel: ${channel}. ` +
    `This feature is planned but not yet available. ` +
    `Set USE_DECISION_ENGINE=false to use legacy methods.`
  );
}

/**
 * Check if decision engine is available
 * @returns {boolean} Always returns false (stub)
 */
export function isDecisionEngineAvailable() {
  return false;
}

