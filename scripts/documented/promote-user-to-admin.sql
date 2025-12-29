-- Script: Promote User to Admin/Internal
-- Description: Updates dev@example.com to have internal/admin access
-- Run this in Supabase SQL Editor

-- ============================================================================
-- OPTION 1: Update Supabase Auth user_metadata (RECOMMENDED)
-- ============================================================================
-- This updates the auth.users table directly (requires service role access)
-- The system falls back to user_metadata.is_internal if vmp_vendor_users record doesn't exist

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{is_internal}',
    'true'::jsonb
)
WHERE email = 'dev@example.com';

-- ============================================================================
-- OPTION 2: Update vmp_vendor_users table (if user record exists)
-- ============================================================================
-- Only run this if the user exists in vmp_vendor_users table

UPDATE vmp_vendor_users 
SET is_internal = true 
WHERE email = 'dev@example.com';

-- ============================================================================
-- OPTION 3: Create user record in vmp_vendor_users (if user doesn't exist)
-- ============================================================================
-- Only run this if user doesn't exist in vmp_vendor_users but exists in auth.users
-- You'll need to provide a vendor_id - use a default/seed vendor ID

-- First, get a vendor_id (use the first vendor or a seed vendor)
-- Then insert the user record:
/*
INSERT INTO vmp_vendor_users (
    id,
    email,
    display_name,
    vendor_id,
    is_internal,
    is_active,
    user_tier
)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
    (SELECT id FROM vmp_vendors LIMIT 1), -- Use first vendor or specific vendor_id
    true, -- is_internal = true
    true, -- is_active = true
    'institutional' -- user_tier
FROM auth.users
WHERE email = 'dev@example.com'
AND NOT EXISTS (
    SELECT 1 FROM vmp_vendor_users WHERE email = 'dev@example.com'
);
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check Supabase Auth user metadata
SELECT 
    id,
    email,
    raw_user_meta_data->>'is_internal' as is_internal_metadata,
    raw_user_meta_data->>'display_name' as display_name
FROM auth.users 
WHERE email = 'dev@example.com';

-- Check vmp_vendor_users table (if record exists)
SELECT 
    id,
    email,
    display_name,
    vendor_id,
    is_internal,
    is_active,
    user_tier
FROM vmp_vendor_users 
WHERE email = 'dev@example.com';

-- Expected results:
-- 1. auth.users.raw_user_meta_data->>'is_internal' should be 'true'
-- 2. vmp_vendor_users.is_internal should be true (if record exists)

