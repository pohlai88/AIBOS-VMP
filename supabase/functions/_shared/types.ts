/**
 * Shared TypeScript Types for Edge Functions
 * 
 * Standardized types for consistent responses and request handling
 */

/**
 * Standard response format for all Edge Functions
 */
export interface StandardResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
  request_id?: string
}

/**
 * Validation result from request validation
 */
export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

/**
 * Individual validation error
 */
export interface ValidationError {
  field: string
  message: string
  code?: string
}

/**
 * Authentication result
 */
export interface AuthResult {
  authenticated: boolean
  user?: {
    id: string
    email?: string
    [key: string]: any
  }
  error?: string
}

/**
 * Request context (enhanced request with parsed data)
 */
export interface RequestContext {
  request: Request
  body: any
  headers: Headers
  url: URL
  method: string
  user?: AuthResult['user']
}

/**
 * Middleware function type
 */
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>
) => Promise<Response>

/**
 * Route handler function type
 */
export type RouteHandler = (ctx: RequestContext) => Promise<Response>

/**
 * Action handler function type (for action-based routing)
 */
export type ActionHandler = (ctx: RequestContext, data: any) => Promise<Response>

