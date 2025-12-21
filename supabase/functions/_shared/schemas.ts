/**
 * Validation Schemas for Edge Functions
 * 
 * Reusable validation schemas for common request patterns
 */

/**
 * Common field schemas
 */
export const commonSchemas = {
  uuid: 'required|string|uuid',
  optionalUuid: 'optional|string|uuid',
  email: 'required|string|email',
  optionalEmail: 'optional|string|email',
  string: 'required|string',
  optionalString: 'optional|string',
  number: 'required|number',
  optionalNumber: 'optional|number',
  boolean: 'required|boolean',
  optionalBoolean: 'optional|boolean',
}

/**
 * Document operation schemas
 */
export const documentSchemas = {
  create: {
    name: 'required|string|min:1|max:255',
    category: 'optional|string|max:100',
    tenant_id: 'required|string|uuid',
    organization_id: 'optional|string|uuid',
    content: 'optional|string',
  },
  update: {
    document_id: 'required|string|uuid',
    name: 'optional|string|min:1|max:255',
    category: 'optional|string|max:100',
    content: 'optional|string',
  },
  delete: {
    document_id: 'required|string|uuid',
    tenant_id: 'required|string|uuid',
  },
  process: {
    document_id: 'required|string|uuid',
    tenant_id: 'required|string|uuid',
    name: 'optional|string',
    category: 'optional|string',
    organization_id: 'optional|string|uuid',
  },
}

/**
 * Payment operation schemas
 */
export const paymentSchemas = {
  create: {
    amount: 'required|number',
    currency: 'required|string|min:3|max:3',
    tenant_id: 'required|string|uuid',
    description: 'optional|string|max:500',
  },
  refund: {
    payment_id: 'required|string|uuid',
    amount: 'optional|number',
    reason: 'optional|string|max:500',
  },
  status: {
    payment_id: 'required|string|uuid',
  },
}

/**
 * Notification operation schemas
 */
export const notificationSchemas = {
  send: {
    recipient_id: 'required|string|uuid',
    title: 'required|string|min:1|max:200',
    message: 'required|string|min:1|max:1000',
    type: 'optional|string|max:50',
  },
  markRead: {
    notification_id: 'required|string|uuid',
  },
  list: {
    user_id: 'required|string|uuid',
    limit: 'optional|number',
    offset: 'optional|number',
  },
}

