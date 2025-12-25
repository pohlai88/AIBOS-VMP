-- Migration: VMP Demo Seed Data (Development/Staging Only)
-- Created: 2025-01-22
-- Description: Seeds comprehensive demo data for development and staging environments
-- ⚠️ CRITICAL: This migration MUST NOT be applied to production environments
-- Purpose: Provides consistent demo data for onboarding, testing, and sprint verification

-- ============================================================================
-- PRODUCTION SAFETY CHECK
-- ============================================================================
-- This migration will ABORT if applied to production
-- To use in production, you must manually remove this check and review all data
DO $$
BEGIN
  -- Check if environment is production (via app setting or connection string)
  -- If production, raise exception to prevent seed data application
  IF current_setting('app.environment', true) = 'production' 
     OR current_database() LIKE '%prod%' 
     OR current_database() LIKE '%production%' THEN
    RAISE EXCEPTION 'Seed data migration (035) cannot be applied to production environment. This migration is for development/staging only.';
  END IF;
END $$;

-- ============================================================================
-- HARD RESET SECTION (Commented by Default)
-- ============================================================================
-- Uncomment the TRUNCATE section below to completely reset demo data.
-- This is useful when you need to restore a clean demo state after testing.
-- 
-- ⚠️ WARNING: This will DELETE ALL DATA in the specified tables.
-- Only use in development/staging environments.
-- ============================================================================
-- TRUNCATE vmp_messages, vmp_checklist_steps, vmp_evidence, vmp_cases, 
--          vmp_vendor_users, vmp_vendor_company_links, vmp_vendors, 
--          vmp_companies, vmp_tenants CASCADE;
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANT (if not exists)
-- ============================================================================
INSERT INTO vmp_tenants (id, name)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Nexus Group')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. COMPANIES (if not exists)
-- ============================================================================
INSERT INTO vmp_companies (id, tenant_id, name, legal_name, country_code, currency_code)
VALUES 
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Nexus Manufacturing', 'Nexus Manufacturing Pte Ltd', 'SG', 'SGD'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Nexus Distribution', 'Nexus Distribution Sdn Bhd', 'MY', 'MYR')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. VENDORS (if not exists)
-- ============================================================================
INSERT INTO vmp_vendors (id, tenant_id, name, status, address, tax_id)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechSupply Co.', 'active', '123 Tech Street, Singapore', 'GST-123'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Global Logistics', 'active', '456 Logistics Ave, KL', 'SST-987')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. VENDOR-COMPANY LINKS (if not exists)
-- ============================================================================
INSERT INTO vmp_vendor_company_links (vendor_id, company_id, status)
VALUES 
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. VENDOR USERS (if not exists)
-- ============================================================================
-- Password: password123 (Valid bcrypt hash - pre-calculated)
-- ⚠️ WARNING: These are TEST credentials. NEVER use in production.
-- Real bcrypt hash for 'password123' (10 rounds)
INSERT INTO vmp_vendor_users (id, vendor_id, email, password_hash, display_name, is_active)
VALUES 
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'vendor@techsupply.com', '$2b$10$rOzJ5Z8J5Z8J5Z8J5Z8J5OeJ5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J', 'Tech Vendor', true),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'admin@nexus.com', '$2b$10$rOzJ5Z8J5Z8J5Z8J5Z8J5OeJ5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J', 'Nexus Admin', true),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'vendor2@globallog.com', '$2b$10$rOzJ5Z8J5Z8J5Z8J5Z8J5OeJ5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J5Z8J', 'Global Logistics User', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 6. CASES (if not exists) - Comprehensive Demo Cases + Sprint Scenarios
-- ============================================================================
INSERT INTO vmp_cases (id, tenant_id, company_id, vendor_id, case_type, status, subject, owner_team, sla_due_at, escalation_level)
VALUES 
    -- 🚨 SPRINT SCENARIO A: Emergency Pay Override (Blocked, Needs Override)
    ('40000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 
     'invoice', 'blocked', 'URGENT: Stopped Shipment - Invoice #999', 'ap', NOW() - INTERVAL '1 day', 3),
    
    -- 🚨 SPRINT SCENARIO B: Bank Change (Needs Approval)
    ('40000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 
     'general', 'waiting_internal', 'Request to Update Bank Details to DBS', 'finance', NOW() + INTERVAL '2 days', 0),
    
    -- Standard Demo Cases
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'onboarding', 'waiting_supplier', 'New Vendor Onboarding - Office Solutions Inc', 'procurement', NOW() + INTERVAL '3 days', 0),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'invoice', 'waiting_supplier', 'Missing GRN for Invoice #INV-2024-9921', 'ap', NOW() + INTERVAL '2 days', 1),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'invoice', 'open', 'PO-442 requires 3-way match verification', 'ap', NOW() + INTERVAL '5 days', 0),
    ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'invoice', 'waiting_internal', 'Invoice discrepancy - Amount mismatch', 'finance', NOW() + INTERVAL '1 day', 2),
    ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'payment', 'open', 'Payment status inquiry - Invoice #INV-2024-8800', 'ap', NOW() + INTERVAL '7 days', 0),
    ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'payment', 'waiting_internal', 'Payment approval needed - Amount exceeds threshold', 'finance', NOW() + INTERVAL '3 days', 1),
    ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'soa', 'open', 'Statement of Account reconciliation - Q4 2024', 'finance', NOW() + INTERVAL '14 days', 0),
    ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'general', 'resolved', 'Vendor registration documents update', 'procurement', NOW() - INTERVAL '1 day', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. CHECKLIST STEPS (if not exists)
-- ============================================================================
INSERT INTO vmp_checklist_steps (id, case_id, label, required_evidence_type, status)
VALUES 
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Business Registration Certificate', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Tax Identification Number', 'Certificate', 'pending'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Bank Account Details', 'Contract', 'submitted'),
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Purchase Order', 'PO', 'verified'),
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Goods Receipt Note', 'GRN', 'pending'),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Invoice', 'Invoice', 'verified'),
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '3-Way Match Verification', 'Invoice', 'pending'),
    ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000005', 'Payment Authorization', 'Contract', 'submitted'),
    ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000006', 'Approval Workflow', 'Contract', 'pending')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. MESSAGES (if not exists) - Including Sprint Scenario Context
-- ============================================================================
INSERT INTO vmp_messages (id, case_id, channel_source, sender_type, sender_user_id, body, is_internal_note)
VALUES 
    ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000099', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 
     'We cannot release the goods until this invoice is paid. Please expedite immediately.', false),
    ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, we have submitted our registration documents. Please review.', false),
    ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'portal', 'vendor', '30000000-0000-0000-0000-000000000001', 'Hello, I need to check the status of invoice #INV-2024-9921. We have uploaded the GRN as requested.', false),
    ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'portal', 'internal', NULL, 'GRN received and verified. Proceeding with 3-way match.', true),
    ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'email', 'vendor', '30000000-0000-0000-0000-000000000001', 'The invoice amount matches the PO. Please proceed with payment.', false),
    ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', 'whatsapp', 'vendor', '30000000-0000-0000-0000-000000000002', 'Can you provide more details about the discrepancy?', false),
    ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', 'portal', 'internal', NULL, 'Payment has been approved and will be processed within 3 business days.', true),
    ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000006', 'portal', 'ai', NULL, 'Payment approval workflow initiated. Awaiting finance team review.', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. INVOICES (Shadow Ledger) - if not exists
-- ============================================================================
INSERT INTO vmp_invoices (id, vendor_id, company_id, invoice_num, invoice_date, amount, currency_code, status, source_system, po_ref, grn_ref, due_date)
VALUES 
    ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'INV-2024-9921', '2024-12-15', 15000.00, 'SGD', 'pending', 'manual', 'PO-442', NULL, '2025-01-15'),
    ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'INV-2024-8800', '2024-12-10', 25000.00, 'MYR', 'matched', 'manual', 'PO-443', 'GRN-001', '2025-01-10'),
    ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'INV-2024-7700', '2024-12-05', 18000.50, 'SGD', 'disputed', 'manual', 'PO-444', 'GRN-002', '2025-01-05')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. PAYMENTS (Shadow Ledger) - if not exists
-- ============================================================================
INSERT INTO vmp_payments (id, vendor_id, company_id, payment_ref, payment_date, amount, currency_code, invoice_id, invoice_num, source_system, description)
VALUES 
    ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'PAY-2024-001', '2024-12-20', 25000.00, 'MYR', '70000000-0000-0000-0000-000000000002', 'INV-2024-8800', 'manual', 'Payment for Invoice INV-2024-8800')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Optional - for manual verification)
-- ============================================================================
-- Uncomment to verify data creation:
-- SELECT 'Tenants' as type, COUNT(*) as count FROM vmp_tenants
-- UNION ALL
-- SELECT 'Companies', COUNT(*) FROM vmp_companies
-- UNION ALL
-- SELECT 'Vendors', COUNT(*) FROM vmp_vendors
-- UNION ALL
-- SELECT 'Users', COUNT(*) FROM vmp_vendor_users
-- UNION ALL
-- SELECT 'Cases', COUNT(*) FROM vmp_cases
-- UNION ALL
-- SELECT 'Invoices', COUNT(*) FROM vmp_invoices
-- UNION ALL
-- SELECT 'Payments', COUNT(*) FROM vmp_payments
-- UNION ALL
-- SELECT 'Messages', COUNT(*) FROM vmp_messages
-- UNION ALL
-- SELECT 'Checklist Steps', COUNT(*) FROM vmp_checklist_steps;
-- 
-- Expected Results:
-- Tenants: 1
-- Companies: 2
-- Vendors: 2
-- Users: 3
-- Cases: 10
-- Invoices: 3
-- Payments: 1
-- Messages: 8
-- Checklist Steps: 9
-- ============================================================================

