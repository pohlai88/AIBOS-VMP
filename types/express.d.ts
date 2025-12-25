// Type declarations for Express Request extension
// Extends Express Request to include user property from auth middleware

import { Request } from 'express';
import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    authToken?: string;
    refreshToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; // vendor_user ID (for database operations)
        authId?: string; // Supabase Auth UUID (for getVendorContext calls)
        email: string;
        displayName: string;
        vendorId?: string | null;
        user_tier?: 'institutional' | 'independent';
        isInternal: boolean;
        role?: 'admin' | 'operator'; // For UI display (ADMIN/OPERATOR badge)
        is_active?: boolean;
        vendor?: {
          id: string;
          name: string;
          tenant_id: string;
        } | null;
      };
    }
  }
}

export {};

