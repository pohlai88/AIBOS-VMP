-- Migration: VMP Super Admin Default User
-- Created: 2025-12-24
-- Description: Adds super_admin role and creates default super admin user

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================
-- Ensure pgcrypto extension is enabled for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ADD super_admin FIELD TO vmp_vendor_users
-- ============================================================================
ALTER TABLE vmp_vendor_users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vmp_vendor_users.is_super_admin IS 'If true, user has super admin privileges with full system access';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vmp_vendor_users_is_super_admin ON vmp_vendor_users(is_super_admin);

-- ============================================================================
-- CREATE DEFAULT SUPER ADMIN USER
-- ============================================================================
-- Note: This creates a super admin user that is internal (not tied to any vendor)
-- Password: admin123 (hashed using crypt with bcrypt)

DO $$
DECLARE
    admin_user_id UUID;
    demo_vendor_id UUID;
    system_tenant_id UUID;
BEGIN
    -- Get or create a system tenant
    SELECT id INTO system_tenant_id FROM vmp_tenants WHERE name = 'System' LIMIT 1;
    
    IF system_tenant_id IS NULL THEN
        INSERT INTO vmp_tenants (name)
        VALUES ('System')
        RETURNING id INTO system_tenant_id;
    END IF;

    -- Get or create a system vendor for internal users
    SELECT id INTO demo_vendor_id FROM vmp_vendors WHERE name = 'System Admin' AND tenant_id = system_tenant_id LIMIT 1;
    
    IF demo_vendor_id IS NULL THEN
        -- Create a system vendor if it doesn't exist
        INSERT INTO vmp_vendors (tenant_id, name, status)
        VALUES (system_tenant_id, 'System Admin', 'active')
        RETURNING id INTO demo_vendor_id;
    END IF;

    -- Check if admin user already exists
    SELECT id INTO admin_user_id FROM vmp_vendor_users WHERE email = 'jackwee2020@gmail.com';
    
    IF admin_user_id IS NULL THEN
        -- Create the super admin user
        INSERT INTO vmp_vendor_users (
            vendor_id,
            email,
            password_hash,
            display_name,
            is_active,
            is_internal,
            is_super_admin
        ) VALUES (
            demo_vendor_id,
            'jackwee2020@gmail.com',
            crypt('admin123', gen_salt('bf')),  -- bcrypt hash of 'admin123'
            'Super Administrator',
            true,
            true,  -- Internal user
            true   -- Super admin
        )
        RETURNING id INTO admin_user_id;
        
        RAISE NOTICE 'Created super admin user: jackwee2020@gmail.com';
    ELSE
        -- Update existing user to be super admin
        UPDATE vmp_vendor_users
        SET 
            is_internal = true,
            is_super_admin = true,
            password_hash = crypt('admin123', gen_salt('bf')),
            is_active = true
        WHERE id = admin_user_id;
        
        RAISE NOTICE 'Updated existing user to super admin: jackwee2020@gmail.com';
    END IF;
END $$;
