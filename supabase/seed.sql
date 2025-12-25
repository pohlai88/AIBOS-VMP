-- =============================================================================
-- NEXUS DEMO SEED DATA
-- For local development with Supabase
-- =============================================================================

-- Demo tenants
INSERT INTO nexus_tenants (tenant_id, tenant_client_id, tenant_vendor_id, name, display_name, email, status, onboarding_status)
VALUES
    ('TNT-ALPHA001', 'TC-ALPHA001', 'TV-ALPHA001', 'Alpha Corp', 'Alpha Corporation', 'admin@alpha.com', 'active', 'completed'),
    ('TNT-BETA0002', 'TC-BETA0002', 'TV-BETA0002', 'Beta Inc', 'Beta Incorporated', 'admin@beta.com', 'active', 'completed'),
    ('TNT-GAMMA003', 'TC-GAMMA003', 'TV-GAMMA003', 'Gamma LLC', 'Gamma Limited', 'admin@gamma.com', 'active', 'completed'),
    ('TNT-DELTA004', 'TC-DELTA004', 'TV-DELTA004', 'Delta Services', 'Delta Services Ltd', 'admin@delta.com', 'active', 'completed')
ON CONFLICT (tenant_id) DO NOTHING;

-- Demo tenant relationships (Alpha is client, Beta/Gamma/Delta are vendors)
INSERT INTO nexus_tenant_relationships (client_id, vendor_id, relationship_type, status)
VALUES
    ('TC-ALPHA001', 'TV-BETA0002', 'client_vendor', 'active'),
    ('TC-ALPHA001', 'TV-GAMMA003', 'client_vendor', 'active'),
    ('TC-ALPHA001', 'TV-DELTA004', 'client_vendor', 'active'),
    ('TC-BETA0002', 'TV-GAMMA003', 'client_vendor', 'active')
ON CONFLICT (client_id, vendor_id) DO NOTHING;

-- Demo users with bcrypt hashed passwords (password: Demo123!)
-- bcrypt hash for "Demo123!" is: $2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW
INSERT INTO nexus_users (user_id, tenant_id, email, display_name, first_name, last_name, role, password_hash, status)
VALUES
    -- Alpha Corp users (can act as both client and vendor)
    ('USR-ALICE001', 'TNT-ALPHA001', 'alice@alpha.com', 'Alice Admin', 'Alice', 'Admin', 'admin', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),
    ('USR-ADAM0002', 'TNT-ALPHA001', 'adam@alpha.com', 'Adam Analyst', 'Adam', 'Analyst', 'member', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),

    -- Beta Inc users (vendor of Alpha)
    ('USR-BOB00003', 'TNT-BETA0002', 'bob@beta.com', 'Bob Builder', 'Bob', 'Builder', 'admin', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),
    ('USR-BETH0004', 'TNT-BETA0002', 'beth@beta.com', 'Beth Baker', 'Beth', 'Baker', 'member', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),

    -- Gamma LLC users (vendor of Alpha and Beta)
    ('USR-GREG0005', 'TNT-GAMMA003', 'greg@gamma.com', 'Greg Gamma', 'Greg', 'Gamma', 'admin', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),
    ('USR-GINA0006', 'TNT-GAMMA003', 'gina@gamma.com', 'Gina Gamma', 'Gina', 'Gamma', 'member', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),

    -- Delta Services users (vendor of Alpha)
    ('USR-DAN00007', 'TNT-DELTA004', 'dan@delta.com', 'Dan Delta', 'Dan', 'Delta', 'admin', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active'),
    ('USR-DIANA008', 'TNT-DELTA004', 'diana@delta.com', 'Diana Delta', 'Diana', 'Delta', 'member', '$2a$10$rRyBsGSHK6.uc8fntPwVIuLVHOkMiVnCuPmF.sQDEzHf5wAXj/8xW', 'active')
ON CONFLICT (email) DO NOTHING;

-- Demo cases
INSERT INTO nexus_cases (case_id, client_id, vendor_id, subject, description, case_type, status, priority)
VALUES
    ('CASE-00000001', 'TC-ALPHA001', 'TV-BETA0002', 'Q1 Compliance Review', 'Quarterly compliance audit for Alpha Corp', 'compliance', 'in_progress', 'high'),
    ('CASE-00000002', 'TC-ALPHA001', 'TV-GAMMA003', 'Contract Renewal 2025', 'Annual contract renewal process', 'contract', 'open', 'normal'),
    ('CASE-00000003', 'TC-ALPHA001', 'TV-DELTA004', 'Security Assessment', 'Annual vendor security assessment', 'other', 'open', 'high'),
    ('CASE-00000004', 'TC-BETA0002', 'TV-GAMMA003', 'Service Integration', 'Beta-Gamma service integration project', 'general', 'in_progress', 'normal')
ON CONFLICT (case_id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Nexus demo data seeded successfully!';
    RAISE NOTICE 'Login credentials: any demo user email with password Demo123!';
END $$;
