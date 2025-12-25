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

// ============================================================================
// NEXUS PORTAL TYPES
// ============================================================================

interface NexusTenant {
  tenant_id: string;
  tenant_client_id: string;
  tenant_vendor_id: string;
  name: string;
  display_name?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface NexusUser {
  user_id: string;
  tenant_id: string;
  email: string;
  display_name?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  tenant?: NexusTenant;
}

interface NexusRelationship {
  id: string;
  client_id: string;
  vendor_id: string;
  status: 'active' | 'inactive' | 'pending';
  vendor_tenant?: NexusTenant;
  client_tenant?: NexusTenant;
}

interface NexusContexts {
  hasClientContext: boolean;
  hasVendorContext: boolean;
  hasDualContext: boolean;
  vendorCount: number;
  clientCount: number;
  asClient: NexusRelationship[];
  asVendor: NexusRelationship[];
}

interface NexusCaseContext {
  case: any;
  myRole: 'client' | 'vendor';
  myContextId: string;
  isClient: boolean;
  isVendor: boolean;
}

interface NexusPaymentContext {
  payment: any;
  isPayer: boolean;
  isPayee: boolean;
}

interface NexusSession {
  // Core Identity
  user?: NexusUser;
  tenant?: NexusTenant;
  userId?: string;
  tenantId?: string;

  // Tenant Context IDs
  tenantClientId?: string;
  tenantVendorId?: string;

  // Context State
  hasDualContext?: boolean;
  activeContext?: 'client' | 'vendor' | null;
  activeContextId?: string;
  facing?: 'up' | 'down'; // 'up' = vendor-facing, 'down' = client-facing

  // Relationship Data
  contexts?: NexusContexts;

  // Route-specific context (populated by middleware)
  caseContext?: NexusCaseContext;
  paymentContext?: NexusPaymentContext;
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

      // Nexus Portal Session
      nexus?: NexusSession;
    }
  }
}

export {};

