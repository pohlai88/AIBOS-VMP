/**
 * Edge Router for Action-Based Routing
 * 
 * Provides a clean way to handle multiple actions within a single Edge Function
 */

import { RequestContext, ActionHandler, RouteHandler } from './types.ts'
import { createErrorResponse, createRequestContext } from './utils.ts'

/**
 * Edge Router class for action-based routing
 */
export class EdgeRouter {
  private routes: Map<string, ActionHandler> = new Map()
  private middleware: Array<(ctx: RequestContext, next: () => Promise<Response>) => Promise<Response>> = []

  /**
   * Register an action handler
   */
  route(action: string, handler: ActionHandler): void {
    this.routes.set(action, handler)
  }

  /**
   * Register middleware (executed before route handlers)
   */
  use(middleware: (ctx: RequestContext, next: () => Promise<Response>) => Promise<Response>): void {
    this.middleware.push(middleware)
  }

  /**
   * Handle a request by routing to the appropriate action handler
   */
  async handle(req: Request): Promise<Response> {
    try {
      const ctx = await createRequestContext(req)

      // Execute middleware chain
      let middlewareIndex = 0
      const next = async (): Promise<Response> => {
        if (middlewareIndex < this.middleware.length) {
          const middleware = this.middleware[middlewareIndex++]
          return middleware(ctx, next)
        }

        // All middleware executed, handle route
        return this.handleRoute(ctx)
      }

      return await next()
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    }
  }

  /**
   * Handle route after middleware
   */
  private async handleRoute(ctx: RequestContext): Promise<Response> {
    const { action, ...data } = ctx.body

    if (!action || typeof action !== 'string') {
      return createErrorResponse(
        'Missing or invalid "action" field in request body',
        400
      )
    }

    const handler = this.routes.get(action)

    if (!handler) {
      return createErrorResponse(
        `Unknown action: ${action}. Available actions: ${Array.from(this.routes.keys()).join(', ')}`,
        404
      )
    }

    try {
      return await handler(ctx, data)
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Handler error',
        500
      )
    }
  }

  /**
   * Get list of registered actions
   */
  getActions(): string[] {
    return Array.from(this.routes.keys())
  }
}

/**
 * Create a new Edge Router instance
 */
export function createRouter(): EdgeRouter {
  return new EdgeRouter()
}

