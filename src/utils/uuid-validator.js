/**
 * UUID Validation Utility
 *
 * Centralized UUID validation to prevent inconsistencies across routes.
 * Replaces inline regex patterns with a single, maintainable validator.
 *
 * Also includes prefixed ID validation for Nexus schema (TNT-*, CASE-*, PAY-*, etc.)
 *
 * @module utils/uuid-validator
 */

import { z } from 'zod';

/**
 * Zod schema for UUID validation
 * Use this in route validation schemas
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Assert that a value is a valid UUID
 *
 * @param {string} value - Value to validate
 * @param {string} [fieldName='ID'] - Field name for error message
 * @throws {Error} If value is not a valid UUID
 * @returns {string} Validated UUID
 *
 * @example
 * try {
 *   const id = assertUuid(req.params.id, 'entity ID');
 * } catch (error) {
 *   return res.status(400).json({ error: error.message });
 * }
 */
export function assertUuid(value, fieldName = 'ID') {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${fieldName} format: must be a valid UUID`);
  }
  return result.data;
}

/**
 * Validate UUID and return boolean (non-throwing)
 *
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid UUID, false otherwise
 *
 * @example
 * if (!isValidUuid(req.params.id)) {
 *   return res.status(400).json({ error: 'Invalid ID format' });
 * }
 */
export function isValidUuid(value) {
  return uuidSchema.safeParse(value).success;
}

/**
 * Validate UUID and return result object
 *
 * @param {string} value - Value to validate
 * @returns {{ valid: boolean, value?: string, error?: string }}
 *
 * @example
 * const validation = validateUuid(req.params.id);
 * if (!validation.valid) {
 *   return res.status(400).json({ error: validation.error });
 * }
 * const id = validation.value;
 */
export function validateUuid(value) {
  const result = uuidSchema.safeParse(value);
  if (result.success) {
    return { valid: true, value: result.data };
  }
  return {
    valid: false,
    error: result.error.errors[0]?.message || 'Invalid UUID format',
  };
}

// ============================================================================
// PREFIXED ID VALIDATION (Nexus Schema)
// ============================================================================

/**
 * Prefixed ID pattern (e.g., TNT-XXXXXXXX, CASE-XXXXXXXX, PAY-XXXXXXXX)
 * Format: PREFIX-XXXXXXXX (3-4 uppercase letters, dash, 8 uppercase hex chars)
 */
const PREFIXED_ID_PATTERN = /^[A-Z]{2,4}-[A-F0-9]{8}$/;

/**
 * Assert that a value is a valid prefixed ID with the expected prefix
 *
 * @param {string} value - Value to validate
 * @param {string} prefix - Expected prefix (e.g., 'CASE', 'PAY', 'TNT')
 * @param {string} [fieldName='ID'] - Field name for error message
 * @throws {Error} If value is not a valid prefixed ID with expected prefix
 * @returns {string} Validated prefixed ID
 *
 * @example
 * try {
 *   const caseId = assertPrefixedId(req.params.id, 'CASE', 'case ID');
 * } catch (error) {
 *   return res.status(400).json({ error: error.message });
 * }
 */
export function assertPrefixedId(value, prefix, fieldName = 'ID') {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be a string`);
  }

  if (!PREFIXED_ID_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${fieldName} format: must be PREFIX-XXXXXXXX (e.g., ${prefix}-A1B2C3D4)`
    );
  }

  const actualPrefix = value.split('-')[0];
  if (actualPrefix !== prefix) {
    throw new Error(`Invalid ${fieldName} prefix: expected '${prefix}-', got '${actualPrefix}-'`);
  }

  return value;
}

/**
 * Validate prefixed ID and return boolean (non-throwing)
 *
 * @param {string} value - Value to validate
 * @param {string} [prefix] - Optional expected prefix
 * @returns {boolean} True if valid prefixed ID (and matches prefix if provided)
 *
 * @example
 * if (!isValidPrefixedId(req.params.id, 'CASE')) {
 *   return res.status(400).json({ error: 'Invalid case ID format' });
 * }
 */
export function isValidPrefixedId(value, prefix = null) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  if (!PREFIXED_ID_PATTERN.test(value)) {
    return false;
  }

  if (prefix) {
    const actualPrefix = value.split('-')[0];
    return actualPrefix === prefix;
  }

  return true;
}

/**
 * Validate prefixed ID and return result object
 *
 * @param {string} value - Value to validate
 * @param {string} [prefix] - Optional expected prefix
 * @returns {{ valid: boolean, value?: string, prefix?: string, error?: string }}
 *
 * @example
 * const validation = validatePrefixedId(req.params.id, 'CASE');
 * if (!validation.valid) {
 *   return res.status(400).json({ error: validation.error });
 * }
 * const caseId = validation.value;
 */
export function validatePrefixedId(value, prefix = null) {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'Value must be a string',
    };
  }

  if (!PREFIXED_ID_PATTERN.test(value)) {
    return {
      valid: false,
      error: 'Invalid format: must be PREFIX-XXXXXXXX (e.g., CASE-A1B2C3D4)',
    };
  }

  const actualPrefix = value.split('-')[0];

  if (prefix && actualPrefix !== prefix) {
    return {
      valid: false,
      error: `Invalid prefix: expected '${prefix}-', got '${actualPrefix}-'`,
    };
  }

  return {
    valid: true,
    value,
    prefix: actualPrefix,
  };
}
