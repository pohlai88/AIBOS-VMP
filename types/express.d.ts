// Type declarations for Express Request extension
// Extends Express Request to include user property from auth middleware

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        vendorId?: string;
        isInternal: boolean;
        vendor?: {
          id: string;
          name: string;
          tenant_id: string;
        };
      };
    }
  }
}

export {};

