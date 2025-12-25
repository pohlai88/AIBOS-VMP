-- Migration: VMP Core Entities (Tenants, Companies, Vendors)
-- Created: 2025-12-22
-- Description: Creates the foundational multi-tenant structure for VMP

-- ============================================================================
-- TENANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_tenants IS 'Top-level tenant isolation for multi-tenant VMP architecture';

-- ============================================================================
-- COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

COMMENT ON TABLE vmp_companies IS 'Companies within a tenant (multi-company support)';

-- ============================================================================
-- VENDORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES vmp_tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE vmp_vendors IS 'Vendor master data - suppliers/partners';

-- ============================================================================
-- VENDOR-COMPANY LINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vmp_vendor_company_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vmp_vendors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES vmp_companies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, company_id)
);

COMMENT ON TABLE vmp_vendor_company_links IS 'Many-to-many relationship between vendors and companies';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_companies_tenant_id ON vmp_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_tenant_id ON vmp_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendors_status ON vmp_vendors(status);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_company_links_vendor_id ON vmp_vendor_company_links(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_company_links_company_id ON vmp_vendor_company_links(company_id);

