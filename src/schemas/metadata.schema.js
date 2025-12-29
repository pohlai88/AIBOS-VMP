/**
 * Metadata Governance Schemas
 * 
 * This file defines the Zod schemas for validating and typing metadata
 * stored in JSONB columns across the application.
 * 
 * **Installation Required:**
 *   npm install zod
 * 
 * **Philosophy:**
 *   - Database stores flexible JSONB
 *   - Application enforces strict typing via Zod
 *   - Business controls configuration via Admin UI
 *   - Code obeys both structure and rules
 * 
 * @see docs/architecture/METADATA_CONTROL_PROTOCOL.md
 */

// TODO: Install Zod before using
// import { z } from 'zod';

// Temporary placeholder - uncomment after installing Zod
// Uncomment the following after running: npm install zod

/*
import { z } from 'zod';

// ============================================================================
// Organization Metadata Schema
// ============================================================================

/**
 * Schema for nexus_tenants.metadata
 * Controls: Plan limits, feature flags, UI preferences
 */
export const OrgMetadataSchema = z.object({
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    retention_days: z.number().min(1).default(30),
    can_export: z.boolean().default(false),
    max_storage_gb: z.number().min(1).default(5),
    tier: z.enum(['basic', 'pro', 'enterprise']).default('basic')
  }).default({}),
  
  feature_flags: z.record(z.string(), z.boolean()).default({}), // { "beta_dashboard": true, "ai_reports": false }
  
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    logo_url: z.string().url().optional()
  }).optional()
});

/**
 * TypeScript/JSDoc type for organization metadata
 * @typedef {z.infer<typeof OrgMetadataSchema>} OrgMetadata
 */

// ============================================================================
// User Preferences Schema
// ============================================================================

/**
 * Schema for nexus_users.preferences
 * Controls: UI preferences, notifications, user limits
 */
export const UserPreferencesSchema = z.object({
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    sidebar_collapsed: z.boolean().default(false),
    dashboard_layout: z.enum(['grid', 'list']).default('grid'),
    items_per_page: z.number().min(10).max(100).default(25)
  }).optional(),
  
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(false),
    digest_frequency: z.enum(['never', 'daily', 'weekly']).default('daily')
  }).optional(),
  
  limits: z.object({
    reports_per_day: z.number().min(0).default(10),
    exports_per_month: z.number().min(0).default(5)
  }).optional()
});

/**
 * TypeScript/JSDoc type for user preferences
 * @typedef {z.infer<typeof UserPreferencesSchema>} UserPreferences
 */

// ============================================================================
// Case Metadata Schema
// ============================================================================

/**
 * Schema for nexus_cases.metadata
 * Controls: Case-specific configuration, tags, custom fields
 */
export const CaseMetadataSchema = z.object({
  tags: z.array(z.string()).default([]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
  source: z.string().optional(), // e.g., "email", "whatsapp", "api"
  channel_metadata: z.record(z.string(), z.unknown()).optional() // Channel-specific data
});

/**
 * TypeScript/JSDoc type for case metadata
 * @typedef {z.infer<typeof CaseMetadataSchema>} CaseMetadata
 */

// ============================================================================
// Message Metadata Schema
// ============================================================================

/**
 * Schema for nexus_case_messages.metadata
 * Controls: Channel-specific metadata (WhatsApp, Email, etc.)
 */
export const MessageMetadataSchema = z.object({
  channel: z.enum(['email', 'whatsapp', 'sms', 'api', 'web']).optional(),
  channel_message_id: z.string().optional(),
  thread_id: z.string().optional(),
  in_reply_to: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    size: z.number().optional(),
    mime_type: z.string().optional()
  })).optional()
});

/**
 * TypeScript/JSDoc type for message metadata
 * @typedef {z.infer<typeof MessageMetadataSchema>} MessageMetadata
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate organization metadata with defaults
 * @param {unknown} raw - Raw JSONB data from database
 * @returns {OrgMetadata} Validated and typed metadata
 */
export function parseOrgMetadata(raw) {
  return OrgMetadataSchema.parse(raw || {});
}

/**
 * Parse and validate user preferences with defaults
 * @param {unknown} raw - Raw JSONB data from database
 * @returns {UserPreferences} Validated and typed preferences
 */
export function parseUserPreferences(raw) {
  return UserPreferencesSchema.parse(raw || {});
}

/**
 * Parse and validate case metadata with defaults
 * @param {unknown} raw - Raw JSONB data from database
 * @returns {CaseMetadata} Validated and typed metadata
 */
export function parseCaseMetadata(raw) {
  return CaseMetadataSchema.parse(raw || {});
}

/**
 * Parse and validate message metadata with defaults
 * @param {unknown} raw - Raw JSONB data from database
 * @returns {MessageMetadata} Validated and typed metadata
 */
export function parseMessageMetadata(raw) {
  return MessageMetadataSchema.parse(raw || {});
}

// ============================================================================
// Schema Versioning (for future migrations)
// ============================================================================

/**
 * Version 1 Schema (current)
 * @deprecated Use OrgMetadataSchema directly
 */
export const OrgMetadataSchemaV1 = OrgMetadataSchema.extend({
  version: z.literal(1).default(1)
});

/**
 * Future: Version 2 Schema (example of breaking change handling)
 * Uncomment and modify when needed for major schema changes
 */
/*
export const OrgMetadataSchemaV2 = z.object({
  version: z.literal(2).default(2),
  plan_config: z.object({
    limits: z.object({
      users: z.number().min(1).default(10), // Renamed from max_users
      storage_gb: z.number().min(1).default(5) // New structure
    })
  }),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system')
  }).optional()
});
*/
*/

// Temporary export to prevent errors
export const OrgMetadataSchema = null;
export const UserPreferencesSchema = null;
export const CaseMetadataSchema = null;
export const MessageMetadataSchema = null;

export function parseOrgMetadata(raw) {
  return raw || {};
}

export function parseUserPreferences(raw) {
  return raw || {};
}

export function parseCaseMetadata(raw) {
  return raw || {};
}

export function parseMessageMetadata(raw) {
  return raw || {};
}

