/**
 * Shared Utilities for Edge Functions
 * 
 * Provides common functionality for validation, error handling, and responses
 */

import { StandardResponse, ValidationResult, ValidationError, AuthResult, RequestContext } from './types.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status = 200
): Response {
  const response: StandardResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID(),
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string | Error,
  status = 500,
  details?: Record<string, any>
): Response {
  const errorMessage = error instanceof Error ? error.message : error

  const response: StandardResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID(),
    ...(details && { data: details }),
  }

  // Log error for debugging (in production, use proper logging service)
  console.error('[Edge Function Error]', {
    error: errorMessage,
    status,
    details,
    timestamp: response.timestamp,
    request_id: response.request_id,
  })

  return new Response(JSON.stringify(response), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Validates request body against a simple schema
 * 
 * Schema format: { field: 'required|type|...' }
 * Types: string, number, boolean, uuid, email, url
 * Rules: required, optional, min:value, max:value
 */
export function validateRequest(
  body: any,
  schema: Record<string, string>
): ValidationResult {
  const errors: ValidationError[] = []

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field]
    const ruleList = rules.split('|')

    // Check required
    if (ruleList.includes('required') && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED',
      })
      continue
    }

    // Skip validation if optional and not provided
    if (ruleList.includes('optional') && (value === undefined || value === null)) {
      continue
    }

    // Type validation
    if (value !== undefined && value !== null) {
      if (ruleList.includes('string') && typeof value !== 'string') {
        errors.push({
          field,
          message: `${field} must be a string`,
          code: 'INVALID_TYPE',
        })
      } else if (ruleList.includes('number') && typeof value !== 'number') {
        errors.push({
          field,
          message: `${field} must be a number`,
          code: 'INVALID_TYPE',
        })
      } else if (ruleList.includes('boolean') && typeof value !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          code: 'INVALID_TYPE',
        })
      } else if (ruleList.includes('uuid') && !isValidUUID(value)) {
        errors.push({
          field,
          message: `${field} must be a valid UUID`,
          code: 'INVALID_UUID',
        })
      } else if (ruleList.includes('email') && !isValidEmail(value)) {
        errors.push({
          field,
          message: `${field} must be a valid email`,
          code: 'INVALID_EMAIL',
        })
      } else if (ruleList.includes('url') && !isValidURL(value)) {
        errors.push({
          field,
          message: `${field} must be a valid URL`,
          code: 'INVALID_URL',
        })
      }

      // String length validation
      if (typeof value === 'string') {
        const minRule = ruleList.find((r) => r.startsWith('min:'))
        const maxRule = ruleList.find((r) => r.startsWith('max:'))

        if (minRule) {
          const min = parseInt(minRule.split(':')[1])
          if (value.length < min) {
            errors.push({
              field,
              message: `${field} must be at least ${min} characters`,
              code: 'MIN_LENGTH',
            })
          }
        }

        if (maxRule) {
          const max = parseInt(maxRule.split(':')[1])
          if (value.length > max) {
            errors.push({
              field,
              message: `${field} must be at most ${max} characters`,
              code: 'MAX_LENGTH',
            })
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Verifies JWT token from Authorization header
 * Returns user information if valid
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Missing or invalid Authorization header',
      }
    }

    const token = authHeader.substring(7)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        authenticated: false,
        error: 'Supabase configuration missing',
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return {
        authenticated: false,
        error: error?.message || 'Invalid token',
      }
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    }
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    }
  }
}

/**
 * Creates a request context from a Request object
 */
export async function createRequestContext(req: Request): Promise<RequestContext> {
  const url = new URL(req.url)
  let body: any = {}

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        body = await req.json()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData()
        body = Object.fromEntries(formData.entries())
      }
    }
  } catch (error) {
    // Ignore JSON parse errors, body remains empty
    console.warn('Failed to parse request body:', error)
  }

  return {
    request: req,
    body,
    headers: req.headers,
    url,
    method: req.method,
  }
}

/**
 * Helper function to check if a string is a valid UUID
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Helper function to check if a string is a valid email
 */
function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Helper function to check if a string is a valid URL
 */
function isValidURL(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validates that required secrets are configured
 */
export function validateSecrets(required: string[]): { valid: boolean; missing: string[] } {
  const missing = required.filter((key) => !Deno.env.get(key))

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Gets a secret with optional validation
 */
export function getSecret(key: string, required = false): string | undefined {
  const value = Deno.env.get(key)

  if (required && !value) {
    throw new Error(`Required secret ${key} is not configured`)
  }

  return value
}

